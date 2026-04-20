// app/(tabs)/profile.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { StoryBadge } from "../../app/StoryBadge";
import { API_BASE_URL } from "../config/api";
import { useUser } from "./../contexts/UserContext";

const { width: SCREEN_W } = Dimensions.get("window");

type Tab = "me" | "box" | "wishlist" | "golden";

interface ProfileData {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
  followersCount: number;
  followingCount: number;
  isPublic: boolean;
  showUsername?: boolean;
  screenTimeLimitMinutes?: number;
}

interface BoxItem {
  id: number;
  videoId: number;
  title: string;
  filePath: string;
  savedAt: string;
  userName: string;
}

interface WishlistItem {
  id: number;
  videoId: number;
  title: string;
  filePath: string;
  addedAt: string;
  isGoing?: boolean;
  notes?: string;
}

interface GoldenFriend {
  userId: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string;
}

interface FollowUser {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string;
  isGolden?: boolean; // DODAJTE OVO
  isBlocked?: boolean;
}

// ─── Activity data type ───────────────────────────────────────────────────────
interface DailyActivity {
  date: string;
  likes: number;
  comments: number;
  posts: number;
  sessionMinutes: number;
  followersCount?: number;
}

function AvatarMale({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgM" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#2D6418" />
          <Stop offset="100%" stopColor="#142F09" />
        </LinearGradient>
        <LinearGradient id="skinM" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#D4A574" />
          <Stop offset="100%" stopColor="#B8845A" />
        </LinearGradient>
        <LinearGradient id="shirtM" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#8A9A98" />
          <Stop offset="100%" stopColor="#5C6E6C" />
        </LinearGradient>
      </Defs>
      {/* Pozadina */}
      <Path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" fill="url(#bgM)" />
      {/* Tijelo - košulja */}
      <Path d="M 20 100 L 20 72 Q 50 62 80 72 L 80 100 Z" fill="url(#shirtM)" />
      {/* Vrat */}
      <Path d="M 42 58 L 42 68 Q 50 72 58 68 L 58 58 Z" fill="url(#skinM)" />
      {/* Ogrlica/ovratnik */}
      <Path d="M 36 68 Q 50 78 64 68 L 64 72 Q 50 82 36 72 Z" fill="#5C6E6C" />
      {/* Glava */}
      <Path
        d="M 32 38 Q 32 20 50 20 Q 68 20 68 38 Q 68 56 50 58 Q 32 56 32 38 Z"
        fill="url(#skinM)"
      />
      {/* Kosa */}
      <Path
        d="M 32 36 Q 32 18 50 18 Q 68 18 68 36 Q 65 24 50 22 Q 35 24 32 36 Z"
        fill="#3A2A1A"
      />
      {/* Obrve */}
      <Path
        d="M 37 34 Q 42 32 45 34"
        stroke="#3A2A1A"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 55 34 Q 58 32 63 34"
        stroke="#3A2A1A"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Oči */}
      <Path d="M 38 37 Q 41 35 44 37 Q 41 40 38 37 Z" fill="#2A1A0A" />
      <Path d="M 56 37 Q 59 35 62 37 Q 59 40 56 37 Z" fill="#2A1A0A" />
      {/* Nos */}
      <Path
        d="M 49 40 L 48 47 Q 50 49 52 47 L 51 40"
        fill="none"
        stroke="#B8845A"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Usta */}
      <Path
        d="M 44 51 Q 50 55 56 51"
        fill="none"
        stroke="#8B5E3C"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Metalni štit - VARA logo mali */}
      <Path
        d="M 44 84 L 38 87 L 38 93 Q 44 96 50 97 Q 56 96 62 93 L 62 87 L 56 84 Z"
        fill="none"
        stroke="rgba(200,215,200,0.5)"
        strokeWidth="1"
      />
    </Svg>
  );
}

function AvatarFemale({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgF" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#2D6418" />
          <Stop offset="100%" stopColor="#142F09" />
        </LinearGradient>
        <LinearGradient id="skinF" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#E8B896" />
          <Stop offset="100%" stopColor="#C8907A" />
        </LinearGradient>
        <LinearGradient id="topF" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#A8B8A8" />
          <Stop offset="100%" stopColor="#6A7A6A" />
        </LinearGradient>
        <LinearGradient id="hairF" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#4A2A0A" />
          <Stop offset="100%" stopColor="#2A1A08" />
        </LinearGradient>
      </Defs>
      {/* Pozadina */}
      <Path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" fill="url(#bgF)" />
      {/* Tijelo */}
      <Path d="M 22 100 L 22 70 Q 50 58 78 70 L 78 100 Z" fill="url(#topF)" />
      {/* Detalj bluze */}
      <Path d="M 42 68 Q 50 74 58 68 L 60 72 Q 50 80 40 72 Z" fill="#8A9898" />
      {/* Vrat */}
      <Path d="M 43 57 L 43 68 Q 50 71 57 68 L 57 57 Z" fill="url(#skinF)" />
      {/* Glava */}
      <Path
        d="M 33 38 Q 33 20 50 20 Q 67 20 67 38 Q 67 56 50 58 Q 33 56 33 38 Z"
        fill="url(#skinF)"
      />
      {/* Kosa - gornji dio */}
      <Path
        d="M 33 36 Q 32 16 50 15 Q 68 16 67 36 Q 65 20 50 18 Q 35 20 33 36 Z"
        fill="url(#hairF)"
      />
      {/* Kosa - sa strane */}
      <Path d="M 33 36 Q 28 45 30 56 Q 32 52 33 48 Z" fill="url(#hairF)" />
      <Path d="M 67 36 Q 72 45 70 56 Q 68 52 67 48 Z" fill="url(#hairF)" />
      {/* Kosa - duga */}
      <Path d="M 28 56 Q 24 70 26 85 Q 30 72 33 65 Z" fill="url(#hairF)" />
      <Path d="M 72 56 Q 76 70 74 85 Q 70 72 67 65 Z" fill="url(#hairF)" />
      {/* Obrve - lučne */}
      <Path
        d="M 37 33 Q 41 30 45 33"
        stroke="#4A2A0A"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 55 33 Q 59 30 63 33"
        stroke="#4A2A0A"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Oči - veće */}
      <Path d="M 37 37 Q 41 34 45 37 Q 41 41 37 37 Z" fill="#2A1A0A" />
      <Path d="M 55 37 Q 59 34 63 37 Q 59 41 55 37 Z" fill="#2A1A0A" />
      {/* Trepavice */}
      <Path
        d="M 37 36 L 36 34 M 39 35 L 39 33 M 41 35 L 41 33 M 43 35 L 44 33 M 45 36 L 46 34"
        stroke="#2A1A0A"
        strokeWidth="0.8"
      />
      <Path
        d="M 55 36 L 54 34 M 57 35 L 57 33 M 59 35 L 59 33 M 61 35 L 62 33 M 63 36 L 64 34"
        stroke="#2A1A0A"
        strokeWidth="0.8"
      />
      {/* Nos */}
      <Path
        d="M 49 40 L 48 46 Q 50 48 52 46 L 51 40"
        fill="none"
        stroke="#C8907A"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      {/* Usta - veća s ruž */}
      <Path
        d="M 43 51 Q 50 56 57 51"
        fill="none"
        stroke="#C04060"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path d="M 43 51 Q 50 54 57 51" fill="#C04060" opacity="0.3" />
      {/* Naušnice */}
      <Path
        d="M 33 47 L 33 52"
        stroke="#C0C8C0"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Path
        d="M 67 47 L 67 52"
        stroke="#C0C8C0"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Metalni štit */}
      <Path
        d="M 44 84 L 38 87 L 38 93 Q 44 96 50 97 Q 56 96 62 93 L 62 87 L 56 84 Z"
        fill="none"
        stroke="rgba(200,215,200,0.5)"
        strokeWidth="1"
      />
    </Svg>
  );
}

