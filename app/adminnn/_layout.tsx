// app/admin/_layout.tsx
import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          title: "Admin Login",
        }}
      />
      <Stack.Screen
        name="dashboard"
        options={{
          headerShown: false,
          title: "Admin Dashboard",
        }}
      />
    </Stack>
  );
}
