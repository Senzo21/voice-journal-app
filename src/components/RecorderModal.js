import React, { useState, useEffect, useRef } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

export default function RecorderModal({ visible, onClose, onSave }) {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const waveAnim = useRef(new Animated.Value(1)).current;
  const waveAnim2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) startWaveAnimation();
    else stopWaveAnimation();
  }, [isRecording]);

  function startWaveAnimation() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1.6, duration: 500, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim2, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(waveAnim2, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }

  function stopWaveAnimation() {
    waveAnim.stopAnimation();
    waveAnim2.stopAnimation();
  }

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed", err);
    }
  }

  async function stopRecording() {
    if (!recording) return;

    setIsRecording(false);
    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    const status = await recording.getStatusAsync();
    const duration = status.durationMillis;

    onSave(uri, duration);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <Text style={styles.title}>Recording…</Text>

        {/* 🔊 Animated Sound Waves */}
        <View style={styles.waveContainer}>
          <Animated.View style={[styles.wave, { transform: [{ scale: waveAnim }] }]} />
          <Animated.View style={[styles.waveSecondary, { transform: [{ scale: waveAnim2 }] }]} />
        </View>

        <TouchableOpacity
          style={styles.btn}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons
            name={isRecording ? "stop-circle" : "mic"}
            size={45}
            color="#fff"
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
          <Text style={{ color: "#ccc" }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1, backgroundColor: "#000d", justifyContent: "center", alignItems: "center"
  },
  title: { color: "#fff", fontSize: 28, marginBottom: 40, fontWeight: "bold" },

  waveContainer: {
    width: 180, height: 180, justifyContent: "center", alignItems: "center"
  },

  wave: {
    width: 180, height: 180, borderRadius: 100,
    backgroundColor: "rgba(30,144,255,0.25)",
    position: "absolute",
  },
  waveSecondary: {
    width: 130, height: 130,
    borderRadius: 100,
    backgroundColor: "rgba(30,144,255,0.35)",
    position: "absolute",
  },

  btn: {
    marginTop: 40,
    backgroundColor: "#1890ff",
    padding: 18,
    borderRadius: 50,
  }
});
