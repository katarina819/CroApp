import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView
} from "react-native";

export default function Register({ navigation }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    birthDate: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (name, value) => {
    setForm({
      ...form,
      [name]: value,
    });
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
      Alert.alert("Greška", "Unesite email ili telefon");
      return false;
    }

    if (hasEmail && !form.email.includes("@")) {
      Alert.alert("Greška", "Neispravan email");
      return false;
    }

    if (!form.password || form.password.length < 6) {
      Alert.alert("Greška", "Lozinka mora imati min 6 znakova");
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
      const dataToSend = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password,
        birthDate: form.birthDate,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      };

      const response = await fetch("http://192.168.1.5:7089/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        Alert.alert("Uspjeh", "Registracija uspješna!");

        setForm({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          password: "",
          birthDate: "",
        });

        navigation.navigate("Login");
      } else {
        const text = await response.text();
        Alert.alert("Greška", text || "Registracija nije uspjela");
      }
    } catch (error) {
      Alert.alert("Greška", "Server nije dostupan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Kreiraj račun</Text>

      <TextInput
        placeholder="Ime"
        style={styles.input}
        value={form.firstName}
        onChangeText={(text) => handleChange("firstName", text)}
      />

      <TextInput
        placeholder="Prezime"
        style={styles.input}
        value={form.lastName}
        onChangeText={(text) => handleChange("lastName", text)}
      />

      <TextInput
        placeholder="Email (opcionalno)"
        style={styles.input}
        value={form.email}
        onChangeText={(text) => handleChange("email", text)}
      />

      <TextInput
        placeholder="Telefon (opcionalno)"
        style={styles.input}
        value={form.phone}
        onChangeText={(text) => handleChange("phone", text)}
      />

      <TextInput
        placeholder="Lozinka"
        style={styles.input}
        secureTextEntry
        value={form.password}
        onChangeText={(text) => handleChange("password", text)}
      />

      <TextInput
        placeholder="Datum rođenja (YYYY-MM-DD)"
        style={styles.input}
        value={form.birthDate}
        onChangeText={(text) => handleChange("birthDate", text)}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>
          {isLoading ? "Učitavanje..." : "Registriraj se"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Već imate račun? Prijava</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    textAlign: "center",
    color: "blue",
  },
});