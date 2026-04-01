// app/(tabs)/messages.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Conversation,
  getConversations,
  getUnreadCount,
} from "../../utils/messagesApi";

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Polling interval za automatsko osvjeĹľavanje
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = async (silent = false) => {
    if (!silent) setError(null);
    try {
      const [convData, unread] = await Promise.all([
        getConversations(),
        getUnreadCount(),
      ]);
      setConversations(convData);
      setTotalUnread(unread);
    } catch (e) {
      if (!silent)
        setError("GreĹˇka pri uÄŤitavanju poruka. Povuci za osvjeĹľavanje.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // OsvjeĹľi kada tab dobije fokus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadConversations();

      // Pokretanje pollinga: svake 8 sekundi tiho osvjeĹľi listu
      pollRef.current = setInterval(() => loadConversations(true), 8000);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const openChat = (userId: number, name: string) => {
    router.push({
      pathname: "/chat/[userId]",
      params: { userId: userId.toString(), name },
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString("hr-HR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "JuÄŤer";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("hr-HR", { weekday: "short" });
    }
    return date.toLocaleDateString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  if (loading && !refreshing) {
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
          <Text style={styles.headerTitle}>Poruke</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color="#ff3b30" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Lista razgovora */}
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.userId.toString()}
          renderItem={({ item }) => (
            <ConversationItem
              item={item}
              onPress={() =>
                openChat(item.userId, `${item.firstName} ${item.lastName}`)
              }
              formatTime={formatTime}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#667eea"
            />
          }
          contentContainerStyle={
            conversations.length === 0
              ? styles.emptyContainer
              : styles.listContent
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={64}
                  color="#d0d0d0"
                />
                <Text style={styles.emptyTitle}>Nema poruka</Text>
                <Text style={styles.emptySubtitle}>
                  Kada netko poĹˇalje poruku ili poĹˇaljeĹˇ poruku gledajuÄ‡i
                  video, ovdje Ä‡e se prikazati razgovor.
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

// â”€â”€â”€ Conversation Item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ConversationItem({
  item,
  onPress,
  formatTime,
}: {
  item: Conversation;
  onPress: () => void;
  formatTime: (t: string) => string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

  const initials =
    `${item.firstName?.[0] ?? ""}${item.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, item.unreadCount > 0 && styles.nameBold]}
              numberOfLines={1}
            >
              {item.firstName} {item.lastName}
            </Text>
            <Text
              style={[
                styles.timestamp,
                item.unreadCount > 0 && styles.timestampUnread,
              ]}
            >
              {formatTime(item.timestamp)}
            </Text>
          </View>

          <View style={styles.messageRow}>
            <Text
              style={[
                styles.lastMessage,
                item.unreadCount > 0 && styles.lastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#1a1a1a" },
  headerBadge: {
    backgroundColor: "#ff3b30",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  headerBadgeText: { color: "white", fontSize: 13, fontWeight: "700" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff5f5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ffe0e0",
  },
  errorText: { fontSize: 13, color: "#ff3b30", flex: 1 },

  listContent: { paddingBottom: 24 },
  emptyContainer: { flex: 1 },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#333" },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },

  // Conversation item
  conversationItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: { color: "white", fontSize: 18, fontWeight: "700" },

  info: { flex: 1, gap: 4 },

  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 15, fontWeight: "500", color: "#333", flex: 1 },
  nameBold: { fontWeight: "700", color: "#1a1a1a" },

  timestamp: { fontSize: 12, color: "#bbb", marginLeft: 8 },
  timestampUnread: { color: "#667eea", fontWeight: "600" },

  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastMessage: { fontSize: 14, color: "#999", flex: 1 },
  lastMessageUnread: { color: "#333", fontWeight: "600" },

  unreadBadge: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
    marginLeft: 8,
  },
  unreadBadgeText: { color: "white", fontSize: 11, fontWeight: "700" },
});
