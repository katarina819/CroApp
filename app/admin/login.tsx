// app/admin/login.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../config/api";

export default function AdminLoginScreen() {
  const [username, setUsername] = useState(""); // Promijenjeno iz email u username
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Greška", "Molimo unesite korisničko ime i lozinku");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Provjera: da li je korisnik admin prema username-u
        // Admin username je "admin_cromap"
        const isAdmin =
          username === "admin_cromap" || data.username === "admin_cromap";

        if (isAdmin) {
          await AsyncStorage.setItem("adminToken", data.token);
          await AsyncStorage.setItem("adminUsername", username);
          router.replace("/adminn/dashboard");
        } else {
          Alert.alert("Pristup odbijen", "Nemate administratorske ovlasti");
        }
      } else {
        Alert.alert("Greška", data.message || "Prijava nije uspjela");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Greška", "Ne mogu se spojiti na server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Admin logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="shield-checkmark" size={60} color="#667eea" />
            </View>
            <Text style={styles.title}>Admin Panel</Text>
            <Text style={styles.subtitle}>Prijava za administratore</Text>
          </View>

          {/* Forma */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#999" />
              <TextInput
                style={styles.input}
                placeholder="Korisničko ime"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" />
              <TextInput
                style={styles.input}
                placeholder="Lozinka"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Prijavi se</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sigurnosna napomena */}
          <Text style={styles.securityNote}>
            Ovo je administratorski pristup. Sve radnje se bilježe.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f0f0ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333",
  },
  loginButton: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  securityNote: {
    textAlign: "center",
    fontSize: 12,
    color: "#999",
    marginTop: 24,
  },
});
