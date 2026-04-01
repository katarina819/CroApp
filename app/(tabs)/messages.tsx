// app/(tabs)/messages.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../../app/config/api";
import {
  Conversation,
  getConversations,
  getUnreadCount,
} from "../../utils/messagesApi";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────
interface Story {
  id: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  createdAt: string;
  viewedByMe: boolean;
  viewCount: number;
  viewers?: { userId: number; userName: string }[];
}

// ─── Story Viewer ─────────────────────────────────────────────────────────────
function StoryViewer({
  story,
  onClose,
  onDelete,
  isOwner,
}: {
  story: Story;
  onClose: () => void;
  onDelete: (id: number) => void;
  isOwner: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [showViewers, setShowViewers] = useState(false);
  const DURATION = story.mediaType === "image" ? 5000 : 15000;

  const player = useVideoPlayer(
    story.mediaType === "video" ? story.mediaUrl : "",
    (p) => { p.loop = false; p.muted = false; }
  );

  useEffect(() => {
    // Mark as viewed
    AsyncStorage.getItem("token").then((token) => {
      if (!token) return;
      fetch(`${API_BASE_URL}/api/story/${story.id}/view`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    });

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onClose();
    });

    if (story.mediaType === "video") player.play();

    return () => {
      progress.stopAnimation();
      if (story.mediaType === "video") player.pause();
    };
  }, [story.id]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={sv.container}>
      {/* Background */}
      <View style={sv.bg} />

      {story.mediaType === "image" ? (
        <Image source={{ uri: story.mediaUrl }} style={sv.media} resizeMode="contain" />
      ) : (
        <VideoView player={player} style={sv.media} contentFit="contain" nativeControls={false} />
      )}

      {/* Progress bar */}
      <View style={sv.progressBar}>
        <Animated.View style={[sv.progressFill, { width: progressWidth }]} />
      </View>

      {/* Header */}
      <View style={sv.header}>
        <View style={sv.userInfo}>
          <View style={sv.smallAvatar}>
            {story.userAvatar ? (
              <Image source={{ uri: story.userAvatar }} style={sv.smallAvatarImg} />
            ) : (
              <Text style={sv.smallAvatarText}>
                {story.userName?.[0]?.toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text style={sv.storyUser}>{story.userName}</Text>
            <Text style={sv.storyTime}>
              {new Date(story.createdAt).toLocaleTimeString("hr-HR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={sv.closeBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={sv.footer}>
        {isOwner && (
          <>
            <TouchableOpacity
              style={sv.viewersBtn}
              onPress={() => setShowViewers(true)}
            >
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <Text style={sv.viewersBtnText}>{story.viewCount} pregleda</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={sv.deleteBtn}
              onPress={() => {
                onDelete(story.id);
                onClose();
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4757" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Viewers Modal */}
      <Modal visible={showViewers} transparent animationType="slide" onRequestClose={() => setShowViewers(false)}>
        <View style={sv.viewersModal}>
          <View style={sv.viewersContent}>
            <View style={sv.viewersHeader}>
              <Text style={sv.viewersTitle}>Pregledi</Text>
              <TouchableOpacity onPress={() => setShowViewers(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {(story.viewers ?? []).map((v, i) => (
              <View key={i} style={sv.viewerRow}>
                <Ionicons name="person-circle" size={32} color="#667eea" />
                <Text style={sv.viewerName}>{v.userName}</Text>
              </View>
            ))}
            {(story.viewers ?? []).length === 0 && (
              <Text style={sv.noViewers}>Nema pregleda</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const sv = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  media: { width: SCREEN_W, height: SCREEN_H },
  progressBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 32,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 2,
  },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 64 : 44,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  userInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
  },
  smallAvatarImg: { width: 40, height: 40 },
  smallAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  storyUser: { color: "#fff", fontWeight: "700", fontSize: 15 },
  storyTime: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  closeBtn: { padding: 8 },
  footer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 40 : 24,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewersBtnText: { color: "#fff", fontSize: 14 },
  deleteBtn: {
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 22,
  },
  viewersModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  viewersContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 200,
  },
  viewersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  viewersTitle: { fontSize: 18, fontWeight: "700", color: "#333" },
  viewerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  viewerName: { fontSize: 15, color: "#333" },
  noViewers: { color: "#999", textAlign: "center", marginTop: 20 },
});

// ─── Stories Row ─────────────────────────────────────────────────────────────
function StoriesRow({
  currentUserId,
  onAddStory,
}: {
  currentUserId: number | null;
  onAddStory: () => void;
}) {
  const [stories, setStories] = useState<Story[]>([]);
  const [viewing, setViewing] = useState<Story | null>(null);

  const loadStories = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/story`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStories(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadStories(); }, []);

  const handleDelete = async (id: number) => {
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_BASE_URL}/api/story/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setStories((prev) => prev.filter((s) => s.id !== id));
    } catch {}
  };

  // Group: My story first, then others
  const myStories = stories.filter((s) => s.userId === currentUserId);
  const otherStories = stories.filter((s) => s.userId !== currentUserId);

  // Group others by user
  const byUser: Record<number, Story[]> = {};
  otherStories.forEach((s) => {
    if (!byUser[s.userId]) byUser[s.userId] = [];
    byUser[s.userId].push(s);
  });

  interface StoryGroup { userId: number; userName: string; stories: Story[]; unread: boolean; avatar?: string; }
  const groups: StoryGroup[] = Object.entries(byUser).map(([uid, ss]) => ({
    userId: parseInt(uid),
    userName: ss[0].userName,
    stories: ss,
    avatar: ss[0].userAvatar,
    unread: ss.some((s) => !s.viewedByMe),
  }));

  return (
    <>
      <View style={srs.container}>
        <FlatList
          horizontal
          data={["add-btn", ...groups]}
          keyExtractor={(item, i) =>
            item === "add-btn" ? "add" : `group-${(item as StoryGroup).userId}`
          }
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={srs.list}
          renderItem={({ item }) => {
            if (item === "add-btn") {
              const myLatest = myStories[0];
              return (
                <View style={srs.storyItem}>
                  <TouchableOpacity
                    style={[srs.ring, myLatest ? srs.hasStory : srs.noStory]}
                    onPress={myLatest ? () => setViewing(myLatest) : onAddStory}
                  >
                    {myLatest ? (
                      <Image source={{ uri: myLatest.mediaUrl }} style={srs.img} />
                    ) : (
                      <View style={srs.addBg}>
                        <Ionicons name="person" size={20} color="#fff" />
                      </View>
                    )}
                    <View style={srs.addIcon}>
                      <Ionicons name="add" size={14} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  <Text style={srs.label} numberOfLines={1}>
                    Moj story
                  </Text>
                </View>
              );
            }
            const g = item as StoryGroup;
            const initials = g.userName?.[0]?.toUpperCase() ?? "?";
            return (
              <View style={srs.storyItem}>
                <TouchableOpacity
                  style={[srs.ring, g.unread ? srs.hasStory : srs.viewedStory]}
                  onPress={() => setViewing(g.stories[0])}
                >
                  {g.avatar ? (
                    <Image source={{ uri: g.avatar }} style={srs.img} />
                  ) : (
                    <View style={[srs.addBg, { backgroundColor: "#8e9cf0" }]}>
                      <Text style={srs.initials}>{initials}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={srs.label} numberOfLines={1}>
                  {g.userName.split(" ")[0]}
                </Text>
              </View>
            );
          }}
        />
      </View>

      {/* Story Viewer */}
      {viewing && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setViewing(null)}>
          <StoryViewer
            story={viewing}
            onClose={() => setViewing(null)}
            onDelete={handleDelete}
            isOwner={viewing.userId === currentUserId}
          />
        </Modal>
      )}
    </>
  );
}

const srs = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebeb",
    paddingVertical: 12,
  },
  list: { paddingHorizontal: 12, gap: 12 },
  storyItem: { alignItems: "center", width: 68 },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    marginBottom: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  hasStory: { borderWidth: 2.5, borderColor: "#667eea" },
  viewedStory: { borderWidth: 2.5, borderColor: "#ccc" },
  noStory: { borderWidth: 2, borderColor: "#ddd", borderStyle: "dashed" },
  img: { width: 56, height: 56, borderRadius: 28 },
  addBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  initials: { color: "#fff", fontSize: 20, fontWeight: "700" },
  addIcon: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  label: { fontSize: 12, color: "#555", textAlign: "center" },
});

// ─── Add Story Modal ──────────────────────────────────────────────────────────
function AddStoryModal({
  visible,
  onClose,
  onUploaded,
}: {
  visible: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [preview, setPreview] = useState<{ uri: string; type: "image" | "video" } | null>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (source: "gallery" | "camera") => {
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
      setPreview({
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
      });
    }
  };

  const upload = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const formData = new FormData();
      formData.append("media", {
        uri: preview.uri,
        type: preview.type === "video" ? "video/mp4" : "image/jpeg",
        name: preview.type === "video" ? "story.mp4" : "story.jpg",
      } as any);
      formData.append("mediaType", preview.type);

      const res = await fetch(`${API_BASE_URL}/api/story/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        setPreview(null);
        onUploaded();
        onClose();
      }
    } catch {
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={asm.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={asm.title}>Dodaj story</Text>
          <View style={{ width: 28 }} />
        </View>

        {!preview ? (
          <View style={asm.pickContainer}>
            <Text style={asm.hint}>Odaberi medij</Text>
            <TouchableOpacity style={asm.pickBtn} onPress={() => pick("gallery")}>
              <Ionicons name="images" size={40} color="#667eea" />
              <Text style={asm.pickLabel}>Galerija</Text>
            </TouchableOpacity>
            <TouchableOpacity style={asm.pickBtn} onPress={() => pick("camera")}>
              <Ionicons name="camera" size={40} color="#667eea" />
              <Text style={asm.pickLabel}>Kamera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Image
              source={{ uri: preview.uri }}
              style={asm.preview}
              resizeMode="cover"
            />
            <View style={asm.previewActions}>
              <TouchableOpacity
                style={[asm.btn, { backgroundColor: "#ff4757" }]}
                onPress={() => setPreview(null)}
              >
                <Text style={asm.btnText}>Obriši</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[asm.btn, { backgroundColor: "#667eea" }]}
                onPress={upload}
                disabled={uploading}
              >
                <Text style={asm.btnText}>
                  {uploading ? "Objavljujem..." : "Objavi"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const asm = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 17, fontWeight: "600", color: "#333" },
  pickContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 24 },
  hint: { fontSize: 18, color: "#666", marginBottom: 8 },
  pickBtn: {
    width: 160,
    alignItems: "center",
    padding: 28,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#667eea",
    borderStyle: "dashed",
    gap: 10,
  },
  pickLabel: { fontSize: 16, color: "#667eea", fontWeight: "600" },
  preview: { flex: 1 },
  previewActions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  btn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

// ─── Main Messages Screen ─────────────────────────────────────────────────────
export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAddStory, setShowAddStory] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = async (silent = false) => {
    if (!silent) setError(null);
    try {
      const storedId = await AsyncStorage.getItem("userId");
      if (storedId) setCurrentUserId(parseInt(storedId));
      const [convData, unread] = await Promise.all([
        getConversations(),
        getUnreadCount(),
      ]);
      setConversations(convData);
      setTotalUnread(unread);
    } catch {
      if (!silent) setError("Greška pri učitavanju poruka.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadConversations();
      pollRef.current = setInterval(() => loadConversations(true), 8000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [])
  );

  const openChat = (userId: number, name: string) => {
    router.push({
      pathname: "/chat/[userId]",
      params: { userId: userId.toString(), name },
    });
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diff === 0)
      return date.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
    if (diff === 1) return "Jučer";
    if (diff < 7)
      return date.toLocaleDateString("hr-HR", { weekday: "short" });
    return date.toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit" });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicatorView />
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
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>

        {/* Stories Row */}
        <StoriesRow
          currentUserId={currentUserId}
          onAddStory={() => setShowAddStory(true)}
        />

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color="#ff3b30" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Conversations */}
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.userId.toString()}
          renderItem={({ item }) => (
            <ConversationItem
              item={item}
              onPress={() => openChat(item.userId, `${item.firstName} ${item.lastName}`)}
              formatTime={formatTime}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadConversations(); }}
              tintColor="#667eea"
            />
          }
          contentContainerStyle={
            conversations.length === 0 ? styles.emptyContainer : styles.listContent
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={64} color="#d0d0d0" />
                <Text style={styles.emptyTitle}>Nema poruka</Text>
                <Text style={styles.emptySubtitle}>
                  Pretraži korisnike i pošalji prvu poruku!
                </Text>
                <TouchableOpacity
                  style={styles.newMsgBtn}
                  onPress={() => router.push("/(tabs)/search")}
                >
                  <Text style={styles.newMsgBtnText}>Pronađi korisnike</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </View>

      {/* Add Story Modal */}
      <AddStoryModal
        visible={showAddStory}
        onClose={() => setShowAddStory(false)}
        onUploaded={() => {}}
      />
    </SafeAreaView>
  );
}

function ActivityIndicatorView() {
  const { ActivityIndicator } = require("react-native");
  return <ActivityIndicator size="large" color="#667eea" />;
}

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
  const initials =
    `${item.firstName?.[0] ?? ""}${item.lastName?.[0] ?? ""}`.toUpperCase();

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.convItem}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={styles.convAvatar}>
          <Text style={styles.convAvatarText}>{initials}</Text>
        </View>
        <View style={styles.convInfo}>
          <View style={styles.convNameRow}>
            <Text
              style={[styles.convName, item.unreadCount > 0 && styles.convNameBold]}
              numberOfLines={1}
            >
              {item.firstName} {item.lastName}
            </Text>
            <Text
              style={[
                styles.convTime,
                item.unreadCount > 0 && styles.convTimeUnread,
              ]}
            >
              {formatTime(item.timestamp)}
            </Text>
          </View>
          <View style={styles.convMsgRow}>
            <Text
              style={[
                styles.convLastMsg,
                item.unreadCount > 0 && styles.convLastMsgUnread,
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
  badge: {
    backgroundColor: "#ff3b30",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
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
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#333" },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
  newMsgBtn: {
    marginTop: 8,
    backgroundColor: "#667eea",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  newMsgBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  convItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  convAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  convAvatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  convInfo: { flex: 1, gap: 4 },
  convNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convName: { fontSize: 15, fontWeight: "500", color: "#333", flex: 1 },
  convNameBold: { fontWeight: "700", color: "#1a1a1a" },
  convTime: { fontSize: 12, color: "#bbb", marginLeft: 8 },
  convTimeUnread: { color: "#667eea", fontWeight: "600" },
  convMsgRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  convLastMsg: { fontSize: 14, color: "#999", flex: 1 },
  convLastMsgUnread: { color: "#333", fontWeight: "600" },
  unreadBadge: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
    marginLeft: 8,
  },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
