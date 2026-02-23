import React, { useEffect, useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

type FeedbackEntry = {
  id: string;
  name: string;
  email: string;
  message: string;
  ts: number;
};

type FeedbackModalProps = {
  visible: boolean;
  onClose: () => void;
  storageKey: string;
};

export default function FeedbackModal({ visible, onClose, storageKey }: FeedbackModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [stored, setStored] = useState<FeedbackEntry[]>([]);

  useEffect(() => {
    if (visible) {
      (async () => {
        const s = await AsyncStorage.getItem(storageKey);
        setStored(s ? (JSON.parse(s) as FeedbackEntry[]) : []);
      })();
    } else {
      // clear fields
      setName("");
      setEmail("");
      setMessage("");
    }
  }, [visible, storageKey]);

  async function submit() {
    if (!message.trim()) return Alert.alert("Please write feedback first.");
    const entry: FeedbackEntry = {
      id: Date.now().toString(),
      name,
      email,
      message,
      ts: Date.now(),
    };
    const updated = [entry, ...stored];
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    setStored(updated);
    Alert.alert("Thanks!", "Your feedback was saved locally. You can share it if you want.");
    setName("");
    setEmail("");
    setMessage("");
  }

  async function exportFeedback() {
    try {
      const path = FileSystem.documentDirectory + `feedback_export_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(stored, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(path);
    } catch (e) {
      console.log("export feedback err", e);
      Alert.alert("Error", "Could not export feedback.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Feedback & Support</Text>
          <Text style={styles.subtitle}>Send feedback or export saved feedback for support.</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name (optional)"
            placeholderTextColor="#7b8086"
            style={styles.input}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email (optional)"
            placeholderTextColor="#7b8086"
            style={styles.input}
            keyboardType="email-address"
          />
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Your message"
            placeholderTextColor="#7b8086"
            style={[styles.input, { height: 100 }]}
            multiline
          />

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
            <TouchableOpacity onPress={submit}>
              <Text style={{ color: "#9aa0a6" }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={exportFeedback}>
              <Text style={{ color: "#2D8BFF" }}>Export</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 12, alignItems: "center" }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <Text style={{ color: "#fff" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    width: "92%",
    backgroundColor: "#0f1113",
    padding: 18,
    borderRadius: 12,
    borderColor: "#222",
    borderWidth: 1,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#8a8f95", marginTop: 6, marginBottom: 12 },
  input: {
    backgroundColor: "#151516",
    color: "#fff",
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderColor: "#222",
    borderWidth: 1,
  },
});
