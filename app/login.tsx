// app/login.tsx — VARA redesign v2 (puna zelena pozadina + poboljšani logo)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import LanguageSelector from "../components/LanguageSelector";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
import { API_ENDPOINTS } from "./config/api";

// ─── Stiliziran VARA natpis ───────────────────────────────────────────────────
function VaraWordmark() {
  return (
    <View style={ws.container}>
      <Text style={ws.text}>VARA</Text>
      <View style={ws.underline} />
    </View>
  );
}

const ws = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 14,
    marginBottom: 6,
  },
  text: {
    fontSize: 42,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 14,
    // Tekstualni efekt — outline/shadow
    textShadowColor: "rgba(180, 210, 180, 0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  underline: {
    width: 180,
    height: 2,
    backgroundColor: "rgba(200,220,200,0.4)",
    marginTop: 4,
    borderRadius: 1,
  },
});

// ─── Glavni Login Screen ──────────────────────────────────────────────────────
export default function LoginScreen() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const { promptAsync } = useGoogleAuth((profile) => {
    const usernameBase = profile.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    setUsername(usernameBase);
  });

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(t("common.error"), t("validation.enterUsername"));
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
        Alert.alert(t("auth.welcome"), `${data.firstName}`, [
          { text: t("common.ok"), onPress: () => router.replace("/(tabs)") },
        ]);
      } else {
        Alert.alert(t("common.error"), t("validation.invalidCredentials"));
      }
    } catch {
      Alert.alert(t("common.error"), t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DEEPEST} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo sekcija — na zelenoj pozadini */}
        {/* Logo sekcija — na zelenoj pozadini */}
        <View style={s.logoSection}>
          <View style={{ position: "absolute", top: 0, right: 0 }}>
            <LanguageSelector />
          </View>
          <Image
            source={require("../assets/images/vara_icon.png")}
            style={{ width: 130, height: 130, borderRadius: 24 }}
            resizeMode="contain"
          />
          <VaraWordmark />
          <Text style={s.tagline}>{t("auth.tagline")}</Text>
        </View>

        {/* Bijela kartica s formom */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("auth.login")}</Text>

          {/* Korisničko ime */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t("auth.username").toUpperCase()}</Text>
            <TextInput
              style={[s.input, usernameFocused && s.inputFocused]}
              placeholder={t("auth.usernamePlaceholder")}
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

          {/* Lozinka */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t("auth.password").toUpperCase()}</Text>
            <TextInput
              style={[s.input, passwordFocused && s.inputFocused]}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor="#9AA9A7"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          {/* Zaboravili ste lozinku */}
          <TouchableOpacity
            style={s.forgotWrap}
            onPress={() => router.push("/forgot-password")}
          >
            <Text style={s.forgotText}>{t("auth.forgotPassword")}</Text>
          </TouchableOpacity>

          {/* Prijavi se gumb */}
          <TouchableOpacity
            style={[s.btn, isLoading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>{t("auth.loginBtn")}</Text>
            )}
          </TouchableOpacity>

          {/* Razdjelnik */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{t("common.or")}</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderRadius: 14,
              paddingVertical: 16,
              marginBottom: 14,
              borderWidth: 1.5,
              borderColor: "#D1DADB",
              backgroundColor: "#FFFFFF",
            }}
            onPress={() => promptAsync()}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT_DARK }}>
              {t("auth.continueWithGoogle")}
            </Text>
          </TouchableOpacity>

          {/* Registracija */}
          <TouchableOpacity
            style={s.outlineBtn}
            onPress={() => router.push("/register")}
            activeOpacity={0.85}
          >
            <Text style={s.outlineBtnText}>{t("auth.createAccount")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.bottomNote}>{t("auth.loginTerms")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Boje ─────────────────────────────────────────────────────────────────────
const GREEN_DEEPEST = "#0D2406";
const GREEN_DARK = "#1B3F0E";
const GREEN_MID = "#2D6418";
const SILVER = "#9AA9A7";
const SILVER_LIGHT = "#E8EEEE";
const TEXT_DARK = "#142F09";
const TEXT_MID = "#5C6765";

const s = StyleSheet.create({
  root: {
    flex: 1,
    // Cijela pozadina je tamnozelena — nema više krem/bež boje
    backgroundColor: GREEN_DARK,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 56 : 44,
    paddingBottom: 40,
    alignItems: "center",
  },

  // Logo sekcija — na zelenoj pozadini
  logoSection: {
    alignItems: "center",
    marginBottom: 28,
    width: "100%",
  },
  tagline: {
    fontSize: 14,
    color: "rgba(200,225,200,0.65)",
    letterSpacing: 2,
    marginTop: 8,
    textTransform: "uppercase",
    fontWeight: "400",
  },

  // Bijela kartica
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT_DARK,
    marginBottom: 24,
    letterSpacing: 0.3,
  },

  // Polje za unos
  fieldWrap: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_MID,
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  input: {
    backgroundColor: SILVER_LIGHT,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D1DADB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_DARK,
  },
  inputFocused: {
    borderColor: GREEN_MID,
    backgroundColor: "#FFFFFF",
    shadowColor: GREEN_MID,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },

  // Zaboravili lozinku
  forgotWrap: {
    alignSelf: "flex-end",
    marginBottom: 22,
    marginTop: -6,
  },
  forgotText: {
    fontSize: 13,
    color: GREEN_MID,
    fontWeight: "600",
  },

  // Gumbi
  btn: {
    backgroundColor: GREEN_MID,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: GREEN_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  btnDisabled: {
    backgroundColor: SILVER,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Razdjelnik
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
    color: TEXT_MID,
  },

  // Outline gumb (registracija)
  outlineBtn: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: GREEN_MID,
    paddingVertical: 16,
    alignItems: "center",
  },
  outlineBtnText: {
    color: GREEN_MID,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Dno
  bottomNote: {
    fontSize: 11,
    color: "rgba(200,225,200,0.45)",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 17,
  },
});
