// app/admin/dashboard.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../config/api";

const { width } = Dimensions.get("window");

interface User {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalSessionMinutes: number;
}

interface UserActivity {
  date: string;
  sessionMinutes: number;
  likes: number;
  comments: number;
  posts: number;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    checkAdminAuth();
    loadUsers();
    loadSummary();
  }, []);

  const checkAdminAuth = async () => {
    const token = await AsyncStorage.getItem("adminToken");
    if (!token) {
      router.replace("/admin/login");
    }
  };

  const loadUsers = async () => {
    try {
      const token = await AsyncStorage.getItem("adminToken");
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else if (response.status === 401) {
        router.replace("/admin/login");
      }
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const token = await AsyncStorage.getItem("adminToken");
      const response = await fetch(`${API_BASE_URL}/api/admin/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error("Error loading summary:", error);
    }
  };

  const loadUserActivity = async (userId: number) => {
    try {
      const token = await AsyncStorage.getItem("adminToken");
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${userId}/daily-activity?days=30`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setUserActivity(data);
      }
    } catch (error) {
      console.error("Error loading user activity:", error);
    }
  };

  const handleUserPress = async (user: User) => {
    setSelectedUser(user);
    await loadUserActivity(user.id);
    setShowUserModal(true);
  };

  const handleLogout = async () => {
    Alert.alert("Odjava", "Jeste li sigurni?", [
      { text: "Odustani", style: "cancel" },
      {
        text: "Odjavi se",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("adminToken");
          await AsyncStorage.removeItem("adminEmail");
          router.replace("/admin/login");
        },
      },
    ]);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSubtitle}>
            Upravljanje korisnicima i aktivnostima
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="#ff4757" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      {summary && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.summaryScroll}
          contentContainerStyle={styles.summaryContainer}
        >
          <View style={styles.summaryCard}>
            <Ionicons name="people" size={24} color="#667eea" />
            <Text style={styles.summaryNumber}>{summary.totalUsers}</Text>
            <Text style={styles.summaryLabel}>Ukupno korisnika</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="heart" size={24} color="#ff3b30" />
            <Text style={styles.summaryNumber}>{summary.totalLikes}</Text>
            <Text style={styles.summaryLabel}>Ukupno lajkova</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="chatbubble" size={24} color="#34c759" />
            <Text style={styles.summaryNumber}>{summary.totalComments}</Text>
            <Text style={styles.summaryLabel}>Ukupno komentara</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="time" size={24} color="#ff9500" />
            <Text style={styles.summaryNumber}>
              {Math.floor(summary.totalMinutes / 60)}h
            </Text>
            <Text style={styles.summaryLabel}>Ukupno vremena</Text>
          </View>
        </ScrollView>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Pretraži korisnike..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => handleUserPress(item)}
          >
            <View style={styles.userAvatar}>
              <Text style={styles.userInitials}>
                {item.firstName[0]}
                {item.lastName[0]}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {item.firstName} {item.lastName}
              </Text>
              <Text style={styles.userEmail}>{item.email}</Text>
              <View style={styles.userStats}>
                <View style={styles.userStat}>
                  <Ionicons name="images" size={12} color="#999" />
                  <Text style={styles.userStatText}>{item.totalPosts}</Text>
                </View>
                <View style={styles.userStat}>
                  <Ionicons name="heart" size={12} color="#ff3b30" />
                  <Text style={styles.userStatText}>{item.totalLikes}</Text>
                </View>
                <View style={styles.userStat}>
                  <Ionicons name="chatbubble" size={12} color="#34c759" />
                  <Text style={styles.userStatText}>{item.totalComments}</Text>
                </View>
                <View style={styles.userStat}>
                  <Ionicons name="time" size={12} color="#ff9500" />
                  <Text style={styles.userStatText}>
                    {Math.floor(item.totalSessionMinutes / 60)}h
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
      />

      {/* User Details Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowUserModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowUserModal(false)}>
              <Ionicons name="arrow-back" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedUser?.firstName} {selectedUser?.lastName}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* User Info */}
            <View style={styles.userDetailCard}>
              <View style={styles.userDetailAvatar}>
                <Text style={styles.userDetailInitials}>
                  {selectedUser?.firstName[0]}
                  {selectedUser?.lastName[0]}
                </Text>
              </View>
              <Text style={styles.userDetailName}>
                {selectedUser?.firstName} {selectedUser?.lastName}
              </Text>
              <Text style={styles.userDetailUsername}>
                @{selectedUser?.username}
              </Text>
              <Text style={styles.userDetailEmail}>{selectedUser?.email}</Text>
              <Text style={styles.userDetailDate}>
                Registriran:{" "}
                {new Date(selectedUser?.createdAt || "").toLocaleDateString(
                  "hr-HR",
                )}
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="people" size={24} color="#667eea" />
                <Text style={styles.statNumber}>
                  {selectedUser?.followersCount}
                </Text>
                <Text style={styles.statLabel}>Pratitelji</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="person-add" size={24} color="#667eea" />
                <Text style={styles.statNumber}>
                  {selectedUser?.followingCount}
                </Text>
                <Text style={styles.statLabel}>Praćeni</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="images" size={24} color="#34c759" />
                <Text style={styles.statNumber}>
                  {selectedUser?.totalPosts}
                </Text>
                <Text style={styles.statLabel}>Objave</Text>
              </View>
            </View>

            {/* Activity Chart */}
            <View style={styles.activitySection}>
              <Text style={styles.activityTitle}>
                Aktivnost (zadnjih 30 dana)
              </Text>
              {userActivity.length === 0 ? (
                <Text style={styles.noActivityText}>
                  Nema aktivnosti za prikaz
                </Text>
              ) : (
                <View>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartLabel}>Minute</Text>
                    <Text style={styles.chartLabel}>Lajkovi</Text>
                    <Text style={styles.chartLabel}>Komentari</Text>
                  </View>
                  {userActivity.slice(0, 7).map((activity, index) => (
                    <View key={index} style={styles.activityRow}>
                      <Text style={styles.activityDate}>
                        {new Date(activity.date).toLocaleDateString("hr-HR")}
                      </Text>
                      <View style={styles.activityBars}>
                        <View
                          style={[
                            styles.activityBar,
                            {
                              width: Math.min(
                                (activity.sessionMinutes / 120) * 60,
                                60,
                              ),
                              backgroundColor: "#ff9500",
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.activityBar,
                            {
                              width: Math.min((activity.likes / 50) * 60, 60),
                              backgroundColor: "#ff3b30",
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.activityBar,
                            {
                              width: Math.min(
                                (activity.comments / 20) * 60,
                                60,
                              ),
                              backgroundColor: "#667eea",
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
  },
  summaryScroll: {
    backgroundColor: "#fff",
    paddingVertical: 16,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    minWidth: 120,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userInitials: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  userEmail: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  userStats: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  userStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userStatText: {
    fontSize: 11,
    color: "#666",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
  },
  userDetailCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  userDetailAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  userDetailInitials: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "600",
  },
  userDetailName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  userDetailUsername: {
    fontSize: 14,
    color: "#667eea",
    marginTop: 4,
  },
  userDetailEmail: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  userDetailDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },
  activitySection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  noActivityText: {
    textAlign: "center",
    color: "#999",
    paddingVertical: 20,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 60,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 10,
    color: "#999",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  activityDate: {
    width: 80,
    fontSize: 11,
    color: "#666",
  },
  activityBars: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  activityBar: {
    height: 20,
    borderRadius: 4,
  },
});
