// app/_layout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { UserProvider } from "./contexts/UserContext";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Kratki delay da se Expo Router navigator inicijalizira
    // prije nego pozovemo router.replace()
    const timer = setTimeout(() => {
      checkAuth();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const checkAuth = async () => {
    try {
      console.log("🔍 Checking auth...");
      const token = await AsyncStorage.getItem("token");
      console.log("🔑 Token exists:", !!token);

      setReady(true);

      if (token) {
        console.log("➡️ Navigating to /(tabs)");
        router.replace("/(tabs)");
      } else {
        console.log("➡️ Navigating to /login");
        router.replace("/login");
      }
    } catch (err: any) {
      console.error("❌ Auth/Navigation error:", err?.message);
      setError(err?.message ?? "Nepoznata greška");
      setReady(true);
    }
  };

  // DEV error screen – vidi što puca
  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          backgroundColor: "#1B3F0E",
        }}
      >
        <Text
          style={{
            color: "#ff4757",
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 12,
          }}
        >
          ❌ Greška pri pokretanju
        </Text>
        <Text
          style={{
            color: "#fff",
            fontSize: 13,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {error}
        </Text>
      </View>
    );
  }

  // Loading dok se auth provjerava
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#1B3F0E",
        }}
      >
        <ActivityIndicator size="large" color="#D1DADB" />
        <Text
          style={{
            color: "rgba(255,255,255,0.5)",
            marginTop: 16,
            fontSize: 13,
          }}
        >
          Pokretanje...
        </Text>
      </View>
    );
  }

  return (
    <UserProvider>
      {/* Svi ekrani uvijek registrirani – ne uvjetno */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile/[userId]" />
        <Stack.Screen name="chat/[userId]" />
        <Stack.Screen name="admin/login" />
        <Stack.Screen name="adminn/dashboard" />
      </Stack>
    </UserProvider>
  );
}
