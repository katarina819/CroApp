// app/(tabs)/profile.tsx — VARA tema
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StoryBadge } from "../../app/StoryBadge";
import { useTheme } from "../../components/AdaptiveThemeProvider";
import UserAvatar from "../../components/UserAvatar";
import { API_BASE_URL } from "../config/api";
import { useUser } from "./../contexts/UserContext";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── VARA Paleta (dark fallback za module-level StyleSheets koji ne ovise o temi) ──
const V_DARK = {
  forestDeep: "#1a2e1a",
  forestMid: "#2a4230",
  forestLight: "#3a5a30",
  borderGreen: "#4a7040",
  borderDim: "#3a5a30",
  silver: "#c0c0c0",
  silverBright: "#e8e8e8",
  silverDim: "#a0a0a0",
  accentGold: "#B8A060",
  visited: "#5a8a48",
  visitedLight: "#3a5a30",
  danger: "#8B3030",
  overlay: "rgba(0,0,0,0.6)",
  overlayLight: "rgba(26,46,21,0.92)",
  cardBg: "#2a4230",
  inputBg: "#2a4230",
} as const;

// ─── Dinamički getter boja koji se koristi UNUTAR komponenti ──────────────────
function getVara(dark: boolean) {
  return {
    forestDeep: dark ? "#1a2e1a" : "#f0ede4",
    forestMid: dark ? "#2a4230" : "#e4ead8",
    forestLight: dark ? "#3a5a30" : "#ccdcb8",
    borderGreen: dark ? "#4a7040" : "#5a8a40",
    borderDim: dark ? "#3a5a30" : "#c0d0a8",
    silver: dark ? "#c0c0c0" : "#3a4a35",
    silverBright: dark ? "#e8e8e8" : "#1a2a18",
    silverDim: dark ? "#a0a0a0" : "#5a6a55",
    accentGold: "#B8A060",
    visited: dark ? "#5a8a48" : "#3a6a28",
    visitedLight: dark ? "#3a5a30" : "#ccdcb8",
    danger: dark ? "#8B3030" : "#7a2020",
    overlay: dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)",
    overlayLight: dark ? "rgba(26,46,21,0.92)" : "rgba(240,237,228,0.96)",
    cardBg: dark ? "#2a4230" : "#e4ead8",
    inputBg: dark ? "#2a4230" : "#e4ead8",
  } as const;
}

type Tab = "me" | "box" | "wishlist" | "golden";

interface ProfileData {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
  followersCount: number;
  followingCount: number;
  isPublic: boolean;
  showUsername?: boolean;
  screenTimeLimitMinutes?: number;
}

interface BoxItem {
  id: number;
  videoId: number;
  title: string;
  filePath: string;
  savedAt: string;
  userName: string;
}

interface WishlistItem {
  id: number;
  videoId: number;
  title: string;
  filePath: string;
  addedAt: string;
  isGoing?: boolean;
  notes?: string;
}

interface GoldenFriend {
  userId: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string;
}

interface FollowUser {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string;
  isGolden?: boolean;
  isBlocked?: boolean;
}

interface DailyActivity {
  date: string;
  likes: number;
  comments: number;
  posts: number;
  sessionMinutes: number;
  followersCount?: number;
}

// ─── StyleSheet factory funkcije — pozivaju se unutar komponenti s aktualnim V ─
function makeFlStyles(V: ReturnType<typeof getVara>) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1.5,
      borderBottomColor: V.borderGreen,
      backgroundColor: V.forestDeep,
    },
    title: { fontSize: 17, fontWeight: "600", color: V.silverBright },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: V.borderDim,
    },
    avatarContainer: { marginRight: 12 },
    userInfo: { flex: 1 },
    name: { fontSize: 15, fontWeight: "600", color: V.silverBright },
    username: { fontSize: 13, color: V.visited, marginTop: 2 },
    actionButtons: { flexDirection: "row", gap: 8 },
    goldenBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: V.forestMid,
      borderWidth: 1.5,
      borderColor: V.borderDim,
      justifyContent: "center",
      alignItems: "center",
    },
    goldenBtnActive: { backgroundColor: "#231C0A", borderColor: V.accentGold },
    blockBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: V.forestMid,
      borderWidth: 1.5,
      borderColor: V.borderDim,
      justifyContent: "center",
      alignItems: "center",
    },
    blockBtnActive: { borderColor: V.danger },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingTop: 60,
    },
    emptyIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: V.forestMid,
      borderWidth: 1.5,
      borderColor: V.borderGreen,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyText: { fontSize: 16, color: V.silverDim },
  });
}

function makeAcStyles(V: ReturnType<typeof getVara>) {
  return StyleSheet.create({
    periodSelector: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 12,
      marginHorizontal: 16,
    },
    periodBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: V.forestMid,
      borderWidth: 1,
      borderColor: V.borderDim,
    },
    periodBtnActive: {
      backgroundColor: V.forestLight,
      borderColor: V.borderGreen,
    },
    periodBtnText: { fontSize: 13, color: V.silverDim },
    periodBtnTextActive: { color: V.silverBright, fontWeight: "600" },
    summaryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
      justifyContent: "center",
    },
    summaryCard: {
      width: (SCREEN_W - 64) / 2,
      minHeight: 100, // ← ovo dodaj
      alignItems: "center",
      justifyContent: "center", // ← ovo dodaj
      padding: 14,
      backgroundColor: V.forestMid,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: V.borderDim,
      borderTopWidth: 3,
      gap: 4,
    },
    summaryNum: { fontSize: 22, fontWeight: "800" },
    summaryLabel: { fontSize: 12, color: V.silverDim },
    followersCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: V.forestMid,
      marginHorizontal: 16,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: V.borderDim,
      borderLeftWidth: 3,
      borderLeftColor: V.visited,
    },
    followersNum: { fontSize: 24, fontWeight: "800", color: V.visited },
    followersLabel: { fontSize: 12, color: V.silverDim },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: V.silverBright,
      paddingHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
    },
    chartSection: {
      marginHorizontal: 16,
      marginBottom: 20,
      backgroundColor: V.forestMid,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: V.borderDim,
    },
    chartTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: V.silver,
      marginBottom: 10,
    },
    bars: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 90 },
    barColumn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
    },
    bar: { width: "100%", borderRadius: 4, minHeight: 2 },
    barValue: { fontSize: 10, color: V.silverDim, fontWeight: "600" },
    barDate: { fontSize: 9, color: V.silverDim, marginTop: 4 },
  });
}

function makeTabStyles(V: ReturnType<typeof getVara>) {
  return StyleSheet.create({
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: V.forestLight,
      borderWidth: 1.5,
      borderColor: V.borderGreen,
      borderRadius: 12,
      margin: 16,
      paddingVertical: 12,
      gap: 8,
    },
    addBtnText: { color: V.silverBright, fontSize: 15, fontWeight: "600" },
    gridItem: { flex: 1 / 3, aspectRatio: 1, padding: 1 },
    gridImg: { width: "100%", height: "100%" },
    videoIcon: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    gridDate: {
      position: "absolute",
      bottom: 4,
      left: 4,
      right: 4,
      fontSize: 10,
      color: V.silver,
      textShadowColor: "#000",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: V.borderDim,
      gap: 12,
    },
    thumb: { width: 60, height: 60, borderRadius: 8 },
    thumbContainer: {
      position: "relative",
      width: 60,
      height: 60,
      borderRadius: 8,
      overflow: "hidden",
    },
    playIcon: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.3)",
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: V.silverBright,
      marginBottom: 3,
    },
    itemMeta: { fontSize: 13, color: V.visited, marginBottom: 2 },
    itemDate: { fontSize: 12, color: V.silverDim },
    removeBtn: { padding: 8 },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
      gap: 14,
    },
    emptyIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: V.forestMid,
      borderWidth: 1.5,
      borderColor: V.borderGreen,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyText: {
      fontSize: 16,
      color: V.silverDim,
      textAlign: "center",
      paddingHorizontal: 32,
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      marginVertical: 12,
    },
    filterBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: V.forestMid,
      borderWidth: 1,
      borderColor: V.borderDim,
    },
    filterBtnActive: {
      backgroundColor: V.forestLight,
      borderColor: V.borderGreen,
    },
    filterBtnText: { fontSize: 13, color: V.silver },
    filterBtnTextActive: { color: V.silverBright, fontWeight: "600" },
    goingBadge: { fontSize: 13, color: V.visited, marginTop: 4 },
    // deleteOverlay removed — ikona smeća više se ne prikazuje u gridu
  });
}

function makeSmStyles(V: ReturnType<typeof getVara>) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1.5,
      borderBottomColor: V.borderGreen,
      backgroundColor: V.forestDeep,
    },
    dangerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    dangerHeaderLine: {
      flex: 1,
      height: 1,
      opacity: 0.5,
      backgroundColor: V.borderGreen,
    },
    dangerHeaderText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase" as const,
      letterSpacing: 1.5,
      color: V.silverDim,
    },
    dangerDesc: {
      fontSize: 12,
      marginBottom: 16,
      fontStyle: "italic" as const,
      color: V.silverDim,
    },
    varaBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
      backgroundColor: V.forestMid,
      borderColor: V.borderDim,
    },
    varaBtnDestructive: {
      borderWidth: 1.5,
      borderTopWidth: 2,
      backgroundColor: "#1e2e18",
      borderColor: V.accentGold,
    },
    varaBtnIcon: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      backgroundColor: V.forestLight,
      borderColor: V.borderDim,
    },
    varaBtnIconDestructive: {
      backgroundColor: "#2a1e0a",
      borderColor: V.accentGold,
    },
    varaBtnText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500" as const,
      color: V.silver,
    },
    varaBtnTextDestructive: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600" as const,
      color: V.accentGold,
    },
    title: { fontSize: 17, fontWeight: "600", color: V.silverBright },
    saveBtn: { fontSize: 16, fontWeight: "600", color: V.visited },
    section: { marginTop: 12, paddingHorizontal: 16 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 12,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
      color: V.silverDim,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: V.borderDim,
    },
    rowLabel: { fontSize: 16, color: V.silverBright },
    rowSub: { fontSize: 13, marginTop: 2, color: V.silverDim },
    currentValue: {
      fontSize: 12,
      marginTop: 4,
      marginBottom: 8,
      color: V.visited,
    },
    activeLimit: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 8,
      borderRadius: 8,
      marginVertical: 8,
      borderWidth: 1,
      backgroundColor: V.forestMid,
      borderColor: V.borderGreen,
    },
    activeLimitText: { fontSize: 13, fontWeight: "600", color: V.visited },
    timeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    timeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      backgroundColor: V.forestMid,
      borderColor: V.borderDim,
    },
    timeBtnActive: {
      backgroundColor: V.forestLight,
      borderColor: V.borderGreen,
    },
    timeBtnText: { fontSize: 13, color: V.silver },
    timeBtnTextActive: { fontWeight: "600", color: V.silverBright },
    blockedUser: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: V.borderDim,
    },
    dangerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1.5,
    },
    dangerBtnText: { fontSize: 15, fontWeight: "600" },
  });
}

