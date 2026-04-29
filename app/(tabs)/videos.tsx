// app/videos.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StoryBadge } from "../../app/StoryBadge";
import UserAvatar from "../../components/UserAvatar";
import { API_BASE_URL } from "../config/api";

const { width, height } = Dimensions.get("window");

interface VideoItem {
  id: number;
  title: string;
  additionalDescription: string;
  location: string;
  filePath: string;
  userId: number;
  createdAt: string;
  userName?: string;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isOwner?: boolean;
  isInWishlist?: boolean;
  mediaType?: string;
}

// ==================== SINGLE VIDEO COMPONENT ====================
function VideoItemComponent({
  item,
  isActive,
  onLikeToggle,
  onSaveToggle,
  onWishlistToggle,
  onDeleteVideo,
  onOpenComments,
  onOpenMessenger,
  onOpenShare,
  onDownload,
}: {
  item: VideoItem;
  isActive: boolean;
  onLikeToggle: (videoId: number) => void;
  onSaveToggle: (videoId: number) => void;
  onWishlistToggle: (videoId: number) => void;
  onDeleteVideo: (videoId: number) => void;
  onOpenComments: (video: VideoItem) => void;
  onOpenMessenger: (video: VideoItem) => void;
  onOpenShare: (video: VideoItem) => void;
  onDownload: (video: VideoItem) => void;
}) {
  const { t } = useTranslation();
  const [videoOwnerAvatar, setVideoOwnerAvatar] = useState<string | null>(null);

  const mediaUrl = item.filePath?.startsWith("http")
    ? item.filePath
    : `${API_BASE_URL}${item.filePath.startsWith("/") ? item.filePath : "/" + item.filePath}`;

  console.log("Media URL:", mediaUrl, "Type:", item.mediaType);

  // Dohvati avatar vlasnika
  useEffect(() => {
    const fetchOwnerAvatar = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(
          `${API_BASE_URL}/api/auth/users/${item.userId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const userData = await res.json();
          if (userData.avatar) {
            const url = userData.avatar.startsWith("http")
              ? userData.avatar
              : `${API_BASE_URL}${userData.avatar}`;
            setVideoOwnerAvatar(url);
          }
        }
      } catch (error) {
        console.error("Error fetching owner avatar:", error);
      }
    };

    fetchOwnerAvatar();
  }, [item.userId]);

  const player = useVideoPlayer(mediaUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (isActive && item.mediaType === "video") {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player, item.mediaType]);

  // Provjeri je li slika
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const filePathLower = (item.filePath || "").toLowerCase();
  const isImageByExtension = imageExtensions.some((ext) =>
    filePathLower.includes(ext),
  );
  const isImage = item.mediaType === "image" || isImageByExtension;

  return (
    <View style={styles.videoContainer}>
      {isImage ? (
        <Image
          source={{ uri: mediaUrl }}
          style={styles.video}
          resizeMode="cover"
        />
      ) : (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      <View style={styles.rightSidebar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onLikeToggle(item.id)}
        >
          <Ionicons
            name={item.isLiked ? "heart" : "heart-outline"}
            size={32}
            color={item.isLiked ? "#ff3b30" : "white"}
          />
          <Text style={styles.actionText}>{item.likeCount || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onOpenComments(item)}
        >
          <Ionicons name="chatbubble-outline" size={28} color="white" />
          <Text style={styles.actionText}>{item.commentCount || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onOpenMessenger(item)}
        >
          <Ionicons name="paper-plane-outline" size={28} color="white" />
          <Text style={styles.actionText}>{t("videos.sendMessage")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onOpenShare(item)}
        >
          <Ionicons name="share-social-outline" size={28} color="white" />
          <Text style={styles.actionText}>{t("common.share")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onDownload(item)}
        >
          <Ionicons name="download-outline" size={28} color="white" />
          <Text style={styles.actionText}>{t("common.download")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onSaveToggle(item.id)}
        >
          <Ionicons
            name={item.isSaved ? "bookmark" : "bookmark-outline"}
            size={28}
            color={item.isSaved ? "#2D6418" : "white"}
          />
          <Text style={styles.actionText}>{t("profile.box")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onWishlistToggle(item.id)}
        >
          <Ionicons
            name={item.isInWishlist ? "star" : "star-outline"}
            size={28}
            color={item.isInWishlist ? "#FFD700" : "white"}
          />
          <Text style={styles.actionText}>{t("profile.wishlist")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomInfo}>
        <View style={styles.userInfo}>
          <StoryBadge userId={item.userId} size={40}>
            {/* ── PROMIJENJENO: samo userId, bez avatar i firstName propa ── */}
            <UserAvatar userId={item.userId} size={40} />
          </StoryBadge>
          <Text style={styles.userName}>
            {item.userName || `User_${item.userId}`}
          </Text>
        </View>
        <Text style={styles.videoTitle}>{item.title}</Text>
        {item.location && (
          <View style={styles.locationRow}>
            <Ionicons
              name="location-outline"
              size={14}
              color="rgba(255,255,255,0.8)"
            />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        )}
        {item.additionalDescription && (
          <Text style={styles.videoDescription}>
            {item.additionalDescription}
          </Text>
        )}
      </View>
    </View>
  );
}
// ==================== COMMENTS MODAL ====================

// app/videos.tsx - zamijeni CommentsModal sa ovim:

// app/videos.tsx - zamijeni CommentsModal sa ovim:

function CommentsModal({
  visible,
  video,
  onClose,
  onCommentAdded,
}: {
  visible: boolean;
  video: VideoItem | null;
  onClose: () => void;
  onCommentAdded: () => void;
}) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const loadComments = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!video) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/comment/video/${video.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Comments loaded:", data.length);
        setComments(data);
      }
    } catch (e) {
      console.error("Error loading comments:", e);
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!video || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newComment.trim(), videoId: video.id }),
      });
      if (res.ok) {
        setNewComment("");
        await loadComments();
        onCommentAdded();
        // Scroll to bottom to show new comment
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
        await fetch(`${API_BASE_URL}/api/activity/track/comment`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (visible && video) {
      loadComments();
    }
  }, [visible, video]);

  if (!video) return null;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {t("videos.comments", { count: video?.commentCount || 0 })}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Lista komentara - flex: 1 gura input na dno */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#2D6418"
              style={{ marginTop: 40, flex: 1 }}
            />
          ) : comments.length === 0 ? (
            <View style={[styles.emptyComments, { flex: 1 }]}>
              <Ionicons name="chatbubbles-outline" size={56} color="#ddd" />
              <Text style={styles.emptyCommentsText}>
                {t("videos.noComments")}
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {comments.map((item) => (
                <View key={item.id} style={styles.commentItem}>
                  <View style={styles.commentAvatar}>
                    #2D6418
                    <Ionicons name="person-circle" size={36} color="" />
                  </View>
                  <View style={styles.commentContent}>
                    <Text style={styles.commentUser}>
                      {item.userName || `User_${item.userId}`}
                    </Text>
                    <Text style={styles.commentText}>{item.content}</Text>
                    <Text style={styles.commentDate}>
                      {new Date(item.createdAt).toLocaleDateString("hr-HR")}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Input - uvijek vidljiv iznad tipkovnice */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder={t("videos.addComment")}
              placeholderTextColor="#999"
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={addComment}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!newComment.trim() || submitting) && styles.sendBtnDisabled,
              ]}
              onPress={addComment}
              disabled={!newComment.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const cm = StyleSheet.create({
  // KAV = cijeli ekran, sheet se gurkne na vrh tipkovnice
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  emptyComments: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyCommentsText: {
    fontSize: 16,
    color: "#bbb",
    textAlign: "center",
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  commentContent: {
    flex: 1,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 4,
  },
  commentDate: {
    fontSize: 11,
    color: "#999",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingBottom: Platform.OS === "ios" ? 34 : 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  emptyText: {
    textAlign: "center",
    color: "#bbb",
    marginTop: 32,
    fontSize: 15,
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  commentBody: { flex: 1 },

  input: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 22,
    paddingHorizontal: 16,
    // Eksplicitan vertikalni padding osigurava da tekst nije skriven
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    color: "#333",
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: { backgroundColor: "#ccc" },
});

// ==================== MESSENGER MODAL ====================
function MessengerModal({
  visible,
  video,
  onClose,
}: {
  visible: boolean;
  video: VideoItem | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!video || !message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/message/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId: video.userId,
          content: message.trim(),
        }),
      });
      if (res.ok) {
        setMessage("");

        Alert.alert(
          t("common.success"),
          t("messages.messageSent", {
            username: video?.userName || `User_${video?.userId}`,
          }),
        );
        onClose();
      } else {
        Alert.alert(t("common.error"), t("messages.messageFailed"));
      }
    } catch {
      Alert.alert(t("common.error"), t("messages.messageFailed"));
    } finally {
      setSending(false);
    }
  };

  if (!video) return null;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={mm.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={mm.sheet}>
          <View style={mm.handle} />

          <View style={mm.header}>
            <Text style={mm.title}>{t("messages.sendMessage")}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={mm.recipientRow}>
            <Ionicons name="person-circle" size={44} color="#2D6418" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={mm.recipientName}>
                {video.userName || `User_${video.userId}`}
              </Text>
              <Text style={mm.recipientSub} numberOfLines={1}>
                {video.title}
              </Text>
            </View>
          </View>

          {/* Brze poruke */}
          <View style={mm.quickRow}>
            {[
              t("videos.quickMessage1"),
              t("videos.quickMessage2"),
              t("videos.quickMessage3"),
              t("videos.quickMessage4"),
            ].map((q) => (
              <TouchableOpacity
                key={q}
                style={mm.quickChip}
                onPress={() => setMessage(q)}
              >
                <Text style={mm.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={mm.inputRow}>
            <TextInput
              style={mm.input}
              placeholder={t("messages.writeMessage", {
                name: video?.userName || "",
              })}
              placeholderTextColor="#aaa"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              autoFocus
            />
            <TouchableOpacity
              style={[
                mm.sendBtn,
                (!message.trim() || sending) && mm.sendBtnDisabled,
              ]}
              onPress={sendMessage}
              disabled={!message.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mm = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  recipientName: { fontSize: 15, fontWeight: "600", color: "#333" },
  recipientSub: { fontSize: 13, color: "#999", marginTop: 2 },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quickChip: {
    backgroundColor: "#f0f0ff",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickText: { fontSize: 13, color: "#2D6418" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    color: "#333",
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2D6418",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: { backgroundColor: "#ccc" },
});

// ==================== SHARE MODAL ====================
function ShareModal({
  visible,
  video,
  onClose,
}: {
  visible: boolean;
  video: VideoItem | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const loadUsers = async () => {
    const token = await AsyncStorage.getItem("token");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const shareToUser = async (receiverId: number, userName: string) => {
    const token = await AsyncStorage.getItem("token");
    if (!video) return;
    setSending(receiverId);
    try {
      const VIDEO_PREFIX = "__CROMAP_VIDEO__";
      const videoContent = `${VIDEO_PREFIX}${JSON.stringify({ id: video.id, title: video.title, url: video.filePath })}`;
      const res = await fetch(`${API_BASE_URL}/api/message/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId, content: videoContent }),
      });
      if (res.ok) {
        Alert.alert(
          t("common.success"),
          t("videos.sharedWith", { name: userName }),
        );
        onClose();
      }
    } catch {
      Alert.alert(t("common.error"), t("videos.shareFailed"));
    } finally {
      setSending(null);
    }
  };

  useEffect(() => {
    if (visible) {
      loadUsers();
      setSearch("");
    }
  }, [visible]);
  const filtered = users.filter((u) =>
    u.username?.toLowerCase().includes(search.toLowerCase()),
  );
  if (!video) return null;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="black" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{t("videos.shareVideo")}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TextInput
            style={styles.searchInput}
            placeholder={t("videos.searchUsers")}
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#2D6418"
            style={{ marginTop: 40 }}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(u) => u.id.toString()}
            renderItem={({ item: u }) => (
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => shareToUser(u.id, u.username)}
                disabled={sending === u.id}
              >
                <Ionicons name="person-circle" size={44} color="#2D6418" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.recipientName}>{u.username}</Text>
                  <Text style={styles.recipientSub}>
                    {u.firstName} {u.lastName}
                  </Text>
                </View>
                {sending === u.id ? (
                  <ActivityIndicator size="small" color="#2D6418" />
                ) : (
                  <Ionicons
                    name="paper-plane-outline"
                    size={22}
                    color="#2D6418"
                  />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        )}
      </View>
    </Modal>
  );
}

