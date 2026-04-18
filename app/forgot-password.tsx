import { router } from "expo-router";
import { useState } from "react";
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
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestCode = async () => {
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Greška", "Unesite ispravnu email adresu");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_ENDPOINTS.LOGIN.replace("/login", "/forgot-password")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        },
      );
      if (response.ok) {
        setStep("code");
        Alert.alert(
          "Email poslan! 📧",
          "Ako email postoji u sustavu, poslan je 6-znamenkasti kod. Provjerite inbox (i spam).",
        );
      } else {
        Alert.alert("Greška", "Nije moguće poslati email. Pokušajte ponovo.");
      }
    } catch {
      Alert.alert("Greška", "Provjeri internetsku vezu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (code.trim().length !== 6) {
      Alert.alert("Greška", "Unesite 6-znamenkasti kod");
      return;
    }
    setStep("newPassword");
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert("Greška", "Lozinka mora imati najmanje 6 znakova");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Greška", "Lozinke se ne podudaraju");
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
        Alert.alert("Uspjeh! ✅", "Lozinka je promijenjena. Prijavite se.", [
          { text: "Prijava", onPress: () => router.replace("/login") },
        ]);
      } else {
        const data = await response.json();
        Alert.alert("Greška", data.message || "Kod je neispravan ili istekao.");
      }
    } catch {
      Alert.alert("Greška", "Provjeri internetsku vezu.");
    } finally {
      setIsLoading(false);
    }
  };

  const STEPS = {
    email: {
      title: "Zaboravili ste lozinku?",
      subtitle: "Unesite email za dobivanje koda",
      icon: "📧",
    },
    code: {
      title: "Unesite kod",
      subtitle: `Poslan na ${email}`,
      icon: "🔢",
    },
    newPassword: {
      title: "Nova lozinka",
      subtitle: "Odaberite novu lozinku",
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
            <Text style={styles.label}>Email adresa</Text>
            <TextInput
              style={styles.input}
              placeholder="vaš@email.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
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
                <Text style={styles.buttonText}>Pošalji kod</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* KOD korak */}
        {step === "code" && (
          <View style={styles.form}>
            <Text style={styles.label}>6-znamenkasti kod</Text>
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
              <Text style={styles.buttonText}>Potvrdi kod</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={() => {
                setStep("email");
                setCode("");
              }}
            >
              <Text style={styles.resendText}>← Pošalji novi kod</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* NOVA LOZINKA korak */}
        {step === "newPassword" && (
          <View style={styles.form}>
            <Text style={styles.label}>Nova lozinka</Text>
            <TextInput
              style={styles.input}
              placeholder="Najmanje 6 znakova"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoFocus
              editable={!isLoading}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>
              Potvrdi lozinku
            </Text>
            <TextInput
              style={[
                styles.input,
                confirmPassword && newPassword !== confirmPassword
                  ? styles.inputError
                  : null,
              ]}
              placeholder="Ponovi lozinku"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!isLoading}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <Text style={styles.errorText}>Lozinke se ne podudaraju</Text>
            )}
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Promijeni lozinku</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Povratak na prijavu</Text>
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
