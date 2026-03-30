import { router, usePathname } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function BottomNav() {
  const pathname = usePathname();

  const navigateTo = (tab: string) => {
    if (tab === "home") {
      router.replace("/(tabs)");
    } else if (tab === "search") {
      router.push("/(tabs)/search");
    } else if (tab === "videos") {
      router.push("/(tabs)/videos");
    } else if (tab === "messages") {
      router.push("/(tabs)/messages");
    } else if (tab === "profile") {
      router.push("/(tabs)/profile");
    }
  };

  const isActive = (tab: string) => {
    if (tab === "home") {
      return pathname === "/(tabs)" || pathname === "/(tabs)/index";
    }
    return pathname === `/(tabs)/${tab}`;
  };

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity onPress={() => navigateTo("home")}>
        <Text style={[styles.icon, isActive("home") && styles.activeIcon]}>
          🏠
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigateTo("videos")}>
        <Text style={[styles.icon, isActive("videos") && styles.activeIcon]}>
          🎥
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigateTo("messages")}>
        <Text style={[styles.icon, isActive("messages") && styles.activeIcon]}>
          💬
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigateTo("search")}>
        <Text style={[styles.icon, isActive("search") && styles.activeIcon]}>
          🔍
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigateTo("profile")}>
        <Text style={[styles.icon, isActive("profile") && styles.activeIcon]}>
          👤
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    bottom: 50, // umjesto top:40
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 20,
  },
  icon: {
    fontSize: 28,
  },
  activeIcon: {
    color: "#667eea",
  },
});
