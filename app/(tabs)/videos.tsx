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

// ─── VARA Paleta — usklađena sa search stilom ──────────────────────────────────
const V = {
  forestDeep: "#1A2E15", // search: forestDeep
  forestMid: "#243B1E", // search: forestMid
  forestLight: "#2D5518", // search: forestLight
  borderGreen: "#4A7040", // search: borderGreen
  borderDim: "#304A28", // search: borderDim
  silver: "#C4CABC", // search: silver
  silverBright: "#E8EDE4", // search: silverBright
  silverDim: "#8A9486", // search: silverDim
  accentGold: "#B8A060",
  visited: "#5A8A48", // search: visited
  danger: "#8B3030",
  overlay: "rgba(10,20,8,0.88)",
} as const;

interface VideoItem {
  id: number;
  title: string;
  additionalDescription: string;
  location: string;
  filePath: string;
  userId: number;
  createdAt: string;
  userName?: string;
  userAvatar?: string | null;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isOwner?: boolean;
  isInWishlist?: boolean;
  mediaType?: string;
}

// ─── Helper: avatar URL ────────────────────────────────────────────────────────
function buildAvatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  if (avatar.startsWith("http://") || avatar.startsWith("https://"))
    return avatar;
  return `${API_BASE_URL}${avatar.startsWith("/") ? avatar : `/${avatar}`}`;
}