// ==================== UPLOAD MODAL ====================
export function UploadModal({
  visible,
  onClose,
  onUploaded,
}: {
  visible: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { t } = useTranslation();
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"video" | "image">("video");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<"pick" | "preview">("pick");

  const previewPlayer = useVideoPlayer(
    mediaType === "video" && mediaUri ? mediaUri : "",
    (p) => {
      p.loop = true;
    },
  );

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t("common.permissionRequired"),
        t("common.galleryPermission"),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.type === "video" ? "video" : "image");
      setStep("preview");
    }
  };

  const recordMedia = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();

    if (!perm.granted) {
      Alert.alert(t("common.permissionRequired"), t("common.cameraPermission"));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      videoMaxDuration: 60,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      setMediaUri(asset.uri);
      setMediaType(asset.type === "video" ? "video" : "image");
      setStep("preview");
    }
  };

  // Zamijeni uploadMedia funkciju s ovom:
  const uploadMedia = async () => {
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

    if (!mediaUri || !title.trim()) {
      Alert.alert(t("common.error"), t("videos.titleRequired"));
      return;
    }

    if (!location.trim()) {
      Alert.alert(t("common.error"), t("videos.locationRequired"));
      return;
    }

    if (!userId || userId === "0") {
      Alert.alert(t("common.error"), t("auth.notLoggedIn"));
      return;
    }

    // 🔥 IZMJENA: Podrži i slike i videe
    if (mediaType !== "video" && mediaType !== "image") {
      Alert.alert(t("common.error"), t("videos.unsupportedMediaType"));
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      // Odredi MIME tip na temelju ekstenzije
      let mimeType = "video/mp4";
      let fileName = "media.mp4";

      if (mediaType === "image") {
        // Provjeri ekstenziju za slike
        const uriParts = mediaUri.split(".");
        const fileExtension = uriParts[uriParts.length - 1].toLowerCase();

        if (fileExtension === "jpg" || fileExtension === "jpeg") {
          mimeType = "image/jpeg";
          fileName = "image.jpg";
        } else if (fileExtension === "png") {
          mimeType = "image/png";
          fileName = "image.png";
        } else if (fileExtension === "gif") {
          mimeType = "image/gif";
          fileName = "image.gif";
        } else if (fileExtension === "webp") {
          mimeType = "image/webp";
          fileName = "image.webp";
        } else {
          mimeType = "image/jpeg";
          fileName = "image.jpg";
        }
      } else {
        // Video
        mimeType = "video/mp4";
        fileName = "video.mp4";
      }

      formData.append("Video", {
        uri: mediaUri,
        type: mimeType,
        name: fileName,
      } as any);

      formData.append("Title", title.trim());
      formData.append("Location", location.trim());
      formData.append("Description", description.trim() || "Nema opisa");
      formData.append("UserId", userId);
      formData.append("MediaType", mediaType); // Dodaj tip medija

      console.log("Uploading media:", {
        type: mediaType,
        mimeType: mimeType,
        title: title.trim(),
        location: location.trim(),
        userId: userId,
      });

      const res = await fetch(`${API_BASE_URL}/api/video/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        console.log("Upload success:", data);

        await fetch(`${API_BASE_URL}/api/activity/track/post`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});

        Alert.alert(
          t("common.success"),
          t("videos.publishSuccess", {
            type: mediaType === "image" ? t("videos.image") : t("videos.video"),
          }),
        );
        resetModal();
        onUploaded();
      } else {
        const errorText = await res.text();
        Alert.alert(t("common.error"), t("videos.uploadFailed"));
      }
    } catch (error) {
      console.error("Upload exception:", error);
      Alert.alert(t("common.error"), t("videos.uploadFailedCheckConnection"));
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setMediaUri(null);
    setTitle("");
    setLocation("");
    setDescription("");
    setStep("pick");
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={resetModal}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetModal}>
              <Ionicons name="close" size={28} color="black" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {step === "pick" ? "Dodaj sadržaj" : "Pregled i objava"}
            </Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16 }}
          >
            {step === "pick" ? (
              <View style={styles.pickContainer}>
                <Text style={styles.pickHint}>Odaberi vrstu i izvor</Text>
                <TouchableOpacity
                  style={styles.pickBtn}
                  onPress={pickFromGallery}
                >
                  <Ionicons name="images" size={40} color="#2D6418" />
                  <Text style={styles.pickBtnText}>Iz galerije</Text>
                  <Text style={styles.pickBtnSub}>Slike i videji</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickBtn} onPress={recordMedia}>
                  <Ionicons name="camera" size={40} color="#2D6418" />
                  <Text style={styles.pickBtnText}>Kamera / Snimanje</Text>
                  <Text style={styles.pickBtnSub}>Snimite sliku ili video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.previewContainer}>
                  {mediaType === "image" ? (
                    <Image
                      source={{ uri: mediaUri ?? "" }}
                      style={styles.previewMedia}
                      resizeMode="cover"
                    />
                  ) : (
                    <VideoView
                      player={previewPlayer}
                      style={styles.previewMedia}
                      contentFit="cover"
                      nativeControls={false}
                    />
                  )}
                  <View style={styles.mediaTypeBadge}>
                    <Ionicons
                      name={mediaType === "video" ? "videocam" : "image"}
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.mediaTypeBadgeText}>
                      {mediaType === "video" ? "Video" : "Slika"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.changeBtn}
                    onPress={() => {
                      setMediaUri(null);
                      setStep("pick");
                    }}
                  >
                    <Ionicons name="refresh" size={16} color="#fff" />
                    <Text
                      style={{ color: "#fff", fontSize: 12, marginLeft: 4 }}
                    >
                      Promijeni
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>Naslov *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Naslov objave"
                  placeholderTextColor="#999"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={100}
                />
                <Text style={styles.fieldLabel}>
                  Lokacija *{" "}
                  <Text style={{ color: "#ff3b30", fontSize: 12 }}>
                    (obavezno)
                  </Text>
                </Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Npr. Zagreb, Dolac"
                  placeholderTextColor="#999"
                  value={location}
                  onChangeText={setLocation}
                  maxLength={150}
                />
                <Text style={styles.fieldLabel}>Opis (opcionalno)</Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    { height: 80, textAlignVertical: "top" },
                  ]}
                  placeholder="Kratki opis..."
                  placeholderTextColor="#999"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={300}
                />
                <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { flex: 1, backgroundColor: "#ff3b30" },
                    ]}
                    onPress={() => {
                      setMediaUri(null);
                      setStep("pick");
                    }}
                    disabled={uploading}
                  >
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                    <Text style={styles.actionBtnText}>Obriši</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        flex: 1,
                        backgroundColor: uploading ? "#a0aec0" : "#2D6418",
                      },
                    ]}
                    onPress={uploadMedia}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="cloud-upload-outline"
                          size={22}
                          color="#fff"
                        />
                        <Text style={styles.actionBtnText}>Objavi</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ==================== MAIN SCREEN ====================
export default function VideosScreen() {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(
    null,
  );
  const [selectedVideoForComments, setSelectedVideoForComments] =
    useState<VideoItem | null>(null);
  const [selectedVideoForMessenger, setSelectedVideoForMessenger] =
    useState<VideoItem | null>(null);
  const [selectedVideoForShare, setSelectedVideoForShare] =
    useState<VideoItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadVideos = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/video`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setVideos(await res.json());
    } catch {
      Alert.alert(t("common.error"), t("videos.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  // ── LIKE ──
  const handleLikeToggle = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId
          ? {
              ...v,
              isLiked: !v.isLiked,
              likeCount: v.isLiked
                ? (v.likeCount ?? 1) - 1
                : (v.likeCount ?? 0) + 1,
            }
          : v,
      ),
    );
    try {
      const res = await fetch(`${API_BASE_URL}/api/like/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) throw new Error();

      await fetch(`${API_BASE_URL}/api/activity/track/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    } catch {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? {
                ...v,
                isLiked: !v.isLiked,
                likeCount: v.isLiked
                  ? (v.likeCount ?? 1) - 1
                  : (v.likeCount ?? 0) + 1,
              }
            : v,
        ),
      );
    }
  };

  // ── BOX / SAVE (FIX: use correct save/unsave endpoints) ──
  const handleSaveToggle = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;

    // Optimistički update
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v)),
    );

    try {
      if (!video.isSaved) {
        // Spremi video u Box
        const res = await fetch(`${API_BASE_URL}/api/savedvideo/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ videoId }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      } else {
        // Ukloni iz Boxa
        const userId = await AsyncStorage.getItem("userId");
        const res = await fetch(
          `${API_BASE_URL}/api/savedvideo/unsave?videoId=${videoId}&userId=${userId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error(`Unsave failed: ${res.status}`);
      }
    } catch (e) {
      console.error("Box toggle error:", e);
      // Vrati na staro
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v)),
      );
      Alert.alert(t("common.error"), t("videos.boxToggleFailed"));
    }
  };

  // ── WISHLIST ──
  const handleWishlistToggle = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;

    // Optimistički update
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? { ...v, isInWishlist: !v.isInWishlist } : v,
      ),
    );

    try {
      if (!video.isInWishlist) {
        // Dodaj u wishlist - koristi ispravan endpoint
        const res = await fetch(`${API_BASE_URL}/api/wishlistvideo/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ videoId, notes: "" }),
        });

        if (!res.ok) {
          const error = await res.text();
          console.error("Add to wishlist error:", error);
          throw new Error(error);
        }

        console.log("Video added to wishlist successfully");
      } else {
        // Ukloni iz wishlist - koristi ispravan endpoint
        const userId = await AsyncStorage.getItem("userId");
        const res = await fetch(
          `${API_BASE_URL}/api/wishlistvideo/remove?userId=${userId}&videoId=${videoId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.ok) {
          const error = await res.text();
          console.error("Remove from wishlist error:", error);
          throw new Error(error);
        }

        console.log("Video removed from wishlist successfully");
      }
    } catch (error) {
      console.error("Wishlist toggle error:", error);
      // Vrati na staro ako je greška
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId ? { ...v, isInWishlist: !v.isInWishlist } : v,
        ),
      );
      Alert.alert(t("common.error"), t("videos.wishlistToggleFailed"));
    }
  };

  // ── DOWNLOAD ──
  const handleDownload = async (video: VideoItem) => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.permissionRequired"), t("common.mediaPermission"));
      return;
    }
    Alert.alert(t("videos.downloading"), t("videos.downloadingDesc"));
    try {
      const fileName = `cromap_${video.id}_${Date.now()}.mp4`;
      const downloadDest = FileSystem.documentDirectory + fileName;
      const result = await FileSystem.downloadAsync(
        video.filePath,
        downloadDest,
      );
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Alert.alert(t("common.success"), t("videos.downloadSuccess"));
    } catch {
      Alert.alert(t("common.error"), t("videos.downloadFailed"));
    }
  };

  // ── DELETE ──
  const handleDeleteVideo = async (videoId: number) => {
    Alert.alert(t("videos.deleteConfirm"), t("videos.deleteConfirmQuestion"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const token = await AsyncStorage.getItem("token");
          try {
            const res = await fetch(`${API_BASE_URL}/api/video/${videoId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok)
              setVideos((prev) => prev.filter((v) => v.id !== videoId));
          } catch {
            Alert.alert("Greška", "Brisanje nije uspjelo");
          }
        },
      },
    ]);
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0)
      setCurrentPlayingIndex(viewableItems[0].index);
  }, []);

  if (loading)
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2D6418" />
      </View>
    );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowUploadModal(true)}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
      <FlatList
        ref={flatListRef}
        data={videos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => (
          <VideoItemComponent
            item={item}
            isActive={index === currentPlayingIndex}
            onLikeToggle={handleLikeToggle}
            onSaveToggle={handleSaveToggle}
            onWishlistToggle={handleWishlistToggle}
            onDeleteVideo={handleDeleteVideo}
            onOpenComments={setSelectedVideoForComments}
            onOpenMessenger={setSelectedVideoForMessenger}
            onOpenShare={setSelectedVideoForShare}
            onDownload={handleDownload}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        snapToInterval={height}
        decelerationRate="fast"
      />
      <CommentsModal
        visible={selectedVideoForComments !== null}
        video={selectedVideoForComments}
        onClose={() => setSelectedVideoForComments(null)}
        onCommentAdded={loadVideos}
      />
      <MessengerModal
        visible={selectedVideoForMessenger !== null}
        video={selectedVideoForMessenger}
        onClose={() => setSelectedVideoForMessenger(null)}
      />
      <ShareModal
        visible={selectedVideoForShare !== null}
        video={selectedVideoForShare}
        onClose={() => setSelectedVideoForShare(null)}
      />
      <UploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={loadVideos}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  commentUser: {
    fontWeight: "600",
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  emptyComments: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyCommentsText: {
    fontSize: 16,
    color: "#bbb",
    textAlign: "center",
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  commentContent: {
    flex: 1,
  },
  videoContainer: {
    width,
    height,
    position: "relative",
    backgroundColor: "#000",
  },
  video: { width: "100%", height: "100%" },
  rightSidebar: {
    position: "absolute",
    bottom: 100,
    right: 12,
    alignItems: "center",
    gap: 16,
  },
  actionButton: { alignItems: "center", gap: 2 },
  actionText: { color: "white", fontSize: 11, fontWeight: "500" },
  bottomInfo: { position: "absolute", bottom: 80, left: 16, right: 90 },
  userInfo: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  userName: { color: "white", fontSize: 15, fontWeight: "600", marginLeft: 8 },
  videoTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  locationText: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  videoDescription: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  addButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    right: 16,
    backgroundColor: "#2D6418",
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: { fontSize: 17, fontWeight: "600", color: "#333" },
  commentItem: { flexDirection: "row", marginVertical: 10, gap: 10 },

  commentText: { fontSize: 14, color: "#555", marginBottom: 2 },
  commentDate: { fontSize: 11, color: "#999" },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    fontSize: 15,
  },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "white",
    alignItems: "flex-end",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    color: "#333",
  },
  sendBtn: {
    backgroundColor: "#2D6418",
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#ccc" },
  recipientCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8f8ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0ff",
  },
  recipientName: { fontSize: 15, fontWeight: "600", color: "#333" },
  recipientSub: { fontSize: 13, color: "#666", marginTop: 2 },
  searchInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#333",
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  pickContainer: { alignItems: "center", gap: 20, paddingTop: 40 },
  pickHint: { fontSize: 18, color: "#666", marginBottom: 8 },
  pickBtn: {
    width: "80%",
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#2D6418",
    borderStyle: "dashed",
    gap: 8,
  },
  pickBtnText: { fontSize: 16, color: "#2D6418", fontWeight: "600" },
  pickBtnSub: { fontSize: 13, color: "#999" },
  previewContainer: { position: "relative", marginBottom: 20 },
  previewMedia: { width: "100%", height: 260, borderRadius: 12 },
  mediaTypeBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  mediaTypeBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  changeBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 6,
    marginTop: 12,
  },
  fieldInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  userAvatar: {
    // ← DODANO
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
