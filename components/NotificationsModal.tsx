import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_BASE_URL } from "@/app/config/api";
import { CloseButton } from "./CloseButton";
import { useTheme } from "./AdaptiveThemeProvider";
import {
  AppNotification,
  NotifiedPost,
  deleteNotification,
  getNotifiedPost,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/utils/notificationsApi";

function colors(isDark: boolean) {
  return {
    bg: isDark ? "#1a2e1a" : "#f0ede4",
    card: isDark ? "#2a4230" : "#e4ead8",
    unread: isDark ? "#33513a" : "#dbe8cc",
    border: isDark ? "#3a5a30" : "#c0d0a8",
    text: isDark ? "#e8e8e8" : "#1a2a18",
    textSub: isDark ? "#c0c0c0" : "#3a4a35",
    textDim: isDark ? "#a0a0a0" : "#5a6a55",
    accent: isDark ? "#7FB069" : "#3a6a28",
  } as const;
}

/** "prije 5 min" / "prije 2 h" / datum — bez vanjske biblioteke. */
function relativeTime(iso: string, t: (k: string, o?: any) => string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return t("notifications.justNow");
  if (minutes < 60) return t("notifications.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("notifications.hoursAgo", { count: hours });
  const days = Math.round(hours / 24);
  if (days <= 7) return t("notifications.daysAgo", { count: days });
  return new Date(then).toLocaleDateString();
}

/** Puna adresa datoteke — poslužitelj vraća čas apsolutnu, čas relativnu. */
function mediaUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Isti oblik kao na objavi u videima: "20.09.2026. - 12:00". */
function eventWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}. - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Objava iza obavijesti.
 *
 * Obavijest sama nosi tek naslov i mjesto. Dosad se na dodir samo označila
 * pročitanom, pa je jedini način da se vidi O ČEMU je riječ bio ručno
 * pretražiti feed. Ovdje se dohvati sama objava i pokaže isto što i u
 * videima: slika ili video, autor, naslov, lokacija, datum događaja i opis
 * (koji već sadrži kategorije i "primjereno za").
 */
function NotificationDetail({
  videoId,
  onClose,
}: {
  videoId: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const C = colors(isDark);

  const [post, setPost] = useState<NotifiedPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (videoId === null) {
      setPost(null);
      setFailed(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setFailed(false);
    getNotifiedPost(videoId)
      .then((data) => {
        if (!alive) return;
        if (data) setPost(data);
        else setFailed(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [videoId]);

  const url = post ? mediaUrl(post.filePath) : "";
  // Nastavak datoteke odlučuje, ne media_type: starije objave znaju biti
  // zapisane kao "video" iako su slike.
  const isImage =
    !!post &&
    (post.mediaType === "image" ||
      [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"].some((ext) =>
        (post.filePath || "").toLowerCase().split("?")[0].endsWith(ext),
      ));

  const player = useVideoPlayer(!isImage && url ? url : null, (p) => {
    p.loop = true;
  });

  const author =
    post?.userName ||
    `${post?.userFirstName ?? ""} ${post?.userLastName ?? ""}`.trim();

  return (
    <Modal
      visible={videoId !== null}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", color: C.text }}>
            {t("notifications.detailTitle")}
          </Text>
          <CloseButton onPress={onClose} tone={isDark ? "light" : "muted"} />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />
        ) : failed || !post ? (
          <View style={{ alignItems: "center", marginTop: 60, padding: 24 }}>
            <Ionicons name="image-outline" size={44} color={C.border} />
            <Text
              style={{
                color: C.textSub,
                fontSize: 15,
                fontWeight: "600",
                marginTop: 12,
                textAlign: "center",
              }}
            >
              {t("notifications.postGone")}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <View
              style={{
                width: "100%",
                aspectRatio: 1,
                backgroundColor: "#000",
              }}
            >
              {isImage ? (
                <Image
                  source={{ uri: url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              ) : (
                <VideoView
                  player={player}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                  nativeControls
                />
              )}
            </View>

            <View style={{ padding: 16, gap: 8 }}>
              {!!author && (
                <Text
                  style={{ color: C.accent, fontSize: 14, fontWeight: "700" }}
                >
                  {author}
                </Text>
              )}
              <Text style={{ color: C.text, fontSize: 19, fontWeight: "800" }}>
                {post.title}
              </Text>

              {!!post.location && (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons
                    name="location-outline"
                    size={15}
                    color={C.textDim}
                  />
                  <Text style={{ color: C.textSub, fontSize: 14, flex: 1 }}>
                    {post.location}
                  </Text>
                </View>
              )}

              {post.isEvent && post.eventStartAt && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    alignSelf: "flex-start",
                    backgroundColor: C.unread,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Ionicons name="calendar" size={14} color={C.text} />
                  <Text
                    style={{ color: C.text, fontSize: 14, fontWeight: "700" }}
                  >
                    {t("post.eventStarts", {
                      when: eventWhen(post.eventStartAt),
                    })}
                  </Text>
                </View>
              )}

              {!!post.additionalDescription && (
                <Text
                  style={{ color: C.textSub, fontSize: 14, lineHeight: 21 }}
                >
                  {post.additionalDescription}
                </Text>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

export function NotificationsModal({
  visible,
  onClose,
  onUnreadChange,
  onOpenSettings,
}: {
  visible: boolean;
  onClose: () => void;
  /** Javlja ekranu koliko je nepročitanih ostalo, da značka bude točna. */
  onUnreadChange?: (count: number) => void;
  /**
   * Otvara postavke obavijesti. Postavke su prije bile zasebna stavka
   * izbornika na karti, pa su popis i njegove postavke izgledali kao dvije
   * nepovezane stvari; sad su jedna, a postavke su korak dublje.
   */
  onOpenSettings?: () => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const C = colors(isDark);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Razlika između "nema obavijesti" i "nisam ih uspio dohvatiti". Bez toga
  // srušen upit na poslužitelju izgleda isto kao prazan popis.
  const [loadFailed, setLoadFailed] = useState(false);
  // Objava koju obavijest otvara; null dok nijedna nije otvorena.
  const [openVideoId, setOpenVideoId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const data = await getNotifications(50, 0);
    if (data === null) {
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    setItems(data);
    onUnreadChange?.(data.filter((n) => !n.isRead).length);
  }, [onUnreadChange]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [visible, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markOne = async (n: AppNotification) => {
    if (n.isRead) return;
    // Prikaz se mijenja odmah; ako poziv ne uspije, sljedeće osvježavanje
    // vratit će pravo stanje.
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
    );
    onUnreadChange?.(items.filter((x) => !x.isRead && x.id !== n.id).length);
    await markNotificationRead(n.id);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    onUnreadChange?.(0);
    await markAllNotificationsRead();
  };

  const remove = async (id: number) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    await deleteNotification(id);
  };

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.text }}>
            {t("notifications.title")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {onOpenSettings && (
              <TouchableOpacity
                onPress={onOpenSettings}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t("map.notifSettings")}
              >
                <Ionicons name="settings-outline" size={22} color={C.text} />
              </TouchableOpacity>
            )}
            <CloseButton onPress={onClose} tone={isDark ? "light" : "muted"} />
          </View>
        </View>

        {unread > 0 && (
          <TouchableOpacity
            onPress={markAll}
            style={{ paddingHorizontal: 16, paddingVertical: 10 }}
          >
            <Text style={{ color: C.accent, fontWeight: "700", fontSize: 14 }}>
              {t("notifications.markAllRead")}
            </Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(n) => String(n.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={C.accent}
              />
            }
            ListEmptyComponent={
              <View
                style={{
                  alignItems: "center",
                  marginTop: 60,
                  paddingHorizontal: 24,
                }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={44}
                  color={C.border}
                />
                <Text
                  style={{
                    color: C.textSub,
                    fontSize: 15,
                    fontWeight: "600",
                    marginTop: 12,
                    textAlign: "center",
                  }}
                >
                  {loadFailed
                    ? t("notifications.loadFailedTitle")
                    : t("notifications.emptyTitle")}
                </Text>
                <Text
                  style={{
                    color: C.textDim,
                    fontSize: 13,
                    marginTop: 6,
                    textAlign: "center",
                    lineHeight: 19,
                  }}
                >
                  {loadFailed
                    ? t("notifications.loadFailedHint")
                    : t("notifications.emptyHint")}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  markOne(item);
                  // Obavijest o praćenju nema objavu — tada dodir samo
                  // označi pročitanim, bez praznog prozora.
                  if (item.videoId) setOpenVideoId(item.videoId);
                }}
                style={{
                  backgroundColor: item.isRead ? C.card : C.unread,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: C.border,
                  padding: 14,
                  marginBottom: 10,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                {/* Redni broj umjesto gole točkice: govori i koliko ih je
                    i gdje si u popisu, a nepročitane i dalje ističe bojom. */}
                <View
                  style={{
                    minWidth: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: item.isRead ? C.card : C.accent,
                    borderWidth: 1,
                    borderColor: item.isRead ? C.border : C.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 5,
                    marginTop: 1,
                  }}
                >
                  <Text
                    style={{
                      color: item.isRead ? C.textDim : "#fff",
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: C.text,
                      fontSize: 15,
                      fontWeight: item.isRead ? "600" : "800",
                    }}
                  >
                    {item.title}
                  </Text>
                  {!!item.body && (
                    <Text
                      style={{ color: C.textSub, fontSize: 13, marginTop: 3 }}
                    >
                      {item.body}
                    </Text>
                  )}
                  <Text
                    style={{ color: C.textDim, fontSize: 12, marginTop: 6 }}
                  >
                    {[
                      item.actorName,
                      item.category
                        ? t(`categories.${item.category}`, {
                            defaultValue: item.category,
                          })
                        : null,
                      relativeTime(item.createdAt, t),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => remove(item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.delete")}
                >
                  <Ionicons name="trash-outline" size={18} color={C.textDim} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
        <NotificationDetail
          videoId={openVideoId}
          onClose={() => setOpenVideoId(null)}
        />
      </SafeAreaView>
    </Modal>
  );
}
