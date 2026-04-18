// app/login.tsx  — VARA redesign (logika nepromijenjena)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { API_ENDPOINTS } from "./config/api";

// ─── Inline VARA shield logo (no extra dependency) ────────────────────────────
function VaraShield({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
      <Defs>
        <LinearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#3A7D1F" />
          <Stop offset="100%" stopColor="#1B3F0E" />
        </LinearGradient>
        <LinearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#E8EEEE" />
          <Stop offset="50%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#B8C4C2" />
        </LinearGradient>
        <LinearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#D1DADB" />
          <Stop offset="45%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#9AA9A7" />
        </LinearGradient>
      </Defs>
      {/* Shield */}
      <Path
        d="M 50 5 C 35 5, 10 12, 10 12 L 10 55 C 10 82, 30 100, 50 110 C 70 100, 90 82, 90 55 L 90 12 C 90 12, 65 5, 50 5 Z"
        fill="url(#sg)"
        stroke="url(#bg2)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Inner bevel */}
      <Path
        d="M 50 10 C 37 10, 16 16, 16 16 L 16 55 C 16 80, 33 96, 50 105 C 67 96, 84 80, 84 55 L 84 16 C 84 16, 63 10, 50 10 Z"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1.5"
      />
      {/* V letter */}
      <Path
        d="M 29 26 L 38 26 L 50 62 L 62 26 L 71 26 L 52 74 L 50 77 L 48 74 Z"
        fill="url(#vg)"
      />
      {/* Nib */}
      <Path d="M 48 74 L 50 80 L 52 74 Z" fill="#9AA9A7" />
      {/* Highlight */}
      <Path
        d="M 35 12 C 28 13, 18 17, 16 19"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  // ── state (logika nepromijenjena) ──
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Greška", "Molimo unesite korisničko ime i lozinku");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (response.ok) {
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("userId", data.userId.toString());
        await AsyncStorage.setItem("firstName", data.firstName);
        await AsyncStorage.setItem("lastName", data.lastName);
        Alert.alert("Dobrodošli!", `${data.firstName}`, [
          { text: "Nastavi", onPress: () => router.replace("/(tabs)") },
        ]);
      } else {
        Alert.alert("Greška", data.message || "Prijava nije uspjela.");
      }
    } catch {
      Alert.alert("Greška", "Došlo je do greške. Pokušajte ponovno.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1B3F0E" />

      {/* Dark green header band */}
      <View style={s.headerBand} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Logo + wordmark */}
        <View style={s.logoSection}>
          <VaraShield size={80} />
          <Text style={s.appName}>VARA</Text>
          <Text style={s.tagline}>Otkrijte svako mjesto</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Prijava</Text>

          {/* Username */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>KORISNIČKO IME</Text>
            <TextInput
              style={[s.input, usernameFocused && s.inputFocused]}
              placeholder="Unesite korisničko ime"
              placeholderTextColor="#9AA9A7"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoFocus
              editable={!isLoading}
              onFocus={() => setUsernameFocused(true)}
              onBlur={() => setUsernameFocused(false)}
            />
          </View>

          {/* Password */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>LOZINKA</Text>
            <TextInput
              style={[s.input, passwordFocused && s.inputFocused]}
              placeholder="Unesite lozinku"
              placeholderTextColor="#9AA9A7"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          {/* Forgot password */}
          <TouchableOpacity
            style={s.forgotWrap}
            onPress={() => router.push("/forgot-password")}
          >
            <Text style={s.forgotText}>Zaboravili ste lozinku?</Text>
          </TouchableOpacity>

          {/* Login button */}
          <TouchableOpacity
            style={[s.btn, isLoading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>Prijavi se</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>ili</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Register */}
          <TouchableOpacity
            style={s.outlineBtn}
            onPress={() => router.push("/register")}
            activeOpacity={0.85}
          >
            <Text style={s.outlineBtnText}>Kreiraj račun</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom note */}
        <Text style={s.bottomNote}>
          Registracijom prihvaćate Uvjete i Pravila privatnosti
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const GREEN = "#2D6418";
const GREEN_DARK = "#1B3F0E";
const GREEN_LIGHT = "#3A7D1F";
const SILVER = "#9AA9A7";
const SILVER_LIGHT = "#E8EEEE";
const TEXT = "#142F09";
const MUTED = "#5C6765";

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F2EDE4", // cream/terrain beige
  },
  headerBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: GREEN_DARK,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  appName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 6,
    marginTop: 10,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    shadowColor: GREEN_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  fieldWrap: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: MUTED,
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: SILVER_LIGHT,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D1DADB",
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: TEXT,
  },
  inputFocused: {
    borderColor: GREEN,
    backgroundColor: "#FFFFFF",
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginBottom: 22,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    color: GREEN,
    fontWeight: "500",
  },
  btn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: GREEN_DARK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  btnDisabled: {
    backgroundColor: SILVER,
    shadowOpacity: 0,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E8EEEE",
  },
  dividerText: {
    fontSize: 13,
    color: MUTED,
  },
  outlineBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: GREEN,
    paddingVertical: 15,
    alignItems: "center",
  },
  outlineBtnText: {
    color: GREEN,
    fontSize: 16,
    fontWeight: "600",
  },
  bottomNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    marginTop: 24,
  },
});
