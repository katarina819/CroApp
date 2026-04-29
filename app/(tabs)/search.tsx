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
import { useTheme } from "../../components/AdaptiveThemeProvider";
import UserAvatar from "../../components/UserAvatar";
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";

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

// ── Compose Message Modal ──────────────────────────────────────────────────────
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
  const { colors, isDark } = useTheme();
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
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colors.background }}
          edges={["top"]}
        >
          <View
            style={[
              cs.header,
              {
                backgroundColor: colors.background,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={[cs.title, { color: colors.text }]}>
              {t("search.sendMessage")}
            </Text>
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

          <View style={[cs.recipientRow, { borderBottomColor: colors.border }]}>
            <Text style={[cs.toLabel, { color: colors.textSecondary }]}>
              {t("search.messageTo")}
            </Text>
            <View
              style={[
                cs.recipientChip,
                { backgroundColor: isDark ? "#1C2128" : "#f0f0ff" },
              ]}
            >
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
              <Text style={[cs.chipName, { color: colors.primary }]}>
                @{recipient.username}
              </Text>
            </View>
          </View>

          <View style={cs.inputArea}>
            <TextInput
              style={[cs.input, { color: colors.text }]}
              placeholder={t("search.messagePlaceholder", { name: firstName })}
              placeholderTextColor={colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              autoFocus
              textAlignVertical="top"
            />
            <Text style={[cs.counter, { color: colors.textSecondary }]}>
              {message.length}/1000
            </Text>
          </View>

          <View style={[cs.suggestions, { borderTopColor: colors.border }]}>
            <Text
              style={[cs.suggestionsLabel, { color: colors.textSecondary }]}
            >
              {t("search.quickMessages")}
            </Text>
            <View style={cs.suggestionsList}>
              {["Hej! 👋", "Kako si?", "Vidimo se uskoro!", "Odlično! 🔥"].map(
                (s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      cs.suggestionChip,
                      { backgroundColor: isDark ? "#1C2128" : "#f5f5f5" },
                    ]}
                    onPress={() => setMessage(s)}
                  >
                    <Text
                      style={[
                        cs.suggestionText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {s}
                    </Text>
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
  },
  title: { fontSize: 17, fontWeight: "600" },
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
    gap: 10,
  },
  toLabel: { fontSize: 15, fontWeight: "600" },
  recipientChip: {
    flexDirection: "row",
    alignItems: "center",
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
  chipName: { fontSize: 14, fontWeight: "600" },
  inputArea: { flex: 1, padding: 16 },
  input: { flex: 1, fontSize: 16, lineHeight: 24 },
  counter: { fontSize: 12, textAlign: "right", marginTop: 4 },
  suggestions: { padding: 16, borderTopWidth: 1 },
  suggestionsLabel: { fontSize: 13, marginBottom: 10 },
  suggestionsList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestionChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestionText: { fontSize: 13 },
});

// ── Main Search Screen ─────────────────────────────────────────────────────────
export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
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
        res = await fetch(`${API_BASE_URL}/api/follow/${userId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
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
      <View style={[styles.userCard, { borderBottomColor: colors.border }]}>
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
          <Text style={[styles.userName, { color: colors.text }]}>
            {firstName} {lastName}
          </Text>
          <Text style={[styles.userUsername, { color: colors.primary }]}>
            @{item.username}
          </Text>
          {item.followersCount !== undefined && (
            <Text
              style={[styles.followersCount, { color: colors.textSecondary }]}
            >
              {t("search.followers", { count: item.followersCount })}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.followBtn,
              isFollowing && styles.followingBtn,
              isFollowing && { borderColor: colors.primary },
            ]}
            onPress={() => handleFollow(item.id)}
            disabled={isLoadingThis}
          >
            {isLoadingThis ? (
              <ActivityIndicator
                size="small"
                color={isFollowing ? colors.primary : "#fff"}
              />
            ) : (
              <Text
                style={[
                  styles.followBtnText,
                  isFollowing && [
                    styles.followingBtnText,
                    { color: colors.primary },
                  ],
                ]}
              >
                {isFollowing ? t("search.following") : t("search.follow")}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.msgBtn,
              { backgroundColor: isDark ? "#1C2128" : "#f0f0ff" },
            ]}
            onPress={() => handleOpenCompose(item)}
          >
            <Ionicons
              name="paper-plane-outline"
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("search.title")}
          </Text>
        </View>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: isDark ? "#1C2128" : "#f5f5f5" },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textSecondary}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t("search.placeholder")}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {!loading && query.length > 0 && (
          <Text style={[styles.resultsInfo, { color: colors.textSecondary }]}>
            {t("search.results", { count: filtered.length })}
          </Text>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t("search.loading")}
            </Text>
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
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="people-outline"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.emptyTitle, { color: colors.textSecondary }]}
                >
                  {query ? t("search.noResults") : t("search.noUsers")}
                </Text>
                <Text
                  style={[
                    styles.emptySubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
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

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16 },
  resultsInfo: { fontSize: 13, paddingHorizontal: 20, marginBottom: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyList: { flex: 1 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarContainer: { marginRight: 12 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  userUsername: { fontSize: 13, marginBottom: 2 },
  followersCount: { fontSize: 12 },
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
    backgroundColor: "transparent",
    borderWidth: 1.5,
  },
  followBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  followingBtnText: { fontWeight: "600" },
  msgBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
});
