// app/_layout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { AdaptiveThemeProvider } from "../components/AdaptiveThemeProvider"; // ← NOVO
import { API_BASE_URL } from "./config/api";
import "./config/i18n"; // ← dodaj ovo kao prvi import
import { UserProvider } from "./contexts/UserContext";

const trackSessionTime = async (minutes: number) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    await fetch(`${API_BASE_URL}/api/activity/track/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ minutes }),
    });
  } catch {}
};

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Praćenje vremena provedenog u aplikaciji — MORA biti ovdje, u root
  // layoutu koji živi cijelo trajanje sesije, ne unutar profil taba. Prije
  // je ovo bilo u ProfileScreen-u, pa se mjerilo samo vrijeme provedeno na
  // profil tabu (koje se gotovo uvijek zaokruži na 0 minuta), a ne stvarno
  // ukupno korištenje aplikacije — otud je arhiva aktivnosti uvijek
  // pokazivala 0 minuta.
  useEffect(() => {
    let sessionStart = Date.now();
    let isTracking = false;
    const trackCurrentSession = async () => {
      if (isTracking) return;
      isTracking = true;
      const minutes = Math.floor((Date.now() - sessionStart) / (1000 * 60));
      if (minutes > 0) await trackSessionTime(minutes);
      isTracking = false;
    };
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (nextAppState === "background" || nextAppState === "inactive") {
          await trackCurrentSession();
        } else if (nextAppState === "active") {
          sessionStart = Date.now();
        }
      },
    );
    return () => {
      subscription.remove();
      const finalMinutes = Math.floor(
        (Date.now() - sessionStart) / (1000 * 60),
      );
      if (finalMinutes > 0) trackSessionTime(finalMinutes);
    };
  }, []);

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

  // ZAMIJENI cijeli if blok s ovim:
  const checkAuth = async () => {
    try {
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