// ─── VARA Avatar s fallback inicijalima ───────────────────────────────────────
function VaraAvatar({
  avatar,
  firstName,
  lastName,
  size,
}: {
  avatar?: string | null;
  firstName?: string;
  lastName?: string;
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
  onLikeToggle: (id: number) => void;
  onSaveToggle: (id: number) => void;
  onWishlistToggle: (id: number) => void;
  onDeleteVideo: (id: number) => void;
  onOpenComments: (v: VideoItem) => void;
  onOpenMessenger: (v: VideoItem) => void;
  onOpenShare: (v: VideoItem) => void;
  onDownload: (v: VideoItem) => void;
}) {
  const { t } = useTranslation();

  const mediaUrl = item.filePath?.startsWith("http")
    ? item.filePath
    : `${API_BASE_URL}${item.filePath?.startsWith("/") ? item.filePath : "/" + item.filePath}`;

  const player = useVideoPlayer(mediaUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (isActive && item.mediaType === "video") player.play();
    else player.pause();
  }, [isActive, player, item.mediaType]);

  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const isImage =
    item.mediaType === "image" ||
    imageExtensions.some((ext) =>
      (item.filePath || "").toLowerCase().includes(ext),
    );

  return (
    <View style={vs.videoContainer}>
      {isImage ? (
        <Image source={{ uri: mediaUrl }} style={vs.video} resizeMode="cover" />
      ) : (
        <VideoView
          player={player}
          style={vs.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      <View style={vs.rightSidebar}>
        <TouchableOpacity
          style={vs.actionButton}
          onPress={() => onLikeToggle(item.id)}
        >
          <Ionicons
            name={item.isLiked ? "heart" : "heart-outline"}
            size={32}
            color={item.isLiked ? "#ff3b30" : "white"}
          />
          <Text style={vs.actionText}>{item.likeCount || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={vs.actionButton}
          onPress={() => onOpenComments(item)}
        >
          <Ionicons name="chatbubble-outline" size={28} color="white" />
          <Text style={vs.actionText}>{item.commentCount || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={vs.actionButton}
          onPress={() => onOpenMessenger(item)}
        >
          <Ionicons name="paper-plane-outline" size={28} color="white" />
          <Text style={vs.actionText}>{t("videos.sendMessage")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={vs.actionButton}
          onPress={() => onOpenShare(item)}
        >
          <Ionicons name="share-social-outline" size={28} color="white" />
          <Text style={vs.actionText}>{t("common.share")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={vs.actionButton}
          onPress={() => onDownload(item)}
        >
          <Ionicons name="download-outline" size={28} color="white" />
          <Text style={vs.actionText}>{t("common.download")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={vs.actionButton}
          onPress={() => onSaveToggle(item.id)}
        >
          <Ionicons
            name={item.isSaved ? "bookmark" : "bookmark-outline"}
            size={28}
            color={item.isSaved ? V.visited : "white"}
          />
          <Text style={vs.actionText}>{t("profile.box")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={vs.actionButton}
          onPress={() => onWishlistToggle(item.id)}
        >
          <Ionicons
            name={item.isInWishlist ? "star" : "star-outline"}
            size={28}
            color={item.isInWishlist ? V.accentGold : "white"}
          />
          <Text style={vs.actionText}>{t("profile.wishlist")}</Text>
        </TouchableOpacity>
      </View>

      <View style={vs.bottomInfo}>
        <View style={vs.userInfo}>
          <StoryBadge userId={item.userId} size={40}>
            <UserAvatar userId={item.userId} size={40} />
          </StoryBadge>
          <Text style={vs.userName}>
            {item.userName || `User_${item.userId}`}
          </Text>
        </View>
        <Text style={vs.videoTitle}>{item.title}</Text>
        {item.location && (
          <View style={vs.locationRow}>
            <Ionicons
              name="location-outline"
              size={14}
              color="rgba(255,255,255,0.8)"
            />
            <Text style={vs.locationText}>{item.location}</Text>
          </View>
        )}
        {item.additionalDescription && (
          <Text style={vs.videoDescription}>{item.additionalDescription}</Text>
        )}
      </View>
    </View>
  );
}

// ==================== COMMENTS MODAL — VARA ===================================
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
    if (!video) return;
    const token = await AsyncStorage.getItem("token");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/comment/video/${video.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setComments(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!video || !newComment.trim()) return;
    const token = await AsyncStorage.getItem("token");
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
        setTimeout(
          () => scrollViewRef.current?.scrollToEnd({ animated: true }),
          100,
        );
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
    if (visible && video) loadComments();
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
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: V.forestDeep }}>
          {/* ── Header: "Komentari" lijevo, "Zatvori" desno, spušten prema dolje ── */}
          <View style={modal.headerSplit}>
            <Text style={modal.headerLeftTitle}>
              {t("videos.comments", { count: video?.commentCount || 0 })}
            </Text>
            <TouchableOpacity onPress={onClose} style={modal.closeBtnText}>
              <Text style={modal.closeBtnLabel}>Zatvori</Text>
            </TouchableOpacity>
          </View>

          {/* Lista */}
          {loading ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={V.visited} />
            </View>
          ) : comments.length === 0 ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View style={modal.emptyIconWrap}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={44}
                  color={V.borderGreen}
                />
              </View>
              <Text style={modal.emptyText}>{t("videos.noComments")}</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {comments.map((item) => (
                <View key={item.id} style={modal.commentRow}>
                  {/* ── Prava profilna slika korisnika ── */}
                  <UserAvatar userId={item.userId} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={modal.commentUser}>
                      {item.userName || `User_${item.userId}`}
                    </Text>
                    <Text style={modal.commentText}>{item.content}</Text>
                    <Text style={modal.commentDate}>
                      {new Date(item.createdAt).toLocaleDateString("hr-HR")}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Input */}
          <View style={modal.inputRow}>
            <TextInput
              style={modal.textInput}
              placeholder={t("videos.addComment")}
              placeholderTextColor={V.silverDim}
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
                modal.sendBtn,
                (!newComment.trim() || submitting) && modal.sendBtnDisabled,
              ]}
              onPress={addComment}
              disabled={!newComment.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={V.silverBright} />
              ) : (
                <Ionicons name="send" size={20} color={V.silverBright} />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ==================== MESSENGER MODAL — VARA (fullscreen) ====================
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
    if (!video || !message.trim()) return;
    const token = await AsyncStorage.getItem("token");
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
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: V.forestDeep }}>
          {/* ── "Pošalji poruku" lijevo, "Zatvori" desno, spušten ── */}
          <View style={modal.headerSplit}>
            <Text style={modal.headerLeftTitle}>
              {t("messages.sendMessage")}
            </Text>
            <TouchableOpacity onPress={onClose} style={modal.closeBtnText}>
              <Text style={modal.closeBtnLabel}>Zatvori</Text>
            </TouchableOpacity>
          </View>

          {/* ── Primatelj s pravom profilnom slikom ── */}
          <View style={modal.recipientRow}>
            <UserAvatar userId={video.userId} size={48} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={modal.recipientName}>
                {video.userName || `User_${video.userId}`}
              </Text>
              <Text style={modal.recipientSub} numberOfLines={1}>
                {video.title}
              </Text>
            </View>
          </View>

          {/* ── Quick replies ── */}
          <View style={modal.quickRow}>
            {[
              t("videos.quickMessage1"),
              t("videos.quickMessage2"),
              t("videos.quickMessage3"),
              t("videos.quickMessage4"),
            ].map((q) => (
              <TouchableOpacity
                key={q}
                style={modal.quickChip}
                onPress={() => setMessage(q)}
              >
                <Text style={modal.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Spacer da input bude pri dnu ── */}
          <View style={{ flex: 1 }} />

          {/* ── Input ── */}
          <View style={modal.inputRow}>
            <TextInput
              style={modal.textInput}
              placeholder={t("messages.writeMessage", {
                name: video?.userName || "",
              })}
              placeholderTextColor={V.silverDim}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              autoFocus
            />
            <TouchableOpacity
              style={[
                modal.sendBtn,
                (!message.trim() || sending) && modal.sendBtnDisabled,
              ]}
              onPress={sendMessage}
              disabled={!message.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={V.silverBright} />
              ) : (
                <Ionicons name="send" size={18} color={V.silverBright} />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ==================== SHARE MODAL — VARA =====================================
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
    if (!video) return;
    const token = await AsyncStorage.getItem("token");
    setSending(receiverId);
    try {
      const VIDEO_PREFIX = "__CROMAP_VIDEO__";
      const content = `${VIDEO_PREFIX}${JSON.stringify({ id: video.id, title: video.title, url: video.filePath })}`;
      const res = await fetch(`${API_BASE_URL}/api/message/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId, content }),
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
      <SafeAreaView style={{ flex: 1, backgroundColor: V.forestDeep }}>
        {/* ── Header: "Podijeli video" lijevo, "Zatvori" desno, spušten ── */}
        <View style={modal.headerSplit}>
          <Text style={modal.headerLeftTitle}>{t("videos.shareVideo")}</Text>
          <TouchableOpacity onPress={onClose} style={modal.closeBtnText}>
            <Text style={modal.closeBtnLabel}>Zatvori</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search — s razmakom ispod headera ── */}
        <View
          style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}
        >
          <View style={modal.searchBar}>
            <Ionicons
              name="search-outline"
              size={16}
              color={V.silverDim}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={modal.searchInput}
              placeholder={t("videos.searchUsers")}
              placeholderTextColor={V.silverDim}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Lista korisnika */}
        {loading ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" color={V.visited} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(u) => u.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 12 }}
            renderItem={({ item: u }) => (
              <TouchableOpacity
                style={modal.userRow}
                onPress={() => shareToUser(u.id, u.username)}
                disabled={sending === u.id}
              >
                <UserAvatar userId={u.id} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={modal.recipientName}>{u.username}</Text>
                  <Text style={modal.recipientSub}>
                    {u.firstName} {u.lastName}
                  </Text>
                </View>
                {sending === u.id ? (
                  <ActivityIndicator size="small" color={V.visited} />
                ) : (
                  <View style={modal.shareIconWrap}>
                    <Ionicons
                      name="paper-plane-outline"
                      size={18}
                      color={V.visited}
                    />
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
                <Ionicons
                  name="people-outline"
                  size={44}
                  color={V.borderGreen}
                />
                <Text style={{ color: V.silverDim, fontSize: 15 }}>
                  Nema korisnika
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ==================== UPLOAD MODAL — VARA =====================================
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

    setUploading(true);
    try {
      let mimeType = "video/mp4";
      let fileName = "media.mp4";
      if (mediaType === "image") {
        const ext = mediaUri.split(".").pop()?.toLowerCase() ?? "jpg";
        mimeType =
          ext === "png"
            ? "image/png"
            : ext === "gif"
              ? "image/gif"
              : "image/jpeg";
        fileName = `image.${ext}`;
      }
      const formData = new FormData();
      formData.append("Video", {
        uri: mediaUri,
        type: mimeType,
        name: fileName,
      } as any);
      formData.append("Title", title.trim());
      formData.append("Location", location.trim());
      formData.append("Description", description.trim() || "Nema opisa");
      formData.append("UserId", userId);
      formData.append("MediaType", mediaType);

      const res = await fetch(`${API_BASE_URL}/api/video/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
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
        Alert.alert(t("common.error"), t("videos.uploadFailed"));
      }
    } catch {
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
        <SafeAreaView style={{ flex: 1, backgroundColor: V.forestDeep }}>
          <View style={modal.header}>
            <TouchableOpacity onPress={resetModal}>
              <Ionicons name="close" size={28} color={V.silver} />
            </TouchableOpacity>
            <Text style={modal.title}>
              {step === "pick" ? "Dodaj sadržaj" : "Pregled i objava"}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 16,
              backgroundColor: V.forestDeep,
            }}
          >
            {step === "pick" ? (
              <View style={upload.pickContainer}>
                <Text style={upload.pickHint}>Odaberi vrstu i izvor</Text>
                <TouchableOpacity
                  style={upload.pickBtn}
                  onPress={pickFromGallery}
                >
                  <Ionicons name="images" size={40} color={V.visited} />
                  <Text style={upload.pickBtnText}>Iz galerije</Text>
                  <Text style={upload.pickBtnSub}>Slike i videji</Text>
                </TouchableOpacity>
                <TouchableOpacity style={upload.pickBtn} onPress={recordMedia}>
                  <Ionicons name="camera" size={40} color={V.visited} />
                  <Text style={upload.pickBtnText}>Kamera / Snimanje</Text>
                  <Text style={upload.pickBtnSub}>Snimite sliku ili video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={upload.previewContainer}>
                  {mediaType === "image" ? (
                    <Image
                      source={{ uri: mediaUri ?? "" }}
                      style={upload.previewMedia}
                      resizeMode="cover"
                    />
                  ) : (
                    <VideoView
                      player={previewPlayer}
                      style={upload.previewMedia}
                      contentFit="cover"
                      nativeControls={false}
                    />
                  )}
                  <View style={upload.mediaTypeBadge}>
                    <Ionicons
                      name={mediaType === "video" ? "videocam" : "image"}
                      size={14}
                      color="#fff"
                    />
                    <Text style={upload.mediaTypeBadgeText}>
                      {mediaType === "video" ? "Video" : "Slika"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={upload.changeBtn}
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

                <Text style={upload.fieldLabel}>Naslov *</Text>
                <TextInput
                  style={upload.fieldInput}
                  placeholder="Naslov objave"
                  placeholderTextColor={V.silverDim}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={100}
                />

                <Text style={upload.fieldLabel}>
                  Lokacija *
                  <Text style={{ color: "#ff3b30", fontSize: 12 }}>
                    {" "}
                    (obavezno)
                  </Text>
                </Text>
                <TextInput
                  style={upload.fieldInput}
                  placeholder="Npr. Zagreb, Dolac"
                  placeholderTextColor={V.silverDim}
                  value={location}
                  onChangeText={setLocation}
                  maxLength={150}
                />

                <Text style={upload.fieldLabel}>Opis (opcionalno)</Text>
                <TextInput
                  style={[
                    upload.fieldInput,
                    { height: 80, textAlignVertical: "top" },
                  ]}
                  placeholder="Kratki opis..."
                  placeholderTextColor={V.silverDim}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={300}
                />

                <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
                  <TouchableOpacity
                    style={[
                      upload.actionBtn,
                      { flex: 1, backgroundColor: V.danger },
                    ]}
                    onPress={() => {
                      setMediaUri(null);
                      setStep("pick");
                    }}
                    disabled={uploading}
                  >
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                    <Text style={upload.actionBtnText}>Obriši</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      upload.actionBtn,
                      {
                        flex: 1,
                        backgroundColor: uploading
                          ? V.borderDim
                          : V.forestLight,
                        borderColor: uploading ? V.borderDim : V.borderGreen,
                      },
                    ]}
                    onPress={uploadMedia}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color={V.silverBright} />
                    ) : (
                      <>
                        <Ionicons
                          name="cloud-upload-outline"
                          size={22}
                          color={V.silverBright}
                        />
                        <Text style={upload.actionBtnText}>Objavi</Text>
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

  const handleSaveToggle = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v)),
    );
    try {
      if (!video.isSaved) {
        const res = await fetch(`${API_BASE_URL}/api/savedvideo/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ videoId }),
        });
        if (!res.ok) throw new Error();
      } else {
        const userId = await AsyncStorage.getItem("userId");
        const res = await fetch(
          `${API_BASE_URL}/api/savedvideo/unsave?videoId=${videoId}&userId=${userId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error();
      }
    } catch {
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v)),
      );
      Alert.alert(t("common.error"), t("videos.boxToggleFailed"));
    }
  };

  const handleWishlistToggle = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? { ...v, isInWishlist: !v.isInWishlist } : v,
      ),
    );
    try {
      if (!video.isInWishlist) {
        const res = await fetch(`${API_BASE_URL}/api/wishlistvideo/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ videoId, notes: "" }),
        });
        if (!res.ok) throw new Error();
      } else {
        const userId = await AsyncStorage.getItem("userId");
        const res = await fetch(
          `${API_BASE_URL}/api/wishlistvideo/remove?userId=${userId}&videoId=${videoId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error();
      }
    } catch {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId ? { ...v, isInWishlist: !v.isInWishlist } : v,
        ),
      );
      Alert.alert(t("common.error"), t("videos.wishlistToggleFailed"));
    }
  };

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
      <View style={vs.centerContainer}>
        <ActivityIndicator size="large" color={V.visited} />
      </View>
    );

  return (
    <View style={vs.container}>
      <TouchableOpacity
        style={vs.addButton}
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

// ─── Video screen stilovi ──────────────────────────────────────────────────────
const vs = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
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
    backgroundColor: V.forestLight,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: V.borderGreen,
  },
});

