import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
      <ScrollView contentContainerStyle={styles.scroll}>
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
              placeholderTextColor="#999"
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
              placeholderTextColor="#999"
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
                placeholderTextColor="#999"
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
                placeholderTextColor="#999"
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 60,
    alignItems: "center",
  },
  progress: { flexDirection: "row", gap: 8, marginBottom: 32 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ddd" },
  dotActive: { backgroundColor: "#667eea", width: 24 },
  dotDone: { backgroundColor: "#34c759" },
  icon: { fontSize: 56, marginBottom: 16 },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  form: { width: "100%" },
  label: { fontSize: 14, fontWeight: "500", color: "#333", marginBottom: 8 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    color: "#333",
    marginBottom: 8,
  },
  inputError: { borderColor: "#ff3b30" },
  codeInput: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 12,
  },
  button: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 12,
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: { backgroundColor: "#a0aec0", opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resendBtn: { marginTop: 16, alignItems: "center" },
  resendText: { color: "#667eea", fontSize: 14 },
  backBtn: { marginTop: 32 },
  backText: { color: "#999", fontSize: 14 },
  errorText: { color: "#ff3b30", fontSize: 12, marginBottom: 4 },
});
