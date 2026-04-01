// app/videos.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { API_BASE_URL } from "../config/api";

const { width, height } = Dimensions.get("window");

// ==================== TYPES ====================
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

      {/* RIGHT SIDEBAR */}
      <View style={styles.rightSidebar}>
        {/* LIKE */}
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

        {/* COMMENTS */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onOpenComments(item)}
        >
          <Ionicons name="chatbubble-outline" size={28} color="white" />
          <Text style={styles.actionText}>{item.commentCount || 0}</Text>
        </TouchableOpacity>

        {/* MESSENGER */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onOpenMessenger(item)}
        >
          <Ionicons name="paper-plane-outline" size={28} color="white" />
          <Text style={styles.actionText}>Poruka</Text>
        </TouchableOpacity>

        {/* SHARE */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onOpenShare(item)}
        >
          <Ionicons name="share-social-outline" size={28} color="white" />
          <Text style={styles.actionText}>Dijeli</Text>
        </TouchableOpacity>

        {/* DOWNLOAD */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onDownload(item)}
        >
          <Ionicons name="download-outline" size={28} color="white" />
          <Text style={styles.actionText}>Preuzmi</Text>
        </TouchableOpacity>

        {/* BOX / SAVE */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onSaveToggle(item.id)}
        >
          <Ionicons
            name={item.isSaved ? "bookmark" : "bookmark-outline"}
            size={28}
            color={item.isSaved ? "#667eea" : "white"}
          />
          <Text style={styles.actionText}>Box</Text>
        </TouchableOpacity>

        {/* WISHLIST */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onWishlistToggle(item.id)}
        >
          <Ionicons
            name={item.isInWishlist ? "star" : "star-outline"}
            size={28}
            color={item.isInWishlist ? "#FFD700" : "white"}
          />
          <Text style={styles.actionText}>Wishlist</Text>
        </TouchableOpacity>
      </View>

      {/* BOTTOM INFO */}
      <View style={styles.bottomInfo}>
        <View style={styles.userInfo}>
          <Ionicons name="person-circle" size={40} color="white" />
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
    const token = await AsyncStorage.getItem("token");
    if (!video) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/comment/video/${video.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setComments(await res.json());
    } catch (e) {
      console.error(e);
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="black" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Komentari ({video.commentCount || 0})
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1, paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
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
              <Text style={styles.emptyText}>
                Nema komentara. Budi prvi! 💬
              </Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Ionicons name="person-circle" size={36} color="#666" />
                  <View style={styles.commentContent}>
                    <Text style={styles.commentUser}>
                      {c.userName || `User_${c.userId}`}
                    </Text>
                    <Text style={styles.commentText}>{c.content}</Text>
                    <Text style={styles.commentDate}>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Dodaj komentar..."
              placeholderTextColor="#999"
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
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
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
          "Poslano!",
          `Poruka je poslana korisniku ${video.userName || "User_" + video.userId}`,
        );
        onClose();
      } else {
        Alert.alert("Greška", "Poruka nije poslana");
      }
    } catch (e) {
      Alert.alert("Greška", "Poruka nije poslana");
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
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="black" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Poruka → {video.userName || `User_${video.userId}`}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={{ flex: 1, padding: 16 }}>
            <View style={styles.recipientCard}>
              <Ionicons name="person-circle" size={44} color="#667eea" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.recipientName}>
                  {video.userName || `User_${video.userId}`}
                </Text>
                <Text style={styles.recipientSub}>
                  Objavio video: {video.title}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Napiši poruku..."
              placeholderTextColor="#999"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              autoFocus
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!message.trim() || sending) && styles.sendBtnDisabled,
              ]}
              onPress={sendMessage}
              disabled={!message.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
      const data = await res.json();
      setUsers(data);
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
      // ── NOVO: strukturirani format umjesto slobodnog teksta ──
      const VIDEO_PREFIX = "__CROMAP_VIDEO__";
      const videoContent = `${VIDEO_PREFIX}${JSON.stringify({
        id: video.id,
        title: video.title,
        url: video.filePath,
      })}`;

      const res = await fetch(`${API_BASE_URL}/api/message/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId,
          content: videoContent, // <── jedina promjena
        }),
      });
      if (res.ok) {
        Alert.alert(
          "Podijeljeno!",
          `Video je podijeljen s korisnikom ${userName}`,
        );
        onClose();
      }
    } catch (e) {
      Alert.alert("Greška", "Dijeljenje nije uspjelo");
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
          <Text style={styles.modalTitle}>Podijeli video</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TextInput
            style={styles.searchInput}
            placeholder="Pretraži korisnike..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#667eea"
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
                <Ionicons name="person-circle" size={44} color="#667eea" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.recipientName}>{u.username}</Text>
                  <Text style={styles.recipientSub}>
                    {u.firstName} {u.lastName}
                  </Text>
                </View>
                {sending === u.id ? (
                  <ActivityIndicator size="small" color="#667eea" />
                ) : (
                  <Ionicons
                    name="paper-plane-outline"
                    size={22}
                    color="#667eea"
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
        "Dozvola potrebna",
        "Dozvolite pristup galeriji u postavkama",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"], // i slike i videji
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
      Alert.alert("Dozvola potrebna", "Dozvolite pristup kameri u postavkama");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
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
      Alert.alert("Greška", "Naslov je obavezan");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Greška", "Lokacija je obavezna");
      return;
    }
    if (!userId || userId === "0") {
      Alert.alert(
        "Greška",
        "Niste prijavljeni. Odjavite se i prijavite ponovo.",
      );
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("media", {
        uri: mediaUri,
        type: mediaType === "video" ? "video/mp4" : "image/jpeg",
        name: mediaType === "video" ? "media.mp4" : "media.jpg",
      } as any);
      formData.append("mediaType", mediaType);
      formData.append("title", title.trim());
      formData.append("location", location.trim());
      formData.append("description", description.trim());
      formData.append("userId", userId);

      // Endpoint: api/video/upload (backend treba podržati i slike)
      const res = await fetch(`${API_BASE_URL}/api/video/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        Alert.alert(
          "Uspjeh!",
          `${mediaType === "video" ? "Video" : "Slika"} je objavljena`,
        );
        resetModal();
        onUploaded();
      } else {
        const err = await res.text();
        Alert.alert("Greška", err || "Upload nije uspio");
      }
    } catch {
      Alert.alert("Greška", "Upload nije uspio. Provjeri konekciju.");
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
          {/* Header */}
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

                {/* Galerija */}
                <TouchableOpacity
                  style={styles.pickBtn}
                  onPress={pickFromGallery}
                >
                  <Ionicons name="images" size={40} color="#667eea" />
                  <Text style={styles.pickBtnText}>Iz galerije</Text>
                  <Text style={styles.pickBtnSub}>Slike i videji</Text>
                </TouchableOpacity>

                {/* Kamera */}
                <TouchableOpacity style={styles.pickBtn} onPress={recordMedia}>
                  <Ionicons name="camera" size={40} color="#667eea" />
                  <Text style={styles.pickBtnText}>Kamera / Snimanje</Text>
                  <Text style={styles.pickBtnSub}>Snimite sliku ili video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Preview */}
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
                      nativeControls
                    />
                  )}
                  {/* Media type badge */}
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

                {/* Form */}
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

                {/* Buttons */}
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
                        backgroundColor: uploading ? "#a0aec0" : "#667eea",
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
      if (res.ok) {
        const data: VideoItem[] = await res.json();
        setVideos(data);
      }
    } catch (e) {
      Alert.alert("Greška", "Neuspješno učitavanje videa");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  // ── LIKE (optimistički) ──
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

  // ── BOX / SAVE (optimistički) ──
  const handleSaveToggle = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v)),
    );
    try {
      const res = await fetch(`${API_BASE_URL}/api/savedvideo/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v)),
      );
    }
  };

  // ── WISHLIST (optimistički) ──
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
        const res = await fetch(`${API_BASE_URL}/api/wishlist/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ videoId, notes: "" }),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch(
          `${API_BASE_URL}/api/wishlist/remove/${videoId}`,
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
    }
  };

  // ── DOWNLOAD ──
  const handleDownload = async (video: VideoItem) => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Dozvola potrebna",
        "Dozvolite pristup medijima u postavkama",
      );
      return;
    }
    Alert.alert("Preuzimanje", "Video se preuzima...");
    try {
      const fileName = `cromap_${video.id}_${Date.now()}.mp4`;
      const downloadDest = FileSystem.documentDirectory + fileName;
      const result = await FileSystem.downloadAsync(
        video.filePath,
        downloadDest,
      );
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Alert.alert("Uspjeh!", "Video je spremljen u galeriju");
    } catch (e) {
      Alert.alert("Greška", "Preuzimanje nije uspjelo");
    }
  };

  // ── DELETE ──
  const handleDeleteVideo = async (videoId: number) => {
    Alert.alert("Obriši video", "Jeste li sigurni?", [
      { text: "Otkaži", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: async () => {
          const token = await AsyncStorage.getItem("token");
          try {
            const res = await fetch(`${API_BASE_URL}/api/video/${videoId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setVideos((prev) => prev.filter((v) => v.id !== videoId));
            }
          } catch (e) {
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
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );

  return (
    <View style={styles.container}>
      {/* ADD BUTTON */}
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

// ==================== STYLES ====================
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

  // SIDEBAR
  rightSidebar: {
    position: "absolute",
    bottom: 100,
    right: 12,
    alignItems: "center",
    gap: 16,
  },
  actionButton: { alignItems: "center", gap: 2 },
  actionText: { color: "white", fontSize: 11, fontWeight: "500" },

  // BOTTOM INFO
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

  // ADD BUTTON
  addButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    right: 16,
    backgroundColor: "#667eea",
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    elevation: 5,
  },

  // MODALS
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: { fontSize: 17, fontWeight: "600", color: "#333" },

  // COMMENTS
  commentItem: { flexDirection: "row", marginVertical: 10, gap: 10 },
  commentContent: { flex: 1 },
  commentUser: {
    fontWeight: "600",
    fontSize: 14,
    color: "#333",
    marginBottom: 2,
  },
  commentText: { fontSize: 14, color: "#555", marginBottom: 2 },
  commentDate: { fontSize: 11, color: "#999" },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    fontSize: 15,
  },

  // INPUT ROW (comments + messenger)
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
    backgroundColor: "#667eea",
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#ccc" },

  // MESSENGER
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

  // SHARE
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

  // UPLOAD
  pickContainer: { alignItems: "center", gap: 20, paddingTop: 40 },
  pickHint: { fontSize: 18, color: "#666", marginBottom: 8 },
  pickBtn: {
    width: "80%",
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#667eea",
    borderStyle: "dashed",
    gap: 8,
  },
  pickBtnText: { fontSize: 16, color: "#667eea", fontWeight: "600" },

  previewVideo: { width: "100%", height: 220, borderRadius: 12 },
  changeVideoBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#667eea",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  uploadBtnDisabled: { backgroundColor: "#a0aec0" },
  uploadBtnText: { color: "white", fontSize: 16, fontWeight: "600" },

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
  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
