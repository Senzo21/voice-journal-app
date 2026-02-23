import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import { Audio } from "expo-av";
import type { AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import RecorderModal from "./src/components/RecorderModal";
import NoteItem from "./src/components/NoteItem";
import FeedbackModal from "./src/components/FeedbackModal";
import uuid from "react-native-uuid";
import type { Note } from "./src/types";

const VOICE_DIR = FileSystem.documentDirectory + "voiceNotes/";
const STORAGE_KEY = "voice_notes_final_v1";
const FEEDBACK_KEY = "voice_feedback_v1";

type PlayOptions = {
  reverse?: boolean;
  requestedRate?: number;
};

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [recVisible, setRecVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Single global sound instance so playback does not overlap
  const soundRef = useRef<Audio.Sound | null>(null);
  // keep track of currently playing note id
  const [playingId, setPlayingId] = useState<string | null>(null);
  // playback progress state (0..1)
  const [progress, setProgress] = useState(0);
  // playback rate
  const [rate, setRate] = useState(1.0);

  useEffect(() => {
    (async () => {
      await FileSystem.makeDirectoryAsync(VOICE_DIR, { intermediates: true }).catch(() => {});
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setNotes(JSON.parse(saved) as Note[]);
      } else {
        setNotes([]);
      }
    })();
    // cleanup on unmount
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  async function saveNotes(list: Note[]) {
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
    setNotes(sorted);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  }

  function filtered() {
    if (!search) return notes;
    const s = search.toLowerCase();
    return notes.filter(
      (n) =>
        (n.title || "").toLowerCase().includes(s) ||
        new Date(n.createdAt).toLocaleString().toLowerCase().includes(s)
    );
  }

  // Add note from recorder (uri points to temp file). App moves file into voiceNotes dir.
  async function addNoteFromRecording(tempUri: string, duration: number, title?: string) {
    try {
      const id = String(uuid.v4());
      const ext = tempUri.split(".").pop() || "m4a";
      const dest = VOICE_DIR + id + "." + ext;

      try {
        await FileSystem.moveAsync({ from: tempUri, to: dest });
      } catch (e) {
        await FileSystem.copyAsync({ from: tempUri, to: dest });
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
      }

      const note: Note = {
        id,
        title: title && title.trim() ? title.trim() : "Untitled Recording",
        uri: dest,
        createdAt: Date.now(),
        duration: duration || 0,
        // optionally you can add waveform data later
      };

      await saveNotes([note, ...notes]);
    } catch (e) {
      console.log("add note error", e);
      Alert.alert("Error", "Could not save the recording.");
    }
  }

  async function renameNote(id: string, newTitle: string) {
    const updated = notes.map((n) => (n.id === id ? { ...n, title: newTitle } : n));
    await saveNotes(updated);
  }

  async function deleteNote(id: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    try {
      await FileSystem.deleteAsync(note.uri, { idempotent: true });
    } catch (e) {
      console.log("file delete error", e);
    }
    const filteredList = notes.filter((n) => n.id !== id);
    await saveNotes(filteredList);
    // if we were playing it, stop
    if (playingId === id) {
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch {}
        soundRef.current = null;
      }
      setPlayingId(null);
      setProgress(0);
    }
  }

  // Try to find a reversed file for a note:
  // convention: if note.uri is .../abcd.m4a, reversed file is .../abcd_rev.m4a
  function reversedUriFor(note: Note) {
    if (!note.uri) return null;
    const i = note.uri.lastIndexOf(".");
    const base = note.uri.slice(0, i);
    const ext = note.uri.slice(i + 1);
    return base + "_rev." + ext;
  }

  // Play/pause with playback speed and support for playing reversed file if requested.
  // Note: negative playback rate (true reverse) is not supported by expo-av.
  // This function will attempt to play a pre-created reversed file if reverse=true and that file exists.
  async function playPause(note: Note, { reverse = false, requestedRate = 1.0 }: PlayOptions = {}) {
    try {
      // If another note is playing, stop it first
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        }
        soundRef.current = null;
        setPlayingId(null);
        setProgress(0);
      }

      // determine uri to play
      let uriToPlay = note.uri;
      if (reverse) {
        const rev = reversedUriFor(note);
        if (rev) {
          // check existence
          const info = await FileSystem.getInfoAsync(rev);
          if (info.exists) {
            uriToPlay = rev;
          } else {
            Alert.alert(
              "Reversed file not found",
              "To play audio backward, a reversed audio file must exist. You can generate it offline and place it next to the original with a `_rev` suffix."
            );
            // fallback to normal
            uriToPlay = note.uri;
          }
        }
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: uriToPlay },
        { shouldPlay: true, rate: requestedRate, shouldCorrectPitch: true }
      );
      soundRef.current = sound;
      setPlayingId(note.id);
      setRate(requestedRate);

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          return;
        }
        // update progress
        if (status.durationMillis && status.positionMillis != null) {
          setProgress(status.positionMillis / status.durationMillis);
        }
        if (status.didJustFinish) {
          // finished, cleanup
          soundRef.current && soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
          setPlayingId(null);
          setProgress(0);
        }
      });
    } catch (e) {
      console.log("playPause err", e);
      Alert.alert("Playback error", "Could not play the note.");
    }
  }

  async function setPlaybackSpeed(newRate: number) {
    setRate(newRate);
    if (soundRef.current) {
      try {
        await soundRef.current.setRateAsync(newRate, true);
      } catch (e) {
        console.log("setRate err", e);
      }
    }
  }

  function animateFab() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 160, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }

  // backup / restore
  async function backup() {
    try {
      const json = JSON.stringify(notes);
      const path = FileSystem.documentDirectory + `voice_backup_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path);
    } catch (e) {
      console.log("backup error", e);
      Alert.alert("Backup failed", String(e));
    }
  }

  async function restore() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/json" });
      if (res.type !== "success") return;
      const uri =
        "uri" in res ? res.uri : res.assets && res.assets.length > 0 ? res.assets[0].uri : null;
      if (!uri) return;
      const content = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const imported = JSON.parse(content) as Note[];
      const valid = imported.filter((i) => i.uri && i.uri.includes("voiceNotes/"));
      await saveNotes([...valid, ...notes]);
      Alert.alert("Restore", "Imported metadata. Ensure audio files exist in voiceNotes folder.");
    } catch (e) {
      console.log("restore err", e);
      Alert.alert("Restore failed", String(e));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Voice Journal</Text>

      <View style={styles.topRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9aa0a6" />
          <TextInput
            placeholder="Search by title or date"
            placeholderTextColor="#6f767a"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={backup}>
          <Ionicons name="cloud-upload" size={18} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={restore}>
          <Ionicons name="cloud-download" size={18} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { marginLeft: 8 }]}
          onPress={() => setFeedbackVisible(true)}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered()}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 160, paddingTop: 12 }}
        renderItem={({ item }) => (
          <NoteItem
            note={item}
            playing={playingId === item.id}
            progress={playingId === item.id ? progress : 0}
            onPlay={(opts = {}) => playPause(item, opts)}
            onPause={async () => {
              if (soundRef.current) {
                try {
                  await soundRef.current.pauseAsync();
                  setPlayingId(null);
                } catch {}
              }
            }}
            onRename={(newTitle) => renameNote(item.id, newTitle)}
            onDelete={() =>
              Alert.alert("Delete recording", "Delete this voice note?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteNote(item.id) },
              ])
            }
            setPlaybackSpeed={setPlaybackSpeed}
            currentRate={rate}
            requestPlay={(reverse = false) => playPause(item, { reverse, requestedRate: rate })}
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 24 }}>
            <Text style={{ color: "#8a8f95" }}>No notes yet - tap the mic to create one.</Text>
          </View>
        }
      />

      <Animated.View style={[styles.fab, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          onPress={() => {
            animateFab();
            setRecVisible(true);
          }}
        >
          <Ionicons name="mic" size={28} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <RecorderModal
        visible={recVisible}
        onClose={() => setRecVisible(false)}
        onSave={addNoteFromRecording}
      />

      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        storageKey={FEEDBACK_KEY}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1012", paddingHorizontal: 18, paddingTop: 56 },
  header: { color: "#fff", fontSize: 28, fontWeight: "800" },

  topRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },

  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151517",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },

  searchInput: { marginLeft: 8, color: "#fff", flex: 1, fontSize: 15 },

  iconBtn: {
    marginLeft: 10,
    backgroundColor: "#1f2230",
    padding: 10,
    borderRadius: 10,
  },

  fab: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    backgroundColor: "#1e88ff",
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    elevation: 12,
  },
});
