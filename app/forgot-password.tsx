import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { API_ENDPOINTS } from "./config/api";

type Step = "email" | "code" | "newPassword";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [contact, setContact] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRequestCode = async () => {
    if (!contact.trim()) {
      Alert.alert(t("common.error"), t("validation.enterEmail"));
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_ENDPOINTS.LOGIN.replace("/login", "/forgot-password")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: contact.trim() }),
        },
      );

      if (response.ok) {
        setEmail(contact.trim());
        setStep("code");
        Alert.alert(
          t("forgotPassword.codeSentTitle"),
          t("forgotPassword.codeSentDesc", { contact }) +
            "\n\n" +
            t("forgotPassword.checkSpamNote"),
        );
      } else if (response.status === 404) {
        Alert.alert(
          t("forgotPassword.notFoundTitle"),
          t("forgotPassword.notFoundDesc"),
        );
      } else {
        Alert.alert(t("common.error"), t("forgotPassword.tryAgain"));
      }
    } catch {
      Alert.alert(t("common.error"), t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (code.trim().length !== 6) {
      Alert.alert(t("common.error"), t("forgotPassword.enterCode"));
      return;
    }
    setStep("newPassword");
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert(t("common.error"), t("validation.passwordMin"));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t("common.error"), t("auth.passwordMismatch"));
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_ENDPOINTS.LOGIN.replace("/login", "/reset-password")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim(), newPassword }),
        },
      );
      if (response.ok) {
        Alert.alert(
          t("forgotPassword.successTitle"),
          t("forgotPassword.successDesc"),
          [
            {
              text: t("auth.loginBtn"),
              onPress: () => router.replace("/login"),
            },
          ],
        );
      } else {
        Alert.alert(t("common.error"), t("forgotPassword.invalidCode"));
      }
    } catch {
      Alert.alert(t("common.error"), t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  const STEPS = {
    email: {
      title: t("forgotPassword.step1Title"),
      subtitle: t("forgotPassword.step1Desc"),
      icon: "📧",
    },
    code: {
      title: t("forgotPassword.step2Title"),
      subtitle: t("forgotPassword.step2Desc", { email }),
      icon: "🔢",
    },
    newPassword: {
      title: t("forgotPassword.step3Title"),
      subtitle: t("forgotPassword.step3Desc"),
      icon: "🔐",
    },
  };

  const current = STEPS[step];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0D2406" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
        {/* Progress dots */}
        <View style={styles.progress}>
          {(["email", "code", "newPassword"] as Step[]).map((s, i) => (
            <View
              key={s}
              style={[
                styles.dot,
                step === s && styles.dotActive,
                (step === "code" && i === 0) ||
                (step === "newPassword" && i <= 1)
                  ? styles.dotDone
                  : null,
              ]}
            />
          ))}
        </View>

        <Text style={styles.icon}>{current.icon}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>

        {/* EMAIL korak */}
        {step === "email" && (
          <View style={styles.form}>
            <Text style={styles.label}>{t("forgotPassword.emailLabel")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("forgotPassword.emailPlaceholder")}
              placeholderTextColor="#9AA9A7"
              value={contact}
              onChangeText={setContact}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRequestCode}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {t("forgotPassword.sendCode")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* KOD korak */}
        {step === "code" && (
          <View style={styles.form}>
            <Text style={styles.label}>{t("forgotPassword.codeLabel")}</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="123456"
              placeholderTextColor="#9AA9A7"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity style={styles.button} onPress={handleVerifyCode}>
              <Text style={styles.buttonText}>
                {t("forgotPassword.verifyCode")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={() => {
                setStep("email");
                setCode("");
              }}
            >
              <Text style={styles.resendText}>
                {t("forgotPassword.resendCode")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* NOVA LOZINKA korak */}
        {step === "newPassword" && (
          <View style={styles.form}>
            <Text style={styles.label}>
              {t("forgotPassword.newPasswordLabel")}
            </Text>
            <View style={{ position: "relative", justifyContent: "center" }}>
              <TextInput
                style={styles.input}
                placeholder={t("forgotPassword.newPasswordPlaceholder")}
                placeholderTextColor="#9AA9A7"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoFocus
                editable={!isLoading}
              />
              <TouchableOpacity
                style={{
                  position: "absolute",
                  right: 14,
                  height: "100%",
                  justifyContent: "center",
                  zIndex: 10,
                  elevation: 10,
                }}
                onPress={() => setShowNewPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={{ fontSize: 18, opacity: showNewPassword ? 1 : 0.5 }}
                >
                  👁️
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.label, { marginTop: 12 }]}>
              {t("forgotPassword.confirmPasswordLabel")}
            </Text>
            <View style={{ position: "relative", justifyContent: "center" }}>
              <TextInput
                style={[
                  styles.input,
                  confirmPassword && newPassword !== confirmPassword
                    ? styles.inputError
                    : null,
                ]}
                placeholder={t("forgotPassword.confirmPasswordPlaceholder")}
                placeholderTextColor="#9AA9A7"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={{
                  position: "absolute",
                  right: 14,
                  height: "100%",
                  justifyContent: "center",
                  zIndex: 10,
                  elevation: 10,
                }}
                onPress={() => setShowConfirmPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    opacity: showConfirmPassword ? 1 : 0.5,
                  }}
                >
                  👁️
                </Text>
              </TouchableOpacity>
            </View>
            {confirmPassword && newPassword !== confirmPassword && (
              <Text style={styles.errorText}>{t("auth.passwordMismatch")}</Text>
            )}
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {t("forgotPassword.changePasswordBtn")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>{t("forgotPassword.backToLogin")}</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Ista paleta kao login.tsx/register.tsx — prije je ovaj ekran koristio
// posve drugu (svijetloplavu/ljubičastu #667eea na sivoj #f5f7fa) shemu
// boja koja nije imala veze s ostatkom aplikacije.
const GREEN_DEEPEST = "#0D2406";
const GREEN_DARK = "#1B3F0E";
const GREEN_MID = "#2D6418";
const VALID_GREEN = "#4CAF50";
const SILVER = "#9AA9A7";
const SILVER_LIGHT = "#E8EEEE";
const TEXT_DARK = "#142F09";
const TEXT_MID = "#5C6765";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GREEN_DARK },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  progress: { flexDirection: "row", gap: 8, marginBottom: 28 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#D1DADB" },
  dotActive: { backgroundColor: GREEN_MID, width: 24 },
  dotDone: { backgroundColor: VALID_GREEN },
  icon: { fontSize: 48, marginBottom: 14 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT_DARK,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_MID,
    textAlign: "center",
    marginBottom: 28,
  },
  form: { width: "100%" },
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "#D1DADB",
    color: TEXT_DARK,
    marginBottom: 8,
  },
  inputError: { borderColor: "#C0392B" },
  codeInput: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 12,
  },
  button: {
    backgroundColor: GREEN_MID,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 12,
    alignItems: "center",
    shadowColor: GREEN_DEEPEST,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDisabled: { backgroundColor: SILVER, shadowOpacity: 0, elevation: 0 },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  resendBtn: { marginTop: 16, alignItems: "center" },
  resendText: { color: GREEN_MID, fontSize: 14, fontWeight: "600" },
  backBtn: { marginTop: 28 },
  backText: { color: TEXT_MID, fontSize: 14 },
  errorText: { color: "#C0392B", fontSize: 12, marginBottom: 4 },
});
