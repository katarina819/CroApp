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
import { API_ENDPOINTS } from "./config/api"; // 🔥 DODAJ OVAJ IMPORT

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

  const handleChange = (name: string, value: string) => {
    setForm({ ...form, [name]: value });
  };

  const validateForm = () => {
    if (!form.firstName.trim()) {
      Alert.alert("Greška", "Molimo unesite ime");
      return false;
    }
    if (!form.lastName.trim()) {
      Alert.alert("Greška", "Molimo unesite prezime");
      return false;
    }

    const hasEmail = form.email.trim() !== "";
    const hasPhone = form.phone.trim() !== "";

    if (!hasEmail && !hasPhone) {
      Alert.alert("Greška", "Molimo unesite email ili telefon");
      return false;
    }

    if (hasEmail && !form.email.includes("@")) {
      Alert.alert("Greška", "Molimo unesite ispravan email");
      return false;
    }

    if (!form.username.trim()) {
      Alert.alert("Greška", "Molimo unesite korisničko ime");
      return false;
    }

    if (!/^[a-zA-Z0-9]+$/.test(form.username)) {
      Alert.alert(
        "Greška",
        "Korisničko ime može sadržavati samo slova i brojeve",
      );
      return false;
    }

    if (!form.password) {
      Alert.alert("Greška", "Molimo unesite lozinku");
      return false;
    }
    if (form.password.length < 6) {
      Alert.alert("Greška", "Lozinka mora imati najmanje 6 znakova");
      return false;
    }
    if (!form.birthDate) {
      Alert.alert("Greška", "Molimo unesite datum rođenja");
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
      };

      if (form.email.trim()) {
        dataToSend.email = form.email.trim();
      } else {
        dataToSend.email = null;
      }

      if (form.phone.trim()) {
        dataToSend.phone = form.phone.trim();
      } else {
        dataToSend.phone = null;
      }

      // 🔥 PROMIJENI OVAJ URL
      console.log("🔗 Register URL:", API_ENDPOINTS.REGISTER);
      console.log("📦 Data:", dataToSend);

      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      console.log("📡 Response status:", response.status);

      let errorMessage = "";
      let responseData = null;

      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          responseData = await response.json();
          errorMessage =
            responseData.title ||
            responseData.message ||
            responseData.errors ||
            JSON.stringify(responseData);
        } else {
          errorMessage = await response.text();
        }
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        errorMessage = "Greška pri obradi odgovora servera";
      }

      if (response.ok) {
        Alert.alert("Uspjeh!", "Registracija uspješna! Molimo prijavite se.", [
          {
            text: "OK",
            onPress: () => {
              setForm({
                firstName: "",
                lastName: "",
                email: "",
                phone: "",
                username: "",
                password: "",
                birthDate: "",
              });
              router.push("/login");
            },
          },
        ]);
      } else {
        if (response.status === 400) {
          Alert.alert(
            "Greška",
            errorMessage || "Neispravni podaci. Provjerite unos.",
          );
        } else if (response.status === 409) {
          Alert.alert(
            "Greška",
            "Korisničko ime već postoji. Molimo odaberite drugo.",
          );
        } else {
          Alert.alert(
            "Greška",
            errorMessage || "Registracija nije uspjela. Pokušajte ponovno.",
          );
        }
      }
    } catch (error: any) {
      console.error("❌ Greška prilikom registracije:", error);
      Alert.alert(
        "Greška",
        `Došlo je do greške: ${error.message}\n\nProvjerite da li je server pokrenut na http://10.156.139.205:7089`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Kreirajte račun</Text>

          <View style={styles.formRow}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>Ime *</Text>
              <TextInput
                style={styles.input}
                placeholder="Vaše ime"
                placeholderTextColor="#999"
                value={form.firstName}
                onChangeText={(value) => handleChange("firstName", value)}
                editable={!isLoading}
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>Prezime *</Text>
              <TextInput
                style={styles.input}
                placeholder="Vaše prezime"
                placeholderTextColor="#999"
                value={form.lastName}
                onChangeText={(value) => handleChange("lastName", value)}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Email{" "}
              <Text style={styles.optionalText}>
                (opcionalno ako je telefon unesen)
              </Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="vaš@email.com"
              placeholderTextColor="#999"
              value={form.email}
              onChangeText={(value) => handleChange("email", value)}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Telefon{" "}
              <Text style={styles.optionalText}>
                (opcionalno ako je email unesen)
              </Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="+385 99 123 4567"
              placeholderTextColor="#999"
              value={form.phone}
              onChangeText={(value) => handleChange("phone", value)}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Korisničko ime *</Text>
            <TextInput
              style={styles.input}
              placeholder="Unesite korisničko ime"
              placeholderTextColor="#999"
              value={form.username}
              onChangeText={(value) => handleChange("username", value)}
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Lozinka *</Text>
            <TextInput
              style={styles.input}
              placeholder="Kreirajte lozinku (min. 6 znakova)"
              placeholderTextColor="#999"
              value={form.password}
              onChangeText={(value) => handleChange("password", value)}
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Datum rođenja *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              value={form.birthDate}
              onChangeText={(value) => handleChange("birthDate", value)}
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Registriraj se</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Registracijom prihvaćate naše{" "}
              <Text style={styles.linkText}>Uvjete korištenja</Text> i{" "}
              <Text style={styles.linkText}>Pravila privatnosti</Text>
            </Text>
            <TouchableOpacity onPress={() => router.push("/login")}>
              <Text style={styles.loginLink}>
                Već imate račun?{" "}
                <Text style={styles.loginLinkBold}>Prijavite se</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ... styles ostaju isti

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  halfWidth: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  optionalText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "normal",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    color: "#333",
  },
  button: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 24,
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: "#a0aec0",
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 18,
  },
  linkText: {
    color: "#667eea",
    textDecorationLine: "underline",
  },
  loginLink: {
    marginTop: 16,
    fontSize: 14,
    color: "#666",
  },
  loginLinkBold: {
    color: "#667eea",
    fontWeight: "600",
  },
});
