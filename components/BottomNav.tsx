// components/BottomNav.tsx  — VARA redesign
// Logika navigacije nepromijenjena, samo stilovi
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const GREEN = "#2D6418";
const GREEN_DARK = "#1B3F0E";
const SILVER = "#9AA9A7";
const SILVER_LIGHT = "#D1DADB";

export default function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  // ✅ TABS niz MORA biti UGNIJEŽĐEN unutar komponente (nakon useTranslation)
  const TABS = [
    {
      route: "/(tabs)",
      label: t("nav.map"),
      icon: "map-outline",
      iconActive: "map",
    },
    {
      route: "/(tabs)/videos",
      label: t("nav.videos"),
      icon: "play-circle-outline",
      iconActive: "play-circle",
    },
    {
      route: "/(tabs)/messages",
      label: t("nav.messages"),
      icon: "chatbubble-outline",
      iconActive: "chatbubble",
    },
    {
      route: "/(tabs)/search",
      label: t("nav.search"),
      icon: "search-outline",
      iconActive: "search",
    },
    {
      route: "/(tabs)/profile",
      label: t("nav.profile"),
      icon: "person-outline",
      iconActive: "person",
    },
  ] as const;

  const isActive = (route: string) => {
    if (route === "/(tabs)")
      return (
        pathname === "/" || pathname === "/(tabs)" || pathname === "/index"
      );
    return pathname.startsWith(route.replace("/(tabs)", ""));
  };

  return (
    <View style={s.wrapper}>
      {/* Green accent bar at top of nav */}
      <View style={s.topAccent} />
      <View style={s.nav}>
        {TABS.map((tab) => {
          const active = isActive(tab.route);
          return (
            <TouchableOpacity
              key={tab.route}
              style={s.tab}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.7}
            >
              {/* Active indicator pill */}
              {active && <View style={s.activePill} />}
              <Ionicons
                name={(active ? tab.iconActive : tab.icon) as any}
                size={22}
                color={active ? GREEN : SILVER}
              />
              <Text style={[s.label, active && s.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 0,
    shadowColor: "#1B3F0E",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  topAccent: {
    height: 2,
    backgroundColor: GREEN,
    marginHorizontal: 32,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  nav: {
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    gap: 3,
    position: "relative",
  },
  activePill: {
    position: "absolute",
    top: 2,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: GREEN,
  },
  label: {
    fontSize: 11,
    color: SILVER,
    fontWeight: "400",
  },
  labelActive: {
    color: GREEN,
    fontWeight: "600",
  },
});
