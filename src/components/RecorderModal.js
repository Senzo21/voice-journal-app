import React, { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";

export default function RecorderModal({ visible, onClose, onSave }) {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);

  // 🟦 FUNCTIONALITY CHANGE — title state so user can name recording
  const [title, setTitle] = useState("");

  useEffect(()=>{
    return ()=>{
      if(recording) {
        recording.stopAndUnloadAsync().catch(()=>{});
      }
    };
  },[recording]);

  async function start() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if(!perm.granted) { Alert.alert("Permission required","Please allow microphone access."); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS:true, playsInSilentModeIOS:true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
    } catch(e){ Alert.alert("Error","Could not start recording."); }
  }

  async function stopAndSave() {
    try {
      setProcessing(true);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      setIsRecording(false);
      setRecording(null);

      // 🟦 FUNCTIONALITY CHANGE — pass title along with uri & duration
      onSave(uri, status.durationMillis || 0, title && title.trim() ? title.trim() : "Voice Note");

      setProcessing(false);
      onClose();
      // reset title for next recording
      setTitle("");
    } catch(e){ setProcessing(false); Alert.alert("Error","Could not save recording."); }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>New Voice Note</Text>
          <Text style={styles.sub}>Add a title (optional) and tap record. Save will store locally.</Text>

          {/* 🟧 UI + 🟦 FUNCTIONALITY — Title input so user names the note */}
          <TextInput
            placeholder="Enter title..."
            placeholderTextColor="#8a8f95"
            value={title}
            onChangeText={setTitle}
            style={styles.titleInput}
          />

          <View style={{marginTop:10, alignItems:"center"}}>
            <TouchableOpacity onPress={isRecording ? stopAndSave : start} style={[styles.recBtn, isRecording && {backgroundColor:"#d32f2f"}]}>
              <Ionicons name={isRecording ? "stop" : "mic"} size={48} color="#fff" />
            </TouchableOpacity>
            {processing && <ActivityIndicator style={{marginTop:12}} />}
          </View>

          <View style={{marginTop:18, flexDirection:"row", justifyContent:"space-between"}}>
            <TouchableOpacity onPress={() => { if(isRecording){ stopAndSave(); } else { setTitle(""); onClose(); } }}><Text style={{color:"#9aa0a6"}}>Close</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { if(isRecording) stopAndSave(); else { if(title.trim()){ /* nothing */ } onClose(); } }}><Text style={{color:"#1e88ff"}}>Done</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"center", alignItems:"center" },
  card: { width:"90%", backgroundColor:"#0f0f10", padding:20, borderRadius:14, borderWidth:1, borderColor:"rgba(255,255,255,0.04)", shadowColor:"#000", shadowOpacity:0.3, shadowRadius:8 },
  title: { fontSize:20, color:"#fff", fontWeight:"800" },
  sub: { color:"#9aa0a6", marginTop:8, marginBottom:12 },

  // 🟧 UI CHANGE — title input style (glassy / modern)
  titleInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.02)",
    color: "#fff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)"
  },

  recBtn: { marginTop:10, width:120, height:120, borderRadius:60, backgroundColor:"#1e88ff", alignItems:"center", justifyContent:"center", shadowColor:"#1e88ff", shadowRadius:10, shadowOpacity:0.45 }
});
