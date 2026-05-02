// app/(tabs)/search.tsx — VARA tema
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
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";

// ─── VARA Paleta ───────────────────────────────────────────────────────────────
const V = {
  forestDeep: "#1A2E15",
  forestMid: "#243B1E",
  forestLight: "#2D5518",
  borderGreen: "#4A7040",
  borderDim: "#304A28",
  silver: "#C4CABC",
  silverBright: "#E8EDE4",
  silverDim: "#8A9486",
  accentGold: "#B8A060",
  visited: "#5A8A48",
  danger: "#8B3030",
} as const;

interface User {
  id: number;
  firstname?: string;
  lastname?: string;
  firstName?: string;
  lastName?: string;
  username: string;
  avatar?: string | null;
  followersCount?: number;
  isFollowing?: boolean;
}

// ─── Helper: ispravna URL konstrukcija avatara ─────────────────────────────────
function buildAvatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  if (avatar.startsWith("http://") || avatar.startsWith("https://"))
    return avatar;
  const path = avatar.startsWith("/") ? avatar : `/${avatar}`;
  return `${API_BASE_URL}${path}`;
}

// ─── Avatar s fallback inicijalima ────────────────────────────────────────────
function VaraAvatar({
  avatar,
  firstName,
  lastName,
  size,
}: {
  avatar?: string | null;
  firstName: string;
  lastName: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const url = buildAvatarUrl(avatar);
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const r = size / 2;

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: r }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: V.forestLight,
        borderWidth: 1.5,
        borderColor: V.borderGreen,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: V.silverBright,
          fontSize: size * 0.36,
          fontWeight: "700",
        }}
      >
        {initials || "?"}
      </Text>
    </View>
  );
}

// ─── Compose Message Modal — VARA stil ────────────────────────────────────────
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

  const firstName = recipient.firstname || recipient.firstName || "";
  const lastName = recipient.lastname || recipient.lastName || "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: V.forestDeep }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: V.forestDeep }}
          edges={["top"]}
        >
          {/* Header */}
          <View style={cs.header}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={28} color={V.silver} />
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
                <ActivityIndicator size="small" color={V.silverBright} />
              ) : (
                <Text style={cs.sendHeaderBtnText}>{t("search.sendBtn")}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Primatelj */}
          <View style={cs.recipientRow}>
            <Text style={cs.toLabel}>{t("search.messageTo")}</Text>
            <View style={cs.recipientChip}>
              <VaraAvatar
                avatar={recipient.avatar}
                firstName={firstName}
                lastName={lastName}
                size={28}
              />
              <Text style={cs.chipName}>@{recipient.username}</Text>
            </View>
          </View>

          {/* Input */}
          <View style={cs.inputArea}>
            <TextInput
              style={cs.input}
              placeholder={t("search.messagePlaceholder", { name: firstName })}
              placeholderTextColor={V.silverDim}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              autoFocus
              textAlignVertical="top"
            />
            <Text style={cs.counter}>{message.length}/1000</Text>
          </View>

          {/* Quick replies */}
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
    borderBottomWidth: 1.5,
    borderBottomColor: V.borderGreen,
    backgroundColor: V.forestDeep,
  },
  title: { fontSize: 17, fontWeight: "700", color: V.silverBright },
  sendHeaderBtn: {
    backgroundColor: V.forestLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
    borderWidth: 1,
    borderColor: V.borderGreen,
  },
  sendHeaderBtnDisabled: {
    backgroundColor: V.borderDim,
    borderColor: V.borderDim,
  },
  sendHeaderBtnText: { color: V.silverBright, fontWeight: "700", fontSize: 14 },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: V.borderDim,
    backgroundColor: V.forestDeep,
  },
  toLabel: { fontSize: 15, fontWeight: "600", color: V.silverDim },
  recipientChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: V.forestMid,
    borderWidth: 1,
    borderColor: V.borderGreen,
  },
  chipName: { fontSize: 14, fontWeight: "600", color: V.visited },
  inputArea: { flex: 1, padding: 16, backgroundColor: V.forestDeep },
  input: { flex: 1, fontSize: 16, lineHeight: 24, color: V.silverBright },
  counter: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
    color: V.silverDim,
  },
  suggestions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: V.borderDim,
    backgroundColor: V.forestMid,
  },
  suggestionsLabel: { fontSize: 13, marginBottom: 10, color: V.silverDim },
  suggestionsList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestionChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: V.forestLight,
    borderWidth: 1,
    borderColor: V.borderGreen,
  },
  suggestionText: { fontSize: 13, color: V.silver, fontWeight: "600" },
});