function AvatarSection({ onUpdate }: { onUpdate: () => void }) {
  const { profile, updateAvatar, refreshProfile } = useUser();
  const [loading, setLoading] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const pickAndUpload = async () => {
    Alert.alert("Profilna slika", "Odaberi izvor", [
      { text: "Galerija", onPress: () => pickImage("gallery") },
      { text: "Odaberi avatar", onPress: () => setShowAvatarModal(true) },
      { text: "Kamera", onPress: () => pickImage("camera") },
      { text: "Ukloni sliku", style: "destructive", onPress: removeAvatar },
      { text: "Odustani", style: "cancel" },
    ]);
  };

  const selectAvatar = async (type: "male" | "female") => {
    setShowAvatarModal(false);
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/auth/profile-photo/avatar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarType: type }),
      });
      if (res.ok) {
        const data = await res.json();
        updateAvatar(data.avatarUrl);
        await refreshProfile();
        onUpdate();
      }
    } catch {
      Alert.alert("Greška", "Nije moguće postaviti avatar");
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (source: "gallery" | "camera") => {
    const perm =
      source === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const result =
      source === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          });

    if (!result.canceled && result.assets[0])
      await uploadAvatar(result.assets[0].uri);
  };

  const uploadAvatar = async (uri: string) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const formData = new FormData();
      formData.append("avatar", {
        uri,
        type: "image/jpeg",
        name: "avatar.jpg",
      } as any);

      const res = await fetch(`${API_BASE_URL}/api/auth/profile-photo`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        updateAvatar(data.avatarUrl);
        await refreshProfile();
        onUpdate();
      } else {
        Alert.alert("Greška", "Nije moguće uploadati sliku");
      }
    } catch {
      Alert.alert("Greška", "Nije moguće uploadati sliku");
    } finally {
      setLoading(false);
    }
  };

  const removeAvatar = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/auth/profile-photo`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        updateAvatar("");
        await refreshProfile();
        onUpdate();
      } else {
        Alert.alert("Greška", "Nije moguće ukloniti sliku");
      }
    } catch {
      Alert.alert("Greška", "Nije moguće ukloniti sliku");
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = () => {
    if (!profile?.avatar) return null;
    // Avatar identifikatori se ne trebaju konvertirati u URL
    if (profile.avatar.startsWith("avatar:")) return null;
    return profile.avatar.startsWith("http")
      ? profile.avatar
      : `${API_BASE_URL}${profile.avatar.startsWith("/") ? "" : "/"}${profile.avatar}`;
  };

  const avatarUrl = getAvatarUrl();
  const isMaleAvatar = profile?.avatar === "avatar:male";
  const isFemaleAvatar = profile?.avatar === "avatar:female";
  const initials =
    `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <>
      <TouchableOpacity
        onPress={pickAndUpload}
        style={av.wrapper}
        activeOpacity={0.8}
      >
        <StoryBadge userId={profile?.id ?? 0} size={96}>
          {isMaleAvatar ? (
            <AvatarMale size={96} />
          ) : isFemaleAvatar ? (
            <AvatarFemale size={96} />
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={av.img} />
          ) : (
            <View style={av.placeholder}>
              <Text style={av.initials}>{initials}</Text>
            </View>
          )}
        </StoryBadge>
        {loading && (
          <View style={av.overlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
        <View style={av.editIcon}>
          <Ionicons name="camera" size={14} color="#fff" />
        </View>
      </TouchableOpacity>

      <Modal
        visible={showAvatarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <TouchableOpacity
          style={avModal.overlay}
          activeOpacity={1}
          onPress={() => setShowAvatarModal(false)}
        >
          <View style={avModal.container}>
            <Text style={avModal.title}>Odaberi avatar</Text>
            <Text style={avModal.subtitle}>Prilagođeno dizajnu VARA</Text>
            <View style={avModal.avatarRow}>
              <TouchableOpacity
                style={[avModal.option, isMaleAvatar && avModal.optionActive]}
                onPress={() => selectAvatar("male")}
                activeOpacity={0.8}
              >
                <View style={avModal.avatarWrapper}>
                  <AvatarMale size={88} />
                  {isMaleAvatar && (
                    <View style={avModal.checkBadge}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={avModal.optionLabel}>Muški</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[avModal.option, isFemaleAvatar && avModal.optionActive]}
                onPress={() => selectAvatar("female")}
                activeOpacity={0.8}
              >
                <View style={avModal.avatarWrapper}>
                  <AvatarFemale size={88} />
                  {isFemaleAvatar && (
                    <View style={avModal.checkBadge}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={avModal.optionLabel}>Ženski</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={avModal.cancelBtn}
              onPress={() => setShowAvatarModal(false)}
            >
              <Text style={avModal.cancelText}>Odustani</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const av = StyleSheet.create({
  wrapper: {
    alignSelf: "center",
    marginBottom: 12,
    width: 104,
    height: 104,
    justifyContent: "center",
    alignItems: "center",
  },
  img: { width: 96, height: 96, borderRadius: 48 },
  placeholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
  },
  initials: { color: "#fff", fontSize: 36, fontWeight: "700" },
  overlay: {
    // ← samo JEDAN overlay, za loading
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  editIcon: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 10,
  },
});

const avModal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: 300,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#999", marginBottom: 24 },
  avatarRow: { flexDirection: "row", gap: 20, marginBottom: 20 },
  option: {
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
  },
  optionActive: { borderColor: "#2D6418", backgroundColor: "#f0f7ee" },
  avatarWrapper: {
    position: "relative",
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
  },
  checkBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  optionLabel: { marginTop: 8, fontSize: 13, fontWeight: "600", color: "#333" },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 32 },
  cancelText: { color: "#999", fontSize: 15 },
});

// ─── Followers / Following List Modal ─────────────────────────────────────────

function FollowListModal({
  visible,
  type,
  userId,
  onClose,
  onUpdate,
}: {
  visible: boolean;
  type: "followers" | "following";
  userId: number | null;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const [list, setList] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;
    loadList();
  }, [visible, userId, type]);

  const loadList = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const endpoint =
        type === "followers"
          ? `${API_BASE_URL}/api/follow/followers/${userId}`
          : `${API_BASE_URL}/api/follow/following/${userId}`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Za svakog korisnika dohvati status Golden i Blocked
        const enhancedData = await Promise.all(
          data.map(async (user: FollowUser) => {
            try {
              const [goldenRes, blockedRes] = await Promise.all([
                fetch(
                  `${API_BASE_URL}/api/golden-friends/is-golden/${user.id}`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  },
                ),
                fetch(`${API_BASE_URL}/api/block/is-blocked/${user.id}`, {
                  headers: { Authorization: `Bearer ${token}` },
                }),
              ]);
              const goldenData = goldenRes.ok
                ? await goldenRes.json()
                : { isGolden: false };
              const blockedData = blockedRes.ok
                ? await blockedRes.json()
                : { isBlocked: false };
              return {
                ...user,
                isGolden: goldenData.isGolden || false,
                isBlocked: blockedData.isBlocked || false,
              };
            } catch {
              return { ...user, isGolden: false, isBlocked: false };
            }
          }),
        );
        setList(enhancedData);
      }
    } catch (error) {
      console.error("Error loading list:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoldenToggle = async (
    targetUserId: number,
    currentStatus: boolean,
  ) => {
    setProcessingId(targetUserId);
    try {
      const token = await AsyncStorage.getItem("token");
      let res;

      if (!currentStatus) {
        // Dodaj Golden Friend
        res = await fetch(
          `${API_BASE_URL}/api/golden-friends/add/${targetUserId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
      } else {
        // Ukloni Golden Friend
        res = await fetch(
          `${API_BASE_URL}/api/golden-friends/remove/${targetUserId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      }

      if (res.ok) {
        // Ažuriraj lokalno stanje
        setList((prev) =>
          prev.map((user) =>
            user.id === targetUserId
              ? { ...user, isGolden: !currentStatus }
              : user,
          ),
        );

        // Osvježi Golden Friends tab ako je otvoren
        // To će se dogoditi kada se tab ponovno učita

        Alert.alert(
          "Uspjeh",
          currentStatus ? "Golden Friend uklonjen" : "Golden Friend dodan",
        );
      } else {
        const errorText = await res.text();
        console.error("Golden toggle error:", errorText);
        Alert.alert("Greška", "Nije moguće promijeniti status Golden Friend-a");
      }
    } catch (error) {
      console.error("Golden toggle error:", error);
      Alert.alert("Greška", "Nije moguće promijeniti status");
    } finally {
      setProcessingId(null);
    }
  };

  const handleBlockToggle = async (
    targetUserId: number,
    currentStatus: boolean,
  ) => {
    setProcessingId(targetUserId);
    try {
      const token = await AsyncStorage.getItem("token");
      let res;

      if (!currentStatus) {
        // PRVO: Ukloni korisnika iz follow relationship-a (ako ga pratiš)
        try {
          // Provjeri da li ga pratimo
          const checkFollow = await fetch(
            `${API_BASE_URL}/api/follow/is-following/${targetUserId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (checkFollow.ok) {
            const followData = await checkFollow.json();
            console.log("Is following:", followData.isFollowing);

            if (followData.isFollowing === true) {
              // Unfollowaj korisnika
              const unfollowRes = await fetch(
                `${API_BASE_URL}/api/follow/unfollow/${targetUserId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              console.log("Unfollow response:", unfollowRes.status);
            }
          }
        } catch (unfollowError) {
          console.error("Error unfollowing before block:", unfollowError);
        }

        // DRUGO: Blokiraj korisnika
        res = await fetch(`${API_BASE_URL}/api/block/block/${targetUserId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          // Ukloni iz UI liste
          setList((prev) => prev.filter((user) => user.id !== targetUserId));

          Alert.alert(
            "Blokirano",
            "Korisnik je blokiran i uklonjen iz popisa praćenih",
          );

          // Osvježi profile podatke (smanji broj praćenih)
          if (onUpdate) onUpdate();

          // Ako je lista postala prazna, zatvori modal
          if (list.length === 1) {
            onClose();
          }
        } else {
          const errorText = await res.text();
          console.error("Block error:", errorText);
          Alert.alert("Greška", "Nije moguće blokirati korisnika");
        }
      } else {
        // Unblock korisnika
        res = await fetch(`${API_BASE_URL}/api/block/unblock/${targetUserId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          // Samo ažuriramo status, ne dodajemo ga natrag u listu
          setList((prev) =>
            prev.map((user) =>
              user.id === targetUserId ? { ...user, isBlocked: false } : user,
            ),
          );
          Alert.alert("Odblokirano", "Korisnik je odblokiran");
        } else {
          Alert.alert("Greška", "Nije moguće odblokirati korisnika");
        }
      }
    } catch (error) {
      console.error("Block toggle error:", error);
      Alert.alert("Greška", "Nije moguće promijeniti status");
    } finally {
      setProcessingId(null);
    }
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#fff" }}
        edges={["top"]}
      >
        <View style={fl.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={fl.title}>
            {type === "followers" ? "Pratitelji" : "Praćeni"}
          </Text>
          <View style={{ width: 28 }} />
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#2D6418" />
        ) : list.length === 0 ? (
          <View style={fl.empty}>
            <Ionicons name="people-outline" size={56} color="#ddd" />
            <Text style={fl.emptyText}>
              {type === "followers" ? "Nema pratitelja" : "Ne pratiš nikog"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(u) => u.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => {
              const initials =
                `${item.firstName?.[0] ?? ""}${item.lastName?.[0] ?? ""}`.toUpperCase();
              const isLoading = processingId === item.id;

              return (
                <View style={fl.row}>
                  <TouchableOpacity
                    style={fl.avatarContainer}
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: "/profile/[userId]",
                        params: { userId: item.id.toString() },
                      } as any);
                    }}
                  >
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} style={fl.avatar} />
                    ) : (
                      <View style={[fl.avatar, fl.avatarPlaceholder]}>
                        <Text style={fl.avatarText}>{initials}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={fl.userInfo}
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: "/profile/[userId]",
                        params: { userId: item.id.toString() },
                      } as any);
                    }}
                  >
                    <Text style={fl.name}>
                      {item.firstName} {item.lastName}
                    </Text>
                    <Text style={fl.username}>@{item.username}</Text>
                  </TouchableOpacity>

                  <View style={fl.actionButtons}>
                    {/* Golden Star Button */}
                    <TouchableOpacity
                      style={[
                        fl.goldenBtn,
                        item.isGolden && fl.goldenBtnActive,
                      ]}
                      onPress={() =>
                        handleGoldenToggle(item.id, item.isGolden || false)
                      }
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFD700" />
                      ) : (
                        <Ionicons
                          name={item.isGolden ? "star" : "star-outline"}
                          size={22}
                          color={item.isGolden ? "#FFD700" : "#999"}
                        />
                      )}
                    </TouchableOpacity>

                    {/* Block Button */}
                    <TouchableOpacity
                      style={[fl.blockBtn, item.isBlocked && fl.blockBtnActive]}
                      onPress={() =>
                        handleBlockToggle(item.id, item.isBlocked || false)
                      }
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#ff4757" />
                      ) : (
                        <Ionicons
                          name={item.isBlocked ? "ban" : "ellipsis-vertical"}
                          size={20}
                          color={item.isBlocked ? "#ff4757" : "#999"}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const fl = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 17, fontWeight: "600", color: "#333" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  userInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#333" },
  username: { fontSize: 13, color: "#2D6418", marginTop: 2 },
  actionButtons: { flexDirection: "row", gap: 8 },
  goldenBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
  },
  goldenBtnActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  blockBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
  },
  blockBtnActive: { borderColor: "#ff4757" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 60,
  },
  emptyText: { fontSize: 16, color: "#bbb" },
});

