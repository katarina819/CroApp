// app/register.tsx  — VARA redesign (logika iz originala nepromijenjena)
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

// ─── Inline mini shield ───────────────────────────────────────────────────────
function MiniShield() {
  return (
    <Svg width={32} height={37} viewBox="0 0 100 115">
      <Defs>
        <LinearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#3A7D1F" />
          <Stop offset="100%" stopColor="#1B3F0E" />
        </LinearGradient>
        <LinearGradient id="vg2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#E8EEEE" />
          <Stop offset="100%" stopColor="#B8C4C2" />
        </LinearGradient>
      </Defs>
      <Path
        d="M 50 5 C 35 5, 10 12, 10 12 L 10 55 C 10 82, 30 100, 50 110 C 70 100, 90 82, 90 55 L 90 12 C 90 12, 65 5, 50 5 Z"
        fill="url(#sg2)"
        stroke="#D1DADB"
        strokeWidth="3"
      />
      <Path
        d="M 29 26 L 38 26 L 50 62 L 62 26 L 71 26 L 52 74 L 50 77 L 48 74 Z"
        fill="url(#vg2)"
      />
    </Svg>
  );
}

interface RegisterData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  birthDate: string;
  email?: string | null;
  phone?: string | null;
}

export default function RegisterScreen() {
  // ── state (originalna logika) ──
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    birthDate: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (name: string, value: string) =>
    setForm({ ...form, [name]: value });

  const validateForm = () => {
    if (!form.firstName.trim()) {
      Alert.alert("Greška", "Unesite ime");
      return false;
    }
    if (!form.lastName.trim()) {
      Alert.alert("Greška", "Unesite prezime");
      return false;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      Alert.alert("Greška", "Unesite email ili telefon");
      return false;
    }
    if (form.email.trim() && !form.email.includes("@")) {
      Alert.alert("Greška", "Neispravan email");
      return false;
    }
    if (!form.username.trim()) {
      Alert.alert("Greška", "Unesite korisničko ime");
      return false;
    }
    if (!/^[a-zA-Z0-9]+$/.test(form.username)) {
      Alert.alert("Greška", "Samo slova i brojevi");
      return false;
    }
    if (form.password.length < 6) {
      Alert.alert("Greška", "Lozinka min 6 znakova");
      return false;
    }
    if (!form.birthDate) {
      Alert.alert("Greška", "Unesite datum rođenja");
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const dataToSend: RegisterData = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password,
        birthDate: form.birthDate,
        username: form.username.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      };
      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      if (response.ok) {
        Alert.alert("Uspjeh!", "Registracija uspješna!", [
          { text: "Prijava", onPress: () => router.push("/login") },
        ]);
      } else {
        const text = await response.text();
        Alert.alert("Greška", text || "Registracija nije uspjela.");
      }
    } catch {
      Alert.alert("Greška", "Provjeri internetsku vezu.");
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
      <View style={s.headerBand} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          <MiniShield />
          <View>
            <Text style={s.appName}>VARA</Text>
            <Text style={s.headerSub}>Kreiranje računa</Text>
          </View>
        </View>

        {/* Card */}
        <View style={s.card}>
          {/* Name row */}
          <View style={s.row}>
            <View style={[s.fieldWrap, s.half]}>
              <Text style={s.label}>IME *</Text>
              <TextInput
                style={s.input}
                placeholder="Vaše ime"
                placeholderTextColor="#9AA9A7"
                value={form.firstName}
                onChangeText={(v) => handleChange("firstName", v)}
                editable={!isLoading}
              />
            </View>
            <View style={[s.fieldWrap, s.half]}>
              <Text style={s.label}>PREZIME *</Text>
              <TextInput
                style={s.input}
                placeholder="Vaše prezime"
                placeholderTextColor="#9AA9A7"
                value={form.lastName}
                onChangeText={(v) => handleChange("lastName", v)}
                editable={!isLoading}
              />
            </View>
          </View>

          <Field
            label="EMAIL"
            placeholder="vaš@email.com"
            value={form.email}
            onChangeText={(v) => handleChange("email", v)}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
            optional
          />

          <Field
            label="TELEFON"
            placeholder="+385 99 123 4567"
            value={form.phone}
            onChangeText={(v) => handleChange("phone", v)}
            keyboardType="phone-pad"
            editable={!isLoading}
            optional
          />

          <Field
            label="KORISNIČKO IME *"
            placeholder="Odaberite username"
            value={form.username}
            onChangeText={(v) => handleChange("username", v)}
            autoCapitalize="none"
            editable={!isLoading}
          />

          <Field
            label="LOZINKA *"
            placeholder="Min. 6 znakova"
            value={form.password}
            onChangeText={(v) => handleChange("password", v)}
            secureTextEntry
            editable={!isLoading}
          />

          <Field
            label="DATUM ROĐENJA *"
            placeholder="YYYY-MM-DD"
            value={form.birthDate}
            onChangeText={(v) => handleChange("birthDate", v)}
            editable={!isLoading}
          />

          {/* Register button */}
          <TouchableOpacity
            style={[s.btn, isLoading && s.btnDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>Registriraj se</Text>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <TouchableOpacity
            style={s.linkWrap}
            onPress={() => router.push("/login")}
          >
            <Text style={s.linkText}>
              Već imate račun? <Text style={s.linkBold}>Prijavite se</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={s.bottomNote}>
          Registracijom prihvaćate Uvjete i Pravila privatnosti
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Reusable field ───────────────────────────────────────────────────────────
function Field(props: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  editable?: boolean;
  optional?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>
        {props.label}
        {props.optional && <Text style={s.optional}> (opcionalno)</Text>}
      </Text>
      <TextInput
        style={[s.input, focused && s.inputFocused]}
        placeholder={props.placeholder}
        placeholderTextColor="#9AA9A7"
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        editable={props.editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const GREEN = "#2D6418";
const GREEN_DARK = "#1B3F0E";
const TEXT = "#142F09";
const MUTED = "#5C6765";

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F2EDE4" },
  headerBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: GREEN_DARK,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 44,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
    paddingLeft: 4,
  },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 4,
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: GREEN_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  fieldWrap: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: MUTED,
    letterSpacing: 1,
    marginBottom: 6,
  },
  optional: { color: "#9AA9A7", fontWeight: "400" },
  input: {
    backgroundColor: "#F4F7F7",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D1DADB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT,
  },
  inputFocused: { borderColor: GREEN, backgroundColor: "#FFFFFF" },
  btn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
    shadowColor: GREEN_DARK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  btnDisabled: { backgroundColor: "#9AA9A7", shadowOpacity: 0 },
  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  linkWrap: { marginTop: 20, alignItems: "center" },
  linkText: { fontSize: 14, color: MUTED },
  linkBold: { color: GREEN, fontWeight: "600" },
  bottomNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 24,
  },
});
