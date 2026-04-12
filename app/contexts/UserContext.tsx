// contexts/UserContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router"; // DODAJ OVAJ IMPORT
import React, { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
  followersCount: number;
  followingCount: number;
  isPublic: boolean;
  showUsername?: boolean;
}

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateAvatar: (avatarUrl: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/my-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("📱 Profile loaded:", data.id, data.firstName);
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const updateAvatar = (avatarUrl: string) => {
    setProfile((prev) => (prev ? { ...prev, avatar: avatarUrl } : prev));
  };

  // Učitaj profil kada se komponenta mounta
  useEffect(() => {
    loadProfile();
  }, []);

  // DODAJ OVO - osvježi profil svaki put kada se ekran fokusira
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, []),
  );

  return (
    <UserContext.Provider
      value={{
        profile,
        loading,
        refreshProfile: loadProfile,
        updateAvatar,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

export default UserProvider;
