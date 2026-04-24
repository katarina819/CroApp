// app/(tabs)/search.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StoryBadge } from "../../app/StoryBadge";
import UserAvatar from "../../components/UserAvatar";
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";

interface User {
  id: number;
  firstname?: string; // API vraća ovo (mala slova)
  lastname?: string; // API vraća ovo (mala slova)
  firstName?: string; // Za backward compatibility
  lastName?: string; // Za backward compatibility
  username: string;
  avatar?: string | null;
  followersCount?: number;
  isFollowing?: boolean;
}

// ── Compose Message Modal ──────────────────────────────────────────────────────
// Otvara se kada korisnik klikne dugme za poruku – umjesto redirecta na chat
function ComposeMessageModal({
  visible,
  recipient,
  onClose,
}: {
  visible: boolean;
  recipient: User | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!recipient || !message.trim()) return;
    setSending(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/message/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId: recipient.id,
          content: message.trim(),
        }),
      });
      if (res.ok) {
        Alert.alert(
          t("common.success"),
          t("search.messageSent", { username: recipient.username }),
        );
        setMessage("");
        onClose();
      } else {
        const err = await res.text();

        Alert.alert(t("common.error"), err || t("search.messageFailed"));
      }
    } catch {
      Alert.alert(t("common.error"), t("search.messageFailedCheckConnection"));
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  if (!recipient) return null;

  // API vraća firstname i lastname (mala slova) - podržava oba formata
  const firstName = recipient.firstname || recipient.firstName || "";
  const lastName = recipient.lastname || recipient.lastName || "";
  const initials =
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: "#fff" }}
          edges={["top"]}
        >
          {/* Header */}
          <View style={cs.header}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={cs.title}>{t("search.sendMessage")}</Text>
            <TouchableOpacity
              style={[
                cs.sendHeaderBtn,
                (!message.trim() || sending) && cs.sendHeaderBtnDisabled,
              ]}
              onPress={send}
              disabled={!message.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={cs.sendHeaderBtnText}>{t("search.sendBtn")}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Recipient */}
          <View style={cs.recipientRow}>
            <Text style={cs.toLabel}>{t("search.messageTo")}</Text>
            <View style={cs.recipientChip}>
              {recipient.avatar ? (
                <Image
                  source={{ uri: recipient.avatar }}
                  style={cs.chipAvatar}
                />
              ) : (
                <View style={[cs.chipAvatar, cs.chipAvatarPlaceholder]}>
                  <Text style={cs.chipInitials}>{initials || "?"}</Text>
                </View>
              )}
              <Text style={cs.chipName}>@{recipient.username}</Text>
            </View>
          </View>

          {/* Message input */}
          <View style={cs.inputArea}>
            <TextInput
              style={cs.input}
              placeholder={t("search.messagePlaceholder", { name: firstName })}
              placeholderTextColor="#bbb"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              autoFocus
              textAlignVertical="top"
            />
            <Text style={cs.counter}>{message.length}/1000</Text>
          </View>

          {/* Quick suggestions */}
          <View style={cs.suggestions}>
            <Text style={cs.suggestionsLabel}>{t("search.quickMessages")}</Text>
            <View style={cs.suggestionsList}>
              {["Hej! 👋", "Kako si?", "Vidimo se uskoro!", "Odlično! 🔥"].map(
                (s) => (
                  <TouchableOpacity
                    key={s}
                    style={cs.suggestionChip}
                    onPress={() => setMessage(s)}
                  >
                    <Text style={cs.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cs = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 17, fontWeight: "600", color: "#333" },
  sendHeaderBtn: {
    backgroundColor: "#2D6418",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
  },
  sendHeaderBtnDisabled: { backgroundColor: "#ccc" },
  sendHeaderBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 10,
  },
  toLabel: { fontSize: 15, color: "#999", fontWeight: "600" },
  recipientChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0ff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  chipAvatar: { width: 28, height: 28, borderRadius: 14 },
  chipAvatarPlaceholder: {
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
  },
  chipInitials: { color: "#fff", fontSize: 11, fontWeight: "700" },
  chipName: { fontSize: 14, fontWeight: "600", color: "#2D6418" },
  inputArea: { flex: 1, padding: 16 },
  input: { flex: 1, fontSize: 16, color: "#333", lineHeight: 24 },
  counter: { fontSize: 12, color: "#ccc", textAlign: "right", marginTop: 4 },
  suggestions: { padding: 16, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  suggestionsLabel: { fontSize: 13, color: "#999", marginBottom: 10 },
  suggestionsList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestionChip: {
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestionText: { fontSize: 13, color: "#555" },
});

// ── Main Search Screen ─────────────────────────────────────────────────────────
export default function SearchScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<number, boolean>>({});
  const [loadingFollow, setLoadingFollow] = useState<Record<number, boolean>>(
    {},
  );
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [composeTarget, setComposeTarget] = useState<User | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (silent = false) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const storedId = await AsyncStorage.getItem("userId");
      const parsedId = parseInt(storedId || "0");
      if (storedId) setCurrentUserId(parsedId);

      const res = await fetch(API_ENDPOINTS.USERS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: User[] = await res.json();
        console.log("Users data from API:", JSON.stringify(data[0], null, 2)); // DEBUG: vidi prvi user
        const others = data.filter((u) => u.id !== parsedId);
        setUsers(others);
        setFiltered(others);
      }

      // Dohvati korisnike koje pratiš
      try {
        // Umjesto /api/follow/my-following (koji ne postoji), koristite:
        const followRes = await fetch(
          `${API_BASE_URL}/api/follow/following/${parsedId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (followRes.ok) {
          const following = await followRes.json();
          const map: Record<number, boolean> = {};
          following.forEach((u: any) => {
            map[u.id] = true;
          });
          setFollowingMap(map);
        }
      } catch (error) {
        console.error("Error loading following list:", error);
      }
    } catch (e) {
      if (!silent) Alert.alert(t("common.error"), t("search.loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (!query.trim()) {
        setFiltered(users);
        return;
      }
      const q = query.toLowerCase();
      setFiltered(
        users.filter(
          (u) =>
            u.username?.toLowerCase().includes(q) ||
            u.firstName?.toLowerCase().includes(q) ||
            u.lastName?.toLowerCase().includes(q),
        ),
      );
    }, 200);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query, users]);

  const handleFollow = async (userId: number) => {
    const token = await AsyncStorage.getItem("token");
    const isFollowing = followingMap[userId];
    setLoadingFollow((p) => ({ ...p, [userId]: true }));
    setFollowingMap((p) => ({ ...p, [userId]: !isFollowing }));

    try {
      let res: Response;
      if (isFollowing) {
        // Unfollow - ISPRAVAN endpoint (bez /unfollow)
        res = await fetch(`${API_BASE_URL}/api/follow/${userId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // Follow - ISPRAVAN endpoint (bez /follow)
        res = await fetch(`${API_BASE_URL}/api/follow/${userId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("Follow error:", res.status, errText);
        throw new Error(`Status ${res.status}`);
      }
    } catch (e) {
      console.error("Follow/unfollow failed:", e);
      setFollowingMap((p) => ({ ...p, [userId]: isFollowing }));
      Alert.alert(t("common.error"), t("search.followFailed"));
    } finally {
      setLoadingFollow((p) => ({ ...p, [userId]: false }));
    }
  };

  // Otvori modal za pisanje poruke – NE otvara chat razgovor
  const handleOpenCompose = (user: User) => {
    setComposeTarget(user);
    setShowCompose(true);
  };

  const handleViewProfile = (user: User) => {
    router.push({
      pathname: "/profile/[userId]",
      params: { userId: user.id.toString() },
    } as any);
  };

  const renderUser = ({ item }: { item: User }) => {
    const firstName = item.firstname || item.firstName || "";
    const lastName = item.lastname || item.lastName || "";

    const isFollowing = followingMap[item.id] || false;
    const isLoadingThis = loadingFollow[item.id] || false;

    return (
      <View style={styles.userCard}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => handleViewProfile(item)}
        >
          <StoryBadge userId={item.id} size={54}>
            <UserAvatar
              avatar={item.avatar}
              firstName={firstName}
              lastName={lastName}
              size={54}
            />
          </StoryBadge>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => handleViewProfile(item)}
        >
          <Text style={styles.userName}>
            {firstName} {lastName}
          </Text>
          <Text style={styles.userUsername}>@{item.username}</Text>
          {item.followersCount !== undefined && (
            <Text style={styles.followersCount}>
              {t("search.followers", { count: item.followersCount })}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={() => handleFollow(item.id)}
            disabled={isLoadingThis}
          >
            {isLoadingThis ? (
              <ActivityIndicator
                size="small"
                color={isFollowing ? "#2D6418" : "#fff"}
              />
            ) : (
              <Text
                style={[
                  styles.followBtnText,
                  isFollowing && styles.followingBtnText,
                ]}
              >
                {isFollowing ? t("search.following") : t("search.follow")}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.msgBtn}
            onPress={() => handleOpenCompose(item)}
          >
            <Ionicons name="paper-plane-outline" size={18} color="#2D6418" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("search.title")}</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={18}
            color="#999"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t("search.placeholder")}
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>

        {!loading && query.length > 0 && (
          <Text style={styles.resultsInfo}>
            {t("search.results", { count: filtered.length })}
          </Text>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2D6418" />
            <Text style={styles.loadingText}>{t("search.loading")}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderUser}
            contentContainerStyle={
              filtered.length === 0 ? styles.emptyList : styles.listContent
            }
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData(true);
                }}
                tintColor="#2D6418"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color="#d0d0d0" />
                <Text style={styles.emptyTitle}>
                  {query ? t("search.noResults") : t("search.noUsers")}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {query
                    ? t("search.noResultsDesc", { query })
                    : t("search.noUsersDesc")}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Compose message modal – pojavljuje se umjesto otvaranja chata */}
      <ComposeMessageModal
        visible={showCompose}
        recipient={composeTarget}
        onClose={() => {
          setShowCompose(false);
          setComposeTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#1a1a1a" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: "#333" },
  resultsInfo: {
    fontSize: 13,
    color: "#999",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyList: { flex: 1 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarPlaceholder: {
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center", // Dodaj ovo
    includeFontPadding: false,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  userUsername: { fontSize: 13, color: "#2D6418", marginBottom: 2 },
  followersCount: { fontSize: 12, color: "#999" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  followBtn: {
    backgroundColor: "#2D6418",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 76,
    alignItems: "center",
  },
  followingBtn: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#2D6418",
  },
  followBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  followingBtnText: { color: "#2D6418" },
  msgBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f0f0ff",
    justifyContent: "center",
    alignItems: "center",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#aaa", fontSize: 14 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#aaa" },
  emptySubtitle: { fontSize: 14, color: "#bbb", textAlign: "center" },
});
