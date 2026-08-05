// app/register.tsx — VARA redesign v2 (puna zelena pozadina)
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageSelector from "../components/LanguageSelector";
import { useGoogleAuth } from "../hooks/useGoogleAuth";

import DateTimePicker from "@react-native-community/datetimepicker";
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
import { API_ENDPOINTS } from "./config/api";

type PasswordStrength = "empty" | "weak" | "medium" | "strong";

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "empty";
  if (password.length < 6) return "weak";
  let score = 0;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return "weak";
  if (score <= 2) return "medium";
  return "strong";
}

function generateStrongPassword(length = 14): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*_-+=";
  const all = lower + upper + digits + symbols;
  let pwd =
    lower[Math.floor(Math.random() * lower.length)] +
    upper[Math.floor(Math.random() * upper.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

const STRENGTH_COLORS: Record<
  PasswordStrength,
  { color: string; barWidth: `${number}%` }
> = {
  empty: { color: "#D1DADB", barWidth: "0%" },
  weak: { color: "#C0392B", barWidth: "33%" },
  medium: { color: "#E29A1E", barWidth: "66%" },
  strong: { color: "#4CAF50", barWidth: "100%" },
};

interface RegisterData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  birthDate: string;
  email?: string | null;
  language: string;
}

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    birthDate: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { request, promptAsync } = useGoogleAuth((profile) => {
    const usernameBase = profile.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    setForm((prev) => ({
      ...prev,
      firstName: profile.firstName || prev.firstName,
      lastName: profile.lastName || prev.lastName,
      email: profile.email || prev.email,
      username: usernameBase || prev.username,
    }));
  });

  const handleChange = (name: string, value: string) =>
    setForm({ ...form, [name]: value });

  const validateForm = () => {
    if (!form.firstName.trim()) {
      Alert.alert(t("common.error"), t("validation.enterFirstName"));
      return false;
    }
    if (!form.lastName.trim()) {
      Alert.alert(t("common.error"), t("validation.enterLastName"));
      return false;
    }
    if (!form.email.trim()) {
      Alert.alert(t("common.error"), t("validation.enterEmail"));
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      Alert.alert(t("common.error"), t("validation.invalidEmail"));
      return false;
    }
    if (!form.username.trim()) {
      Alert.alert(t("common.error"), t("validation.enterUsername"));
      return false;
    }
    if (form.username.trim().length < 3) {
      Alert.alert(t("common.error"), t("validation.usernameMinLength"));
      return false;
    }
    if (!/^[a-zA-Z0-9]+$/.test(form.username)) {
      Alert.alert(t("common.error"), t("validation.usernameChars"));
      return false;
    }
    if (!form.password.trim()) {
      Alert.alert(t("common.error"), t("validation.enterPassword"));
      return false;
    }
    if (form.password.length < 6) {
      Alert.alert(t("common.error"), t("validation.passwordMin"));
      return false;
    }
    if (!form.birthDate.trim()) {
      Alert.alert(t("common.error"), t("validation.enterBirthDate"));
      return false;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(form.birthDate.trim())) {
      Alert.alert(t("common.error"), t("validation.invalidDateFormat"));
      return false;
    }

    const [year, month, day] = form.birthDate.trim().split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);
    const isValidDate =
      parsedDate.getFullYear() === year &&
      parsedDate.getMonth() === month - 1 &&
      parsedDate.getDate() === day;

    if (!isValidDate) {
      Alert.alert(t("common.error"), t("validation.invalidDate"));
      return false;
    }

    const today = new Date();
    if (parsedDate > today) {
      Alert.alert(t("common.error"), t("validation.futureDate"));
      return false;
    }

    const age =
      today.getFullYear() -
      year -
      (today < new Date(today.getFullYear(), month - 1, day) ? 1 : 0);

    if (age < 13) {
      Alert.alert(t("common.error"), t("validation.tooYoung"));
      return false;
    }
    if (age > 120) {
      Alert.alert(t("common.error"), t("validation.unrealisticAge"));
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
        language: i18n.language,
      };
      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      if (response.ok) {
        Alert.alert(t("common.success"), t("auth.registerSuccess"), [
          { text: t("auth.loginBtn"), onPress: () => router.push("/login") },
        ]);
      } else {
        const errorData = await response.json().catch(() => null);
        if (errorData?.field === "username" && errorData?.code === "taken") {
          Alert.alert(t("common.error"), t("validation.usernameTaken"));
        } else if (
          errorData?.field === "email" &&
          errorData?.code === "taken"
        ) {
          Alert.alert(t("common.error"), t("validation.emailTaken"));
        } else if (response.status === 409) {
          Alert.alert(t("common.error"), t("validation.duplicateGeneric"));
        } else {
          Alert.alert(t("common.error"), t("validation.registerFailed"));
        }
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
      <StatusBar barStyle="light-content" backgroundColor="#0D2406" />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header na zelenoj pozadini */}
        <View style={s.header}>
          <Image
            source={require("../assets/images/vara_icon.png")}
            style={{ width: 36, height: 36, borderRadius: 6 }}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>VARA</Text>
            <Text style={s.headerSub}>{t("auth.register")}</Text>
          </View>
          <LanguageSelector />
        </View>

        {/* Bijela kartica */}
        <View style={s.card}>
          {/* Ime i prezime */}
          {/* Ime i prezime */}
          <View style={s.row}>
            <View style={[s.fieldWrap, s.half]}>
              <Text style={s.label}>{t("auth.firstName").toUpperCase()} *</Text>
              <TextInput
                style={s.input}
                placeholder={t("auth.firstNamePlaceholder")}
                placeholderTextColor="#9AA9A7"
                value={form.firstName}
                onChangeText={(v) => handleChange("firstName", v)}
                editable={!isLoading}
              />
            </View>
            <View style={[s.fieldWrap, s.half]}>
              <Text style={s.label}>{t("auth.lastName").toUpperCase()} *</Text>
              <TextInput
                style={s.input}
                placeholder={t("auth.lastNamePlaceholder")}
                placeholderTextColor="#9AA9A7"
                value={form.lastName}
                onChangeText={(v) => handleChange("lastName", v)}
                editable={!isLoading}
              />
            </View>
          </View>

          <Field
            label={`${t("auth.email").toUpperCase()}`}
            placeholder={t("auth.emailPlaceholder")}
            value={form.email}
            onChangeText={(v) => handleChange("email", v)}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
          <Field
            label={`${t("auth.username").toUpperCase()} *`}
            placeholder={t("auth.usernamePlaceholder")}
            value={form.username}
            onChangeText={(v) => handleChange("username", v)}
            autoCapitalize="none"
            editable={!isLoading}
          />
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t("auth.password").toUpperCase()} *</Text>
            <View style={{ position: "relative", justifyContent: "center" }}>
              <TextInput
                style={s.input}
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor="#9AA9A7"
                value={form.password}
                onChangeText={(v) => handleChange("password", v)}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={{
                  position: "absolute",
                  right: 14,
                  height: "100%",
                  justifyContent: "center",
                }}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ fontSize: 18 }}>
                  {showPassword ? "🙈" : "👁️"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={{
                fontSize: 12,
                marginTop: 6,
                color:
                  form.password.length === 0
                    ? MUTED
                    : form.password.length < 6
                      ? "#C0392B"
                      : "#4CAF50",
              }}
            >
              {t("password.minLength")}
            </Text>

            {form.password.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "#E8EEEE",
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width:
                        STRENGTH_COLORS[getPasswordStrength(form.password)]
                          .barWidth,
                      backgroundColor:
                        STRENGTH_COLORS[getPasswordStrength(form.password)]
                          .color,
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    marginTop: 4,
                    color:
                      STRENGTH_COLORS[getPasswordStrength(form.password)].color,
                  }}
                >
                  {t(`password.strength.${getPasswordStrength(form.password)}`)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => {
                const generated = generateStrongPassword();
                setForm((prev) => ({ ...prev, password: generated }));
                Alert.alert(t("password.suggestedTitle"), generated);
              }}
              disabled={isLoading}
              style={{ marginTop: 8, alignSelf: "flex-start" }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: GREEN_MID,
                  textDecorationLine: "underline",
                }}
              >
                {t("password.suggestStrong")}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t("auth.birthDate").toUpperCase()} *</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9AA9A7"
                value={form.birthDate}
                onChangeText={(v) => handleChange("birthDate", v)}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={{
                  width: 46,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: "#D1DADB",
                  backgroundColor: SILVER_LIGHT,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => setShowPicker(true)}
              >
                <Text style={{ fontSize: 18 }}>📅</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showPicker && (
            <DateTimePicker
              value={
                form.birthDate ? new Date(form.birthDate) : new Date(2000, 0, 1)
              }
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowPicker(false);
                if (selectedDate) {
                  const iso = selectedDate.toISOString().split("T")[0];
                  handleChange("birthDate", iso);
                }
              }}
            />
          )}

          <TouchableOpacity
            style={[s.btn, isLoading && s.btnDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>{t("auth.registerBtn")}</Text>
            )}
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 20,
              marginBottom: 4,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: "#D1DADB" }} />
            <Text style={{ marginHorizontal: 10, color: MUTED, fontSize: 12 }}>
              {t("common.or").toUpperCase()}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#D1DADB" }} />
          </View>

          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderRadius: 14,
              paddingVertical: 14,
              marginTop: 12,
              borderWidth: 1.5,
              borderColor: "#D1DADB",
              backgroundColor: "#FFFFFF",
            }}
            onPress={() => promptAsync()}
            disabled={!request || isLoading}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT }}>
              {t("auth.continueWithGoogle")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.linkWrap}
            onPress={() => router.push("/login")}
          >
            <Text style={s.linkText}>
              {t("auth.hasAccount")}{" "}
              <Text style={s.linkBold}>{t("auth.loginBtn")}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={s.bottomNote}>{t("auth.registerTerms")}</Text>
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
