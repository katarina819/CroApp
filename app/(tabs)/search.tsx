import { useCallback, useState } from "react";
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

// Definirani tip za korisnika
interface User {
  id: string;
  firstName: string;
  lastName: string;
  city: string;
  avatar: string | null;
}

// Mock korisnici s tipom
const MOCK_USERS: User[] = [
  {
    id: "1",
    firstName: "Marko",
    lastName: "Marković",
    city: "Zagreb",
    avatar: null,
  },
  { id: "2", firstName: "Ana", lastName: "Anić", city: "Split", avatar: null },
  {
    id: "3",
    firstName: "Ivan",
    lastName: "Ivić",
    city: "Rijeka",
    avatar: null,
  },
  {
    id: "4",
    firstName: "Maja",
    lastName: "Majić",
    city: "Osijek",
    avatar: null,
  },
  {
    id: "5",
    firstName: "Petar",
    lastName: "Perić",
    city: "Zadar",
    avatar: null,
  },
  {
    id: "6",
    firstName: "Lucija",
    lastName: "Lucić",
    city: "Dubrovnik",
    avatar: null,
  },
  {
    id: "7",
    firstName: "Filip",
    lastName: "Filipović",
    city: "Varaždin",
    avatar: null,
  },
  { id: "8", firstName: "Ema", lastName: "Emić", city: "Pula", avatar: null },
  {
    id: "9",
    firstName: "Luka",
    lastName: "Lukić",
    city: "Šibenik",
    avatar: null,
  },
  {
    id: "10",
    firstName: "Nika",
    lastName: "Nikić",
    city: "Karlovac",
    avatar: null,
  },
];

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>(MOCK_USERS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === "") {
      setFilteredUsers(MOCK_USERS);
    } else {
      const filtered = MOCK_USERS.filter((user) =>
        `${user.firstName} ${user.lastName}`
          .toLowerCase()
          .includes(text.toLowerCase()),
      );
      setFilteredUsers(filtered);
    }
  };

  const handleFollow = (userId: string, userName: string) => {
    Alert.alert("Prati", `Želite li pratiti ${userName}?`, [
      { text: "Otkaži", style: "cancel" },
      {
        text: "Prati",
        onPress: () => console.log(`Prati korisnika ${userId}`),
      },
    ]);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setFilteredUsers(MOCK_USERS);
      setRefreshing(false);
    }, 1000);
  }, []);

  const renderUserItem = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.firstName[0]}
              {item.lastName[0]}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={styles.userCity}>{item.city}</Text>
      </View>
      <TouchableOpacity
        style={styles.followButton}
        onPress={() =>
          handleFollow(item.id, `${item.firstName} ${item.lastName}`)
        }
      >
        <Text style={styles.followButtonText}>Prati</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyText}>Nema pronađenih korisnika</Text>
      <Text style={styles.emptySubtext}>
        Pokušajte s drugim pojmom za pretragu
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pretraga</Text>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Pretraži korisnike..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#667eea" />
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderUserItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={renderEmptyState}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  searchInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  userCity: {
    fontSize: 14,
    color: "#666",
  },
  followButton: {
    backgroundColor: "#667eea",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});
