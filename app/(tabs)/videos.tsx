// app/videos.tsx (server-side auth verzija)
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE_URL } from "../config/api";

const { width, height } = Dimensions.get("window");

// ==================== TYPES ====================
interface VideoItem {
  id: number;
  title: string;
  description: string;
  filePath: string;
  userId: number;
  createdAt: string;
  userName?: string;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isOwner?: boolean;
}

// ==================== SINGLE VIDEO COMPONENT ====================
function VideoItemComponent({
  item,
  isActive,
  onLikeToggle,
  onSaveToggle,
  onDeleteVideo,
  onOpenComments,
}: {
  item: VideoItem;
  isActive: boolean;
  onLikeToggle: (videoId: number) => void;
  onSaveToggle: (videoId: number) => void;
  onDeleteVideo: (videoId: number) => void;
  onOpenComments: (video: VideoItem) => void;
}) {
  const player = useVideoPlayer(item.filePath, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);

  return (
    <View style={styles.videoContainer}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />

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
          onPress={() => onSaveToggle(item.id)}
        >
          <Ionicons
            name={item.isSaved ? "bookmark" : "bookmark-outline"}
            size={28}
            color="white"
          />
        </TouchableOpacity>

        {item.isOwner && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onDeleteVideo(item.id)}
          >
            <Ionicons name="trash-outline" size={28} color="#ff3b30" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bottomInfo}>
        <View style={styles.userInfo}>
          <Ionicons name="person-circle" size={40} color="white" />
          <Text style={styles.userName}>
            {item.userName || `User_${item.userId}`}
          </Text>
        </View>
        <Text style={styles.videoTitle}>{item.title}</Text>
        {item.description && (
          <Text style={styles.videoDescription}>{item.description}</Text>
        )}
      </View>
    </View>
  );
}

