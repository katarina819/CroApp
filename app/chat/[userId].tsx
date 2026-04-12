import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Message,
  getConversationMessages,
  getCurrentUserId,
  markAsRead,
  sendMessage,
} from "../../utils/messagesApi";
import { API_BASE_URL } from "../config/api";

// ─── Video Share Format ────────────────────────────────────────────────────────
export const VIDEO_PREFIX = "__CROMAP_VIDEO__";

export interface VideoSharePayload {
  id: number;
  title: string;
  url: string;
}

export function parseVideoMessage(content: string): VideoSharePayload | null {
  if (!content?.startsWith(VIDEO_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(VIDEO_PREFIX.length));
  } catch {
    return null;
  }
}

// ─── Video Bubble Component ────────────────────────────────────────────────────
const vbStyles = StyleSheet.create({
  container: {
    width: 240,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});

function VideoBubble({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    return () => {
      try {
        if (player) player.pause();
      } catch (e) {
        console.log("VideoPlayer already released");
      }
    };
  }, []);

  return (
    <View style={vbStyles.container}>
      <VideoView
        player={player}
        style={vbStyles.video}
        contentFit="contain"
        nativeControls={true}
      />
    </View>
  );
}

// ─── Image Bubble Component ────────────────────────────────────────────────────
const ibStyles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

function ImageBubble({ url }: { url: string }) {
  return (
    <View style={ibStyles.container}>
      <Image source={{ uri: url }} style={ibStyles.image} resizeMode="cover" />
    </View>
  );
}

function parseImageMessage(content: string): string | null {
  if (!content?.startsWith("__CROMAP_IMAGE__")) return null;
  try {
    const data = JSON.parse(content.slice("__CROMAP_IMAGE__".length));
    return data.url;
  } catch {
    return null;
  }
}

// ─── Helper funkcija za inicijale ─────────────────────────────────────────────
const getInitials = (firstName?: string, lastName?: string) => {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return `${first}${last}`.toUpperCase();
};

