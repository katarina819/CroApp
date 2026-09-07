import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CloseButton } from "./CloseButton";
import { useTheme } from "./AdaptiveThemeProvider";
import {
  AppNotification,
  deleteNotification,
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

export function NotificationsModal({
  visible,
  onClose,
  onUnreadChange,
}: {
  visible: boolean;
  onClose: () => void;
  /** Javlja ekranu koliko je nepročitanih ostalo, da značka bude točna. */
  onUnreadChange?: (count: number) => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const C = colors(isDark);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getNotifications(50, 0);
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
          <CloseButton onPress={onClose} tone={isDark ? "light" : "muted"} />
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
                  {t("notifications.emptyTitle")}
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
                  {t("notifications.emptyHint")}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => markOne(item)}
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
                {!item.isRead && (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: C.accent,
                      marginTop: 6,
                    }}
                  />
                )}
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
                >
                  <Ionicons name="trash-outline" size={18} color={C.textDim} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