function makeLangStyles(V: ReturnType<typeof getVara>) {
  return StyleSheet.create({
    currentLang: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: V.forestMid,
      borderWidth: 1,
      borderColor: V.borderDim,
      padding: 12,
      borderRadius: 10,
      marginBottom: 12,
    },
    currentLangLabel: { fontSize: 14, color: V.silverDim },
    currentLangValue: { fontSize: 14, fontWeight: "700", color: V.visited },
    langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    langBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: V.forestMid,
      borderWidth: 1.5,
      borderColor: V.borderDim,
      position: "relative",
      paddingRight: 28,
    },
    langBtnActive: {
      backgroundColor: V.forestLight,
      borderColor: V.borderGreen,
    },
    langFlag: { fontSize: 18 },
    langLabel: { fontSize: 13, fontWeight: "600", color: V.silver },
    langLabelActive: { color: V.silverBright },
  });
}

function makeSctStyles(V: ReturnType<typeof getVara>) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: V.forestMid,
      borderWidth: 1,
      borderColor: V.borderGreen,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      alignSelf: "center",
      marginBottom: 8,
    },
    warning: { backgroundColor: "#2A1010", borderColor: "#5A3030" },
    text: { fontSize: 13, color: V.visited, fontWeight: "600" },
    warningText: { color: "#C05050" },
  });
}

function makeThemeStyles(V: ReturnType<typeof getVara>) {
  return StyleSheet.create({
    optionsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
    themeCard: {
      flex: 1,
      borderRadius: 14,
      padding: 10,
      alignItems: "center",
      borderWidth: 2,
      position: "relative",
      gap: 6,
    },
    themeCardLight: { backgroundColor: "#f0ead8", borderColor: "#c8b870" },
    themeCardActive: {
      borderWidth: 2.5,
      shadowColor: "#e0c060",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 4,
    },
    previewLight: {
      width: "100%",
      height: 52,
      backgroundColor: "#fff8e8",
      borderRadius: 8,
      padding: 6,
      gap: 4,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#e0d090",
    },
    previewBarLight: {
      height: 6,
      width: "80%",
      backgroundColor: "#c8a840",
      borderRadius: 3,
    },
    previewCircleLight: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#e8c848",
      alignSelf: "flex-end",
      marginTop: 2,
    },
    themeLabelLight: { fontSize: 22 },
    themeTitleLight: { fontSize: 12, fontWeight: "700", color: "#5a4a10" },
    themeCardAuto: { backgroundColor: V.forestMid, borderColor: V.borderDim },
    themeCardActiveAuto: {
      borderColor: V.visited,
      borderWidth: 2.5,
      shadowColor: V.visited,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 4,
    },
    previewAuto: {
      width: "100%",
      height: 52,
      backgroundColor: V.forestDeep,
      borderRadius: 8,
      padding: 6,
      gap: 4,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: V.borderGreen,
      overflow: "hidden",
    },
    previewBarAuto: {
      height: 6,
      width: "80%",
      backgroundColor: V.visited,
      borderRadius: 3,
    },
    previewCircleAuto: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#5a8a48",
      alignSelf: "flex-end",
      marginTop: 2,
    },
    themeLabelAuto: { fontSize: 22 },
    themeTitleAuto: { fontSize: 12, fontWeight: "700", color: V.silverBright },
    themeSubAuto: { fontSize: 9, color: V.silverDim, textAlign: "center" },
    themeCardDark: { backgroundColor: "#120820", borderColor: "#4a3870" },
    themeCardActiveDark: {
      borderColor: "#9080e0",
      borderWidth: 2.5,
      shadowColor: "#7060c0",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 4,
    },
    previewDark: {
      width: "100%",
      height: 52,
      backgroundColor: "#0a0418",
      borderRadius: 8,
      padding: 6,
      gap: 4,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#4a3870",
    },
    previewBarDark: {
      height: 6,
      width: "80%",
      backgroundColor: "#7060c0",
      borderRadius: 3,
    },
    previewCircleDark: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#5040a0",
      alignSelf: "flex-end",
      marginTop: 2,
    },
    themeLabelDark: { fontSize: 22 },
    themeTitleDark: { fontSize: 12, fontWeight: "700", color: "#c0b0ff" },
    checkDot: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    autoInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: V.forestDeep,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: V.borderGreen,
      marginTop: 4,
    },
    autoInfoEmoji: { fontSize: 24 },
    autoInfoTitle: { fontSize: 14, fontWeight: "700", color: V.silverBright },
    autoInfoSub: { fontSize: 11, color: V.silverDim, marginTop: 2 },
    autoSchemeDot: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      alignItems: "center",
    },
  });
}

const AVATAR_MALE = require("../../assets/images/avatar-male.png");
const AVATAR_FEMALE = require("../../assets/images/avatar-female.png");

