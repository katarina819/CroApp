import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { API_ENDPOINTS } from "./config/api";

export default function SetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (password.length < 6) {
      Alert.alert("Greška", "Lozinka mora imati najmanje 6 znakova.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Greška", "Lozinke se ne podudaraju.");
      return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(API_ENDPOINTS.SET_PASSWORD, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const needsBirthDate = await AsyncStorage.getItem("needsBirthDate");
        if (needsBirthDate === "true") {
          router.replace("/complete-profile");
        } else {
          router.replace("/(tabs)");
        }
      } else {
        Alert.alert("Greška", "Spremanje lozinke nije uspjelo.");
      }
    } catch {
      Alert.alert("Greška", "Provjeri internetsku vezu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Text style={s.title}>Postavi lozinku</Text>
      <Text style={s.subtitle}>
        Trebat će ti za prijavu putem korisničkog imena, bez obzira registrirala
        si se putem Googlea.
      </Text>

      <TextInput
        style={s.input}
        placeholder="Nova lozinka"
        placeholderTextColor="#9AA9A7"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={s.input}
        placeholder="Potvrdi lozinku"
        placeholderTextColor="#9AA9A7"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity
        style={[s.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.saveBtnText}>Spremi i nastavi</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1B3F0E",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 28,
    textAlign: "center",
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 14,
    color: "#142F09",
  },
  saveBtn: {
    backgroundColor: "#2D6418",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
