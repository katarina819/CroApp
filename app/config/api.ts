// app/config/api.ts
import { Platform } from "react-native";

// 🔥 KORISTI OVU IP ADRESU (tvoja Wi-Fi IP)
const YOUR_COMPUTER_IP = "10.225.64.205"; // 🔹 tvoj laptop IP
const BACKEND_PORT = "7089";

const getBaseUrl = () => {
  if (__DEV__) {
    if (Platform.OS === "android") {
      // Android fizički uređaj ili emulator
      return `http://${YOUR_COMPUTER_IP}:${BACKEND_PORT}`;
    } else if (Platform.OS === "ios") {
      // iOS fizički uređaj ili simulator
      return `http://${YOUR_COMPUTER_IP}:${BACKEND_PORT}`;
    }
  }
  // production URL (promijeni kad objaviš)
  return "https://your-production-api.com";
};

export const API_BASE_URL = getBaseUrl();

console.log("🌐 API URL:", API_BASE_URL);

export const API_ENDPOINTS = {
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  USERS: `${API_BASE_URL}/api/auth/users`,
  USER_BY_ID: (id: number) => `${API_BASE_URL}/api/auth/users/${id}`,
};

// 🔥 DEFAULT EXPORT ZA LAKŠI IMPORT U EXPO ROUTER
export default {
  API_BASE_URL,
  API_ENDPOINTS,
};
