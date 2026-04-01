// app/chat/[userId].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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
  getCurrentUserId,
  getConversationMessages,
  markAsRead,
  sendMessage,
} from "../../utils/messagesApi";

// ─── Video Share Format ────────────────────────────────────────────────────────
// Poruke koje sadrže video imaju prefiks: __CROMAP_VIDEO__{"id":...,"title":...,"url":...}

export const VIDEO_PREFIX = "__CROMAP_VIDEO__";

export interface VideoSharePayload {
  id: number;
  title: string;
  url: string;
}

export function parseVideoMessage(content: string): VideoSharePayload | null {
  if (!content.startsWith(VIDEO_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(VIDEO_PREFIX.length));
  } catch {
    return null;
  }
}

export function buildVideoShareContent(payload: VideoSharePayload): string {
  return `${VIDEO_PREFIX}${JSON.stringify(payload)}`;
}

// ─── Video Bubble Component ────────────────────────────────────────────────────

function VideoBubble({
  payload,
  isMine,
}: {
  payload: VideoSharePayload;
  isMine: boolean;
}) {
  const [playing, setPlaying] = useState(false);

  const player = useVideoPlayer(payload.url, (p) => {
    p.loop = false;
    p.muted = false;
  });

  const togglePlay = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player]);

  return (
    <View
      style={[
        styles.videoBubble,
        isMine ? styles.videoBubbleMine : styles.videoBubbleOther,
      ]}
    >
      {/* Video player area */}
      <View style={styles.videoPlayerWrapper}>
        <VideoView
          player={player}
          style={styles.inlineVideo}
          contentFit="cover"
          nativeControls={false}
        />

        {/* Play/Pause overlay */}
        <TouchableOpacity
          style={styles.playOverlay}
          onPress={togglePlay}
          activeOpacity={0.85}
        >
          <View style={styles.playBtn}>
            <Ionicons
              name={playing ? "pause" : "play"}
              size={26}
              color="white"
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* Naslov videa */}
      <View style={styles.videoInfo}>
        <Ionicons
          name="videocam"
          size={13}
          color={isMine ? "rgba(255,255,255,0.8)" : "#667eea"}
          style={{ marginRight: 5 }}
        />
        <Text
          style={[
            styles.videoTitle,
            isMine ? styles.videoTitleMine : styles.videoTitleOther,
          ]}
          numberOfLines={2}
        >
          {payload.title}
        </Text>
      </View>
    </View>
  );
}

// ─── Chat Screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { userId, name } = useLocalSearchParams<{
    userId: string;
    name: string;
  }>();

  const otherUserId = parseInt(userId ?? "0", 10);
  const displayName = name ?? `User_${userId}`;

  const [messages, setMessages] = useState<Message[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // ─── Dohvat poruka ───────────────────────────────────────────────────────────

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!silent) setError(null);
      try {
        const msgs = await getConversationMessages(otherUserId);
        msgs.sort(
          (a, b) =>
            new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
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
    [otherUserId, myId]
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
        100
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

  const renderMessage = ({
    item,
    index,
  }: {
    item: Message;
    index: number;
  }) => {
    const isMine = item.senderId === myId;
    const prev = index > 0 ? messages[index - 1] : null;
    const videoPayload = parseVideoMessage(item.content);

    const showDateSep =
      !prev ||
      new Date(item.sentAt).toDateString() !==
        new Date(prev.sentAt).toDateString();

    const prevSameSender =
      prev &&
      prev.senderId === item.senderId &&
      Math.abs(
        new Date(item.sentAt).getTime() - new Date(prev.sentAt).getTime()
      ) <
        60 * 1000;

    const showTime =
      !messages[index + 1] ||
      messages[index + 1].senderId !== item.senderId ||
      Math.abs(
        new Date(messages[index + 1].sentAt).getTime() -
          new Date(item.sentAt).getTime()
      ) >
        60 * 1000;

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
          {/* Avatar sugovornika - samo za primljene */}
          {!isMine && (
            <View style={[styles.msgAvatar, prevSameSender && styles.hidden]}>
              <Text style={styles.msgAvatarText}>
                {displayName?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}

          <View
            style={[
              isMine ? styles.outgoing : styles.incomingGroup,
              videoPayload && { maxWidth: "85%" },
            ]}
          >
            {/* ── VIDEO PORUKA ── */}
            {videoPayload ? (
              <VideoBubble payload={videoPayload} isMine={isMine} />
            ) : (
              /* ── TEKST PORUKA ── */
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

            {/* Vrijeme + kvačica */}
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

  // ─── UI ──────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {displayName?.[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
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
              (!inputText.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={18} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  },
  msgAvatarText: { color: "white", fontSize: 12, fontWeight: "700" },
  hidden: { opacity: 0 },

  outgoing: { alignItems: "flex-end", maxWidth: "75%" },
  incomingGroup: { alignItems: "flex-start", maxWidth: "75%" },

  // Text bubble
  bubble: { borderRadius: BUBBLE_RADIUS, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: "#667eea", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#f2f2f7", borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: "white", fontSize: 15, lineHeight: 21 },
  bubbleTextOther: { color: "#1a1a1a", fontSize: 15, lineHeight: 21 },

  // Video bubble
  videoBubble: { borderRadius: 16, overflow: "hidden", width: 240 },
  videoBubbleMine: { backgroundColor: "#667eea", borderBottomRightRadius: 4 },
  videoBubbleOther: { backgroundColor: "#f2f2f7", borderBottomLeftRadius: 4 },
  videoPlayerWrapper: { width: "100%", height: 160, backgroundColor: "#000" },
  inlineVideo: { width: "100%", height: "100%" },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  videoInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  videoTitle: { fontSize: 13, fontWeight: "600", flex: 1 },
  videoTitleMine: { color: "rgba(255,255,255,0.92)" },
  videoTitleOther: { color: "#333" },

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
});