// ==================== COMMENTS MODAL ====================
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
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const loadComments = async () => {
    const authToken = await AsyncStorage.getItem("token");
    if (!video) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/comment/video/${video.id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error("Greška pri učitavanju komentara:", error);
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    const authToken = await AsyncStorage.getItem("token");
    if (!video || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content: newComment.trim(), videoId: video.id }),
      });
      if (response.ok) {
        setNewComment("");
        await loadComments();
        onCommentAdded();
      } else {
        Alert.alert("Greška", "Neuspješno dodavanje komentara");
      }
    } catch (error) {
      console.error("Greška:", error);
      Alert.alert("Greška", "Neuspješno dodavanje komentara");
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.commentsHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="black" />
            </TouchableOpacity>
            <Text style={styles.commentsTitle}>
              Komentari ({video.commentCount || 0})
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
            ref={scrollViewRef}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            {loading ? (
              <ActivityIndicator
                size="large"
                color="#667eea"
                style={{ marginTop: 40 }}
              />
            ) : comments.length === 0 ? (
              <Text style={styles.noComments}>
                Nema komentara. Budi prvi! 💬
              </Text>
            ) : (
              comments.map((item) => (
                <View key={item.id} style={styles.commentItem}>
                  <Ionicons name="person-circle" size={36} color="#666" />
                  <View style={styles.commentContent}>
                    <Text style={styles.commentUser}>
                      {item.userName || `User_${item.userId}`}
                    </Text>
                    <Text style={styles.commentText}>{item.content}</Text>
                    <Text style={styles.commentDate}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Dodaj komentar..."
              placeholderTextColor="#999"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newComment.trim() || submitting) && styles.sendButtonDisabled,
              ]}
              onPress={addComment}
              disabled={!newComment.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={22} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ==================== MAIN SCREEN ====================
export default function VideosScreen() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(
    null,
  );
  const [selectedVideoForComments, setSelectedVideoForComments] =
    useState<VideoItem | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadVideos = async () => {
    const authToken = await AsyncStorage.getItem("token");
    console.log("Token exists:", !!authToken); // ← DODAJ OVO
    console.log("Token value:", authToken); // ← DODAJ OVO

    if (!authToken) {
      console.error("No token found!");
      Alert.alert("Greška", "Niste prijavljeni. Molimo prijavite se.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/video`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status); // ← DODAJ OVO

      if (!response.ok) {
        const errText = await response.text();
        console.error("API greška:", response.status, errText);

        if (response.status === 401) {
          Alert.alert(
            "Greška",
            "Vaša sesija je istekla. Molimo prijavite se ponovno.",
          );
          // Opcionalno: navigiraj na login screen
        } else {
          Alert.alert("Greška", `Server greška: ${response.status}`);
        }
        return;
      }

      const allVideos: VideoItem[] = await response.json();
      setVideos(allVideos);
    } catch (error) {
      console.error("Greška pri učitavanju videa:", error);
      Alert.alert("Greška", "Neuspješno učitavanje videa");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  // Zamijeni handleLikeToggle u VideosScreen
  const handleLikeToggle = async (videoId: number) => {
    const authToken = await AsyncStorage.getItem("token");

    // ✅ Optimistički update — odmah mijenjamo UI
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
      const response = await fetch(`${API_BASE_URL}/api/like/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        // ❌ Ako API ne uspije — vrati nazad
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
    } catch (error) {
      console.error("Greška pri like/unlike:", error);
      // ❌ Revert i na network grešci
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

  // Zamijeni handleSaveToggle isto — isti pattern
  const handleSaveToggle = async (videoId: number) => {
    const authToken = await AsyncStorage.getItem("token");

    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v)),
    );

    try {
      const response = await fetch(`${API_BASE_URL}/api/savedvideo/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, isSaved: !v.isSaved } : v,
          ),
        );
      }
    } catch (error) {
      console.error("Greška pri save/unsave:", error);
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v)),
      );
    }
  };

  const handleDeleteVideo = async (videoId: number) => {
    Alert.alert(
      "Obriši video",
      "Jeste li sigurni da želite obrisati ovaj video?",
      [
        { text: "Otkaži", style: "cancel" },
        {
          text: "Obriši",
          style: "destructive",
          onPress: async () => {
            const authToken = await AsyncStorage.getItem("token");
            try {
              const response = await fetch(
                `${API_BASE_URL}/api/video/${videoId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${authToken}` },
                },
              );
              if (response.ok) {
                setVideos((prev) => prev.filter((v) => v.id !== videoId));
                Alert.alert("Uspjeh", "Video je obrisan");
              } else {
                Alert.alert("Greška", "Ne možete obrisati tuđi video");
              }
            } catch (error) {
              console.error("Greška:", error);
              Alert.alert("Greška", "Brisanje nije uspjelo");
            }
          },
        },
      ],
    );
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0)
      setCurrentPlayingIndex(viewableItems[0].index);
  }, []);

  if (loading)
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowOptionsMenu(!showOptionsMenu)}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {showOptionsMenu && (
        <View style={styles.optionsMenu}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={async () => {}}
          >
            <Ionicons name="images" size={22} color="white" />
            <Text style={styles.optionText}>Galerija</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={async () => {}}
          >
            <Ionicons name="camera" size={22} color="white" />
            <Text style={styles.optionText}>Snimi</Text>
          </TouchableOpacity>
        </View>
      )}

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
            onDeleteVideo={handleDeleteVideo}
            onOpenComments={setSelectedVideoForComments}
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
    </View>
  );
}

// ===== STYLES (ostaju isti kao u originalnom kodu) =====
const styles = StyleSheet.create({
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
    bottom: 120,
    right: 16,
    alignItems: "center",
    gap: 24,
  },
  actionButton: { alignItems: "center", gap: 4 },
  actionText: { color: "white", fontSize: 12, fontWeight: "500" },
  bottomInfo: { position: "absolute", bottom: 100, left: 16, right: 80 },
  userInfo: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  userName: { color: "white", fontSize: 15, fontWeight: "600", marginLeft: 10 },
  videoTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  videoDescription: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  addButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    backgroundColor: "#667eea",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  optionsMenu: {
    position: "absolute",
    bottom: 170,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 12,
    padding: 8,
    gap: 8,
    zIndex: 10,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  optionText: { color: "white", fontSize: 14 },
  commentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    backgroundColor: "white",
  },
  commentsTitle: { fontSize: 18, fontWeight: "600", color: "#333" },
  commentItem: { flexDirection: "row", marginBottom: 20, gap: 12 },
  commentContent: { flex: 1 },
  commentUser: {
    fontWeight: "600",
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  commentText: { fontSize: 14, color: "#555", marginBottom: 4 },
  commentDate: { fontSize: 11, color: "#999" },
  noComments: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    fontSize: 16,
  },
  commentInputContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "white",
    alignItems: "flex-end",
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: "#667eea",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  sendButtonDisabled: { backgroundColor: "#ccc" },
});