// ─── Activity Archive with Charts ─────────────────────────────────────────────
// Zamijenite postojeću ActivityArchive funkciju s ovom:

function ActivityArchive({ userId }: { userId: number | null }) {
  const [data, setData] = useState<DailyActivity[]>([]);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadStats();
  }, [userId, period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_BASE_URL}/api/activity/stats?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error("Error loading activity stats:", error);
      // Mock podaci za prikaz
      const mock: DailyActivity[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toISOString().split("T")[0],
          sessionMinutes: Math.floor(Math.random() * 45) + 5,
          likes: Math.floor(Math.random() * 15),
          comments: Math.floor(Math.random() * 8),
          posts: Math.floor(Math.random() * 3),
          followersCount: Math.floor(Math.random() * 100) + 50,
        };
      });
      setData(mock);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return <ActivityIndicator color="#2D6418" style={{ marginTop: 20 }} />;

  const totalLikes = data.reduce((s, d) => s + d.likes, 0);
  const totalComments = data.reduce((s, d) => s + d.comments, 0);
  const totalPosts = data.reduce((s, d) => s + d.posts, 0);
  const totalMinutes = data.reduce((s, d) => s + d.sessionMinutes, 0);
  const currentFollowers = data[data.length - 1]?.followersCount || 0;

  const maxLikes = Math.max(...data.map((d) => d.likes), 1);
  const maxComments = Math.max(...data.map((d) => d.comments), 1);
  const maxPosts = Math.max(...data.map((d) => d.posts), 1);
  const maxMinutes = Math.max(...data.map((d) => d.sessionMinutes), 1);
  const BAR_HEIGHT = 60;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
      {/* Period Selector */}
      <View style={ac.periodSelector}>
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[ac.periodBtn, period === p && ac.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[ac.periodBtnText, period === p && ac.periodBtnTextActive]}
            >
              {p === "daily"
                ? "Dnevno"
                : p === "weekly"
                  ? "Tjedno"
                  : "Mjesečno"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Cards */}
      <View style={ac.summaryRow}>
        <View style={[ac.summaryCard, { borderTopColor: "#ff3b30" }]}>
          <Ionicons name="heart" size={20} color="#ff3b30" />
          <Text style={[ac.summaryNum, { color: "#ff3b30" }]}>
            {totalLikes}
          </Text>
          <Text style={ac.summaryLabel}>Lajkovi</Text>
        </View>
        <View style={[ac.summaryCard, { borderTopColor: "#2D6418" }]}>
          <Ionicons name="chatbubble" size={20} color="#2D6418" />
          <Text style={[ac.summaryNum, { color: "#2D6418" }]}>
            {totalComments}
          </Text>
          <Text style={ac.summaryLabel}>Komentari</Text>
        </View>
        <View style={[ac.summaryCard, { borderTopColor: "#34c759" }]}>
          <Ionicons name="images" size={20} color="#34c759" />
          <Text style={[ac.summaryNum, { color: "#34c759" }]}>
            {totalPosts}
          </Text>
          <Text style={ac.summaryLabel}>Objave</Text>
        </View>
        <View style={[ac.summaryCard, { borderTopColor: "#ff9500" }]}>
          <Ionicons name="time" size={20} color="#ff9500" />
          <Text style={[ac.summaryNum, { color: "#ff9500" }]}>
            {totalMinutes}
          </Text>
          <Text style={ac.summaryLabel}>Minuta</Text>
        </View>
      </View>

      {/* Followers Card */}
      <View style={ac.followersCard}>
        <Ionicons name="people" size={24} color="#2D6418" />
        <View>
          <Text style={ac.followersNum}>{currentFollowers}</Text>
          <Text style={ac.followersLabel}>Trenutno pratitelja</Text>
        </View>
      </View>

      {/* Charts */}
      <Text style={ac.sectionTitle}>
        {period === "daily"
          ? "Zadnjih 7 dana"
          : period === "weekly"
            ? "Zadnjih 6 tjedana"
            : "Zadnjih 6 mjeseci"}
      </Text>

      {renderBarChart(
        data.map((d) => d.sessionMinutes),
        "⏱ Minuta",
        "#ff9500",
        maxMinutes,
        BAR_HEIGHT,
      )}
      {renderBarChart(
        data.map((d) => d.likes),
        "❤️ Lajkovi",
        "#ff3b30",
        maxLikes,
        BAR_HEIGHT,
      )}
      {renderBarChart(
        data.map((d) => d.comments),
        "💬 Komentari",
        "#2D6418",
        maxComments,
        BAR_HEIGHT,
      )}
      {renderBarChart(
        data.map((d) => d.posts),
        "📤 Objave",
        "#34c759",
        maxPosts,
        BAR_HEIGHT,
      )}
    </ScrollView>
  );
}