function AvatarMale({ size = 96 }: { size?: number }) {
  return (
    <Image
      source={AVATAR_MALE}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
}

function AvatarFemale({ size = 96 }: { size?: number }) {
  return (
    <Image
      source={AVATAR_FEMALE}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
}

// ─── Avatar Section ───────────────────────────────────────────────────────────
function AvatarSection({ onUpdate }: { onUpdate: () => void }) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const { profile, updateAvatar, refreshProfile, resetProfile } = useUser();
  const [loading, setLoading] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const pickAndUpload = async () => {
    Alert.alert(t("profile.profilePicture"), t("profile.selectSource"), [
      { text: t("profile.gallery"), onPress: () => pickImage("gallery") },
      { text: t("profile.camera"), onPress: () => pickImage("camera") },
      {
        text: t("profile.selectAvatar"),
        onPress: () => setShowAvatarModal(true),
      },
      {
        text: t("profile.noPhoto"),
        onPress: async () => {
          setLoading(true);
          try {
            const token = await AsyncStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/auth/profile-photo`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              updateAvatar("");
              await refreshProfile();
              onUpdate();
              Alert.alert(t("common.success"), t("profile.photoRemoved"));
            }
          } catch {
            Alert.alert(t("common.error"), t("profile.photoRemoveError"));
          } finally {
            setLoading(false);
          }
        },
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const selectInitials = async () => {
    setShowAvatarModal(false);
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/auth/profile-photo`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        updateAvatar("");
        await refreshProfile();
        onUpdate();
      }
    } catch {
      Alert.alert(t("common.error"), t("profile.photoRemoveError"));
    } finally {
      setLoading(false);
    }
  };

  const selectAvatar = async (type: "male" | "female") => {
    setShowAvatarModal(false);
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/auth/profile-photo/avatar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarType: type }),
      });
      if (res.ok) {
        const data = await res.json();
        updateAvatar(data.avatarUrl);
        await refreshProfile();
        onUpdate();
      }
    } catch {
      Alert.alert(t("common.error"), t("profile.avatarError"));
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (source: "gallery" | "camera") => {
    const perm =
      source === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result =
      source === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          });
    if (!result.canceled && result.assets[0])
      await uploadAvatar(result.assets[0].uri);
  };

  const uploadAvatar = async (uri: string) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const formData = new FormData();
      formData.append("avatar", {
        uri,
        type: "image/jpeg",
        name: "avatar.jpg",
      } as any);
      const res = await fetch(`${API_BASE_URL}/api/auth/profile-photo`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        updateAvatar(data.avatarUrl);
        await refreshProfile();
        onUpdate();
      } else {
        Alert.alert(t("common.error"), t("profile.photoError"));
      }
    } catch {
      Alert.alert(t("common.error"), t("profile.photoError"));
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = () => {
    if (!profile?.avatar) return null;
    if (profile.avatar.startsWith("avatar:")) return null;

    const base = profile.avatar.startsWith("http")
      ? profile.avatar
      : `${API_BASE_URL}${profile.avatar.startsWith("/") ? "" : "/"}${profile.avatar}`;

    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}uid=${profile.id}`;
  };
  const avatarUrl = getAvatarUrl();
  const isMaleAvatar = profile?.avatar === "avatar:male";
  const isFemaleAvatar = profile?.avatar === "avatar:female";
  const initials =
    `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <>
      <TouchableOpacity
        onPress={pickAndUpload}
        style={av.wrapper}
        activeOpacity={0.8}
      >
        <StoryBadge userId={profile?.id ?? 0} size={96}>
          {isMaleAvatar ? (
            <AvatarMale size={96} />
          ) : isFemaleAvatar ? (
            <AvatarFemale size={96} />
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={av.img} />
          ) : (
            <View
              style={[
                av.placeholder,
                { backgroundColor: V.forestLight, borderColor: V.borderGreen },
              ]}
            >
              <Text style={[av.initials, { color: V.silverBright }]}>
                {initials}
              </Text>
            </View>
          )}
        </StoryBadge>
        {loading && (
          <View style={av.overlay}>
            <ActivityIndicator color={V.silverBright} />
          </View>
        )}
        <View
          style={[
            av.editIcon,
            { backgroundColor: V.forestLight, borderColor: V.borderGreen },
          ]}
        >
          <Ionicons name="camera" size={14} color={V.silverBright} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={showAvatarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <TouchableOpacity
          style={[avModal.overlay, { backgroundColor: V.overlay }]}
          activeOpacity={1}
          onPress={() => setShowAvatarModal(false)}
        >
          <View
            style={[
              avModal.container,
              { backgroundColor: V.forestDeep, borderColor: V.borderGreen },
            ]}
          >
            <View
              style={[avModal.handle, { backgroundColor: V.borderGreen }]}
            />
            <Text style={[avModal.title, { color: V.silverBright }]}>
              {t("profile.avatarTitle")}
            </Text>
            <Text style={[avModal.subtitle, { color: V.silverDim }]}>
              {t("profile.avatarSubtitle")}
            </Text>
            <View style={avModal.avatarRow}>
              <TouchableOpacity
                style={[
                  avModal.option,
                  { borderColor: V.borderDim, backgroundColor: V.forestMid },
                  isMaleAvatar && {
                    borderColor: V.borderGreen,
                    backgroundColor: V.forestLight,
                  },
                ]}
                onPress={() => selectAvatar("male")}
                activeOpacity={0.8}
              >
                <View style={avModal.avatarWrapper}>
                  <AvatarMale size={88} />
                  {isMaleAvatar && (
                    <View
                      style={[
                        avModal.checkBadge,
                        {
                          backgroundColor: V.visited,
                          borderColor: V.forestDeep,
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={V.silverBright}
                      />
                    </View>
                  )}
                </View>
                <Text style={[avModal.optionLabel, { color: V.silver }]}>
                  {t("profile.maleAvatar")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  avModal.option,
                  { borderColor: V.borderDim, backgroundColor: V.forestMid },
                  isFemaleAvatar && {
                    borderColor: V.borderGreen,
                    backgroundColor: V.forestLight,
                  },
                ]}
                onPress={() => selectAvatar("female")}
                activeOpacity={0.8}
              >
                <View style={avModal.avatarWrapper}>
                  <AvatarFemale size={88} />
                  {isFemaleAvatar && (
                    <View
                      style={[
                        avModal.checkBadge,
                        {
                          backgroundColor: V.visited,
                          borderColor: V.forestDeep,
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={V.silverBright}
                      />
                    </View>
                  )}
                </View>
                <Text style={[avModal.optionLabel, { color: V.silver }]}>
                  {t("profile.femaleAvatar")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  avModal.option,
                  { borderColor: V.borderDim, backgroundColor: V.forestMid },
                  !avatarUrl &&
                    !isMaleAvatar &&
                    !isFemaleAvatar && {
                      borderColor: V.borderGreen,
                      backgroundColor: V.forestLight,
                    },
                ]}
                onPress={selectInitials}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    avModal.avatarWrapper,
                    avModal.initialsWrapper,
                    {
                      backgroundColor: V.forestLight,
                      borderColor: V.borderGreen,
                    },
                  ]}
                >
                  <Text
                    style={[avModal.initialsText, { color: V.silverBright }]}
                  >
                    {initials}
                  </Text>
                  {!avatarUrl && !isMaleAvatar && !isFemaleAvatar && (
                    <View
                      style={[
                        avModal.checkBadge,
                        {
                          backgroundColor: V.visited,
                          borderColor: V.forestDeep,
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={V.silverBright}
                      />
                    </View>
                  )}
                </View>
                <Text style={[avModal.optionLabel, { color: V.silver }]}>
                  {t("profile.initialsAvatar")}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={avModal.cancelBtn}
              onPress={() => setShowAvatarModal(false)}
            >
              <Text style={[avModal.cancelText, { color: V.silverDim }]}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const av = StyleSheet.create({
  wrapper: {
    alignSelf: "center",
    marginBottom: 12,
    width: 104,
    height: 104,
    justifyContent: "center",
    alignItems: "center",
  },
  img: { width: 96, height: 96, borderRadius: 48 },
  placeholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  initials: { fontSize: 36, fontWeight: "700" },
  overlay: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  editIcon: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});

const avModal = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    padding: 24,
    width: "100%",
    alignItems: "center",
    paddingBottom: 36,
  },
  handle: { width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 24 },
  avatarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 20,
    justifyContent: "center",
  },
  option: {
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  avatarWrapper: {
    position: "relative",
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
  },
  initialsWrapper: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  initialsText: { fontSize: 30, fontWeight: "700" },
  checkBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  optionLabel: { marginTop: 8, fontSize: 13, fontWeight: "600" },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 32 },
  cancelText: { fontSize: 15, fontWeight: "600" },
});

// ─── Followers / Following List Modal ─────────────────────────────────────────
function FollowListModal({
  visible,
  type,
  userId,
  onClose,
  onUpdate,
}: {
  visible: boolean;
  type: "followers" | "following";
  userId: number | null;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const fl = useMemo(() => makeFlStyles(V), [V]);
  const [list, setList] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;
    loadList();
  }, [visible, userId, type]);

  const loadList = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const endpoint =
        type === "followers"
          ? `${API_BASE_URL}/api/follow/followers/${userId}`
          : `${API_BASE_URL}/api/follow/following/${userId}`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const enhancedData = await Promise.all(
          data.map(async (user: FollowUser) => {
            try {
              const [goldenRes, blockedRes] = await Promise.all([
                fetch(
                  `${API_BASE_URL}/api/golden-friends/is-golden/${user.id}`,
                  { headers: { Authorization: `Bearer ${token}` } },
                ),
                fetch(`${API_BASE_URL}/api/block/is-blocked/${user.id}`, {
                  headers: { Authorization: `Bearer ${token}` },
                }),
              ]);
              const goldenData = goldenRes.ok
                ? await goldenRes.json()
                : { isGolden: false };
              const blockedData = blockedRes.ok
                ? await blockedRes.json()
                : { isBlocked: false };
              const cacheBustedAvatar =
                user.avatar && !user.avatar.startsWith("avatar:")
                  ? `${user.avatar}${user.avatar.includes("?") ? "&" : "?"}_t=${Date.now()}`
                  : user.avatar;

              return {
                ...user,
                avatar: cacheBustedAvatar,
                isGolden: goldenData.isGolden || false,
                isBlocked: blockedData.isBlocked || false,
              };
            } catch {
              const cacheBustedAvatar =
                user.avatar && !user.avatar.startsWith("avatar:")
                  ? `${user.avatar}${user.avatar.includes("?") ? "&" : "?"}_t=${Date.now()}`
                  : user.avatar;
              return {
                ...user,
                avatar: cacheBustedAvatar,
                isGolden: false,
                isBlocked: false,
              };
            }
          }),
        );
        setList(enhancedData);
      }
    } catch (error) {
      console.error("Error loading list:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoldenToggle = async (
    targetUserId: number,
    currentStatus: boolean,
    targetName?: string,
  ) => {
    const doToggle = async () => {
      setProcessingId(targetUserId);
      try {
        const token = await AsyncStorage.getItem("token");
        const res = !currentStatus
          ? await fetch(
              `${API_BASE_URL}/api/golden-friends/add/${targetUserId}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              },
            )
          : await fetch(
              `${API_BASE_URL}/api/golden-friends/remove/${targetUserId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
        if (res.ok) {
          setList((prev) =>
            prev.map((user) =>
              user.id === targetUserId
                ? { ...user, isGolden: !currentStatus }
                : user,
            ),
          );
          Alert.alert(
            t("common.success"),
            currentStatus
              ? t("profile.goldenRemoved")
              : t("profile.goldenAdded"),
          );
        }
      } catch (error) {
        console.error("Golden toggle error:", error);
      } finally {
        setProcessingId(null);
      }
    };

    if (!currentStatus) {
      Alert.alert(
        t("profile.goldenConfirmTitle"),
        t("profile.goldenConfirmMsg", { name: targetName ?? "" }),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("profile.goldenConfirmBtn"), onPress: doToggle },
        ],
      );
    } else {
      doToggle();
    }
  };

  const handleBlockToggle = async (
    targetUserId: number,
    currentStatus: boolean,
    targetName?: string,
  ) => {
    const doBlock = async () => {
      setProcessingId(targetUserId);
      try {
        const token = await AsyncStorage.getItem("token");
        try {
          const checkFollow = await fetch(
            `${API_BASE_URL}/api/follow/is-following/${targetUserId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (checkFollow.ok) {
            const followData = await checkFollow.json();
            if (followData.isFollowing === true) {
              await fetch(
                `${API_BASE_URL}/api/follow/unfollow/${targetUserId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
            }
          }
        } catch {}
        const res = await fetch(
          `${API_BASE_URL}/api/block/block/${targetUserId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (res.ok) {
          setList((prev) => prev.filter((user) => user.id !== targetUserId));
          Alert.alert(t("profile.blocked"), t("profile.blockedDesc"));
          if (onUpdate) onUpdate();
          if (list.length === 1) onClose();
        }
      } catch (error) {
        console.error("Block toggle error:", error);
      } finally {
        setProcessingId(null);
      }
    };

    const doUnblock = async () => {
      setProcessingId(targetUserId);
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(
          `${API_BASE_URL}/api/block/unblock/${targetUserId}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          setList((prev) =>
            prev.map((user) =>
              user.id === targetUserId ? { ...user, isBlocked: false } : user,
            ),
          );
          Alert.alert(t("profile.unblocked"), t("profile.unblockedDesc"));
        }
      } catch (error) {
        console.error("Block toggle error:", error);
      } finally {
        setProcessingId(null);
      }
    };

    if (!currentStatus) {
      Alert.alert(
        t("profile.blockConfirmTitle"),
        t("profile.blockConfirmMsg", { name: targetName ?? "" }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("profile.blockConfirmBtn"),
            style: "destructive",
            onPress: doBlock,
          },
        ],
      );
    } else {
      doUnblock();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: V.forestDeep }}
        edges={["top"]}
      >
        <View style={fl.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={V.silver} />
          </TouchableOpacity>
          <Text style={fl.title}>
            {type === "followers"
              ? t("profile.followersList")
              : t("profile.followingList")}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={V.visited} />
        ) : list.length === 0 ? (
          <View style={fl.empty}>
            <View style={fl.emptyIconWrap}>
              <Ionicons name="people-outline" size={44} color={V.borderGreen} />
            </View>
            <Text style={fl.emptyText}>
              {type === "followers"
                ? t("profile.noFollowers")
                : t("profile.noFollowing")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(u) => u.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => {
              const isLoading = processingId === item.id;
              return (
                <View style={fl.row}>
                  <TouchableOpacity
                    style={fl.avatarContainer}
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: "/profile/[userId]",
                        params: { userId: item.id.toString() },
                      } as any);
                    }}
                  >
                    <UserAvatar
                      avatar={item.avatar}
                      firstName={item.firstName}
                      lastName={item.lastName}
                      size={50}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={fl.userInfo}
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: "/profile/[userId]",
                        params: { userId: item.id.toString() },
                      } as any);
                    }}
                  >
                    <Text style={fl.name}>
                      {item.firstName} {item.lastName}
                    </Text>
                    <Text style={fl.username}>@{item.username}</Text>
                  </TouchableOpacity>
                  <View style={fl.actionButtons}>
                    <TouchableOpacity
                      style={[
                        fl.goldenBtn,
                        item.isGolden && fl.goldenBtnActive,
                      ]}
                      onPress={() =>
                        handleGoldenToggle(
                          item.id,
                          item.isGolden || false,
                          `${item.firstName} ${item.lastName}`,
                        )
                      }
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={V.accentGold} />
                      ) : (
                        <Ionicons
                          name={item.isGolden ? "star" : "star-outline"}
                          size={22}
                          color={item.isGolden ? V.accentGold : V.silverDim}
                        />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[fl.blockBtn, item.isBlocked && fl.blockBtnActive]}
                      onPress={() =>
                        handleBlockToggle(
                          item.id,
                          item.isBlocked || false,
                          `${item.firstName} ${item.lastName}`,
                        )
                      }
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={V.danger} />
                      ) : (
                        <Ionicons
                          name={item.isBlocked ? "ban" : "ellipsis-vertical"}
                          size={20}
                          color={item.isBlocked ? "#ff4757" : V.silverDim}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Activity Archive ─────────────────────────────────────────────────────────
function ActivityArchive({ userId }: { userId: number | null }) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const ac = useMemo(() => makeAcStyles(V), [V]);
  const [data, setData] = useState<DailyActivity[]>([]);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadStats();
  }, [userId, period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_BASE_URL}/api/activity/stats?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) setData(await res.json());
    } catch {
      const mock: DailyActivity[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toISOString().split("T")[0],
          sessionMinutes: Math.floor(Math.random() * 45) + 5,
          likes: Math.floor(Math.random() * 15),
          comments: Math.floor(Math.random() * 8),
          posts: Math.floor(Math.random() * 3),
          followersCount: Math.floor(Math.random() * 100) + 50,
        };
      });
      setData(mock);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return <ActivityIndicator color={V.visited} style={{ marginTop: 20 }} />;

  const totalLikes = data.reduce((s, d) => s + d.likes, 0);
  const totalComments = data.reduce((s, d) => s + d.comments, 0);
  const totalPosts = data.reduce((s, d) => s + d.posts, 0);
  const totalMinutes = data.reduce((s, d) => s + d.sessionMinutes, 0);
  const currentFollowers = data[data.length - 1]?.followersCount || 0;

  const renderBarChart = (
    values: number[],
    label: string,
    color: string,
    max: number,
    height: number,
  ) => {
    if (values.length === 0) return null;
    return (
      <View style={ac.chartSection}>
        <Text style={ac.chartTitle}>{label}</Text>
        <View style={ac.bars}>
          {values.map((val, i) => {
            const barH =
              max === 0 ? 4 : Math.max((val / max) * height, val > 0 ? 4 : 2);
            const date = new Date();
            date.setDate(date.getDate() - (values.length - 1 - i));
            const shortDate = `${date.getMonth() + 1}/${date.getDate()}`;
            return (
              <View key={i} style={ac.barColumn}>
                <Text style={ac.barValue}>{val}</Text>
                <View
                  style={[ac.bar, { height: barH, backgroundColor: color }]}
                />
                <Text style={ac.barDate}>{shortDate}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
      <View style={ac.periodSelector}>
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[ac.periodBtn, period === p && ac.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[ac.periodBtnText, period === p && ac.periodBtnTextActive]}
            >
              {p === "daily"
                ? t("activity.dailyPeriod")
                : p === "weekly"
                  ? t("activity.weeklyPeriod")
                  : t("activity.monthlyPeriod")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {[
        [
          {
            icon: "heart",
            color: "#C05050",
            value: totalLikes,
            label: t("activity.likes"),
          },
          {
            icon: "chatbubble",
            color: V.visited,
            value: totalComments,
            label: t("activity.comments"),
          },
        ],
        [
          {
            icon: "images",
            color: V.accentGold,
            value: totalPosts,
            label: t("activity.posts"),
          },
          {
            icon: "time",
            color: V.silver,
            value: totalMinutes,
            label: t("activity.minutes"),
          },
        ],
        [
          {
            icon: "people",
            color: V.visited,
            value: currentFollowers,
            label: t("activity.currentFollowers"),
          },
        ],
      ].map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
            marginBottom: 10,
            paddingHorizontal: 16,
          }}
        >
          {row.map((card, i) => (
            <View
              key={i}
              style={[ac.summaryCard, { borderTopColor: card.color }]}
            >
              <Ionicons name={card.icon as any} size={20} color={card.color} />
              <Text style={[ac.summaryNum, { color: card.color }]}>
                {card.value}
              </Text>
              <Text style={ac.summaryLabel}>{card.label}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Video Preview Modal ──────────────────────────────────────────────────────
// PROMJENA: dodan onDelete callback za gumb "Obriši" u headeru
function VideoPreviewModal({
  visible,
  videoUrl,
  title,
  onClose,
  onDelete,
}: {
  visible: boolean;
  videoUrl: string;
  title: string;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
    playerRef.current = p;
    setIsPlayerReady(true);
  });

  useEffect(() => {
    if (!player) return;
    if (visible && isPlayerReady) {
      setTimeout(() => {
        try {
          playerRef.current?.play();
        } catch {}
      }, 100);
    } else if (!visible && playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
    }
  }, [visible, player, isPlayerReady]);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          if (typeof playerRef.current.release === "function")
            playerRef.current.release();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        {/* PROMJENA: header sada ima "Zatvori" lijevo, naziv u sredini, "Obriši" desno */}
        <View style={vpModal.header}>
          <TouchableOpacity onPress={onClose} style={vpModal.headerBtn}>
            <Text style={{ color: "#c0c0c0", fontSize: 15, fontWeight: "600" }}>
              Zatvori
            </Text>
          </TouchableOpacity>
          <Text style={vpModal.title} numberOfLines={1}>
            {title}
          </Text>
          {onDelete ? (
            <TouchableOpacity
              onPress={() => {
                onClose();
                onDelete();
              }}
              style={vpModal.headerBtn}
            >
              <Text
                style={{ color: "#C05050", fontSize: 15, fontWeight: "600" }}
              >
                Obriši
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={vpModal.headerBtn} />
          )}
        </View>
        <View style={vpModal.videoContainer}>
          {visible && (
            <VideoView
              player={player}
              style={vpModal.video}
              contentFit="contain"
              nativeControls={true}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const vpModal = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerBtn: {
    minWidth: 60,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#c0c0c0",
    flex: 1,
    marginHorizontal: 12,
    textAlign: "center",
  },
  videoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  video: { width: "100%", height: "100%" },
});

// ─── Screen Time Countdown ────────────────────────────────────────────────────
function ScreenTimeCountdown() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const sct = useMemo(() => makeSctStyles(V), [V]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = async () => {
      const limitStr = await AsyncStorage.getItem("screenTimeLimit");
      const startStr = await AsyncStorage.getItem("screenTimeStart");
      if (!limitStr || !startStr || parseInt(limitStr) === 0) {
        setRemaining(null);
        return;
      }
      const limit = parseInt(limitStr) * 60 * 1000;
      const start = parseInt(startStr);
      const rem = limit - (Date.now() - start);
      if (rem <= 0) {
        setRemaining(0);
        await handleScreenTimeExpired();
      } else setRemaining(Math.floor(rem / 1000));
    };
    check();
    intervalRef.current = setInterval(async () => {
      const limitStr = await AsyncStorage.getItem("screenTimeLimit");
      const startStr = await AsyncStorage.getItem("screenTimeStart");
      if (!limitStr || !startStr || parseInt(limitStr) === 0) {
        setRemaining(null);
        return;
      }
      const limit = parseInt(limitStr) * 60 * 1000;
      const start = parseInt(startStr);
      const rem = limit - (Date.now() - start);
      if (rem <= 0) {
        setRemaining(0);
        await handleScreenTimeExpired();
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else setRemaining(Math.floor(rem / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleScreenTimeExpired = async () => {
    await AsyncStorage.setItem(
      "screenTimeLogoutDate",
      new Date().toDateString(),
    );
    Alert.alert(
      t("profile.screenTimeLimitReached"),
      t("profile.screenTimeLimitReachedDesc"),
      [
        {
          text: "OK",
          onPress: async () => {
            await AsyncStorage.removeItem("token");
            router.replace("/login");
          },
        },
      ],
    );
  };

  if (remaining === null) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isWarning = remaining < 300;

  return (
    <View style={[sct.container, isWarning && sct.warning]}>
      <Ionicons
        name="time-outline"
        size={16}
        color={isWarning ? "#C05050" : V.visited}
      />
      <Text style={[sct.text, isWarning && sct.warningText]}>
        Preostalo: {mins}:{secs.toString().padStart(2, "0")}
      </Text>
    </View>
  );
}

const getThumbnail = (item: any): string | null => {
  if (item.type === "image") return item.url || item.filePath || null;
  return null;
};

// ─── Empty Tab ────────────────────────────────────────────────────────────────
function EmptyTab({ icon, text }: { icon: any; text: string }) {
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const tab = useMemo(() => makeTabStyles(V), [V]);
  return (
    <View style={tab.empty}>
      <View style={tab.emptyIconWrap}>
        <Ionicons name={icon} size={44} color={V.borderGreen} />
      </View>
      <Text style={tab.emptyText}>{text}</Text>
    </View>
  );
}

// ─── Me Tab ───────────────────────────────────────────────────────────────────
function MeTab({ userId }: { userId: number | null }) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const tab = useMemo(() => makeTabStyles(V), [V]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const videoUrl = selectedMedia?.type === "video" ? selectedMedia.url : "";
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
    setPlayerReady(true);
  });

  useEffect(() => {
    if (
      showMediaModal &&
      selectedMedia?.type === "video" &&
      playerReady &&
      player
    ) {
      player.play();
    } else if (!showMediaModal && player) {
      player.pause();
    }
  }, [showMediaModal, selectedMedia, playerReady, player]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/media/my-media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setItems(await res.json());
      } else {
        const fallback = await fetch(
          `${API_BASE_URL}/api/video/user/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (fallback.ok) {
          const vids = await fallback.json();
          setItems(
            vids.map((v: any) => ({
              id: v.id,
              url: v.filePath,
              type: v.filePath
                ?.toLowerCase()
                .match(/\.(jpg|jpeg|png|gif|webp)$/)
                ? "image"
                : "video",
              createdAt: v.createdAt,
              title: v.title,
            })),
          );
        }
      }
    } catch (e) {
      console.error("MeTab load error:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const openMedia = (item: any) => {
    setSelectedMedia(item);
    setShowMediaModal(true);
  };

  const confirmDelete = (item: any) => {
    Alert.alert(
      t("common.delete"),
      t("profile.deleteMediaConfirm", {
        name: item.title || t("profile.media"),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => deleteItem(item.id),
        },
      ],
    );
  };

  const deleteItem = async (id: number) => {
    const token = await AsyncStorage.getItem("token");
    try {
      let res = await fetch(`${API_BASE_URL}/api/media/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok)
        res = await fetch(`${API_BASE_URL}/api/video/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        Alert.alert(t("common.success"), t("profile.mediaDeleted"));
      }
    } catch {}
  };

  const addMedia = async () => {
    Alert.alert(t("profile.addMedia"), t("profile.selectSource"), [
      {
        text: t("profile.selectFromGallery"),
        onPress: () => pickMedia("gallery"),
      },
      { text: t("profile.takePhoto"), onPress: () => pickMedia("camera") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const pickMedia = async (source: "gallery" | "camera") => {
    const perm =
      source === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result =
      source === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            quality: 1,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            quality: 1,
          });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploading(true);
      try {
        const token = await AsyncStorage.getItem("token");
        let uid = await AsyncStorage.getItem("userId");
        if (!uid || uid === "0") {
          try {
            const payload = JSON.parse(atob(token!.split(".")[1]));
            uid =
              payload[
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
              ];
          } catch {}
        }
        const formData = new FormData();
        formData.append("Video", {
          uri: asset.uri,
          type: asset.type === "video" ? "video/mp4" : "image/jpeg",
          name: asset.type === "video" ? "media.mp4" : "media.jpg",
        } as any);
        formData.append("Title", asset.type === "video" ? "Video" : "Slika");
        formData.append("Location", "Moja lokacija");
        formData.append("Description", "Nema opisa");
        formData.append("UserId", uid || "");
        const res = await fetch(`${API_BASE_URL}/api/video/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          Alert.alert("Uspjeh!", "Medij je dodan");
          load();
        }
      } catch {
      } finally {
        setUploading(false);
      }
    }
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color={V.visited} />;

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        style={tab.addBtn}
        onPress={addMedia}
        disabled={uploading}
      >
        <Text style={tab.addBtnText}>
          {uploading ? t("profile.uploading") : t("profile.addMedia")}
        </Text>
      </TouchableOpacity>

      {items.length === 0 ? (
        <EmptyTab icon="images-outline" text={t("profile.noMedia")} />
      ) : (
        <FlatList
          data={items}
          numColumns={3}
          keyExtractor={(i) => i.id.toString()}
          renderItem={({ item }) => {
            const isVideo = item.type === "video";
            const imageUrl = getThumbnail(item);
            return (
              // PROMJENA: uklonjena onLongPress i deleteOverlay ikona smeća
              // Brisanje je sada dostupno samo kroz gumb "Obriši" u previewu
              <TouchableOpacity
                style={tab.gridItem}
                onPress={() => openMedia(item)}
                activeOpacity={0.7}
              >
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={tab.gridImg} />
                ) : (
                  <View
                    style={[
                      tab.gridImg,
                      {
                        backgroundColor: V.forestMid,
                        justifyContent: "center",
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Ionicons name="videocam" size={32} color={V.visited} />
                  </View>
                )}
                {isVideo && (
                  <View style={tab.videoIcon}>
                    <Ionicons
                      name="play-circle"
                      size={28}
                      color={V.silverBright}
                    />
                  </View>
                )}
                {/* UKLONJENO: deleteOverlay / ikona smeća */}
                <Text style={tab.gridDate} numberOfLines={1}>
                  {new Date(item.createdAt).toLocaleDateString("hr-HR")}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}

      {/* PROMJENA: Media modal sada koristi isti pattern kao BoxTab/WishlistTab
          s gumbom "Obriši" u headeru */}
      <Modal
        visible={showMediaModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowMediaModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={styles.mediaModalHeader}>
            <TouchableOpacity
              onPress={() => setShowMediaModal(false)}
              style={{ minWidth: 60 }}
            >
              <Text
                style={{ color: "#c0c0c0", fontSize: 15, fontWeight: "600" }}
              >
                Zatvori
              </Text>
            </TouchableOpacity>
            <Text style={styles.mediaModalTitle} numberOfLines={1}>
              {selectedMedia?.title || "Pregled"}
            </Text>
            {/* PROMJENA: "Obriši" gumb desno sa alert potvrdom */}
            <TouchableOpacity
              onPress={() => {
                setShowMediaModal(false);
                if (selectedMedia) confirmDelete(selectedMedia);
              }}
              style={{ minWidth: 60, alignItems: "flex-end" }}
            >
              <Text
                style={{ color: "#C05050", fontSize: 15, fontWeight: "600" }}
              >
                Obriši
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mediaModalContent}>
            {selectedMedia?.type === "video" ? (
              <VideoView
                player={player}
                style={styles.mediaModalVideo}
                contentFit="contain"
                nativeControls={true}
              />
            ) : selectedMedia?.type === "image" ? (
              <Image
                source={{ uri: selectedMedia.url }}
                style={styles.mediaModalImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.mediaModalImage}>
                <Text style={{ color: "#c0c0c0" }}>Nepoznati medij</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ─── Box Tab ──────────────────────────────────────────────────────────────────
function BoxTab() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const tab = useMemo(() => makeTabStyles(V), [V]);
  const [items, setItems] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<BoxItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/api/savedvideo/my-saved`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setItems(await res.json());
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const removeFromBox = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    const userId = await AsyncStorage.getItem("userId");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/savedvideo/unsave?videoId=${videoId}&userId=${userId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        setItems((p) => p.filter((i) => i.videoId !== videoId));
        Alert.alert(t("common.success"), t("profile.removedFromBox"));
      }
    } catch {}
  };

  const handleRemove = (videoId: number, title: string) => {
    Alert.alert(
      t("profile.removeFromBox"),
      t("profile.removeFromBoxConfirm", { title }),
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Ukloni",
          style: "destructive",
          onPress: () => removeFromBox(videoId),
        },
      ],
    );
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color={V.visited} />;
  if (items.length === 0)
    return <EmptyTab icon="bookmark-outline" text={t("profile.boxEmpty")} />;

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id.toString()}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        renderItem={({ item }) => (
          // PROMJENA: uklonjena ikona smeća s desne strane liste
          <TouchableOpacity
            style={tab.listItem}
            onPress={() => setSelectedVideo(item)}
            activeOpacity={0.7}
          >
            <View style={tab.thumbContainer}>
              <View
                style={[
                  tab.thumb,
                  {
                    backgroundColor: V.forestMid,
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
              >
                <Ionicons name="videocam" size={30} color={V.visited} />
              </View>
              <View style={tab.playIcon}>
                <Ionicons name="play-circle" size={28} color={V.silverBright} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={tab.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={tab.itemMeta}>@{item.userName}</Text>
              <Text style={tab.itemDate}>
                {t("profile.savedOn")}{" "}
                {new Date(item.savedAt).toLocaleDateString("hr-HR")}
              </Text>
            </View>
            {/* UKLONJENO: ikona smeća (trash-outline) */}
          </TouchableOpacity>
        )}
      />
      {/* PROMJENA: VideoPreviewModal dobiva onDelete callback */}
      <VideoPreviewModal
        visible={selectedVideo !== null}
        videoUrl={
          selectedVideo?.filePath?.startsWith("http")
            ? selectedVideo.filePath
            : `${API_BASE_URL}${selectedVideo?.filePath || ""}`
        }
        title={selectedVideo?.title || ""}
        onClose={() => setSelectedVideo(null)}
        onDelete={
          selectedVideo
            ? () => handleRemove(selectedVideo.videoId, selectedVideo.title)
            : undefined
        }
      />
    </>
  );
}

// ─── Wishlist Tab ─────────────────────────────────────────────────────────────
function WishlistTab() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const tab = useMemo(() => makeTabStyles(V), [V]);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "yes" | "no">("all");
  const [selectedVideo, setSelectedVideo] = useState<WishlistItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(
          `${API_BASE_URL}/api/wishlistvideo/my-wishlist`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) setItems(await res.json());
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((i) => {
    if (filter === "yes") return i.isGoing === true;
    if (filter === "no") return i.isGoing === false;
    return true;
  });

  const removeFromWishlist = async (videoId: number) => {
    const token = await AsyncStorage.getItem("token");
    const userId = await AsyncStorage.getItem("userId");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/wishlistvideo/remove?userId=${userId}&videoId=${videoId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        setItems((p) => p.filter((i) => i.videoId !== videoId));
        Alert.alert(t("common.success"), t("profile.removedFromWishlist"));
      }
    } catch {}
  };

  const handleRemoveWishlist = (videoId: number, title: string) => {
    Alert.alert(
      t("profile.removeFromWishlist"),
      t("profile.removeFromWishlistConfirm", { title }),
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Obriši",
          style: "destructive",
          onPress: () => removeFromWishlist(videoId),
        },
      ],
    );
  };

  const toggleGoing = async (item: WishlistItem) => {
    const token = await AsyncStorage.getItem("token");
    const newVal =
      item.isGoing === true ? false : item.isGoing === false ? undefined : true;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/wishlistvideo/update/${item.videoId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isGoing: newVal }),
        },
      );
      if (res.ok)
        setItems((p) =>
          p.map((i) =>
            i.videoId === item.videoId ? { ...i, isGoing: newVal } : i,
          ),
        );
    } catch {}
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color={V.visited} />;

  return (
    <>
      <View style={{ flex: 1 }}>
        <View style={tab.filterRow}>
          {(["all", "yes", "no"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[tab.filterBtn, filter === f && tab.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  tab.filterBtnText,
                  filter === f && tab.filterBtnTextActive,
                ]}
              >
                {/* PROMJENA: uklonjen simbol "❌" kod "Nisam bio/la" filtra */}
                {f === "all"
                  ? t("common.all")
                  : f === "yes"
                    ? "✅ " + t("profile.visited")
                    : t("profile.notVisited")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {filtered.length === 0 ? (
          <View style={tab.empty}>
            <Text style={tab.emptyText}>{t("profile.wishlistEmpty")}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.videoId.toString()}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
            renderItem={({ item }) => (
              // PROMJENA: uklonjena ikona smeća s desne strane liste
              <TouchableOpacity
                style={tab.listItem}
                onPress={() => setSelectedVideo(item)}
                activeOpacity={0.7}
              >
                <View style={tab.thumbContainer}>
                  <View
                    style={[
                      tab.thumb,
                      {
                        backgroundColor: V.forestMid,
                        justifyContent: "center",
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Ionicons name="videocam" size={30} color={V.visited} />
                  </View>
                  <View style={tab.playIcon}>
                    <Ionicons
                      name="play-circle"
                      size={28}
                      color={V.silverBright}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={tab.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={tab.itemDate}>
                    {t("profile.addedOn")}{" "}
                    {new Date(item.addedAt).toLocaleDateString("hr-HR")}
                  </Text>
                  <TouchableOpacity onPress={() => toggleGoing(item)}>
                    <Text style={tab.goingBadge}>
                      {item.isGoing === true
                        ? "✅ " + t("profile.visited")
                        : item.isGoing === false
                          ? t("profile.notVisited")
                          : "⭕ " + t("profile.undecided")}
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* UKLONJENO: ikona smeća (trash-outline) */}
              </TouchableOpacity>
            )}
          />
        )}
      </View>
      {/* PROMJENA: VideoPreviewModal dobiva onDelete callback */}
      <VideoPreviewModal
        visible={selectedVideo !== null}
        videoUrl={
          selectedVideo?.filePath?.startsWith("http")
            ? selectedVideo.filePath
            : `${API_BASE_URL}${selectedVideo?.filePath || ""}`
        }
        title={selectedVideo?.title || ""}
        onClose={() => setSelectedVideo(null)}
        onDelete={
          selectedVideo
            ? () =>
                handleRemoveWishlist(selectedVideo.videoId, selectedVideo.title)
            : undefined
        }
      />
    </>
  );
}

// ─── Golden Friends Tab ───────────────────────────────────────────────────────
function GoldenFriendsTab() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const tab = useMemo(() => makeTabStyles(V), [V]);
  const [friends, setFriends] = useState<GoldenFriend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/api/golden-friends`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setFriends(
            data.map((f: any) => ({
              ...f,
              avatar: f.avatar ?? null,
            })),
          );
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const remove = async (userId: number) => {
    Alert.alert(t("profile.removeGolden"), t("profile.removeGoldenConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.remove"),
        style: "destructive",
        onPress: async () => {
          const token = await AsyncStorage.getItem("token");
          await fetch(`${API_BASE_URL}/api/golden-friends/remove/${userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          setFriends((p) => p.filter((f) => f.userId !== userId));
        },
      },
    ]);
  };

  if (loading)
    return <ActivityIndicator style={{ marginTop: 40 }} color={V.visited} />;
  if (friends.length === 0)
    return <EmptyTab icon="star-outline" text={t("profile.noGoldenFriends")} />;

  return (
    <FlatList
      data={friends}
      keyExtractor={(f) => f.userId.toString()}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
      renderItem={({ item }) => (
        <View style={tab.listItem}>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/profile/[userId]",
                params: { userId: item.userId.toString() },
              } as any)
            }
          >
            {(() => {
              const av = item.avatar;
              const initials =
                `${item.firstName?.[0] ?? ""}${item.lastName?.[0] ?? ""}`.toUpperCase();
              const PRESETS: Record<string, any> = {
                "avatar:male": require("../../assets/images/avatar-male.png"),
                "avatar:female": require("../../assets/images/avatar-female.png"),
              };
              if (av && PRESETS[av]) {
                return (
                  <Image
                    source={PRESETS[av]}
                    style={{ width: 50, height: 50, borderRadius: 25 }}
                    resizeMode="cover"
                  />
                );
              }
              if (av && !av.startsWith("avatar:")) {
                const url = av.startsWith("http")
                  ? av
                  : `${API_BASE_URL}${av.startsWith("/") ? "" : "/"}${av}`;
                return (
                  <Image
                    source={{
                      uri: `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`,
                    }}
                    style={{ width: 50, height: 50, borderRadius: 25 }}
                    resizeMode="cover"
                  />
                );
              }
              return (
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: V.forestMid,
                    borderWidth: 1.5,
                    borderColor: V.borderGreen,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: V.silverBright,
                      fontSize: 18,
                      fontWeight: "700",
                    }}
                  >
                    {initials || "?"}
                  </Text>
                </View>
              );
            })()}
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, marginLeft: 12 }}
            onPress={() =>
              router.push({
                pathname: "/profile/[userId]",
                params: { userId: item.userId.toString() },
              } as any)
            }
          >
            <Text style={tab.itemTitle}>
              {item.firstName} {item.lastName}
            </Text>
            <Text style={tab.itemMeta}>@{item.username}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[
                tab.removeBtn,
                {
                  backgroundColor: V.forestMid,
                  borderRadius: 8,
                  padding: 8,
                  borderWidth: 1,
                  borderColor: V.borderGreen,
                },
              ]}
              onPress={() =>
                router.push({
                  pathname: "/chat/[userId]",
                  params: {
                    userId: item.userId.toString(),
                    name: `${item.firstName} ${item.lastName}`,
                  },
                })
              }
            >
              <Ionicons
                name="paper-plane-outline"
                size={18}
                color={V.visited}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[tab.removeBtn, { padding: 8 }]}
              onPress={() => remove(item.userId)}
            >
              <Ionicons name="star" size={18} color={V.accentGold} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: ProfileData | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { isDark, setManualOverride } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const sm = useMemo(() => makeSmStyles(V), [V]);
  const { resetProfile } = useUser();
  const langStyles = useMemo(() => makeLangStyles(V), [V]);
  const themeStyles = useMemo(() => makeThemeStyles(V), [V]);

  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? true);
  const [showUsernameOnProfile, setShowUsernameOnProfile] = useState(
    profile?.showUsername ?? true,
  );
  const [screenLimit, setScreenLimit] = useState(
    profile?.screenTimeLimitMinutes ?? 0,
  );
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showActivityArchive, setShowActivityArchive] = useState(false);
  const [showAppProblemModal, setShowAppProblemModal] = useState(false);
  const [showMapProblemModal, setShowMapProblemModal] = useState(false);
  const [problemText, setProblemText] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || "hr");
  const [manualTheme, setManualTheme] = useState<"light" | "auto" | "dark">(
    "auto",
  );

  useEffect(() => {
    AsyncStorage.getItem("vara_theme_override").then((val) => {
      if (val === "light" || val === "dark" || val === "auto")
        setManualTheme(val as "light" | "auto" | "dark");
    });
  }, [visible]);

  const handleThemeChange = async (mode: "light" | "auto" | "dark") => {
    setManualTheme(mode);
    await setManualOverride(mode);
  };

  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  const getZone = (h: number) => {
    if (h >= 5 && h <= 6)
      return { label: "Svitanje", emoji: "🌅", scheme: "light" as const };
    if (h >= 7 && h <= 10)
      return { label: "Jutro", emoji: "🌤", scheme: "light" as const };
    if (h >= 11 && h <= 16)
      return { label: "Dan", emoji: "☀️", scheme: "light" as const };
    if (h >= 17 && h <= 19)
      return { label: "Večer", emoji: "🌇", scheme: "light" as const };
    if (h >= 20 && h <= 22)
      return { label: "Noć", emoji: "🌙", scheme: "dark" as const };
    return { label: "Duboka noć", emoji: "🌑", scheme: "dark" as const };
  };
  const {
    label: autoZoneLabel,
    emoji: autoZoneEmoji,
    scheme: autoScheme,
  } = getZone(currentHour);

  useEffect(() => {
    if (profile) {
      setIsPublic(profile.isPublic);
      setShowUsernameOnProfile(profile.showUsername ?? true);
      setScreenLimit(profile.screenTimeLimitMinutes ?? 0);
    }
  }, [profile]);

  const LANGUAGES = [
    { code: "hr", label: "Hrvatski", flag: "🇭🇷" },
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "de", label: "Deutsch", flag: "🇩🇪" },
    { code: "it", label: "Italiano", flag: "🇮🇹" },
    { code: "fr", label: "Français", flag: "🇫🇷" },
  ];

  const changeLanguage = async (langCode: string) => {
    await i18n.changeLanguage(langCode);
    setCurrentLang(langCode);
    await AsyncStorage.setItem("appLanguage", langCode);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/auth/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isPublic,
          showUsername: showUsernameOnProfile,
          screenTimeLimitMinutes: screenLimit,
        }),
      });
      if (res.ok) {
        await AsyncStorage.setItem("profileIsPublic", String(isPublic));
        await AsyncStorage.setItem(
          "profileShowUsername",
          String(showUsernameOnProfile),
        );
        Alert.alert(t("common.success"), t("profile.settingsSaved"));
        onSaved();
      }
    } catch {
      Alert.alert(t("common.error"), t("profile.settingsError"));
    } finally {
      setSaving(false);
    }
  };

  const handleScreenLimitSelect = (mins: number) => {
    if (mins === 0) {
      setScreenLimit(0);
      AsyncStorage.removeItem("screenTimeLimit");
      AsyncStorage.removeItem("screenTimeStart");
      return;
    }
    Alert.alert(
      t("profile.setLimit"),
      t("profile.screenTimeLimitConfirm", { minutes: mins }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.set"),
          onPress: async () => {
            setScreenLimit(mins);
            await AsyncStorage.setItem("screenTimeLimit", String(mins));
            await AsyncStorage.setItem("screenTimeStart", String(Date.now()));
            await AsyncStorage.removeItem("screenTimeLogoutDate");
          },
        },
      ],
    );
  };

  const loadBlocked = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/block/blocked-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBlockedUsers(await res.json());
    } catch {}
    setShowBlocked(true);
  };

  const unblockUser = async (userId: number) => {
    const token = await AsyncStorage.getItem("token");
    await fetch(`${API_BASE_URL}/api/block/unblock/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setBlockedUsers((p: any[]) => p.filter((u: any) => u.id !== userId));
  };

  const handleLogout = () => {
    Alert.alert(t("profile.logout"), t("profile.logoutConfirm"), [
      { text: "Odustani", style: "cancel" },
      {
        text: "Odjavi se",
        style: "destructive",
        onPress: async () => {
          resetProfile();
          await AsyncStorage.clear();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t("profile.deleteAccount"), t("profile.deleteAccountWarning"), [
      { text: "Odustani", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: async () => {
          const token = await AsyncStorage.getItem("token");
          await fetch(`${API_BASE_URL}/api/auth/delete-account`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          await AsyncStorage.clear();
          router.replace("/login");
        },
      },
    ]);
  };

  const sendReport = async (type: "app" | "map") => {
    if (!problemText.trim()) {
      Alert.alert("Greška", "Molimo opišite problem.");
      return;
    }
    setSendingReport(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/support/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          message: problemText.trim(),
          userName: `${profile?.firstName} ${profile?.lastName}`,
          userUsername: profile?.username,
        }),
      });
      if (res.ok) {
        setProblemText("");
        type === "app"
          ? setShowAppProblemModal(false)
          : setShowMapProblemModal(false);
        Alert.alert(
          "Hvala!",
          "Tvoja poruka je uspješno poslana adminu. Potrudit ćemo se odgovoriti što prije.",
        );
      } else {
        Alert.alert("Greška", "Slanje nije uspjelo. Pokušaj ponovno.");
      }
    } catch {
      Alert.alert("Greška", "Slanje nije uspjelo. Provjeri internetsku vezu.");
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: V.forestDeep }}>
        <View style={sm.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={V.silver} />
          </TouchableOpacity>
          <Text style={sm.title}>{t("profile.settings")}</Text>
          <TouchableOpacity onPress={saveSettings} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={V.visited} />
            ) : (
              <Text style={sm.saveBtn}>{t("common.save")}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          {/* ─── JEZIK ─────────────────────────────────────── */}
          <View style={[sm.section, { marginTop: 8 }]}>
            <Text style={sm.sectionTitle}>{t("profile.language")}</Text>
            <View style={langStyles.currentLang}>
              <Text style={langStyles.currentLangLabel}>
                {t("profile.currentLanguage")}
                <Text style={langStyles.currentLangValue}>
                  {LANGUAGES.find((l) => l.code === currentLang)?.flag}{" "}
                  {LANGUAGES.find((l) => l.code === currentLang)?.label}
                </Text>
              </Text>
            </View>
            <View style={langStyles.langGrid}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    langStyles.langBtn,
                    currentLang === lang.code && langStyles.langBtnActive,
                  ]}
                  onPress={() => changeLanguage(lang.code)}
                >
                  <Text style={langStyles.langFlag}>{lang.flag}</Text>
                  <Text
                    style={[
                      langStyles.langLabel,
                      currentLang === lang.code && langStyles.langLabelActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                  {currentLang === lang.code && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={V.visited}
                      style={{ position: "absolute", top: 6, right: 6 }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ─── TEMA ─────────────────────────────────────── */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>{t("profile.theme")}</Text>
            <View style={themeStyles.optionsRow}>
              {/* SVJETLA */}
              <TouchableOpacity
                style={[
                  themeStyles.themeCard,
                  themeStyles.themeCardLight,
                  manualTheme === "light" && themeStyles.themeCardActive,
                ]}
                onPress={() => handleThemeChange("light")}
                activeOpacity={0.8}
              >
                <View style={themeStyles.previewLight}>
                  <View style={themeStyles.previewBarLight} />
                  <View
                    style={[
                      themeStyles.previewBarLight,
                      { width: "60%", opacity: 0.5 },
                    ]}
                  />
                  <View style={themeStyles.previewCircleLight} />
                </View>
                <Text style={themeStyles.themeLabelLight}>☀️</Text>
                <Text style={themeStyles.themeTitleLight}>
                  {t("profile.themeLight")}
                </Text>
                {manualTheme === "light" && (
                  <View
                    style={[
                      themeStyles.checkDot,
                      { backgroundColor: "#e0c060" },
                    ]}
                  >
                    <Ionicons name="checkmark" size={12} color="#1a1a1a" />
                  </View>
                )}
              </TouchableOpacity>

              {/* AUTO */}
              <TouchableOpacity
                style={[
                  themeStyles.themeCard,
                  themeStyles.themeCardAuto,
                  manualTheme === "auto" && themeStyles.themeCardActiveAuto,
                ]}
                onPress={() => handleThemeChange("auto")}
                activeOpacity={0.8}
              >
                <View style={themeStyles.previewAuto}>
                  <View style={themeStyles.previewBarAuto} />
                  <View
                    style={[
                      themeStyles.previewBarAuto,
                      { width: "70%", opacity: 0.6 },
                    ]}
                  />
                  <View style={themeStyles.previewCircleAuto} />
                </View>
                <Text style={themeStyles.themeLabelAuto}>🕐</Text>
                <Text style={themeStyles.themeTitleAuto}>
                  {t("profile.themeAuto")}
                </Text>
                <Text style={themeStyles.themeSubAuto}>
                  {t("profile.themeAutoSub")}
                </Text>
                {manualTheme === "auto" && (
                  <View
                    style={[
                      themeStyles.checkDot,
                      { backgroundColor: V.visited },
                    ]}
                  >
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* TAMNA */}
              <TouchableOpacity
                style={[
                  themeStyles.themeCard,
                  themeStyles.themeCardDark,
                  manualTheme === "dark" && themeStyles.themeCardActiveDark,
                ]}
                onPress={() => handleThemeChange("dark")}
                activeOpacity={0.8}
              >
                <View style={themeStyles.previewDark}>
                  <View style={themeStyles.previewBarDark} />
                  <View
                    style={[
                      themeStyles.previewBarDark,
                      { width: "55%", opacity: 0.5 },
                    ]}
                  />
                  <View style={themeStyles.previewCircleDark} />
                </View>
                <Text style={themeStyles.themeLabelDark}>🌙</Text>
                <Text style={themeStyles.themeTitleDark}>
                  {t("profile.themeDark")}
                </Text>
                {manualTheme === "dark" && (
                  <View
                    style={[
                      themeStyles.checkDot,
                      { backgroundColor: "#7060c0" },
                    ]}
                  >
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {manualTheme === "auto" && (
              <View style={themeStyles.autoInfoRow}>
                <Text style={themeStyles.autoInfoEmoji}>{autoZoneEmoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={themeStyles.autoInfoTitle}>{autoZoneLabel}</Text>
                  <Text style={themeStyles.autoInfoSub}>
                    {currentHour}:{String(currentMinute).padStart(2, "0")} —
                    tema se automatski prilagođava
                  </Text>
                </View>
                <View
                  style={[
                    themeStyles.autoSchemeDot,
                    {
                      backgroundColor:
                        autoScheme === "dark" ? "#3a3060" : "#e8d880",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: autoScheme === "dark" ? "#c0b0ff" : "#6a5000",
                    }}
                  >
                    {autoScheme === "dark" ? "TAMNA" : "SVJETLA"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ─── PRIVATNOST ─────────────────────────────── */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>{t("profile.privacy")}</Text>
            <View style={sm.row}>
              <View style={{ flex: 1 }}>
                <Text style={sm.rowLabel}>{t("profile.publicProfile")}</Text>
                <Text style={sm.rowSub}>{t("profile.publicProfileDesc")}</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: V.visited, false: V.borderDim }}
                thumbColor={V.silverBright}
              />
            </View>
            <Text style={sm.currentValue}>
              {t("profile.currently")}:{" "}
              {isPublic
                ? t("profile.currentlyPublic")
                : t("profile.currentlyPrivate")}
            </Text>

            <View style={sm.row}>
              <View style={{ flex: 1 }}>
                <Text style={sm.rowLabel}>{t("profile.showUsername")}</Text>
                <Text style={sm.rowSub}>{t("profile.showUsernameDesc")}</Text>
              </View>
              <Switch
                value={showUsernameOnProfile}
                onValueChange={setShowUsernameOnProfile}
                trackColor={{ true: V.visited, false: V.borderDim }}
                thumbColor={V.silverBright}
              />
            </View>
            <Text style={sm.currentValue}>
              {t("profile.currently")}:{" "}
              {showUsernameOnProfile
                ? t("profile.visible")
                : t("profile.hidden")}
            </Text>
          </View>

          {/* ─── SCREEN TIME ──────────────────────────────── */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>{t("profile.timeManagement")}</Text>
            <Text style={sm.rowSub}>{t("profile.screenTimeLimit")}</Text>
            {screenLimit > 0 && (
              <View style={sm.activeLimit}>
                <Ionicons name="time-outline" size={16} color={V.visited} />
                <Text style={sm.activeLimitText}>
                  {t("profile.activeLimit", { minutes: screenLimit })}
                </Text>
              </View>
            )}
            <View style={sm.timeRow}>
              {[0, 30, 60, 90, 120, 180].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[sm.timeBtn, screenLimit === mins && sm.timeBtnActive]}
                  onPress={() => handleScreenLimitSelect(mins)}
                >
                  <Text
                    style={[
                      sm.timeBtnText,
                      screenLimit === mins && sm.timeBtnTextActive,
                    ]}
                  >
                    {mins === 0 ? t("profile.noLimitShort") : `${mins}min`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ─── BLOKIRANI KORISNICI ───────────────────────── */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>{t("profile.blockedUsers")}</Text>
            <TouchableOpacity style={sm.row} onPress={loadBlocked}>
              <Text style={sm.rowLabel}>{t("profile.blockedUsersList")}</Text>
              <Ionicons name="chevron-forward" size={20} color={V.silverDim} />
            </TouchableOpacity>
            {showBlocked && (
              <View style={{ marginTop: 8 }}>
                {blockedUsers.length === 0 ? (
                  <Text style={sm.rowSub}>{t("profile.noBlockedUsers")}</Text>
                ) : (
                  blockedUsers.map((u) => (
                    <View key={u.id} style={sm.blockedUser}>
                      <Text style={sm.rowLabel}>
                        {u.firstName} {u.lastName}
                      </Text>
                      <TouchableOpacity onPress={() => unblockUser(u.id)}>
                        <Text
                          style={{
                            color: V.visited,
                            fontSize: 13,
                            fontWeight: "600",
                          }}
                        >
                          {t("profile.unblock")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

          {/* ─── AKTIVNOSTI ───────────────────────────────── */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>{t("profile.activitiesTitle")}</Text>
            <TouchableOpacity
              style={sm.row}
              onPress={() => setShowActivityArchive(!showActivityArchive)}
            >
              <Text style={sm.rowLabel}>
                {t("profile.activityArchiveLabel")}
              </Text>
              <Ionicons
                name={showActivityArchive ? "chevron-up" : "chevron-down"}
                size={20}
                color={V.visited}
              />
            </TouchableOpacity>
            {showActivityArchive && (
              <View style={{ height: 600 }}>
                <ActivityArchive userId={profile?.id ?? null} />
              </View>
            )}
          </View>

          {/* ─── PODRŠKA ──────────────────────────────────── */}
          <View style={sm.section}>
            <Text style={sm.sectionTitle}>
              {<Text style={sm.sectionTitle}>{t("profile.support")}</Text>}
            </Text>

            {/* 1. Obrati se adminu putem maila */}
            <TouchableOpacity
              style={sm.varaBtn}
              onPress={() => {
                const email = "adminvaraapp@gmail.com";
                const subject = encodeURIComponent("Upit - Vara aplikacija");
                const body = encodeURIComponent(
                  `Pozdrav,\n\nPišem u vezi...\n\nKorisnik: ${profile?.firstName} ${profile?.lastName} (@${profile?.username})`,
                );
                import("react-native").then(({ Linking }) => {
                  Linking.openURL(
                    `mailto:${email}?subject=${subject}&body=${body}`,
                  ).catch(() =>
                    Alert.alert(
                      "Greška",
                      "Nije moguće otvoriti mail aplikaciju.",
                    ),
                  );
                });
              }}
            >
              <View style={sm.varaBtnIcon}>
                <Ionicons name="mail-outline" size={18} color={V.silverDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sm.varaBtnText}>{t("profile.contactAdmin")}</Text>
                <Text style={[sm.rowSub, { marginTop: 0 }]}>
                  admin@gmail.com
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={V.silverDim} />
            </TouchableOpacity>

            {/* 2. Prijavi problem s aplikacijom */}
            <TouchableOpacity
              style={sm.varaBtn}
              onPress={() => setShowAppProblemModal(true)}
            >
              <View style={sm.varaBtnIcon}>
                <Ionicons name="bug-outline" size={18} color={V.silverDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sm.varaBtnText}>
                  {t("profile.reportAppIssue")}
                </Text>
                <Text style={[sm.rowSub, { marginTop: 0 }]}>
                  {t("profile.reportAppIssueSub")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={V.silverDim} />
            </TouchableOpacity>

            {/* 3. Prijavi problem s kartom */}
            <TouchableOpacity
              style={sm.varaBtn}
              onPress={() => setShowMapProblemModal(true)}
            >
              <View style={sm.varaBtnIcon}>
                <Ionicons name="map-outline" size={18} color={V.silverDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sm.varaBtnText}>
                  {t("profile.reportMapIssue")}
                </Text>
                <Text style={[sm.rowSub, { marginTop: 0 }]}>
                  {t("profile.reportMapIssueSub")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={V.silverDim} />
            </TouchableOpacity>
          </View>

          {/* ─── OPASNA ZONA ──────────────────────────────── */}
          <View style={sm.section}>
            <View style={sm.dangerHeader}>
              <View style={sm.dangerHeaderLine} />
              <Text style={sm.dangerHeaderText}>{t("profile.dangerZone")}</Text>
              <View style={sm.dangerHeaderLine} />
            </View>
            <Text style={sm.dangerDesc}>
              {t("") ?? "Ove radnje su nepovratne"}
            </Text>

            <TouchableOpacity style={sm.varaBtn} onPress={handleLogout}>
              <View style={sm.varaBtnIcon}>
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color={V.silverDim}
                />
              </View>
              <Text style={sm.varaBtnText}>{t("profile.logoutBtn")}</Text>
              <Ionicons name="chevron-forward" size={16} color={V.silverDim} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[sm.varaBtn, sm.varaBtnDestructive]}
              onPress={handleDeleteAccount}
            >
              <View style={[sm.varaBtnIcon, sm.varaBtnIconDestructive]}>
                <Ionicons name="trash-outline" size={18} color={V.accentGold} />
              </View>
              <Text style={sm.varaBtnTextDestructive}>
                {t("profile.deleteAccountBtn")}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={V.accentGold} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
      {/* ─── Modal za prijavu problema ─────────────────── */}
      {(["app", "map"] as const).map((type) => (
        <Modal
          key={type}
          visible={type === "app" ? showAppProblemModal : showMapProblemModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setProblemText("");
            type === "app"
              ? setShowAppProblemModal(false)
              : setShowMapProblemModal(false);
          }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: V.overlay,
            }}
          >
            <View
              style={{
                width: "88%",
                backgroundColor: V.forestDeep,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: V.borderGreen,
                padding: 24,
              }}
            >
              {/* Naslov */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name={type === "app" ? "bug-outline" : "map-outline"}
                  size={22}
                  color={V.visited}
                />
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "700",
                    color: V.silverBright,
                    flex: 1,
                  }}
                >
                  {type === "app"
                    ? t("profile.appProblemTitle")
                    : t("profile.mapProblemTitle")}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setProblemText("");
                    type === "app"
                      ? setShowAppProblemModal(false)
                      : setShowMapProblemModal(false);
                  }}
                >
                  <Ionicons name="close" size={22} color={V.silverDim} />
                </TouchableOpacity>
              </View>

              <Text
                style={{ fontSize: 13, color: V.silverDim, marginBottom: 16 }}
              >
                {type === "app"
                  ? t("profile.appProblemDesc")
                  : t("profile.mapProblemDesc")}
              </Text>

              {/* Tekstualno polje */}
              <View
                style={{
                  backgroundColor: V.forestMid,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: V.borderDim,
                  marginBottom: 16,
                }}
              >
                <TextInput
                  value={problemText}
                  onChangeText={setProblemText}
                  placeholder={
                    type === "app"
                      ? t("profile.appProblemPlaceholder")
                      : t("profile.mapProblemPlaceholder")
                  }
                  placeholderTextColor={V.silverDim}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  style={{
                    padding: 12,
                    fontSize: 14,
                    color: V.silverBright,
                    minHeight: 110,
                  }}
                  maxLength={500}
                />
                <Text
                  style={{
                    fontSize: 11,
                    color: V.silverDim,
                    textAlign: "right",
                    paddingRight: 10,
                    paddingBottom: 6,
                  }}
                >
                  {problemText.length}/500
                </Text>
              </View>

              {/* Gumbi */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setProblemText("");
                    type === "app"
                      ? setShowAppProblemModal(false)
                      : setShowMapProblemModal(false);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: V.borderDim,
                    backgroundColor: V.forestMid,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: V.silverDim,
                      fontWeight: "600",
                      fontSize: 15,
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => sendReport(type)}
                  disabled={sendingReport || !problemText.trim()}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: problemText.trim()
                      ? V.visited
                      : V.forestMid,
                    borderWidth: 1,
                    borderColor: problemText.trim()
                      ? V.borderGreen
                      : V.borderDim,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {sendingReport ? (
                    <ActivityIndicator size="small" color={V.silverBright} />
                  ) : (
                    <Text
                      style={{
                        color: V.silverBright,
                        fontWeight: "600",
                        fontSize: 15,
                      }}
                    >
                      {t("common.send")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ))}
    </Modal>
  );
}

// ─── Session Tracking ─────────────────────────────────────────────────────────
const trackSessionTime = async (minutes: number) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    await fetch(`${API_BASE_URL}/api/activity/track/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ minutes }),
    });
  } catch {}
};

// ─── Main Profile Screen ──────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { refreshProfile } = useUser();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const V = useMemo(() => getVara(isDark), [isDark]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("me");
  const [showSettings, setShowSettings] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  useEffect(() => {
    let sessionStart = Date.now();
    let isTracking = false;
    const trackCurrentSession = async () => {
      if (isTracking) return;
      isTracking = true;
      const minutes = Math.floor((Date.now() - sessionStart) / (1000 * 60));
      if (minutes > 0) await trackSessionTime(minutes);
      isTracking = false;
    };
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (nextAppState === "background" || nextAppState === "inactive") {
          await trackCurrentSession();
        } else if (nextAppState === "active") {
          sessionStart = Date.now();
        }
      },
    );
    return () => {
      subscription.remove();
      const finalMinutes = Math.floor(
        (Date.now() - sessionStart) / (1000 * 60),
      );
      if (finalMinutes > 0) trackSessionTime(finalMinutes);
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/my-profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setProfile(await res.json());
          setLoading(false);
          return;
        }
      } catch {}
      const [first, last, userId] = await Promise.all([
        AsyncStorage.getItem("firstName"),
        AsyncStorage.getItem("lastName"),
        AsyncStorage.getItem("userId"),
      ]);
      const cachedIsPublic = await AsyncStorage.getItem("profileIsPublic");
      const cachedShowUsername = await AsyncStorage.getItem(
        "profileShowUsername",
      );
      setProfile({
        id: parseInt(userId ?? "0"),
        firstName: first ?? "",
        lastName: last ?? "",
        username: first?.toLowerCase() ?? "",
        followersCount: 0,
        followingCount: 0,
        isPublic: cachedIsPublic !== null ? cachedIsPublic === "true" : true,
        showUsername:
          cachedShowUsername !== null ? cachedShowUsername === "true" : true,
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshProfile();
    }, [load, refreshProfile]),
  );

  useEffect(() => {
    (async () => {
      const logoutDate = await AsyncStorage.getItem("screenTimeLogoutDate");
      if (logoutDate === new Date().toDateString()) {
        Alert.alert(
          t("profile.screenTimeLimitReached"),
          t("profile.screenTimeLimitReachedDesc"),
          [
            {
              text: "OK",
              onPress: async () => {
                await AsyncStorage.removeItem("token");
                router.replace("/login");
              },
            },
          ],
        );
      }
    })();
  }, []);

  const TABS = [
    { key: "me", label: t("profile.my"), icon: "person-outline" },
    { key: "box", label: t("profile.box"), icon: "bookmark-outline" },
    { key: "wishlist", label: t("profile.wishlist"), icon: "star-outline" },
    { key: "golden", label: t("profile.golden"), icon: "star" },
  ];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: V.forestDeep }]}>
        <ActivityIndicator size="large" color={V.visited} />
      </View>
    );
  }

  const displayUsername =
    profile?.showUsername !== false ? `@${profile?.username}` : null;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: V.forestDeep }]}
      edges={["top"]}
    >
      <View style={[styles.container, { backgroundColor: V.forestDeep }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: V.borderGreen, backgroundColor: V.forestDeep },
          ]}
        >
          <Text style={[styles.headerTitle, { color: V.silverBright }]}>
            {t("profile.profileHeader")}
          </Text>
          <TouchableOpacity
            style={[
              styles.settingsBtn,
              { backgroundColor: V.forestMid, borderColor: V.borderGreen },
            ]}
            onPress={() => setShowSettings(true)}
          >
            <Ionicons name="settings-outline" size={22} color={V.silver} />
          </TouchableOpacity>
        </View>

        <ScreenTimeCountdown />

        {/* Profile Info */}
        <View
          style={[
            styles.profileSection,
            { borderBottomColor: V.borderDim, backgroundColor: V.forestDeep },
          ]}
        >
          <AvatarSection onUpdate={load} />
          <Text style={[styles.name, { color: V.silverBright }]}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          {displayUsername && (
            <Text style={[styles.usernameText, { color: V.visited }]}>
              {displayUsername}
            </Text>
          )}
          <View
            style={[
              styles.privacyBadge,
              { backgroundColor: V.forestMid, borderColor: V.borderDim },
            ]}
          >
            <Ionicons
              name={profile?.isPublic ? "globe-outline" : "lock-closed-outline"}
              size={12}
              color={V.visited}
            />
            <Text style={[styles.privacyText, { color: V.visited }]}>
              {profile?.isPublic
                ? t("profile.publicProfileLabel")
                : t("profile.privateProfileLabel")}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.stat}
              onPress={() => setShowFollowers(true)}
            >
              <Text style={[styles.statNum, { color: V.silverBright }]}>
                {profile?.followersCount ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: V.silverDim }]}>
                {t("profile.followers")}
              </Text>
            </TouchableOpacity>
            <View
              style={[styles.statDivider, { backgroundColor: V.borderDim }]}
            />
            <TouchableOpacity
              style={styles.stat}
              onPress={() => setShowFollowing(true)}
            >
              <Text style={[styles.statNum, { color: V.silverBright }]}>
                {profile?.followingCount ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: V.silverDim }]}>
                {t("profile.following")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Bar */}
        <View
          style={[
            styles.tabBar,
            { borderBottomColor: V.borderGreen, backgroundColor: V.forestDeep },
          ]}
        >
          {TABS.map((t_) => (
            <TouchableOpacity
              key={t_.key}
              style={[
                styles.tabBtn,
                activeTab === t_.key && { borderBottomColor: V.visited },
              ]}
              onPress={() => setActiveTab(t_.key as Tab)}
            >
              <Ionicons
                name={t_.icon as any}
                size={18}
                color={activeTab === t_.key ? V.visited : V.silverDim}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: V.silverDim },
                  activeTab === t_.key && {
                    color: V.visited,
                    fontWeight: "600",
                  },
                ]}
              >
                {t_.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={{ flex: 1 }}>
          {activeTab === "me" && <MeTab userId={profile?.id ?? null} />}
          {activeTab === "box" && <BoxTab />}
          {activeTab === "wishlist" && <WishlistTab />}
          {activeTab === "golden" && <GoldenFriendsTab />}
        </View>
      </View>

      <SettingsModal
        visible={showSettings}
        profile={profile}
        onClose={() => setShowSettings(false)}
        onSaved={() => {
          setShowSettings(false);
          load();
        }}
      />
      <FollowListModal
        visible={showFollowers}
        type="followers"
        userId={profile?.id ?? null}
        onClose={() => setShowFollowers(false)}
        onUpdate={load}
      />
      <FollowListModal
        visible={showFollowing}
        type="following"
        userId={profile?.id ?? null}
        onClose={() => setShowFollowing(false)}
        onUpdate={load}
      />
    </SafeAreaView>
  );
}

// ─── Statični stilovi (layout-only, bez boja) ─────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1.5,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  name: { fontSize: 22, fontWeight: "700", marginBottom: 2 },
  usernameText: { fontSize: 15, marginBottom: 6 },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  },
  privacyText: { fontSize: 12, fontWeight: "500" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 32 },
  stat: { alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "700" },
  statLabel: { fontSize: 13, marginTop: 2 },
  statDivider: { width: 1, height: 36 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1.5 },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnText: { fontSize: 11 },
  mediaModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  mediaModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#c0c0c0",
    flex: 1,
    marginHorizontal: 12,
    textAlign: "center",
  },
  mediaModalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  mediaModalVideo: { width: "100%", height: "100%" },
  mediaModalImage: { width: "100%", height: "100%" },
});
