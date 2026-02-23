import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Note } from "../types";

type PlayOptions = {
  reverse?: boolean;
};

type NoteItemProps = {
  note: Note;
  playing: boolean;
  progress?: number;
  onPlay?: (opts?: PlayOptions) => void | Promise<void>;
  onPause?: () => void | Promise<void>;
  onDelete?: () => void;
  onRename?: (newTitle: string) => void;
  setPlaybackSpeed?: (rate: number) => void;
  currentRate?: number;
  requestPlay?: (reverse?: boolean) => void | Promise<void>;
};

export default function NoteItem({
  note,
  playing,
  progress = 0,
  onPlay,
  onPause,
  onDelete,
  onRename,
  setPlaybackSpeed,
  currentRate = 1.0,
  requestPlay,
}: NoteItemProps) {
  const [renameVisible, setRenameVisible] = useState(false);
  const [newTitle, setNewTitle] = useState(note.title || "");
  const [speedMenuVisible, setSpeedMenuVisible] = useState(false);

  // waveform animation values - create N bars
  const BAR_COUNT = 18;
  const bars = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    // animate bars while playing or idle (subtle)
    let running = true;
    function animateLoop() {
      if (!running) return;
      const anims = bars.map((v) =>
        Animated.timing(v, {
          toValue: playing ? 0.2 + Math.random() * 0.8 : 0.05 + Math.random() * 0.15,
          duration: 300 + Math.random() * 500,
          useNativeDriver: false,
          easing: Easing.ease,
        })
      );
      Animated.parallel(anims).start(() => {
        if (running) animateLoop();
      });
    }
    animateLoop();
    return () => {
      running = false;
    };
  }, [playing, bars]);

  // progress bar animated width
  const progAnim = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(progAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start();
  }, [progress, progAnim]);

  // play/pause toggle handler
  const handlePlayPause = async () => {
    if (playing) {
      if (onPause) await onPause();
    } else {
      if (onPlay) await onPlay({ reverse: false });
    }
  };

  const handleReverse = async () => {
    // request playing reversed version (app will attempt to locate reversed file)
    if (requestPlay) await requestPlay(true);
  };

  return (
    <>
      <Pressable
        onLongPress={onDelete}
        delayLongPress={500}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1.0 }]}
      >
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{note.title}</Text>
            <Text style={styles.meta}>
              {new Date(note.createdAt).toLocaleString()} -{" "}
              {Math.round((note.duration || 0) / 1000)}s
            </Text>

            {/* progress bar */}
            <View style={styles.progressContainer}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>

            {/* waveform (simple animated bars) */}
            <View style={styles.waveRow}>
              {bars.map((v, i) => (
                <Animated.View
                  key={i}
                  style={{
                    width: 4,
                    height: v.interpolate({ inputRange: [0, 1], outputRange: [6, 40] }),
                    marginRight: 4,
                    backgroundColor: i % 2 === 0 ? "#3fb0ff" : "#79d1ff",
                    borderRadius: 2,
                    opacity: 0.95,
                  }}
                />
              ))}
            </View>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={handlePlayPause} style={{ marginRight: 10 }}>
              <Ionicons name={playing ? "pause-circle" : "play-circle"} size={36} color="#e6eef8" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setRenameVisible(true)} style={{ marginRight: 10 }}>
              <Ionicons name="pencil" size={22} color="#6fa7ff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleReverse} style={{ marginRight: 10 }}>
              <Ionicons name="swap-vertical" size={22} color="#ffd166" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setSpeedMenuVisible((s) => !s)}>
              <Text style={{ color: "#bfe0ff", fontWeight: "700" }}>{currentRate}x</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>

      {/* speed menu */}
      {speedMenuVisible && (
        <View style={styles.speedMenu}>
          {[1.0, 1.5, 2.0].map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => {
                setSpeedMenuVisible(false);
                if (setPlaybackSpeed) setPlaybackSpeed(r);
              }}
              style={styles.speedRow}
            >
              <Text
                style={{
                  color: r === currentRate ? "#fff" : "#bfbfbf",
                  fontWeight: r === currentRate ? "800" : "500",
                }}
              >
                {r}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* rename modal */}
      <Modal visible={renameVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rename Recording</Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              style={styles.renameInput}
              placeholder="Enter title"
              placeholderTextColor="#777"
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
              <TouchableOpacity onPress={() => setRenameVisible(false)}>
                <Text style={{ color: "#aaa" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (onRename) onRename(newTitle.trim() || note.title);
                  setRenameVisible(false);
                }}
              >
                <Text style={{ color: "#2D8BFF" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#111216",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#202227",
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  meta: { color: "#9aa0a6", marginTop: 6, marginBottom: 8 },

  controls: { alignItems: "center", marginLeft: 10 },

  progressContainer: {
    height: 4,
    backgroundColor: "#17181A",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 10,
    marginBottom: 8,
  },
  progressFill: { height: 4, backgroundColor: "#2D8BFF", width: "0%" },

  waveRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: "86%",
    backgroundColor: "#0f1113",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  renameInput: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#16171A",
    color: "#fff",
    borderWidth: 1,
    borderColor: "#222",
  },

  speedMenu: {
    position: "absolute",
    right: 18,
    top: 60,
    backgroundColor: "#0f1112",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#222",
  },
  speedRow: { paddingHorizontal: 14, paddingVertical: 8 },
});