// ─── Main Search Screen ────────────────────────────────────────────────────────
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
        const others = data.filter((u) => u.id !== parsedId);
        setUsers(others);
        setFiltered(others);
      }
      try {
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
      } catch {}
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
      const res = isFollowing
        ? await fetch(`${API_BASE_URL}/api/follow/${userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        : await fetch(`${API_BASE_URL}/api/follow/${userId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
      if (!res.ok) throw new Error(`Status ${res.status}`);
    } catch {
      setFollowingMap((p) => ({ ...p, [userId]: isFollowing }));
      Alert.alert(t("common.error"), t("search.followFailed"));
    } finally {
      setLoadingFollow((p) => ({ ...p, [userId]: false }));
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const firstName = item.firstname || item.firstName || "";
    const lastName = item.lastname || item.lastName || "";
    const isFollowing = followingMap[item.id] || false;
    const isLoadingThis = loadingFollow[item.id] || false;

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() =>
          router.push({
            pathname: "/profile/[userId]",
            params: { userId: item.id.toString() },
          } as any)
        }
        activeOpacity={0.75}
      >
        {/* Avatar s prstenom za story */}
        <StoryBadge userId={item.id} size={54}>
          <VaraAvatar
            avatar={item.avatar}
            firstName={firstName}
            lastName={lastName}
            size={54}
          />
        </StoryBadge>

        {/* Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {firstName} {lastName}
          </Text>
          <Text style={styles.userUsername}>@{item.username}</Text>
          {item.followersCount !== undefined && (
            <Text style={styles.followersCount}>
              {t("search.followers", { count: item.followersCount })}
            </Text>
          )}
        </View>

        {/* Akcije */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={() => handleFollow(item.id)}
            disabled={isLoadingThis}
          >
            {isLoadingThis ? (
              <ActivityIndicator
                size="small"
                color={isFollowing ? V.visited : V.silverBright}
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
            onPress={() => {
              setComposeTarget(item);
              setShowCompose(true);
            }}
          >
            <Ionicons name="paper-plane-outline" size={18} color={V.visited} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("search.title")}</Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={18}
              color={V.silverDim}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t("search.placeholder")}
              placeholderTextColor={V.silverDim}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={V.silverDim} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Broj rezultata */}
        {!loading && query.length > 0 && (
          <Text style={styles.resultsInfo}>
            {t("search.results", { count: filtered.length })}
          </Text>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={V.visited} />
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
                tintColor={V.visited}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name="people-outline"
                    size={44}
                    color={V.borderGreen}
                  />
                </View>
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

// ─── Stilovi — VARA tema ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: V.forestDeep },
  container: { flex: 1, backgroundColor: V.forestDeep },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: V.borderGreen,
    backgroundColor: V.forestDeep,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: V.silverBright },

  // Search bar
  searchBarWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: V.forestMid,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: V.borderGreen,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  searchInput: { flex: 1, fontSize: 15, color: V.silverBright },
  resultsInfo: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 4,
    color: V.silverDim,
  },

  // List
  listContent: { paddingHorizontal: 12, paddingBottom: 100 },
  emptyList: { flex: 1 },

  // User card
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: V.borderDim,
    backgroundColor: V.forestDeep,
    gap: 12,
  },

  // User info
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontWeight: "700", color: V.silverBright },
  userUsername: { fontSize: 13, color: V.visited },
  followersCount: { fontSize: 12, color: V.silverDim, marginTop: 1 },

  // Action buttons
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  followBtn: {
    backgroundColor: V.forestLight,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: V.borderGreen,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 78,
    alignItems: "center",
  },
  followingBtn: {
    backgroundColor: "transparent",
    borderColor: V.visited,
  },
  followBtnText: { color: V.silverBright, fontSize: 13, fontWeight: "600" },
  followingBtnText: { color: V.visited },
  msgBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: V.forestMid,
    borderWidth: 1,
    borderColor: V.borderGreen,
  },

  // Loading
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, color: V.silverDim },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 14,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: V.forestMid,
    borderWidth: 1.5,
    borderColor: V.borderGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: V.silverDim },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    color: V.silverDim,
    paddingHorizontal: 32,
  },
});
