// app/(tabs)/profile.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { API_BASE_URL } from "../config/api";

// ─── Types ────────────────────────────────────────────────────────────────────
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
  screenTimeLimitMinutes?: number;
}

interface MediaItem {
  id: number;
  url: string;
  type: "image" | "video";
  createdAt: string;
  title?: string;
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
  isGoing?: boolean; // "da" ili "ne"
  notes?: string;
}

interface GoldenFriend {
  userId: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string;
}

// ─── Avatar Uploader ──────────────────────────────────────────────────────────
function AvatarSection({
  profile,
  onUpdate,
}: {
  profile: ProfileData | null;
  onUpdate: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const pickAndUpload = async () => {
    Alert.alert("Profilna slika", "Odaberi izvor", [
      {
        text: "Galerija",
        onPress: () => pickImage("gallery"),
      },
      {
        text: "Kamera",
        onPress: () => pickImage("camera"),
      },
      {
        text: "Ukloni sliku",
        style: "destructive",
        onPress: removeAvatar,
      },
      { text: "Odustani", style: "cancel" },
    ]);
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

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
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
      if (res.ok) onUpdate();
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
      await fetch(`${API_BASE_URL}/api/auth/profile-photo`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      onUpdate();
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const initials =
    `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <TouchableOpacity style={av.wrapper} onPress={pickAndUpload}>
      {profile?.avatar ? (
        <Image source={{ uri: profile.avatar }} style={av.img} />
      ) : (
        <View style={av.placeholder}>
          <Text style={av.initials}>{initials}</Text>
        </View>
      )}
      {loading ? (
        <View style={av.overlay}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <View style={av.editIcon}>
          <Ionicons name="camera" size={14} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const av = StyleSheet.create({
  wrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: "center",
    marginBottom: 12,
  },
  img: { width: 96, height: 96, borderRadius: 48 },
  placeholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  initials: { color: "#fff", fontSize: 36, fontWeight: "700" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  editIcon: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
});

// ─── "Me" Tab (own photos & videos) ──────────────────────────────────────────
function MeTab({ userId }: { userId: number | null }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/media/my-media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setItems(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

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
        const formData = new FormData();
        formData.append("media", {
          uri: asset.uri,
          type: asset.type === "video" ? "video/mp4" : "image/jpeg",
          name: asset.type === "video" ? "media.mp4" : "media.jpg",
        } as any);
        formData.append(
          "mediaType",
          asset.type === "video" ? "video" : "image",
        );
        await fetch(`${API_BASE_URL}/api/media/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        load();
      } catch {
      } finally {
        setUploading(false);
      }
    }
  };

  const deleteItem = async (id: number) => {
    Alert.alert("Brisanje", "Jeste li sigurni?", [
      { text: "Odustani", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: async () => {
          const token = await AsyncStorage.getItem("token");
          await fetch(`${API_BASE_URL}/api/media/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          setItems((p) => p.filter((i) => i.id !== id));
        },
      },
    ]);
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color="#667eea" />;

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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={tab.gridItem}
              onLongPress={() => deleteItem(item.id)}
            >
              <Image source={{ uri: item.url }} style={tab.gridImg} />
              {item.type === "video" && (
                <View style={tab.videoIcon}>
                  <Ionicons name="play-circle" size={22} color="#fff" />
                </View>
              )}
              <Text style={tab.gridDate} numberOfLines={1}>
                {new Date(item.createdAt).toLocaleDateString("hr-HR")}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </View>
  );
}

// ─── Box Tab ──────────────────────────────────────────────────────────────────
function BoxTab() {
  const [items, setItems] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/api/savedvideo/my-saved`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setItems(await res.json());
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const removeFromBox = async (id: number) => {
    Alert.alert("Ukloni iz Boxa", "Jeste li sigurni?", [
      { text: "Odustani", style: "cancel" },
      {
        text: "Ukloni",
        style: "destructive",
        onPress: async () => {
          const token = await AsyncStorage.getItem("token");
          await fetch(`${API_BASE_URL}/api/savedvideo/remove/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          setItems((p) => p.filter((i) => i.id !== id));
        },
      },
    ]);
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color="#667eea" />;
  if (items.length === 0)
    return <EmptyTab icon="bookmark-outline" text="Box je prazan" />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id.toString()}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
      renderItem={({ item }) => (
        <View style={tab.listItem}>
          <Image source={{ uri: item.filePath }} style={tab.thumb} />
          <View style={{ flex: 1 }}>
            <Text style={tab.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={tab.itemMeta}>@{item.userName}</Text>
            <Text style={tab.itemDate}>
              Pohranjeno: {new Date(item.savedAt).toLocaleDateString("hr-HR")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => removeFromBox(item.videoId)}
            style={tab.removeBtn}
          >
            <Ionicons name="trash-outline" size={20} color="#ff4757" />
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

// ─── Wishlist Tab ─────────────────────────────────────────────────────────────
function WishlistTab() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "yes" | "no">("all");

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/api/wishlist/my-wishlist`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setItems(await res.json());
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((i) => {
    if (filter === "yes") return i.isGoing === true;
    if (filter === "no") return i.isGoing === false;
    return true;
  });

  const removeFromWishlist = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    await fetch(`${API_BASE_URL}/api/wishlist/remove/${videoId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setItems((p) => p.filter((i) => i.videoId !== videoId));
  };

  const toggleGoing = async (item: WishlistItem) => {
    const token = await AsyncStorage.getItem("token");
    const newVal =
      item.isGoing === true ? false : item.isGoing === false ? undefined : true;
    await fetch(`${API_BASE_URL}/api/wishlist/update/${item.videoId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isGoing: newVal }),
    });
    setItems((p) =>
      p.map((i) =>
        i.videoId === item.videoId ? { ...i, isGoing: newVal } : i,
      ),
    );
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color="#667eea" />;

  return (
    <View style={{ flex: 1 }}>
      {/* Filter */}
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
                  ? "✅ Био sam"
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
          renderItem={({ item }) => (
            <View style={tab.listItem}>
              <Image source={{ uri: item.filePath }} style={tab.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={tab.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={tab.itemDate}>
                  Dodano: {new Date(item.addedAt).toLocaleDateString("hr-HR")}
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
                onPress={() => removeFromWishlist(item.videoId)}
                style={tab.removeBtn}
              >
                <Ionicons name="trash-outline" size={20} color="#ff4757" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─── Golden Friends Tab ───────────────────────────────────────────────────────
function GoldenFriendsTab() {
  const [friends, setFriends] = useState<GoldenFriend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/api/golden-friends`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setFriends(await res.json());
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const remove = async (userId: number) => {
    Alert.alert("Ukloni", "Ukloniti ovog Golden Frienda?", [
      { text: "Odustani", style: "cancel" },
      {
        text: "Ukloni",
        style: "destructive",
        onPress: async () => {
          const token = await AsyncStorage.getItem("token");
          await fetch(`${API_BASE_URL}/api/golden-friends/${userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          setFriends((p) => p.filter((f) => f.userId !== userId));
        },
      },
    ]);
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color="#667eea" />;
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
        const initials =
          `${item.firstName?.[0] ?? ""}${item.lastName?.[0] ?? ""}`.toUpperCase();
        return (
          <View style={tab.listItem}>
            <View
              style={[
                av.placeholder,
                { width: 50, height: 50, borderRadius: 25 },
              ]}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {initials}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={tab.itemTitle}>
                {item.firstName} {item.lastName}
              </Text>
              <Text style={tab.itemMeta}>@{item.username}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[
                  tab.removeBtn,
                  { backgroundColor: "#f0f0ff", borderRadius: 8 },
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
                  color="#667eea"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={tab.removeBtn}
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
  const [screenLimit, setScreenLimit] = useState(
    profile?.screenTimeLimitMinutes ?? 0,
  );
  const [showCredentials, setShowCredentials] = useState(false);
  const [username, setUsername] = useState("");
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setIsPublic(profile.isPublic);
      setScreenLimit(profile.screenTimeLimitMinutes ?? 0);
      setUsername(profile.username);
    }
  }, [profile]);

  const saveSettings = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_BASE_URL}/api/auth/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPublic, screenTimeLimitMinutes: screenLimit }),
      });
      onSaved();
    } catch {
      Alert.alert("Greška", "Nije moguće pohraniti postavke");
    }
  };

  const loadBlocked = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/block/blocked-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBlockedUsers(await res.json());
    } catch {}
    setActiveSection("blocked");
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
          <TouchableOpacity onPress={saveSettings}>
            <Text style={sm.saveBtn}>Spremi</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          {/* Privacy */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>Privatnost</Text>
            <View style={sm.row}>
              <View>
                <Text style={sm.rowLabel}>Javni profil</Text>
                <Text style={sm.rowSub}>Svi mogu vidjeti vaš profil</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: "#667eea" }}
              />
            </View>
          </View>

          {/* Credentials */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>Korisnički podaci</Text>
            <TouchableOpacity
              style={sm.row}
              onPress={() => setShowCredentials(!showCredentials)}
            >
              <Text style={sm.rowLabel}>Prikaži korisničko ime</Text>
              <Ionicons
                name={showCredentials ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#667eea"
              />
            </TouchableOpacity>
            {showCredentials && (
              <View style={sm.credBox}>
                <Text style={sm.credLabel}>Korisničko ime:</Text>
                <Text style={sm.credValue}>@{username}</Text>
                <Text style={sm.credNote}>
                  * Lozinka nije prikazana iz sigurnosnih razloga.{"\n"}
                  Možete je promijeniti u postavkama računa.
                </Text>
              </View>
            )}
          </View>

          {/* Screen Time */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>Upravljanje vremenom</Text>
            <Text style={sm.rowSub}>Dnevno ograničenje korištenja</Text>
            <View style={sm.timeRow}>
              {[0, 30, 60, 90, 120, 180].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[sm.timeBtn, screenLimit === mins && sm.timeBtnActive]}
                  onPress={() => setScreenLimit(mins)}
                >
                  <Text
                    style={[
                      sm.timeBtnText,
                      screenLimit === mins && sm.timeBtnTextActive,
                    ]}
                  >
                    {mins === 0 ? "Bez ograničenja" : `${mins}min`}
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
            {activeSection === "blocked" && (
              <View>
                {blockedUsers.length === 0 ? (
                  <Text style={sm.rowSub}>Nema blokiranih korisnika</Text>
                ) : (
                  blockedUsers.map((u) => (
                    <View key={u.id} style={sm.blockedUser}>
                      <Text style={sm.rowLabel}>
                        {u.firstName} {u.lastName}
                      </Text>
                      <TouchableOpacity>
                        <Text style={{ color: "#667eea", fontSize: 13 }}>
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
              onPress={() =>
                setActiveSection(
                  activeSection === "activity" ? null : "activity",
                )
              }
            >
              <Text style={sm.rowLabel}>Arhiva aktivnosti</Text>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
            {activeSection === "activity" && (
              <View style={sm.credBox}>
                <Text style={sm.credNote}>
                  📊 Praćenje aktivnosti dostupno u sljedećoj verziji.{"\n"}
                  Uključuje dnevne, mjesečne i godišnje statistike lajkova,
                  komentara, objava i prijateljstava.
                </Text>
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
  saveBtn: { color: "#667eea", fontSize: 16, fontWeight: "600" },
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
  credBox: {
    backgroundColor: "#f8f8ff",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  credLabel: { fontSize: 13, color: "#999", marginBottom: 4 },
  credValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  credNote: { fontSize: 12, color: "#999", lineHeight: 18 },
  timeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  timeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  timeBtnActive: { backgroundColor: "#667eea" },
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
    backgroundColor: "#667eea",
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
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 3,
  },
  itemMeta: { fontSize: 13, color: "#667eea", marginBottom: 2 },
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
  filterBtnActive: { backgroundColor: "#667eea" },
  filterBtnText: { fontSize: 13, color: "#666" },
  filterBtnTextActive: { color: "#fff" },
  goingBadge: { fontSize: 13, color: "#667eea", marginTop: 4 },
});

// ─── Main Profile Screen ──────────────────────────────────────────────────────
export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("me");
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      // Pokušaj učitati profile sa servera, fallback na AsyncStorage
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/my-profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setProfile(await res.json());
          setLoading(false);
          return;
        }
      } catch {}
      // Fallback
      const [first, last, userId] = await Promise.all([
        AsyncStorage.getItem("firstName"),
        AsyncStorage.getItem("lastName"),
        AsyncStorage.getItem("userId"),
      ]);
      setProfile({
        id: parseInt(userId ?? "0"),
        firstName: first ?? "",
        lastName: last ?? "",
        username: first?.toLowerCase() ?? "",
        followersCount: 0,
        followingCount: 0,
        isPublic: true,
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "me", label: "Moje", icon: "person-outline" },
    { key: "box", label: "Box", icon: "bookmark-outline" },
    { key: "wishlist", label: "Wishlist", icon: "star-outline" },
    { key: "golden", label: "Golden", icon: "star" },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

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

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <AvatarSection profile={profile} onUpdate={load} />

          <Text style={styles.name}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          <Text style={styles.usernameText}>@{profile?.username}</Text>

          {/* Privacy badge */}
          <View style={styles.privacyBadge}>
            <Ionicons
              name={profile?.isPublic ? "globe-outline" : "lock-closed-outline"}
              size={12}
              color="#667eea"
            />
            <Text style={styles.privacyText}>
              {profile?.isPublic ? "Javni profil" : "Privatni profil"}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.stat}>
              <Text style={styles.statNum}>{profile?.followersCount ?? 0}</Text>
              <Text style={styles.statLabel}>Pratitelji</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.stat}>
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
                color={activeTab === t.key ? "#667eea" : "#999"}
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
      </View>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        profile={profile}
        onClose={() => setShowSettings(false)}
        onSaved={() => {
          setShowSettings(false);
          load();
        }}
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
  usernameText: { fontSize: 15, color: "#667eea", marginBottom: 6 },
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
  privacyText: { fontSize: 12, color: "#667eea", fontWeight: "500" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
  },
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
  tabBtnActive: { borderBottomColor: "#667eea" },
  tabBtnText: { fontSize: 11, color: "#999" },
  tabBtnTextActive: { color: "#667eea", fontWeight: "600" },
});
