// app/_layout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AdaptiveThemeProvider } from "../components/AdaptiveThemeProvider"; // ← NOVO
import "./config/i18n"; // ← dodaj ovo kao prvi import
import { UserProvider } from "./contexts/UserContext";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle deep link kada je app zatvorena (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        const { path } = Linking.parse(url);
        // Ne navigiraj odmah - checkAuth će se pobrinuti za routing
        // Samo logiraj za debug
        console.log("🔗 Initial deep link:", url, "path:", path);
      }
    });

    // Handle deep link kada je app u pozadini (warm start)
    const subscription = Linking.addEventListener("url", (event) => {
      const { path } = Linking.parse(event.url);
      console.log("🔗 Deep link received:", event.url, "path:", path);
      if (path === "login") {
        router.replace("/login");
      }
    });

    return () => subscription.remove();
  }, []);

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
      // ← POMAKNI OVU PROVJERU NA SAM VRH, PRIJE SVEGA
      if (
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/admin") ||
          window.location.pathname.startsWith("/adminn"))
      ) {
        console.log("➡️ Admin ruta — preskačem auth check");
        setReady(true);
        return; // ← izlazi odmah, ne dotiče routing
      }

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
    <AdaptiveThemeProvider>
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
    </AdaptiveThemeProvider>
  );
}
