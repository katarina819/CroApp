import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { UserProvider } from "./contexts/UserContext";

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      setIsAuthenticated(!!token);
    } catch (error) {
      console.error(error);
      setIsAuthenticated(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <UserProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="login" />
        ) : (
          <Stack.Screen name="(tabs)" />
        )}
        <Stack.Screen name="register" />

        <Stack.Screen name="forgot-password" />
      </Stack>
    </UserProvider>
  );
}
