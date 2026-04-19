// app/register.tsx — VARA redesign v2 (puna zelena pozadina)
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

// ─── Mini shield za header ────────────────────────────────────────────────────
function MiniShield() {
  const shield = `M 100 8 L 28 38 L 18 55 L 18 128 C 18 182 56 218 100 232 C 144 218 182 182 182 128 L 182 55 L 172 38 Z`;
  const vShape = `M 40 68 L 68 68 L 100 158 L 132 68 L 160 68 L 112 172 L 100 176 L 88 172 Z`;
  const penNib = `M 100 62 L 114 100 L 100 140 L 86 100 Z`;

  return (
    <Svg width={36} height={44} viewBox="0 0 200 240">
      <Defs>
        <LinearGradient id="sbg2" x1="0.4" y1="0" x2="0.6" y2="1">
          <Stop offset="0%" stopColor="#2D6418" />
          <Stop offset="100%" stopColor="#142F09" />
        </LinearGradient>
        <LinearGradient id="sb2" x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0%" stopColor="#8A9A98" />
          <Stop offset="40%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#7A8A88" />
        </LinearGradient>
        <LinearGradient id="sv2" x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0%" stopColor="#D0DCDA" />
          <Stop offset="50%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#A8B4B2" />
        </LinearGradient>
      </Defs>
      <Path
        d={shield}
        fill="url(#sbg2)"
        stroke="url(#sb2)"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <Path d={vShape} fill="url(#sv2)" />
      <Path d={penNib} fill="url(#sv2)" />
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

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0D2406" />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header na zelenoj pozadini */}
        <View style={s.header}>
          <MiniShield />
          <View>
            <Text style={s.appName}>VARA</Text>
            <Text style={s.headerSub}>Kreiranje računa</Text>
          </View>
        </View>

        {/* Bijela kartica */}
        <View style={s.card}>
          {/* Ime i prezime */}
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

const GREEN_DARK = "#1B3F0E";
const GREEN_MID = "#2D6418";
const SILVER_LIGHT = "#E8EEEE";
const TEXT = "#142F09";
const MUTED = "#5C6765";

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_DARK },
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
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 8,
    textShadowColor: "rgba(180,210,180,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(200,225,200,0.55)",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  fieldWrap: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  optional: { color: "#9AA9A7", fontWeight: "400" },
  input: {
    backgroundColor: SILVER_LIGHT,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D1DADB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT,
  },
  inputFocused: { borderColor: GREEN_MID, backgroundColor: "#FFFFFF" },
  btn: {
    backgroundColor: GREEN_MID,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#0D2406",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  btnDisabled: { backgroundColor: "#9AA9A7", shadowOpacity: 0, elevation: 0 },
  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  linkWrap: { marginTop: 20, alignItems: "center" },
  linkText: { fontSize: 14, color: MUTED },
  linkBold: { color: GREEN_MID, fontWeight: "700" },
  bottomNote: {
    fontSize: 11,
    color: "rgba(200,225,200,0.4)",
    textAlign: "center",
    marginTop: 24,
  },
});