// ─── Modal stilovi — VARA tema ─────────────────────────────────────────────────
const modal = StyleSheet.create({
  // ── Standardni centered header (Upload modal) ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20, // spušten prema dolje
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: V.borderGreen,
    backgroundColor: V.forestDeep,
  },
  title: { fontSize: 17, fontWeight: "700", color: V.silverBright },

  // ── Split header: naslov lijevo, "Zatvori" desno — za Komentare, Poruke i Dijeli ──
  headerSplit: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 36, // dodatno spušten prema dolje
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: V.borderGreen,
    backgroundColor: V.forestDeep,
  },
  headerLeftTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: V.silverBright,
  },
  // "Zatvori" tekst gumb
  closeBtnText: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: V.forestMid,
    borderWidth: 1,
    borderColor: V.borderGreen,
  },
  closeBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: V.silverDim,
  },
  // stari closeBtn (ostavljen radi kompatibilnosti)
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: V.forestMid,
    borderWidth: 1,
    borderColor: V.borderGreen,
    justifyContent: "center",
    alignItems: "center",
  },

  // Empty state
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: V.forestMid,
    borderWidth: 1.5,
    borderColor: V.borderGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 16, color: V.silverDim, textAlign: "center" },

  // Comments
  commentRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: V.borderDim,
    alignItems: "flex-start",
  },
  commentUser: {
    fontSize: 14,
    fontWeight: "700",
    color: V.silver,
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: V.silverDim,
    lineHeight: 20,
    marginBottom: 4,
  },
  commentDate: { fontSize: 11, color: V.silverDim },

  // Input row
  inputRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    alignItems: "flex-end",
    borderTopWidth: 1.5,
    borderTopColor: V.borderGreen,
    backgroundColor: V.forestDeep,
  },
  textInput: {
    flex: 1,
    backgroundColor: V.forestMid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: V.borderGreen,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    color: V.silverBright,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: V.forestLight,
    borderWidth: 1.5,
    borderColor: V.borderGreen,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: { backgroundColor: V.borderDim, borderColor: V.borderDim },

  // Recipient row (Messenger fullscreen)
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: V.borderDim,
  },
  recipientName: { fontSize: 15, fontWeight: "700", color: V.silverBright },
  recipientSub: { fontSize: 13, color: V.silverDim, marginTop: 2 },

  // Quick replies
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quickChip: {
    backgroundColor: V.forestMid,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: V.borderGreen,
  },
  quickText: { fontSize: 13, color: V.silver, fontWeight: "600" },

  // Share — search bar + user row
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: V.forestMid,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: V.borderGreen,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: V.silverBright },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: V.borderDim,
  },
  shareIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: V.forestMid,
    borderWidth: 1,
    borderColor: V.borderGreen,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─── Upload modal stilovi — VARA ───────────────────────────────────────────────
const upload = StyleSheet.create({
  pickContainer: { alignItems: "center", gap: 20, paddingTop: 40 },
  pickHint: { fontSize: 18, color: V.silverDim, marginBottom: 8 },
  pickBtn: {
    width: "80%",
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: V.borderGreen,
    borderStyle: "dashed",
    gap: 8,
    backgroundColor: V.forestMid,
  },
  pickBtnText: { fontSize: 16, color: V.visited, fontWeight: "600" },
  pickBtnSub: { fontSize: 13, color: V.silverDim },
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
    fontWeight: "600",
    color: V.silver,
    marginBottom: 6,
    marginTop: 12,
  },
  fieldInput: {
    backgroundColor: V.forestMid,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: V.silverBright,
    borderWidth: 1,
    borderColor: V.borderGreen,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1.5,
    borderColor: V.borderGreen,
  },
  actionBtnText: { color: V.silverBright, fontSize: 16, fontWeight: "600" },
});
