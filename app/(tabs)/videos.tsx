import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

interface VideoItem {
  id: string;
  uri: string;
  title: string;
  description: string;
  user: string;
  likes: number;
  comments: number;
  createdAt: string;
}

export default function VideosScreen() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const [newVideoDescription, setNewVideoDescription] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(
    null,
  );

  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: any }>({});

  // Load videos on mount
  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      // Učitaj videe iz AsyncStorage (ili s backend-a)
      const savedVideos = await AsyncStorage.getItem("videos");
      if (savedVideos) {
        setVideos(JSON.parse(savedVideos));
      } else {
        // Dummy videi za demo
        setVideos([
          {
            id: "1",
            uri: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            title: "Prekrasan zalazak sunca",
            description: "Divan pogled na more",
            user: "lana_vana",
            likes: 234,
            comments: 45,
            createdAt: new Date().toISOString(),
          },
          {
            id: "2",
            uri: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
            title: "Druženje s prijateljima",
            description: "Nezaboravni trenuci",
            user: "marko_88",
            likes: 567,
            comments: 89,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveVideos = async (newVideos: VideoItem[]) => {
    try {
      await AsyncStorage.setItem("videos", JSON.stringify(newVideos));
    } catch (error) {
      console.error("Error saving videos:", error);
    }
  };

  const pickVideo = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Dozvola", "Potrebna je dozvola za pristup galeriji");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideo(result.assets[0].uri);
        setModalVisible(true);
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Greška", "Nije moguće odabrati video");
    }
  };

  const recordVideo = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Dozvola", "Potrebna je dozvola za pristup kameri");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideo(result.assets[0].uri);
        setModalVisible(true);
      }
    } catch (error) {
      console.error("Error recording video:", error);
      Alert.alert("Greška", "Nije moguće snimiti video");
    }
  };

  const uploadVideo = async () => {
    if (!selectedVideo) return;
    if (!newVideoTitle.trim()) {
      Alert.alert("Greška", "Molimo unesite naziv videa");
      return;
    }

    setUploading(true);

    try {
      // Dohvati korisničko ime
      const firstName = await AsyncStorage.getItem("firstName");
      const lastName = await AsyncStorage.getItem("lastName");
      const userName = `${firstName || "Korisnik"} ${lastName || ""}`.trim();

      const newVideo: VideoItem = {
        id: Date.now().toString(),
        uri: selectedVideo,
        title: newVideoTitle,
        description: newVideoDescription,
        user: userName || "Anonymous",
        likes: 0,
        comments: 0,
        createdAt: new Date().toISOString(),
      };

      const updatedVideos = [newVideo, ...videos];
      setVideos(updatedVideos);
      await saveVideos(updatedVideos);

      // Reset forme
      setModalVisible(false);
      setSelectedVideo(null);
      setNewVideoTitle("");
      setNewVideoDescription("");

      Alert.alert("Uspjeh", "Video je uspješno dodan!");

      // Scrollaj na vrh da se vidi novi video
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (error) {
      console.error("Error uploading video:", error);
      Alert.alert("Greška", "Dodavanje videa nije uspjelo");
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (videoId: string) => {
    const updatedVideos = videos.map((video) =>
      video.id === videoId ? { ...video, likes: video.likes + 1 } : video,
    );
    setVideos(updatedVideos);
    await saveVideos(updatedVideos);
  };

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index;
        // Pause previous video
        if (currentPlayingIndex !== null && currentPlayingIndex !== newIndex) {
          const prevVideoId = videos[currentPlayingIndex]?.id;
          if (prevVideoId && videoRefs.current[prevVideoId]) {
            videoRefs.current[prevVideoId].pauseAsync();
          }
        }
        // Play new video
        const newVideoId = viewableItems[0].item.id;
        if (videoRefs.current[newVideoId]) {
          videoRefs.current[newVideoId].playAsync();
        }
        setCurrentPlayingIndex(newIndex);
      }
    },
    [currentPlayingIndex, videos],
  );

  const renderVideoItem = ({
    item,
    index,
  }: {
    item: VideoItem;
    index: number;
  }) => (
    <View style={styles.videoContainer}>
      <Video
        ref={(ref) => {
          if (ref) videoRefs.current[item.id] = ref;
        }}
        source={{ uri: item.uri }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={index === currentPlayingIndex}
        isLooping
        useNativeControls={false}
        onError={(error) => console.log("Video error:", error)}
      />

      {/* Video info overlay */}
      <View style={styles.videoInfo}>
        <View style={styles.userInfo}>
          <Ionicons name="person-circle" size={40} color="white" />
          <Text style={styles.userName}>{item.user}</Text>
        </View>

        <Text style={styles.videoTitle}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.videoDescription}>{item.description}</Text>
        ) : null}

        <View style={styles.stats}>
          <TouchableOpacity
            style={styles.statButton}
            onPress={() => handleLike(item.id)}
          >
            <Ionicons name="heart" size={24} color="white" />
            <Text style={styles.statText}>{item.likes}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statButton}>
            <Ionicons name="chatbubble" size={22} color="white" />
            <Text style={styles.statText}>{item.comments}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Add Video Button */}
      <TouchableOpacity style={styles.addButton} onPress={pickVideo}>
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* Video List */}
      <FlatList
        ref={flatListRef}
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={renderVideoItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
        }}
        snapToInterval={height}
        decelerationRate="fast"
      />

      {/* Add Video Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dodaj video</Text>

            <TextInput
              style={styles.input}
              placeholder="Naziv videa *"
              placeholderTextColor="#999"
              value={newVideoTitle}
              onChangeText={setNewVideoTitle}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Opis (opcionalno)"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              value={newVideoDescription}
              onChangeText={setNewVideoDescription}
            />

            {selectedVideo && (
              <View style={styles.videoPreview}>
                <Text style={styles.previewText}>Video odabran ✅</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedVideo(null);
                  setNewVideoTitle("");
                  setNewVideoDescription("");
                }}
              >
                <Text style={styles.cancelButtonText}>Otkaži</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.uploadButton]}
                onPress={uploadVideo}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.uploadButtonText}>Objavi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Video Options Menu */}
      <View style={styles.optionsMenu}>
        <TouchableOpacity style={styles.optionButton} onPress={pickVideo}>
          <Ionicons name="images" size={24} color="white" />
          <Text style={styles.optionText}>Galerija</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionButton} onPress={recordVideo}>
          <Ionicons name="camera" size={24} color="white" />
          <Text style={styles.optionText}>Snimi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  videoContainer: {
    width: width,
    height: height,
    position: "relative",
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoInfo: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  userName: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  videoTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  videoDescription: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginBottom: 12,
  },
  stats: {
    flexDirection: "row",
    gap: 20,
  },
  statButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    color: "white",
    fontSize: 14,
  },
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
    bottom: 100,
    right: 90,
    flexDirection: "row",
    gap: 12,
    zIndex: 10,
  },
  optionButton: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  optionText: {
    color: "white",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  videoPreview: {
    backgroundColor: "#e8f5e9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  previewText: {
    color: "#2e7d32",
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
  uploadButton: {
    backgroundColor: "#667eea",
  },
  uploadButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});
