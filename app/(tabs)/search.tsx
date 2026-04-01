// app/(tabs)/search.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
  followersCount?: number;
  isFollowing?: boolean;
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<number, boolean>>({});
  const [loadingFollow, setLoadingFollow] = useState<Record<number, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (silent = false) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const storedId = await AsyncStorage.getItem("userId");
      if (storedId) setCurrentUserId(parseInt(storedId));

      // Dohvati sve korisnike
      const res = await fetch(API_ENDPOINTS.USERS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: User[] = await res.json();
        const withId = parseInt(storedId || "0");
        const filtered = data.filter((u) => u.id !== withId);
        setUsers(filtered);
        setFiltered(filtered);
      }

      // Dohvati korisnike koje pratiš
      try {
        const followRes = await fetch(`${API_BASE_URL}/api/follow/my-following`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (followRes.ok) {
          const following = await followRes.json();
          const map: Record<number, boolean> = {};
          following.forEach((u: any) => {
            map[u.followedId ?? u.id] = true;
          });
          setFollowingMap(map);
        }
      } catch {
        // Endpoint možda ne postoji – preskočimo
      }
    } catch (e) {
      if (!silent) Alert.alert("Greška", "Nije moguće učitati korisnike");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtriranje u realnom vremenu
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (!query.trim()) {
        setFiltered(users);
        return;
      }
      const q = query.toLowerCase();
      setFiltered(
        users.filter(
          (u) =>
            u.username?.toLowerCase().includes(q) ||
            u.firstName?.toLowerCase().includes(q) ||
            u.lastName?.toLowerCase().includes(q)
        )
      );
    }, 200);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query, users]);

  const handleFollow = async (userId: number) => {
    const token = await AsyncStorage.getItem("token");
    const isFollowing = followingMap[userId];
    setLoadingFollow((p) => ({ ...p, [userId]: true }));
    // Optimistički update
    setFollowingMap((p) => ({ ...p, [userId]: !isFollowing }));

    try {
      const url = isFollowing
        ? `${API_BASE_URL}/api/follow/unfollow/${userId}`
        : `${API_BASE_URL}/api/follow/follow/${userId}`;
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
    } catch {
      // Vrati na staro pri grešci
      setFollowingMap((p) => ({ ...p, [userId]: isFollowing }));
      Alert.alert("Greška", "Nije moguće pratiti korisnika. Provjerite server.");
    } finally {
      setLoadingFollow((p) => ({ ...p, [userId]: false }));
    }
  };

  const handleMessage = (user: User) => {
    router.push({
      pathname: "/chat/[userId]",
      params: {
        userId: user.id.toString(),
        name: `${user.firstName} ${user.lastName}`,
      },
    });
  };

  const handleViewProfile = (user: User) => {
    router.push({
      pathname: "/profile/[userId]",
      params: { userId: user.id.toString() },
    } as any);
  };

  const renderUser = ({ item }: { item: User }) => {
    const initials =
      `${item.firstName?.[0] || ""}${item.lastName?.[0] || ""}`.toUpperCase();
    const isFollowing = followingMap[item.id] || false;
    const isLoadingThis = loadingFollow[item.id] || false;

    return (
      <View style={styles.userCard}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => handleViewProfile(item)}
        >
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => handleViewProfile(item)}
        >
          <Text style={styles.userName}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.userUsername}>@{item.username}</Text>
          {item.followersCount !== undefined && (
            <Text style={styles.followersCount}>
              {item.followersCount} pratitelja
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={() => handleFollow(item.id)}
            disabled={isLoadingThis}
          >
            {isLoadingThis ? (
              <ActivityIndicator size="small" color={isFollowing ? "#667eea" : "#fff"} />
            ) : (
              <Text
                style={[
                  styles.followBtnText,
                  isFollowing && styles.followingBtnText,
                ]}
              >
                {isFollowing ? "Praćenje" : "Prati"}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.msgBtn}
            onPress={() => handleMessage(item)}
          >
            <Ionicons name="paper-plane-outline" size={18} color="#667eea" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pretraga</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={18}
            color="#999"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Pretraži korisnike..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>

        {/* Results count */}
        {!loading && query.length > 0 && (
          <Text style={styles.resultsInfo}>
            {filtered.length} {filtered.length === 1 ? "korisnik" : "korisnika"}
          </Text>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Učitavanje korisnika...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderUser}
            contentContainerStyle={
              filtered.length === 0
                ? styles.emptyList
                : styles.listContent
            }
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData(true);
                }}
                tintColor="#667eea"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color="#d0d0d0" />
                <Text style={styles.emptyTitle}>
                  {query ? "Nema rezultata" : "Nema korisnika"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {query
                    ? `Nema korisnika koji odgovaraju "${query}"`
                    : "Biti ćete prvi!"}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#1a1a1a" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  resultsInfo: {
    fontSize: 13,
    color: "#999",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyList: { flex: 1 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarPlaceholder: {
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", marginBottom: 2 },
  userUsername: { fontSize: 13, color: "#667eea", marginBottom: 2 },
  followersCount: { fontSize: 12, color: "#999" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  followBtn: {
    backgroundColor: "#667eea",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 76,
    alignItems: "center",
  },
  followingBtn: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#667eea",
  },
  followBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  followingBtnText: { color: "#667eea" },
  msgBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f0f0ff",
    justifyContent: "center",
    alignItems: "center",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#aaa", fontSize: 14 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#aaa" },
  emptySubtitle: { fontSize: 14, color: "#bbb", textAlign: "center" },
});
