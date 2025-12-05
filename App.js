import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Alert, Animated, Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import RecorderModal from "./src/components/RecorderModal";
import NoteItem from "./src/components/NoteItem";
import uuid from 'react-native-uuid';
import sample1 from "./assets/sample1.wav";
import sample2 from "./assets/sample2.wav";

const VOICE_DIR = FileSystem.documentDirectory + "voiceNotes/";
const STORAGE_KEY = "voice_notes_v1";

export default function App() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [recVisible, setRecVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    (async ()=>{
      await FileSystem.makeDirectoryAsync(VOICE_DIR, { intermediates: true });
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if(!saved) {
        // copy sample assets into documentDirectory and create initial notes
        try {
          const dest1 = VOICE_DIR + "sample1.wav";
          const dest2 = VOICE_DIR + "sample2.wav";
          // safe copy, ignore errors if already present
          await FileSystem.copyAsync({ from: AssetToUri(sample1), to: dest1 }).catch(()=>{});
          await FileSystem.copyAsync({ from: AssetToUri(sample2), to: dest2 }).catch(()=>{});
          const now = Date.now();
          const initial = [
            { id: uuid.v4(), title: "Meeting Notes", uri: dest1, createdAt: now - 1000*60*60*24*2, duration:120000 },
            { id: uuid.v4(), title: "Grocery List", uri: dest2, createdAt: now - 1000*60*60*24*3, duration:65000 },
            { id: uuid.v4(), title: "Lecture", uri: dest1, createdAt: now - 1000*60*60*24*4, duration:260000 },
            { id: uuid.v4(), title: "Reminder", uri: dest2, createdAt: now - 1000*60*60*24*5, duration:45000 }
          ];
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
          setNotes(initial);
          return;
        } catch(e){ console.log("initial copy error", e); }
      } else {
        setNotes(JSON.parse(saved));
      }
    })();
  },[]);

  // Helper to get local uri for asset (works with packager or file)
  function AssetToUri(mod) {
    // mod may be a number or object depending on bundler; handle both by checking structure
    if(typeof mod === "string") return mod;
    try {
      return mod;
    } catch(e){ return mod; }
  }

  async function saveNotes(list) {
    setNotes(list);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function formattedDate(ts) {
    return new Date(ts).toLocaleString();
  }

  function filtered() {
    if(!search) return notes;
    const s = search.toLowerCase();
    return notes.filter(n=> (n.title||"").toLowerCase().includes(s) || formattedDate(n.createdAt).toLowerCase().includes(s));
  }

  // 🟦 FUNCTIONALITY CHANGE — accept a title from the recorder
  async function addNoteFromRecording(uri, duration, title) {
    try {
      const id = uuid.v4();
      const ext = uri.split(".").pop();
      const dest = VOICE_DIR + id + "." + ext;
      await FileSystem.copyAsync({ from: uri, to: dest });
      // 🟦 FUNCTIONALITY CHANGE — use user-provided title (fallback to "Voice Note")
      const note = { id, title: title || "Voice Note", uri: dest, createdAt: Date.now(), duration };
      const updated = [note, ...notes];
      await saveNotes(updated);
    } catch(e){ console.log("add note error", e); Alert.alert("Error","Could not add the recording."); }
  }

  async function deleteNote(id) {
    const note = notes.find(n=>n.id===id);
    if(!note) return;
    try { await FileSystem.deleteAsync(note.uri, { idempotent: true }); } catch(e){}
    const filteredList = notes.filter(n=>n.id!==id);
    await saveNotes(filteredList);
  }

  async function backup() {
    try {
      const json = JSON.stringify(notes);
      const path = FileSystem.documentDirectory + "voice_backup_" + Date.now() + ".json";
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path);
    } catch(e){ Alert.alert("Backup failed", String(e)); }
  }

  async function restore() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/json" });
      if(res.type !== "success") return;
      const content = await FileSystem.readAsStringAsync(res.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const imported = JSON.parse(content);
      // simple restore: merge items that have file URIs available in app directory
      const available = imported.filter(i=> i.uri && i.uri.includes("voiceNotes/"));
      const merged = [...available, ...notes];
      await saveNotes(merged);
      Alert.alert("Restore", "Imported notes. Make sure audio files exist in the app's voiceNotes folder.");
    } catch(e){ Alert.alert("Restore failed", String(e)); }
  }

  // FAB animation
  function animateFab() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 180, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 180, useNativeDriver: true })
    ]).start();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Journal</Text>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color="#9aa0a6" />
        <TextInput placeholder="Search" placeholderTextColor="#6f767a" style={styles.searchInput} value={search} onChangeText={setSearch} />
        <TouchableOpacity onPress={backup} style={{marginLeft:8}}><Ionicons name="cloud-upload" size={22} color="#9aa0a6" /></TouchableOpacity>
        <TouchableOpacity onPress={restore} style={{marginLeft:12}}><Ionicons name="cloud-download" size={22} color="#9aa0a6" /></TouchableOpacity>
      </View>

      <FlatList data={filtered()} keyExtractor={i=>i.id} style={{marginTop:12}} contentContainerStyle={{paddingBottom:120}} renderItem={({item})=> (
        <NoteItem note={item} onDelete={()=>{
          Alert.alert("Delete","Delete this note?",[{text:"Cancel",style:"cancel"},{text:"Delete",style:"destructive", onPress: ()=> deleteNote(item.id)}]);
        }} />
      )} ListEmptyComponent={<View style={{padding:24}}><Text style={{color:"#9ba0a6"}}>No voice notes yet — tap the mic to record.</Text></View>} />

      <Animated.View style={[styles.fab, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity onPress={()=>{ animateFab(); setRecVisible(true); }} style={{alignItems:"center"}}>
          <Ionicons name="mic" size={28} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* 🟦 FUNCTIONALITY: RecorderModal now returns title too */}
      <RecorderModal visible={recVisible} onClose={()=>setRecVisible(false)} onSave={addNoteFromRecording} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:"#0f0f10", paddingTop:60, paddingHorizontal:18 },

  // 🟧 UI CHANGE — larger, bolder header for more premium look
  title: { fontSize:38, fontWeight:"900", color:"#fff", marginBottom:22, letterSpacing:0.4 },

  // 🟧 UI CHANGE — frosted / glassy search bar with subtle shadow
  searchRow: {
    flexDirection:"row",
    alignItems:"center",
    backgroundColor:"rgba(255,255,255,0.04)",
    padding:12,
    borderRadius:16,
    borderWidth:1,
    borderColor:"rgba(255,255,255,0.06)",
    shadowColor:"#000",
    shadowOpacity:0.3,
    shadowRadius:6,
    shadowOffset:{ width:0, height:3 }
  },

  searchInput: { flex:1, marginLeft:8, color:"#fff" },

  // 🟧 UI CHANGE — glowing, larger FAB centered at bottom
  fab: {
    position:"absolute",
    bottom:32,
    alignSelf:"center",
    backgroundColor:"#1e88ff",
    width:78,
    height:78,
    borderRadius:39,
    alignItems:"center",
    justifyContent:"center",
    shadowColor:"#1e88ff",
    shadowRadius:14,
    shadowOpacity:0.6,
    shadowOffset:{ height:0, width:0 },
    elevation:12
  }
});
