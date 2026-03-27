import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image
} from "react-native";
import Map from "./Map";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Dashboard({ navigation, setIsAuthenticated }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const fn = await AsyncStorage.getItem("firstName");
    const ln = await AsyncStorage.getItem("lastName");
    setFirstName(fn || "");
    setLastName(ln || "");
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setIsAuthenticated(false);
    navigation.navigate("Login");
  };

  const locations = [
    { latitude: 45.815, longitude: 15.9819 },
    { latitude: 43.5081, longitude: 16.4402 },
    { latitude: 45.3271, longitude: 14.4422 },
  ];

  return (
    <View style={styles.container}>

      {/* 🔝 TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate("Add")}>
          <Text style={styles.topBtn}>➕ Dodaj</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <Text style={styles.topBtn}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* 👋 HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Dobrodošli, {firstName} {lastName}
        </Text>

        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Odjava</Text>
        </TouchableOpacity>
      </View>

      {/* 🗺️ MAPA */}
      <View style={styles.mapWrapper}>
        <Map
  locations={[
    { lat: 45.815, lng: 15.9819 },
    { lat: 43.5081, lng: 16.4402 },
    { lat: 45.3271, lng: 14.4422 },
  ]}
  center={{ lat: 45.815, lng: 15.9819 }}
/>
      </View>

      {/* 🔻 BOTTOM NAV */}
      <View style={styles.bottomNav}>
        <TouchableOpacity onPress={() => navigation.navigate("Dashboard")}>
          <Text style={styles.navIcon}>🏠</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Videos")}>
          <Text style={styles.navIcon}>🎥</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Messages")}>
          <Text style={styles.navIcon}>💬</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Search")}>
          <Text style={styles.navIcon}>🔍</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Image
            source={{ uri: "https://via.placeholder.com/40" }}
            style={styles.profile}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
  },

  topBtn: {
    backgroundColor: "#4a90e2",
    color: "white",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
  },

  logout: {
    backgroundColor: "#dc3545",
    color: "white",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  mapWrapper: {
    flex: 1, // 🔥 mapa zauzima cijeli ekran
  },

  map: {
    width: "100%",
    height: "100%",
  },

  bottomNav: {
    height: 70,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#e0e0e0",
  },

  navIcon: {
    fontSize: 22,
  },

  profile: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});