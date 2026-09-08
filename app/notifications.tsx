// app/notifications.tsx — centar obavijesti
//
// Ekran je dosad bio prazna ploha s natpisom "Nema novih obavijesti", jer
// obavijesti nisu ni postojale. Sada prikazuje stvarne obavijesti s
// poslužitelja i dopušta korisniku da si sam kreira obavijest (podsjetnik),
// po želji i s kopijom na e-mail.

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../components/AdaptiveThemeProvider";
import CloseButton from "../components/CloseButton";
import {
  AppNotification,
  EMPTY_PREFS,
  NotificationPrefs,
  createNotification,
  deleteAllNotifications,
  deleteNotification,
  getNotificationPrefs,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../utils/notificationsApi";
import { placeCategories } from "./services/locationService";

const PAGE_SIZE = 30;

function getColors(isDark: boolean) {
  return {
    bg: isDark ? "#1a2e1a" : "#f0ede4",
    card: isDark ? "#2a4230" : "#e4ead8",
    cardUnread: isDark ? "#33513a" : "#dcead0",
    border: isDark ? "#4a7040" : "#5a8a40",
    borderDim: isDark ? "#3a5a30" : "#c0d0a8",
    text: isDark ? "#e8e8e8" : "#1a2a18",
    textSub: isDark ? "#c0c0c0" : "#3a4a35",
    textDim: isDark ? "#a0a0a0" : "#5a6a55",
    accent: isDark ? "#5a8a48" : "#3a6a28",
    danger: isDark ? "#d9736b" : "#a13029",
    inputBg: isDark ? "#22381f" : "#ffffff",
    placeholder: isDark ? "#8a8a8a" : "#7a8a75",
  } as const;
}

/** "prije 5 min", "prije 2 h", pa datum — kratko i bez vanjske biblioteke. */
function useRelativeTime() {
  const { t } = useTranslation();

  return useCallback(
    (iso: string) => {
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return "";

      const diffMin = Math.floor((Date.now() - then) / 60000);
      if (diffMin < 1) return t("notif.justNow");
      if (diffMin < 60) return t("notif.minutesAgo", { count: diffMin });

      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return t("notif.hoursAgo", { count: diffH });

      const diffD = Math.floor(diffH / 24);
      if (diffD < 7) return t("notif.daysAgo", { count: diffD });

      return new Date(then).toLocaleDateString();
    },
    [t],
  );
}

// ─── Modal za kreiranje obavijesti ────────────────────────────────────────────

function CreateNotificationModal({
  visible,
  onClose,
  onCreated,
  emailEnabled,
  C,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (n: AppNotification) => void;
  emailEnabled: boolean;
  C: ReturnType<typeof getColors>;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState("general");
  const [sendEmail, setSendEmail] = useState(emailEnabled);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle("");
    setBody("");
    setPlaceName("");
    setCategory("general");
    setSendEmail(emailEnabled);
    setScheduledAt(null);
    setPickerMode(null);
  }, [visible, emailEnabled]);

  const categories = useMemo(
    () => [
      { id: "general", label: t("notif.categoryGeneral") },
      ...Object.keys(placeCategories).map((id) => ({
        id,
        label: t(`categories.${id}`, { defaultValue: id }),
      })),
    ],
    [t],
  );

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert(t("common.error"), t("notif.needTitle"));
      return;
    }

    setSaving(true);
    try {
      const created = await createNotification({
        title: title.trim(),
        body: body.trim() || undefined,
        placeName: placeName.trim() || undefined,
        category,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
        sendEmail,
      });
      onCreated(created);
      onClose();
      Alert.alert(t("common.success"), t("notif.created"));
    } catch {
      Alert.alert(t("common.error"), t("notif.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[s.header, { borderBottomColor: C.border }]}>
            <CloseButton onPress={onClose} color={C.textDim} />
            <Text
              style={[
                s.headerTitle,
                { color: C.text, flex: 1, textAlign: "center" },
              ]}
              numberOfLines={1}
            >
              {t("notif.createTitle")}
            </Text>
            {/* Praznina iste širine kao gumb — naslov ostaje u sredini. */}
            <View style={{ width: 78 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[s.hint, { color: C.textDim }]}>
              {t("notif.createHint")}
            </Text>

            <Text style={[s.label, { color: C.textSub }]}>
              {t("notif.fieldTitle")}
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  backgroundColor: C.inputBg,
                  borderColor: C.border,
                  color: C.text,
                },
              ]}
              placeholder={t("notif.fieldTitlePlaceholder")}
              placeholderTextColor={C.placeholder}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />

            <Text style={[s.label, { color: C.textSub }]}>
              {t("notif.fieldBody")}
            </Text>
            <TextInput
              style={[
                s.input,
                s.inputMultiline,
                {
                  backgroundColor: C.inputBg,
                  borderColor: C.border,
                  color: C.text,
                },
              ]}
              placeholder={t("notif.fieldBodyPlaceholder")}
              placeholderTextColor={C.placeholder}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
            />

            <Text style={[s.label, { color: C.textSub }]}>
              {t("notif.fieldPlace")}
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  backgroundColor: C.inputBg,
                  borderColor: C.border,
                  color: C.text,
                },
              ]}
              placeholder={t("notif.fieldPlacePlaceholder")}
              placeholderTextColor={C.placeholder}
              value={placeName}
              onChangeText={setPlaceName}
              maxLength={200}
            />

            <Text style={[s.label, { color: C.textSub }]}>
              {t("notif.fieldCategory")}
            </Text>
            <View style={s.chipWrap}>
              {categories.map((c) => {
                const on = category === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCategory(c.id)}
                    style={[
                      s.chip,
                      {
                        backgroundColor: on ? C.accent : C.card,
                        borderColor: on ? C.accent : C.borderDim,
                      },
                    ]}
                  >
                    <Text
                      style={[s.chipText, { color: on ? "#fff" : C.textSub }]}
                      numberOfLines={1}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[s.label, { color: C.textSub }]}>
              {t("notif.fieldWhen")}
            </Text>
            <View style={s.whenRow}>
              <TouchableOpacity
                style={[
                  s.whenBtn,
                  { backgroundColor: C.card, borderColor: C.borderDim },
                ]}
                onPress={() => setPickerMode("date")}
              >
                <Text style={[s.whenText, { color: C.text }]} numberOfLines={1}>
                  {scheduledAt
                    ? `${scheduledAt.toLocaleDateString()} ${scheduledAt.toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}`
                    : t("notif.whenNotSet")}
                </Text>
              </TouchableOpacity>
              {scheduledAt && (
                <TouchableOpacity
                  onPress={() => setScheduledAt(null)}
                  style={s.whenClear}
                >
                  <Text style={[s.whenClearText, { color: C.danger }]}>
                    {t("common.clear")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {pickerMode && (
              <DateTimePicker
                value={scheduledAt ?? new Date()}
                mode={pickerMode}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={pickerMode === "date" ? new Date() : undefined}
                onChange={(event, picked) => {
                  // Android pokazuje datum i vrijeme u dva odvojena koraka —
                  // nakon datuma odmah otvaramo odabir sata.
                  if (event.type === "dismissed" || !picked) {
                    setPickerMode(null);
                    return;
                  }
                  if (pickerMode === "date") {
                    const base = scheduledAt ?? new Date();
                    const next = new Date(picked);
                    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
                    setScheduledAt(next);
                    setPickerMode("time");
                  } else {
                    const next = new Date(scheduledAt ?? picked);
                    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                    setScheduledAt(next);
                    setPickerMode(null);
                  }
                }}
              />
            )}

            <View
              style={[
                s.switchRow,
                { backgroundColor: C.card, borderColor: C.borderDim },
              ]}
            >
              <Text style={[s.switchLabel, { color: C.text }]}>
                {t("notif.sendEmailCopy")}
              </Text>
              <Switch
                value={sendEmail}
                onValueChange={setSendEmail}
                trackColor={{ true: "#5a8a48", false: "#3a5a30" }}
                thumbColor={sendEmail ? "#34c759" : "#888"}
              />
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: C.accent }]}
              onPress={submit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>{t("common.save")}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Ekran ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const C = useMemo(() => getColors(isDark), [isDark]);
  const relativeTime = useRelativeTime();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>(EMPTY_PREFS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        // Postavke se dohvaćaju uz popis jer o njima ovisi i poruka koju
        // pokazujemo kad je popis prazan.
        const [list, serverPrefs] = await Promise.all([
          getNotifications(1, PAGE_SIZE),
          getNotificationPrefs().catch(() => EMPTY_PREFS),
        ]);
        setItems(list);
        setPrefs(serverPrefs);
      } catch {
        if (!silent) Alert.alert(t("common.error"), t("notif.loadFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = items.filter((n) => !n.isRead).length;

  const onOpen = async (n: AppNotification) => {
    if (n.isRead) return;
    // Optimistično — poziv koji padne se ionako ispravi na sljedeće
    // osvježavanje popisa.
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
    );
    try {
      await markNotificationRead(n.id, true);
    } catch {}
  };

  const onMarkAllRead = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      load(true);
    }
  };

  const onDelete = async (id: number) => {
    const previous = items;
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      await deleteNotification(id);
    } catch {
      setItems(previous);
    }
  };

  const onDeleteAll = () => {
    Alert.alert(t("notif.deleteAll"), t("notif.deleteAllConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const previous = items;
          setItems([]);
          try {
            await deleteAllNotifications();
          } catch {
            setItems(previous);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const categoryLabel =
      item.category === "general"
        ? t("notif.categoryGeneral")
        : t(`categories.${item.category}`, { defaultValue: item.category });

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onOpen(item)}
        style={[
          s.item,
          {
            backgroundColor: item.isRead ? C.card : C.cardUnread,
            borderColor: item.isRead ? C.borderDim : C.border,
          },
        ]}
      >
        <View style={s.itemTopRow}>
          <View style={[s.badge, { borderColor: C.border }]}>
            <Text style={[s.badgeText, { color: C.textSub }]} numberOfLines={1}>
              {item.source === "user"
                ? t("notif.sourceReminder")
                : categoryLabel}
            </Text>
          </View>
          {!item.isRead && (
            <View style={[s.dot, { backgroundColor: C.accent }]} />
          )}
          <View style={{ flex: 1 }} />
          <Text style={[s.time, { color: C.textDim }]}>
            {relativeTime(item.createdAt)}
          </Text>
        </View>

        <Text style={[s.itemTitle, { color: C.text }]}>{item.title}</Text>

        {!!item.body && (
          <Text style={[s.itemBody, { color: C.textSub }]}>{item.body}</Text>
        )}

        {!!item.placeName && (
          <Text style={[s.itemMeta, { color: C.textDim }]} numberOfLines={1}>
            📍 {item.placeName}
          </Text>
        )}

        {item.emailSent && (
          <Text style={[s.itemMeta, { color: C.textDim }]}>
            ✉️ {t("notif.emailSent")}
          </Text>
        )}

        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          style={s.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel={t("notif.deleteOne")}
        >
          <Text style={[s.deleteText, { color: C.danger }]}>
            {t("common.delete")}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: C.bg }]} edges={["top"]}>
      <View style={[s.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: C.text }]} numberOfLines={1}>
            {t("notif.title")}
          </Text>
          {unreadCount > 0 && (
            <Text style={[s.headerSub, { color: C.textDim }]}>
              {t("notif.unreadCount", { count: unreadCount })}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={[s.newBtn, { backgroundColor: C.accent }]}
        >
          <Text style={s.newBtnText} numberOfLines={1}>
            {t("notif.create")}
          </Text>
        </TouchableOpacity>
      </View>

      {items.length > 0 && (
        <View style={[s.toolbar, { borderBottomColor: C.borderDim }]}>
          <TouchableOpacity
            onPress={onMarkAllRead}
            disabled={unreadCount === 0}
          >
            <Text
              style={[
                s.toolbarText,
                { color: unreadCount === 0 ? C.textDim : C.accent },
              ]}
            >
              {t("notif.markAllRead")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDeleteAll}>
            <Text style={[s.toolbarText, { color: C.danger }]}>
              {t("notif.deleteAll")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => `notif_${n.id}`}
          renderItem={renderItem}
          contentContainerStyle={
            items.length === 0
              ? { flexGrow: 1, justifyContent: "center", padding: 24 }
              : { padding: 16, paddingBottom: 40 }
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={C.accent}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: C.text }]}>
                {t("notif.empty")}
              </Text>
              <Text style={[s.emptyBody, { color: C.textDim }]}>
                {prefs.appEnabled
                  ? t("notif.emptyHint")
                  : t("notif.appOffHint")}
              </Text>
            </View>
          }
        />
      )}

      <CreateNotificationModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(n) => setItems((prev) => [n, ...prev])}
        emailEnabled={prefs.emailEnabled}
        C={C}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
  },
  backBtn: { padding: 2 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerSub: { fontSize: 12, marginTop: 2 },
  newBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    maxWidth: 160,
  },
  newBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolbarText: { fontSize: 13, fontWeight: "600" },

  item: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  itemTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 160,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  time: { fontSize: 11 },
  itemTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  itemBody: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  itemMeta: { fontSize: 12, marginTop: 6 },
  deleteBtn: { alignSelf: "flex-end", marginTop: 8, paddingVertical: 2 },
  deleteText: { fontSize: 13, fontWeight: "600" },

  empty: { alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },

  hint: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 12 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: "top" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  whenRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  whenBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  whenText: { fontSize: 15, fontWeight: "600" },
  whenClear: { paddingVertical: 8, paddingHorizontal: 4 },
  whenClearText: { fontSize: 13, fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 20,
  },
  switchLabel: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 12 },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
