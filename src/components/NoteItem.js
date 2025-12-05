import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

export default function NoteItem({ note, onDelete }) {
  const soundRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  async function togglePlay() {
    try {
      if(!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: note.uri });
        soundRef.current = sound;
        await sound.playAsync();
        setPlaying(true);
        sound.setOnPlaybackStatusUpdate(status => {
          if(status.didJustFinish) {
            setPlaying(false);
            soundRef.current && soundRef.current.unloadAsync().catch(()=>{});
            soundRef.current = null;
          }
        });
      } else {
        const status = await soundRef.current.getStatusAsync();
        if(status.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setPlaying(true);
        }
      }
    } catch(e){ console.log("play err", e); }
  }

  return (
    <View style={styles.card}>
      <View style={{flex:1}}>
        <Text style={styles.title}>{note.title}</Text>
        <Text style={styles.sub}>{new Date(note.createdAt).toLocaleString()} · {Math.round((note.duration||0)/1000)}s</Text>
      </View>

      <View style={{flexDirection:"row", alignItems:"center"}}>
        <TouchableOpacity onPress={togglePlay} style={{marginRight:12}}>
          <Ionicons name={playing ? "pause-circle" : "play-circle"} size={36} color="#e6eef8" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete}>
          <Ionicons name="trash" size={28} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 🟧 UI CHANGE — modern audio card with shadow and subtle border
  card: {
    flexDirection:"row",
    alignItems:"center",
    backgroundColor:"#121212",
    padding:16,
    borderRadius:14,
    marginBottom:14,
    borderWidth:1,
    borderColor:"rgba(255,255,255,0.03)",
    shadowColor:"#000",
    shadowOpacity:0.3,
    shadowRadius:8,
    shadowOffset:{ width:0, height:3 }
  },
  title: { color:"#fff", fontSize:18, fontWeight:"800", marginBottom:4 },
  sub: { color:"#9aa0a6", marginTop:2 }
});