// ─── Chat Screen ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { userId, name } = useLocalSearchParams<{
    userId: string;
    name?: string;
  }>();

  const otherUserId = parseInt(userId ?? "0", 10);
  const displayName = name ?? `User_${userId}`;

  // State za korisničke podatke (ime, prezime, avatar)
  const [otherUserInfo, setOtherUserInfo] = useState<{
    firstName: string;
    lastName: string;
    avatar: string | null;
  } | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{
    uri: string;
    type: "image" | "video";
  } | null>(null);
  const [showMediaPreview, setShowMediaPreview] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Dohvati podatke o drugom korisniku (ime, prezime, avatar)
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(
          `${API_BASE_URL}/api/auth/users/${otherUserId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const userData = await res.json();
          let avatar = null;
          if (userData.avatar) {
            avatar = userData.avatar.startsWith("http")
              ? userData.avatar
              : `${API_BASE_URL}${userData.avatar}`;
          }
          setOtherUserInfo({
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
            avatar: avatar,
          });
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    };

    if (otherUserId) {
      fetchUserInfo();
    }
  }, [otherUserId]);

  // Funkcija za odabir medija
  const pickMedia = async (source: "gallery" | "camera") => {
    const perm =
      source === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Dozvola potrebna", "Dozvolite pristup za slanje medija");
      return;
    }

    const result =
      source === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            quality: 0.8,
            allowsEditing: false,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            quality: 0.8,
          });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMediaPreview({
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
      });
      setShowMediaPreview(true);
    }
  };

  // Funkcija za upload i slanje medija
  const sendMedia = async () => {
    if (!mediaPreview) return;
    setSendingMedia(true);

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
        uri: mediaPreview.uri,
        type: mediaPreview.type === "video" ? "video/mp4" : "image/jpeg",
        name:
          mediaPreview.type === "video" ? "chat_video.mp4" : "chat_image.jpg",
      } as any);
      formData.append("Title", "Chat Media");
      formData.append("Location", "Chat");
      formData.append("Description", "");
      formData.append("UserId", userId || "");

      const uploadRes = await fetch(`${API_BASE_URL}/api/video/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      const uploadData = await uploadRes.json();
      const mediaUrl = uploadData.videoUrl || uploadData.url;

      const mediaContent =
        mediaPreview.type === "video"
          ? `${VIDEO_PREFIX}${JSON.stringify({ id: Date.now(), title: "Video", url: mediaUrl })}`
          : `__CROMAP_IMAGE__${JSON.stringify({ url: mediaUrl })}`;

      const ok = await sendMessage(otherUserId, mediaContent);

      if (ok) {
        setMediaPreview(null);
        setShowMediaPreview(false);
        await loadMessages(true);
      }
    } catch (error) {
      console.error("Send media error:", error);
      Alert.alert("Greška", "Nije moguće poslati medij");
    } finally {
      setSendingMedia(false);
    }
  };

  // ─── Dohvat poruka ───────────────────────────────────────────────────────────
  const loadMessages = useCallback(
    async (silent = false) => {
      if (!silent) setError(null);
      try {
        const msgs = await getConversationMessages(otherUserId);
        msgs.sort(
          (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
        );
        setMessages(msgs);

        const unread = msgs.filter((m) => m.receiverId === myId && !m.isRead);
        unread.forEach((m) => markAsRead(m.id).catch(() => {}));
      } catch {
        if (!silent) setError("Greška pri učitavanju razgovora.");
      } finally {
        setLoading(false);
      }
    },
    [otherUserId, myId],
  );

  useEffect(() => {
    (async () => {
      const id = await getCurrentUserId();
      setMyId(id);
    })();
  }, []);

  useEffect(() => {
    if (myId === null) return;
    loadMessages();
    pollRef.current = setInterval(() => loadMessages(true), 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [myId, loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages.length]);

  // ─── Slanje poruke ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    const optimisticMsg: Message = {
      id: Date.now(),
      senderId: myId!,
      receiverId: otherUserId,
      content: text,
      isRead: false,
      sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setSending(true);

    try {
      const ok = await sendMessage(otherUserId, text);
      if (!ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setInputText(text);
        setError("Poruka nije poslana. Pokušaj ponovo.");
      } else {
        await loadMessages(true);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInputText(text);
      setError("Poruka nije poslana. Provjeri konekciju.");
    } finally {
      setSending(false);
    }
  };

  // ─── Formatiranje ────────────────────────────────────────────────────────────
  const formatTime = (sentAt: string) => {
    const date = new Date(sentAt);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("hr-HR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateSeparator = (sentAt: string) => {
    const date = new Date(sentAt);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return "Danas";
    if (date.toDateString() === yesterday.toDateString()) return "Jučer";
    return date.toLocaleDateString("hr-HR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  };

  // ─── Render poruke ────────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === myId;
    const videoPayload = parseVideoMessage(item.content);
    const imageUrl = parseImageMessage(item.content);
    const prev = index > 0 ? messages[index - 1] : null;

    const showDateSep =
      !prev ||
      new Date(item.sentAt).toDateString() !==
        new Date(prev.sentAt).toDateString();

    const prevSameSender =
      prev &&
      prev.senderId === item.senderId &&
      Math.abs(
        new Date(item.sentAt).getTime() - new Date(prev.sentAt).getTime(),
      ) <
        60 * 1000;

    const showTime =
      !messages[index + 1] ||
      messages[index + 1].senderId !== item.senderId ||
      Math.abs(
        new Date(messages[index + 1].sentAt).getTime() -
          new Date(item.sentAt).getTime(),
      ) >
        60 * 1000;

    // Inicijali za drugog korisnika (ako nema avatar)
    const userInitials = otherUserInfo
      ? getInitials(otherUserInfo.firstName, otherUserInfo.lastName)
      : (displayName?.[0]?.toUpperCase() ?? "?");

    return (
      <>
        {showDateSep && (
          <View style={styles.dateSep}>
            <View style={styles.dateSepLine} />
            <Text style={styles.dateSepText}>
              {formatDateSeparator(item.sentAt)}
            </Text>
            <View style={styles.dateSepLine} />
          </View>
        )}

        <View
          style={[
            styles.msgRow,
            isMine ? styles.msgRowRight : styles.msgRowLeft,
            prevSameSender && { marginTop: 2 },
          ]}
        >
          {!isMine && (
            <View style={[styles.msgAvatar, prevSameSender && styles.hidden]}>
              {otherUserInfo?.avatar ? (
                <Image
                  source={{ uri: otherUserInfo.avatar }}
                  style={styles.msgAvatarImage}
                />
              ) : (
                <Text style={styles.msgAvatarText}>{userInitials}</Text>
              )}
            </View>
          )}

          <View
            style={[
              isMine ? styles.outgoing : styles.incomingGroup,
              (videoPayload || imageUrl) && { maxWidth: "85%" },
            ]}
          >
            {videoPayload && <VideoBubble url={videoPayload.url} />}
            {!videoPayload && imageUrl && <ImageBubble url={imageUrl} />}
            {!videoPayload && !imageUrl && (
              <View
                style={[
                  styles.bubble,
                  isMine ? styles.bubbleMine : styles.bubbleOther,
                ]}
              >
                <Text
                  style={
                    isMine ? styles.bubbleTextMine : styles.bubbleTextOther
                  }
                >
                  {item.content}
                </Text>
              </View>
            )}

            {showTime && (
              <View
                style={[
                  styles.timeRow,
                  isMine ? styles.timeRowRight : styles.timeRowLeft,
                ]}
              >
                <Text style={styles.timeText}>{formatTime(item.sentAt)}</Text>
                {isMine && (
                  <Ionicons
                    name={item.isRead ? "checkmark-done" : "checkmark"}
                    size={12}
                    color={item.isRead ? "#667eea" : "#bbb"}
                    style={{ marginLeft: 3 }}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </>
    );
  };

  // Inicijali za header
  const headerInitials = otherUserInfo
    ? getInitials(otherUserInfo.firstName, otherUserInfo.lastName)
    : (displayName?.[0]?.toUpperCase() ?? "?");

  // ─── UI ──────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header s avatarom */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {otherUserInfo?.avatar ? (
            <Image
              source={{ uri: otherUserInfo.avatar }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{headerInitials}</Text>
            </View>
          )}

          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.headerStatus}>Aktivan korisnik</Text>
          </View>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {error && (
        <TouchableOpacity
          style={styles.errorBanner}
          onPress={() => setError(null)}
        >
          <Ionicons name="warning-outline" size={14} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          <Ionicons name="close" size={14} color="#ff3b30" />
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Učitavanje razgovora...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessage}
            contentContainerStyle={[
              styles.messagesList,
              messages.length === 0 && styles.emptyList,
            ]}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={56}
                  color="#e0e0e0"
                />
                <Text style={styles.emptyTitle}>Nema poruka</Text>
                <Text style={styles.emptySubtitle}>
                  Pošalji prvu poruku korisniku {displayName}!
                </Text>
              </View>
            }
          />
        )}

        <View style={styles.inputArea}>
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => pickMedia("gallery")}
            disabled={sendingMedia}
          >
            <Ionicons name="images-outline" size={24} color="#667eea" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => pickMedia("camera")}
            disabled={sendingMedia}
          >
            <Ionicons name="camera-outline" size={24} color="#667eea" />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={`Poruka za ${displayName}...`}
            placeholderTextColor="#aaa"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() && !mediaPreview) || sending
                ? styles.sendBtnDisabled
                : null,
            ]}
            onPress={inputText.trim() ? handleSend : () => pickMedia("gallery")}
            disabled={(!inputText.trim() && !mediaPreview) || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons
                name={inputText.trim() ? "send" : "attach"}
                size={18}
                color="white"
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Preview Modal */}
      <Modal
        visible={showMediaPreview}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowMediaPreview(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setShowMediaPreview(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Pregled</Text>
            <TouchableOpacity
              style={styles.previewSendBtn}
              onPress={sendMedia}
              disabled={sendingMedia}
            >
              {sendingMedia ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.previewSendBtnText}>Pošalji</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.previewContainer}>
            {mediaPreview?.type === "video" ? (
              <VideoView
                player={useVideoPlayer(mediaPreview.uri, (p) => {
                  p.loop = true;
                  p.play();
                })}
                style={styles.previewMedia}
                contentFit="contain"
                nativeControls
              />
            ) : (
              <Image
                source={{ uri: mediaPreview?.uri }}
                style={styles.previewMedia}
                resizeMode="contain"
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const BUBBLE_RADIUS = 18;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebeb",
    backgroundColor: "#fff",
  },
  backBtn: { padding: 8 },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarText: { color: "white", fontSize: 16, fontWeight: "700" },
  headerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    maxWidth: 180,
  },
  headerStatus: { fontSize: 12, color: "#aaa", marginTop: 1 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff5f5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ffe0e0",
  },
  errorText: { fontSize: 13, color: "#ff3b30", flex: 1 },
  messagesList: { padding: 12, paddingBottom: 8 },
  emptyList: { flex: 1, justifyContent: "center" },
  dateSep: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  dateSepLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e8e8e8",
  },
  dateSepText: { fontSize: 12, color: "#bbb", fontWeight: "500" },
  msgRow: { flexDirection: "row", marginVertical: 4, alignItems: "flex-end" },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  msgAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    flexShrink: 0,
    overflow: "hidden",
  },
  msgAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  msgAvatarText: { color: "white", fontSize: 12, fontWeight: "700" },
  hidden: { opacity: 0 },
  outgoing: { alignItems: "flex-end", maxWidth: "75%" },
  incomingGroup: { alignItems: "flex-start", maxWidth: "75%" },
  bubble: {
    borderRadius: BUBBLE_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: { backgroundColor: "#667eea", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#f2f2f7", borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: "white", fontSize: 15, lineHeight: 21 },
  bubbleTextOther: { color: "#1a1a1a", fontSize: 15, lineHeight: 21 },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  timeRowRight: { justifyContent: "flex-end" },
  timeRowLeft: { justifyContent: "flex-start" },
  timeText: { fontSize: 11, color: "#bbb" },
  emptyState: { alignItems: "center", paddingHorizontal: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#aaa" },
  emptySubtitle: {
    fontSize: 14,
    color: "#bbb",
    textAlign: "center",
    lineHeight: 20,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#aaa", fontSize: 14 },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ebebeb",
    backgroundColor: "#fff",
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: "#f2f2f7",
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1a1a1a",
    lineHeight: 20,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: { backgroundColor: "#d0d0d0", shadowOpacity: 0 },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
  },
  previewTitle: { fontSize: 17, fontWeight: "600", color: "#fff" },
  previewSendBtn: {
    backgroundColor: "#667eea",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  previewSendBtnText: { color: "#fff", fontWeight: "600" },
  previewContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  previewMedia: { width: "100%", height: "100%" },
  mediaBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0ff",
  },
});