const renderBarChart = (
  values: number[],
  label: string,
  color: string,
  max: number,
  height: number,
) => {
  if (values.length === 0) return null;

  return (
    <View style={ac.chartSection}>
      <Text style={ac.chartTitle}>{label}</Text>
      <View style={ac.bars}>
        {values.map((val, i) => {
          const barH =
            max === 0 ? 4 : Math.max((val / max) * height, val > 0 ? 4 : 2);
          const date = new Date();
          date.setDate(date.getDate() - (values.length - 1 - i));
          const shortDate = `${date.getMonth() + 1}/${date.getDate()}`;
          return (
            <View key={i} style={ac.barColumn}>
              <Text style={ac.barValue}>{val}</Text>
              <View
                style={[ac.bar, { height: barH, backgroundColor: color }]}
              />
              <Text style={ac.barDate}>{shortDate}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const ac = StyleSheet.create({
  periodSelector: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 12,
    marginHorizontal: 16,
  },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  periodBtnActive: { backgroundColor: "#2D6418" },
  periodBtnText: { fontSize: 13, color: "#666" },
  periodBtnTextActive: { color: "#fff" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 },
  summaryCard: {
    flex: 1,
    minWidth: (SCREEN_W - 56) / 2,
    alignItems: "center",
    padding: 14,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    borderTopWidth: 3,
    gap: 4,
  },
  summaryNum: { fontSize: 22, fontWeight: "800" },
  summaryLabel: { fontSize: 12, color: "#999" },
  followersCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f0f0ff",
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
  },
  followersNum: { fontSize: 24, fontWeight: "800", color: "#2D6418" },
  followersLabel: { fontSize: 12, color: "#999" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  chartSection: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 12,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 10,
  },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 90 },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  bar: { width: "100%", borderRadius: 4, minHeight: 2 },
  barValue: { fontSize: 10, color: "#666", fontWeight: "600" },
  barDate: { fontSize: 9, color: "#aaa", marginTop: 4 },
});

// Dodajte ovo PRIJE BoxTab komponente
// Dodajte ovo PRIJE BoxTab komponente
function VideoPreviewModal({
  visible,
  videoUrl,
  title,
  onClose,
}: {
  visible: boolean;
  videoUrl: string;
  title: string;
  onClose: () => void;
}) {
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Kreiraj player samo kada je modal vidljiv
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
    playerRef.current = p;
    setIsPlayerReady(true);
  });

  // Upravljanje play/pause na temelju vidljivosti modala
  useEffect(() => {
    if (!player) return;

    if (visible && isPlayerReady) {
      // Mala odgoda da se modal otvori
      setTimeout(() => {
        if (playerRef.current) {
          try {
            playerRef.current.play();
          } catch (e) {
            console.log("Error playing video:", e);
          }
        }
      }, 100);
    } else if (!visible && playerRef.current) {
      try {
        playerRef.current.pause();
      } catch (e) {
        console.log("Error pausing video:", e);
      }
    }
  }, [visible, player, isPlayerReady]);

  // Čišćenje pri odmontiranju
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          // Oslobodi resurse ako je moguće
          if (typeof playerRef.current.release === "function") {
            playerRef.current.release();
          }
        } catch (e) {
          console.log("Error cleaning up video player:", e);
        }
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={vpModal.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={vpModal.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={vpModal.videoContainer}>
          {visible && (
            <VideoView
              player={player}
              style={vpModal.video}
              contentFit="contain"
              nativeControls={true}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const vpModal = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    marginHorizontal: 12,
    textAlign: "center",
  },
  videoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});

// ─── Screen Time Countdown ────────────────────────────────────────────────────
function ScreenTimeCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = async () => {
      const limitStr = await AsyncStorage.getItem("screenTimeLimit");
      const startStr = await AsyncStorage.getItem("screenTimeStart");
      if (!limitStr || !startStr || parseInt(limitStr) === 0) {
        setRemaining(null);
        return;
      }
      const limit = parseInt(limitStr) * 60 * 1000; // ms
      const start = parseInt(startStr);
      const elapsed = Date.now() - start;
      const rem = limit - elapsed;
      if (rem <= 0) {
        setRemaining(0);
        await handleScreenTimeExpired();
      } else {
        setRemaining(Math.floor(rem / 1000));
      }
    };

    check();
    intervalRef.current = setInterval(async () => {
      const limitStr = await AsyncStorage.getItem("screenTimeLimit");
      const startStr = await AsyncStorage.getItem("screenTimeStart");
      if (!limitStr || !startStr || parseInt(limitStr) === 0) {
        setRemaining(null);
        return;
      }
      const limit = parseInt(limitStr) * 60 * 1000;
      const start = parseInt(startStr);
      const elapsed = Date.now() - start;
      const rem = limit - elapsed;
      if (rem <= 0) {
        setRemaining(0);
        await handleScreenTimeExpired();
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setRemaining(Math.floor(rem / 1000));
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleScreenTimeExpired = async () => {
    await AsyncStorage.setItem(
      "screenTimeLogoutDate",
      new Date().toDateString(),
    );
    Alert.alert(
      "Dnevno ograničenje dosegnuto",
      "Koristili ste aplikaciju za dopušteno dnevno vrijeme. Možete se prijaviti sutra.",
      [
        {
          text: "OK",
          onPress: async () => {
            await AsyncStorage.removeItem("token");
            router.replace("/login");
          },
        },
      ],
    );
  };

  if (remaining === null) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isWarning = remaining < 300; // manje od 5 min

  return (
    <View style={[sct.container, isWarning && sct.warning]}>
      <Ionicons
        name="time-outline"
        size={16}
        color={isWarning ? "#ff3b30" : "#2D6418"}
      />
      <Text style={[sct.text, isWarning && sct.warningText]}>
        Preostalo: {mins}:{secs.toString().padStart(2, "0")}
      </Text>
    </View>
  );
}

const sct = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0f0ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 8,
  },
  warning: { backgroundColor: "#fff0f0" },
  text: { fontSize: 13, color: "#2D6418", fontWeight: "600" },
  warningText: { color: "#ff3b30" },
});

const getThumbnail = (item: any): string | null => {
  if (item.type === "image") {
    return item.url || item.filePath || null;
  }
  return null;
};

// ─── Me Tab ───────────────────────────────────────────────────────────────────
function MeTab({ userId }: { userId: number | null }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  // Kreiraj player s dinamičkim URL-om
  const videoUrl = selectedMedia?.type === "video" ? selectedMedia.url : "";
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
    setPlayerReady(true);
  });

  // Kontroliraj play/pause kada se modal otvori/zatvori
  useEffect(() => {
    if (
      showMediaModal &&
      selectedMedia?.type === "video" &&
      playerReady &&
      player
    ) {
      player.play();
    } else if (!showMediaModal && player) {
      player.pause();
    }
  }, [showMediaModal, selectedMedia, playerReady, player]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/media/my-media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Media items from API:", data);
        setItems(data);
      } else {
        const fallback = await fetch(
          `${API_BASE_URL}/api/video/user/${userId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (fallback.ok) {
          const vids = await fallback.json();
          console.log("Video items from fallback:", vids);
          setItems(
            vids.map((v: any) => ({
              id: v.id,
              url: v.filePath,
              // Ispravno odredi tip na temelju ekstenzije fajla
              type:
                v.filePath?.toLowerCase().endsWith(".jpg") ||
                v.filePath?.toLowerCase().endsWith(".jpeg") ||
                v.filePath?.toLowerCase().endsWith(".png") ||
                v.filePath?.toLowerCase().endsWith(".gif") ||
                v.filePath?.toLowerCase().endsWith(".webp")
                  ? "image"
                  : "video",
              createdAt: v.createdAt,
              title: v.title,
            })),
          );
        }
      }
    } catch (e) {
      console.error("MeTab load error:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // OTVARANJE MEDIJA ZA PREGLED
  const openMedia = (item: any) => {
    console.log("Opening media:", item.type, item.url);
    setSelectedMedia(item);
    setShowMediaModal(true);
  };

  // BRISANJE S POTVRDOM
  const confirmDelete = (item: any) => {
    Alert.alert(
      "Obriši medij",
      `Jeste li sigurni da želite obrisati "${item.title || "medij"}"?`,
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Obriši",
          style: "destructive",
          onPress: () => deleteItem(item.id),
        },
      ],
    );
  };

  // BRISANJE MEDIJA
  const deleteItem = async (id: number) => {
    const token = await AsyncStorage.getItem("token");
    try {
      let res = await fetch(`${API_BASE_URL}/api/media/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/api/video/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        Alert.alert("Uspjeh", "Medij je uspješno obrisan");
      } else {
        Alert.alert("Greška", "Nije moguće obrisati medij");
      }
    } catch (error) {
      console.error("Delete error:", error);
      Alert.alert("Greška", "Nije moguće obrisati medij");
    }
  };

  const addMedia = async () => {
    Alert.alert("Dodaj medij", "Odaberi izvor", [
      { text: "Galerija", onPress: () => pickMedia("gallery") },
      { text: "Kamera", onPress: () => pickMedia("camera") },
      { text: "Odustani", style: "cancel" },
    ]);
  };

  const pickMedia = async (source: "gallery" | "camera") => {
    const perm =
      source === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const result =
      source === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            quality: 1,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            quality: 1,
          });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploading(true);
      try {
        const token = await AsyncStorage.getItem("token");
        let userId = await AsyncStorage.getItem("userId");

        if (!userId || userId === "0") {
          try {
            const payload = JSON.parse(atob(token!.split(".")[1]));
            userId =
              payload[
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
              ];
          } catch {}
        }

        const formData = new FormData();
        formData.append("Video", {
          uri: asset.uri,
          type: asset.type === "video" ? "video/mp4" : "image/jpeg",
          name: asset.type === "video" ? "media.mp4" : "media.jpg",
        } as any);
        formData.append("Title", asset.type === "video" ? "Video" : "Slika");
        formData.append("Location", "Moja lokacija");
        formData.append("Description", "Nema opisa");
        formData.append("UserId", userId || "");

        const res = await fetch(`${API_BASE_URL}/api/video/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (res.ok) {
          Alert.alert("Uspjeh!", "Medij je dodan u 'Moje'");
          load();
        } else {
          const err = await res.text();
          console.error("Upload error:", err);
          Alert.alert("Greška pri uploadu", err || "Nepoznata greška");
        }
      } catch (e) {
        console.error("Upload error:", e);
        Alert.alert("Greška", "Upload nije uspio. Provjeri konekciju.");
      } finally {
        setUploading(false);
      }
    }
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color="#2D6418" />;

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        style={tab.addBtn}
        onPress={addMedia}
        disabled={uploading}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={tab.addBtnText}>
          {uploading ? "Uploadam..." : "Dodaj sliku/video"}
        </Text>
      </TouchableOpacity>
      {items.length === 0 ? (
        <EmptyTab icon="images-outline" text="Nema objavljenog sadržaja" />
      ) : (
        <FlatList
          data={items}
          numColumns={3}
          keyExtractor={(i) => i.id.toString()}
          // U MeTab komponenti, zamijeni renderItem dio:

          renderItem={({ item }) => {
            const isVideo = item.type === "video";
            const imageUrl = getThumbnail(item);

            return (
              <TouchableOpacity
                style={tab.gridItem}
                onPress={() => openMedia(item)}
                onLongPress={() => confirmDelete(item)}
                activeOpacity={0.7}
              >
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={tab.gridImg} />
                ) : (
                  <View
                    style={[
                      tab.gridImg,
                      {
                        backgroundColor: "#1a1a2e",
                        justifyContent: "center",
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Ionicons name="videocam" size={32} color="#2D6418" />
                  </View>
                )}
                {isVideo && (
                  <View style={tab.videoIcon}>
                    <Ionicons name="play-circle" size={28} color="#fff" />
                  </View>
                )}

                <View style={tab.deleteOverlay}>
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                </View>

                <Text style={tab.gridDate} numberOfLines={1}>
                  {new Date(item.createdAt).toLocaleDateString("hr-HR")}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}

      <Modal
        visible={showMediaModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowMediaModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={styles.mediaModalHeader}>
            <TouchableOpacity onPress={() => setShowMediaModal(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.mediaModalTitle} numberOfLines={1}>
              {selectedMedia?.title || "Pregled"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowMediaModal(false);
                if (selectedMedia) confirmDelete(selectedMedia);
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#ff4757" />
            </TouchableOpacity>
          </View>
          <View style={styles.mediaModalContent}>
            {selectedMedia?.type === "video" ? (
              <VideoView
                player={player}
                style={styles.mediaModalVideo}
                contentFit="contain"
                nativeControls={true}
              />
            ) : selectedMedia?.type === "image" ? (
              <Image
                source={{ uri: selectedMedia.url }}
                style={styles.mediaModalImage}
                resizeMode="contain"
                onError={(e) =>
                  console.log("Image load error:", e.nativeEvent.error)
                }
                onLoad={() => console.log("Image loaded:", selectedMedia.url)}
              />
            ) : (
              // Fallback ako nije ni video ni image
              <View style={styles.mediaModalImage}>
                <Text style={{ color: "#fff" }}>Nepoznati medij</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ─── Box Tab ──────────────────────────────────────────────────────────────────
// ─── Box Tab ──────────────────────────────────────────────────────────────────
function BoxTab() {
  const [items, setItems] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<BoxItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/api/savedvideo/my-saved`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          console.log("Box items loaded:", data.length);
          setItems(data);
        }
      } catch (error) {
        console.error("Error loading box:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const removeFromBox = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    const userId = await AsyncStorage.getItem("userId");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/savedvideo/unsave?videoId=${videoId}&userId=${userId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        setItems((p) => p.filter((i) => i.videoId !== videoId));
        Alert.alert("Uspjeh", "Video je uklonjen iz Boxa");
      }
    } catch (error) {
      Alert.alert("Greška", "Nije moguće ukloniti video");
    }
  };

  const handleRemove = (videoId: number, title: string) => {
    Alert.alert(
      "Ukloni iz Boxa",
      `Jeste li sigurni da želite ukloniti "${title}" iz Boxa?`,
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Ukloni",
          style: "destructive",
          onPress: () => removeFromBox(videoId),
        },
      ],
    );
  };

  const openVideo = (item: BoxItem) => {
    setSelectedVideo(item);
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color="#2D6418" />;
  if (items.length === 0)
    return <EmptyTab icon="bookmark-outline" text="Box je prazan" />;

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id.toString()}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        renderItem={({ item }) => {
          const videoUrl = item.filePath?.startsWith("http")
            ? item.filePath
            : `${API_BASE_URL}${item.filePath}`;

          return (
            <TouchableOpacity
              style={tab.listItem}
              onPress={() => openVideo(item)}
              activeOpacity={0.7}
            >
              <View style={tab.thumbContainer}>
                {/* Za video, koristimo placeholder umjesto slike */}
                <View
                  style={[
                    tab.thumb,
                    {
                      backgroundColor: "#1a1a2e",
                      justifyContent: "center",
                      alignItems: "center",
                    },
                  ]}
                >
                  <Ionicons name="videocam" size={30} color="#2D6418" />
                </View>
                <View style={tab.playIcon}>
                  <Ionicons name="play-circle" size={28} color="#fff" />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={tab.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={tab.itemMeta}>@{item.userName}</Text>
                <Text style={tab.itemDate}>
                  Pohranjeno:{" "}
                  {new Date(item.savedAt).toLocaleDateString("hr-HR")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemove(item.videoId, item.title)}
                style={tab.removeBtn}
              >
                <Ionicons name="trash-outline" size={20} color="#ff4757" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />

      {/* Video Preview Modal */}
      <VideoPreviewModal
        visible={selectedVideo !== null}
        videoUrl={
          selectedVideo?.filePath?.startsWith("http")
            ? selectedVideo.filePath
            : `${API_BASE_URL}${selectedVideo?.filePath || ""}`
        }
        title={selectedVideo?.title || ""}
        onClose={() => setSelectedVideo(null)}
      />
    </>
  );
}

// ─── Wishlist Tab ─────────────────────────────────────────────────────────────
// ─── Wishlist Tab ─────────────────────────────────────────────────────────────
function WishlistTab() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "yes" | "no">("all");
  const [selectedVideo, setSelectedVideo] = useState<WishlistItem | null>(null);

  const loadWishlist = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/wishlistvideo/my-wishlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Wishlist items loaded:", data.length);
        setItems(data);
      } else {
        console.error("Failed to load wishlist:", res.status);
      }
    } catch (error) {
      console.error("Error loading wishlist:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWishlist();
  }, []);

  const filtered = items.filter((i) => {
    if (filter === "yes") return i.isGoing === true;
    if (filter === "no") return i.isGoing === false;
    return true;
  });

  const removeFromWishlist = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    const userId = await AsyncStorage.getItem("userId");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/wishlistvideo/remove?userId=${userId}&videoId=${videoId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        setItems((p) => p.filter((i) => i.videoId !== videoId));
        Alert.alert("Uspjeh", "Video je uklonjen iz Wishlist-a");
      } else {
        Alert.alert("Greška", "Nije moguće ukloniti video");
      }
    } catch (error) {
      Alert.alert("Greška", "Nije moguće ukloniti video");
    }
  };

  const handleRemove = (videoId: number, title: string) => {
    Alert.alert(
      "Obriši iz Wishlist-a",
      `Jeste li sigurni da želite obrisati "${title}" iz Wishlist-a?`,
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Obriši",
          style: "destructive",
          onPress: () => removeFromWishlist(videoId),
        },
      ],
    );
  };

  const toggleGoing = async (item: WishlistItem) => {
    const token = await AsyncStorage.getItem("token");
    const newVal =
      item.isGoing === true ? false : item.isGoing === false ? undefined : true;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/wishlistvideo/update/${item.videoId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isGoing: newVal }),
        },
      );
      if (res.ok) {
        setItems((p) =>
          p.map((i) =>
            i.videoId === item.videoId ? { ...i, isGoing: newVal } : i,
          ),
        );
      }
    } catch (error) {
      console.error("Error updating going status:", error);
    }
  };

  // Funkcija za otvaranje videa
  const openVideo = (item: WishlistItem) => {
    setSelectedVideo(item);
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color="#2D6418" />;

  return (
    <>
      <View style={{ flex: 1 }}>
        <View style={tab.filterRow}>
          {(["all", "yes", "no"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[tab.filterBtn, filter === f && tab.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  tab.filterBtnText,
                  filter === f && tab.filterBtnTextActive,
                ]}
              >
                {f === "all"
                  ? "Svi"
                  : f === "yes"
                    ? "✅ Bio sam"
                    : "❌ Nisam bio"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {filtered.length === 0 ? (
          <EmptyTab icon="star-outline" text="Wishlist je prazan" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.videoId.toString()}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
            renderItem={({ item }) => {
              const videoUrl = item.filePath?.startsWith("http")
                ? item.filePath
                : `${API_BASE_URL}${item.filePath}`;

              return (
                <TouchableOpacity
                  style={tab.listItem}
                  onPress={() => openVideo(item)}
                  activeOpacity={0.7}
                >
                  <View style={tab.thumbContainer}>
                    {/* Za video, koristimo placeholder umjesto slike */}
                    <View
                      style={[
                        tab.thumb,
                        {
                          backgroundColor: "#1a1a2e",
                          justifyContent: "center",
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Ionicons name="videocam" size={30} color="#2D6418" />
                    </View>
                    <View style={tab.playIcon}>
                      <Ionicons name="play-circle" size={28} color="#fff" />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={tab.itemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={tab.itemDate}>
                      Dodano:{" "}
                      {new Date(item.addedAt).toLocaleDateString("hr-HR")}
                    </Text>
                    <TouchableOpacity onPress={() => toggleGoing(item)}>
                      <Text style={tab.goingBadge}>
                        {item.isGoing === true
                          ? "✅ Bio/la sam"
                          : item.isGoing === false
                            ? "❌ Nisam bio/la"
                            : "⭕ Neodlučeno"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemove(item.videoId, item.title)}
                    style={tab.removeBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff4757" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* Video Preview Modal */}
      <VideoPreviewModal
        visible={selectedVideo !== null}
        videoUrl={
          selectedVideo?.filePath?.startsWith("http")
            ? selectedVideo.filePath
            : `${API_BASE_URL}${selectedVideo?.filePath || ""}`
        }
        title={selectedVideo?.title || ""}
        onClose={() => setSelectedVideo(null)}
      />
    </>
  );
}

// ─── Golden Friends Tab ───────────────────────────────────────────────────────
// ─── Golden Friends Tab ───────────────────────────────────────────────────────
function GoldenFriendsTab() {
  const [friends, setFriends] = useState<GoldenFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const loadGoldenFriends = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const storedId = await AsyncStorage.getItem("userId");
        const userId = storedId ? parseInt(storedId) : null;
        setCurrentUserId(userId);

        const res = await fetch(`${API_BASE_URL}/api/golden-friends`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Osiguraj da svaki friend ima ispravan avatar URL
          const friendsWithAvatar = data.map((friend: any) => ({
            ...friend,
            avatar: friend.avatar
              ? friend.avatar.startsWith("http")
                ? friend.avatar
                : `${API_BASE_URL}${friend.avatar.startsWith("/") ? "" : "/"}${friend.avatar}`
              : null,
          }));
          setFriends(friendsWithAvatar);
        } else {
          console.error("Failed to load golden friends:", res.status);
        }
      } catch (error) {
        console.error("Error loading golden friends:", error);
      } finally {
        setLoading(false);
      }
    };

    loadGoldenFriends();
  }, []);

  const remove = async (userId: number) => {
    Alert.alert("Ukloni", "Ukloniti ovog Golden Frienda?", [
      { text: "Odustani", style: "cancel" },
      {
        text: "Ukloni",
        style: "destructive",
        onPress: async () => {
          const token = await AsyncStorage.getItem("token");
          await fetch(`${API_BASE_URL}/api/golden-friends/remove/${userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          setFriends((p) => p.filter((f) => f.userId !== userId));
        },
      },
    ]);
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color="#2D6418" />;
  if (friends.length === 0)
    return (
      <EmptyTab
        icon="star-outline"
        text="Nema Golden Friendova. Dodaj ih kod pregleda korisnika!"
      />
    );

  return (
    <FlatList
      data={friends}
      keyExtractor={(f) => f.userId.toString()}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
      renderItem={({ item }) => {
        const firstName = item.firstName || "";
        const lastName = item.lastName || "";
        const initials =
          `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

        return (
          <View style={tab.listItem}>
            {/* Avatar - prikaži profilnu sliku ako postoji */}
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/profile/[userId]",
                  params: { userId: item.userId.toString() },
                } as any)
              }
            >
              {item.avatar ? (
                <Image
                  source={{ uri: item.avatar }}
                  style={{ width: 50, height: 50, borderRadius: 25 }}
                />
              ) : (
                <View
                  style={[
                    styles.goldenAvatar,
                    { width: 50, height: 50, borderRadius: 25 },
                  ]}
                >
                  <Text style={styles.goldenAvatarText}>{initials || "?"}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 1, marginLeft: 12 }}
              onPress={() =>
                router.push({
                  pathname: "/profile/[userId]",
                  params: { userId: item.userId.toString() },
                } as any)
              }
            >
              <Text style={tab.itemTitle}>
                {item.firstName} {item.lastName}
              </Text>
              <Text style={tab.itemMeta}>@{item.username}</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[
                  tab.removeBtn,
                  { backgroundColor: "#f0f0ff", borderRadius: 8, padding: 8 },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/chat/[userId]",
                    params: {
                      userId: item.userId.toString(),
                      name: `${item.firstName} ${item.lastName}`,
                    },
                  })
                }
              >
                <Ionicons
                  name="paper-plane-outline"
                  size={18}
                  color="#2D6418"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[tab.removeBtn, { padding: 8 }]}
                onPress={() => remove(item.userId)}
              >
                <Ionicons name="star" size={18} color="#FFD700" />
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}
// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: ProfileData | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? true);
  const [showUsernameOnProfile, setShowUsernameOnProfile] = useState(
    profile?.showUsername ?? true,
  );
  const [screenLimit, setScreenLimit] = useState(
    profile?.screenTimeLimitMinutes ?? 0,
  );
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showActivityArchive, setShowActivityArchive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setIsPublic(profile.isPublic);
      setShowUsernameOnProfile(profile.showUsername ?? true);
      setScreenLimit(profile.screenTimeLimitMinutes ?? 0);
    }
  }, [profile]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/auth/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isPublic,
          showUsername: showUsernameOnProfile,
          screenTimeLimitMinutes: screenLimit,
        }),
      });
      if (res.ok) {
        // Lokalno spremi u AsyncStorage za prikaz
        await AsyncStorage.setItem("profileIsPublic", String(isPublic));
        await AsyncStorage.setItem(
          "profileShowUsername",
          String(showUsernameOnProfile),
        );
        Alert.alert("Spremljeno ✅", "Postavke su uspješno ažurirane");
        onSaved();
      } else {
        const err = await res.text();
        Alert.alert("Greška", err || "Nije moguće pohraniti postavke");
      }
    } catch {
      Alert.alert("Greška", "Nije moguće pohraniti postavke");
    } finally {
      setSaving(false);
    }
  };

  // Upravljanje vremenom s potvrdom i pokretanjem odbrojavanja
  const handleScreenLimitSelect = (mins: number) => {
    if (mins === 0) {
      setScreenLimit(0);
      AsyncStorage.removeItem("screenTimeLimit");
      AsyncStorage.removeItem("screenTimeStart");
      return;
    }
    Alert.alert(
      "Postavi ograničenje",
      `Koristit ćete aplikaciju još ${mins} minuta. Nakon toga ćete biti automatski odjavljeni i moći ćete se prijaviti tek sutra.\n\nJeste li sigurni?`,
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Postavi",
          onPress: async () => {
            setScreenLimit(mins);
            await AsyncStorage.setItem("screenTimeLimit", String(mins));
            await AsyncStorage.setItem("screenTimeStart", String(Date.now()));
            await AsyncStorage.removeItem("screenTimeLogoutDate");
          },
        },
      ],
    );
  };

  const loadBlocked = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/block/blocked-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBlockedUsers(await res.json());
    } catch {}
    setShowBlocked(true);
  };

  const unblockUser = async (userId: number) => {
    const token = await AsyncStorage.getItem("token");
    await fetch(`${API_BASE_URL}/api/block/unblock/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setBlockedUsers((p) => p.filter((u) => u.id !== userId));
  };

  const handleLogout = () => {
    Alert.alert("Odjava", "Jeste li sigurni?", [
      { text: "Odustani", style: "cancel" },
      {
        text: "Odjavi se",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Brisanje računa",
      "Ovo će trajno obrisati vaš račun i sve podatke. Jeste li sigurni?",
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Obriši",
          style: "destructive",
          onPress: async () => {
            const token = await AsyncStorage.getItem("token");
            await fetch(`${API_BASE_URL}/api/auth/delete-account`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            await AsyncStorage.clear();
            router.replace("/login");
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={sm.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={sm.title}>Postavke</Text>
          <TouchableOpacity onPress={saveSettings} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#2D6418" />
            ) : (
              <Text style={sm.saveBtn}>Spremi</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          {/* Privacy */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>Privatnost</Text>

            <View style={sm.row}>
              <View style={{ flex: 1 }}>
                <Text style={sm.rowLabel}>Javni profil</Text>
                <Text style={sm.rowSub}>Svi mogu vidjeti vaš profil</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={(val) => setIsPublic(val)}
                trackColor={{ true: "#2D6418", false: "#ccc" }}
                thumbColor="#fff"
              />
            </View>
            <Text style={sm.currentValue}>
              Trenutno: {isPublic ? "🌐 Javan" : "🔒 Privatan"}
            </Text>

            <View style={sm.row}>
              <View style={{ flex: 1 }}>
                <Text style={sm.rowLabel}>Prikaži korisničko ime</Text>
                <Text style={sm.rowSub}>Vidljivo na vašem profilu</Text>
              </View>
              <Switch
                value={showUsernameOnProfile}
                onValueChange={(val) => setShowUsernameOnProfile(val)}
                trackColor={{ true: "#2D6418", false: "#ccc" }}
                thumbColor="#fff"
              />
            </View>
            <Text style={sm.currentValue}>
              Trenutno: {showUsernameOnProfile ? "👁 Vidljivo" : "🙈 Skriveno"}
            </Text>
          </View>

          {/* Screen Time */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>Upravljanje vremenom</Text>
            <Text style={sm.rowSub}>Dnevno ograničenje korištenja</Text>
            {screenLimit > 0 && (
              <View style={sm.activeLimit}>
                <Ionicons name="time-outline" size={16} color="#2D6418" />
                <Text style={sm.activeLimitText}>
                  Aktivno ograničenje: {screenLimit} min
                </Text>
              </View>
            )}
            <View style={sm.timeRow}>
              {[0, 30, 60, 90, 120, 180].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[sm.timeBtn, screenLimit === mins && sm.timeBtnActive]}
                  onPress={() => handleScreenLimitSelect(mins)}
                >
                  <Text
                    style={[
                      sm.timeBtnText,
                      screenLimit === mins && sm.timeBtnTextActive,
                    ]}
                  >
                    {mins === 0 ? "Bez ogr." : `${mins}min`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Blocked Users */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>Blokirani korisnici</Text>
            <TouchableOpacity style={sm.row} onPress={loadBlocked}>
              <Text style={sm.rowLabel}>Popis blokiranih</Text>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
            {showBlocked && (
              <View style={{ marginTop: 8 }}>
                {blockedUsers.length === 0 ? (
                  <Text style={sm.rowSub}>Nema blokiranih korisnika</Text>
                ) : (
                  blockedUsers.map((u) => (
                    <View key={u.id} style={sm.blockedUser}>
                      <Text style={sm.rowLabel}>
                        {u.firstName} {u.lastName}
                      </Text>
                      <TouchableOpacity onPress={() => unblockUser(u.id)}>
                        <Text style={{ color: "#2D6418", fontSize: 13 }}>
                          Odblokiraj
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Activity Archive */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>Aktivnosti</Text>
            <TouchableOpacity
              style={sm.row}
              onPress={() => setShowActivityArchive(!showActivityArchive)}
            >
              <Text style={sm.rowLabel}>Arhiva aktivnosti</Text>
              <Ionicons
                name={showActivityArchive ? "chevron-up" : "chevron-down"}
                size={20}
                color="#2D6418"
              />
            </TouchableOpacity>
            {showActivityArchive && (
              <View style={{ height: 600 }}>
                <ActivityArchive userId={profile?.id ?? null} />
              </View>
            )}
          </View>

          {/* Danger Zone */}
          <View style={sm.section}>
            <Text style={[sm.sectionTitle, { color: "#ff4757" }]}>
              Opasna zona
            </Text>
            <TouchableOpacity style={sm.dangerBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#ff4757" />
              <Text style={sm.dangerBtnText}>Odjavi se</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sm.dangerBtn, { marginTop: 8 }]}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4757" />
              <Text style={sm.dangerBtnText}>Obriši račun</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const sm = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 17, fontWeight: "600", color: "#333" },
  saveBtn: { color: "#2D6418", fontSize: 16, fontWeight: "600" },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#999",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  rowLabel: { fontSize: 16, color: "#333" },
  rowSub: { fontSize: 13, color: "#999", marginTop: 2 },
  currentValue: {
    fontSize: 12,
    color: "#2D6418",
    marginTop: 4,
    marginBottom: 8,
  },
  activeLimit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0f0ff",
    padding: 8,
    borderRadius: 8,
    marginVertical: 8,
  },
  activeLimitText: { fontSize: 13, color: "#2D6418", fontWeight: "600" },
  timeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  timeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  timeBtnActive: { backgroundColor: "#2D6418" },
  timeBtnText: { fontSize: 13, color: "#666" },
  timeBtnTextActive: { color: "#fff" },
  blockedUser: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#ff4757",
  },
  dangerBtnText: { color: "#ff4757", fontSize: 15, fontWeight: "600" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function EmptyTab({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={tab.empty}>
      <Ionicons name={icon} size={56} color="#d0d0d0" />
      <Text style={tab.emptyText}>{text}</Text>
    </View>
  );
}

const tab = StyleSheet.create({
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2D6418",
    borderRadius: 12,
    margin: 16,
    paddingVertical: 12,
    gap: 8,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  gridItem: { flex: 1 / 3, aspectRatio: 1, padding: 1 },
  gridImg: { width: "100%", height: "100%" },
  videoIcon: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  gridDate: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    fontSize: 10,
    color: "#fff",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  // DODAJTE OVE STILOVE OVDJE:
  thumbContainer: {
    position: "relative",
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
  },
  playIcon: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  // KRAJ DODANIH STILOVA
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 3,
  },
  itemMeta: { fontSize: 13, color: "#2D6418", marginBottom: 2 },
  itemDate: { fontSize: 12, color: "#999" },
  removeBtn: { padding: 8 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#bbb",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  deleteOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  filterBtnActive: { backgroundColor: "#2D6418" },
  filterBtnText: { fontSize: 13, color: "#666" },
  filterBtnTextActive: { color: "#fff" },
  goingBadge: { fontSize: 13, color: "#2D6418", marginTop: 4 },
});

// Praćenje vremena sesije - DODAJTE OVO PRIJE ProfileScreen
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
    console.log(`Tracked session: ${minutes} minutes`);
  } catch (error) {
    console.error("Error tracking session:", error);
  }
};

// ─── Main Profile Screen ──────────────────────────────────────────────────────
export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("me");
  const [showSettings, setShowSettings] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  // DODAJTE OVAJ USEFFECT ZA PRAĆENJE VREMENA (smjestite ga nakon ostalih useEffectova)
  useEffect(() => {
    console.log("🟢 Session tracking STARTED");
    let sessionStart = Date.now();
    console.log(
      "Session start time:",
      new Date(sessionStart).toLocaleTimeString(),
    );

    let isTracking = false;

    const trackCurrentSession = async () => {
      if (isTracking) return;
      isTracking = true;

      const sessionEnd = Date.now();
      const minutes = Math.floor((sessionEnd - sessionStart) / (1000 * 60));
      console.log(`📊 Session duration: ${minutes} minutes`);
      if (minutes > 0) {
        await trackSessionTime(minutes);
      }
      isTracking = false;
    };

    // Pratimo kada se aplikacija gasi ili ide u pozadinu
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        console.log(`📱 App state changed to: ${nextAppState}`); // Ovo je ključno
        if (nextAppState === "background" || nextAppState === "inactive") {
          await trackCurrentSession();
        } else if (nextAppState === "active") {
          // Resetiraj start vremena kada se aplikacija vrati u prvi plan
          sessionStart = Date.now();
          console.log(
            "Session restarted at:",
            new Date(sessionStart).toLocaleTimeString(),
          );
        }
      },
    );

    // Čišćenje pri unmountu
    return () => {
      console.log("🔴 Cleaning up session tracking");
      subscription.remove();
      // Spremi zadnju sesiju
      const finalMinutes = Math.floor(
        (Date.now() - sessionStart) / (1000 * 60),
      );
      if (finalMinutes > 0) {
        trackSessionTime(finalMinutes);
      }
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      // 🔥 Pokušaj dohvatiti profil sa servera
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/my-profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setLoading(false);
          return;
        }
      } catch (networkError) {
        // 🔥 TIHO IGNORIRAJ — network nije dostupan
        // Ne prikazujemo grešku korisniku, samo koristimo cached podatke
        console.log("Network not available, using cached data");
      }

      // 🔥 FALLBACK: Učitaj iz AsyncStorage (cached podaci)
      const [first, last, userId] = await Promise.all([
        AsyncStorage.getItem("firstName"),
        AsyncStorage.getItem("lastName"),
        AsyncStorage.getItem("userId"),
      ]);
      const cachedIsPublic = await AsyncStorage.getItem("profileIsPublic");
      const cachedShowUsername = await AsyncStorage.getItem(
        "profileShowUsername",
      );

      setProfile({
        id: parseInt(userId ?? "0"),
        firstName: first ?? "",
        lastName: last ?? "",
        username: first?.toLowerCase() ?? "",
        followersCount: 0,
        followingCount: 0,
        isPublic: cachedIsPublic !== null ? cachedIsPublic === "true" : true,
        showUsername:
          cachedShowUsername !== null ? cachedShowUsername === "true" : true,
      });
    } catch (error) {
      // 🔥 Potpuni fallback - čak ni cached podaci ne postoje
      console.log("Failed to load profile from any source");
      // Ne radimo ništa, profile ostaje null
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, []);

  // Provjeri screen time limit pri učitavanju
  useEffect(() => {
    (async () => {
      const logoutDate = await AsyncStorage.getItem("screenTimeLogoutDate");
      if (logoutDate === new Date().toDateString()) {
        Alert.alert(
          "Dnevno ograničenje",
          "Dosegli ste dnevno ograničenje korištenja aplikacije. Pokušajte sutra.",
          [
            {
              text: "OK",
              onPress: async () => {
                await AsyncStorage.removeItem("token");
                router.replace("/login");
              },
            },
          ],
        );
      }
    })();
  }, []);

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "me", label: "Moje", icon: "person-outline" },
    { key: "box", label: "Box", icon: "bookmark-outline" },
    { key: "wishlist", label: "Wishlist", icon: "star-outline" },
    { key: "golden", label: "Golden", icon: "star" },
  ];

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2D6418" />
      </View>
    );

  // Prikaz korisničkog imena ovisi o postavci showUsername
  const displayUsername =
    profile?.showUsername !== false ? `@${profile?.username}` : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
          <TouchableOpacity onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Screen time countdown (ako je postavljeno) */}
        <ScreenTimeCountdown />

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <AvatarSection onUpdate={load} />
          <Text style={styles.name}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          {/* Prikaži username samo ako nije skriveno */}
          {displayUsername && (
            <Text style={styles.usernameText}>{displayUsername}</Text>
          )}

          {/* Privacy badge */}
          <View style={styles.privacyBadge}>
            <Ionicons
              name={profile?.isPublic ? "globe-outline" : "lock-closed-outline"}
              size={12}
              color="#2D6418"
            />
            <Text style={styles.privacyText}>
              {profile?.isPublic ? "Javni profil" : "Privatni profil"}
            </Text>
          </View>

          {/* Stats – klikabilni za prikaz liste */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.stat}
              onPress={() => setShowFollowers(true)}
            >
              <Text style={styles.statNum}>{profile?.followersCount ?? 0}</Text>
              <Text style={styles.statLabel}>Pratitelji</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.stat}
              onPress={() => setShowFollowing(true)}
            >
              <Text style={styles.statNum}>{profile?.followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>Praćeni</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tabBtn,
                activeTab === t.key && styles.tabBtnActive,
              ]}
              onPress={() => setActiveTab(t.key)}
            >
              <Ionicons
                name={t.icon}
                size={18}
                color={activeTab === t.key ? "#2D6418" : "#999"}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === t.key && styles.tabBtnTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={{ flex: 1 }}>
          {activeTab === "me" && <MeTab userId={profile?.id ?? null} />}
          {activeTab === "box" && <BoxTab />}
          {activeTab === "wishlist" && <WishlistTab />}
          {activeTab === "golden" && <GoldenFriendsTab />}
        </View>

        {/* 👇👇👇 DODAJTE OVDJE - PRIJE ZADNJEG </View> 👇👇👇 */}
        {/* Admin Panel Link - SAMO ZA TESTIRANJE */}
        <View
          style={{
            position: "absolute",
            bottom: 20,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => router.push("/admin/login")}
            style={{
              backgroundColor: "#2D6418",
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
              Admin Panel
            </Text>
          </TouchableOpacity>
        </View>
        {/* 👆👆👆 DODAJTE GORE 👆👆👆 */}
      </View>

      {/* Settings */}
      <SettingsModal
        visible={showSettings}
        profile={profile}
        onClose={() => setShowSettings(false)}
        onSaved={() => {
          setShowSettings(false);
          load();
        }}
      />

      {/* Followers list */}
      <FollowListModal
        visible={showFollowers}
        type="followers"
        userId={profile?.id ?? null}
        onClose={() => setShowFollowers(false)}
        onUpdate={load}
      />

      {/* Following list */}
      <FollowListModal
        visible={showFollowing}
        type="following"
        userId={profile?.id ?? null}
        onClose={() => setShowFollowing(false)}
        onUpdate={load}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#1a1a1a" },
  profileSection: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  name: { fontSize: 22, fontWeight: "700", color: "#1a1a1a", marginBottom: 2 },
  usernameText: { fontSize: 15, color: "#2D6418", marginBottom: 6 },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0f0ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  },
  privacyText: { fontSize: 12, color: "#2D6418", fontWeight: "500" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 32 },
  stat: { alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  statLabel: { fontSize: 13, color: "#999", marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: "#e0e0e0" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: "#2D6418" },
  tabBtnText: { fontSize: 11, color: "#999" },
  tabBtnTextActive: { color: "#2D6418", fontWeight: "600" },
  thumbContainer: {
    position: "relative",
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
  },
  playIcon: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 3,
  },
  itemMeta: { fontSize: 13, color: "#2D6418 ", marginBottom: 2 },
  itemDate: { fontSize: 12, color: "#999" },
  removeBtn: { padding: 8 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#bbb",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  filterBtnActive: { backgroundColor: "#2D6418" },
  filterBtnText: { fontSize: 13, color: "#666" },
  filterBtnTextActive: { color: "#fff" },
  goingBadge: { fontSize: 13, color: "#2D6418", marginTop: 4 },
  deleteOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    padding: 4,
  },
  mediaModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  mediaModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    marginHorizontal: 12,
    textAlign: "center",
  },
  mediaModalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  mediaModalVideo: {
    width: "100%",
    height: "100%",
  },
  mediaModalImage: {
    width: "100%",
    height: "100%",
  },
  goldenAvatar: {
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
  },
  goldenAvatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
