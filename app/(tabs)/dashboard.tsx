// app/(tabs)/dashboard.tsx  ─  v5
// Promjene:
//   1. Brza lokacija — Balanced accuracy → zatim High u pozadini
//   2. Network error za profil — tiho ignorira, ne crasha app
//   3. Limit od 10 rezultata po kategoriji + "Prikaži više" gumb
//   4. Strogi filteri dolaze iz locationService.ts (v5)
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker, Region } from "react-native-maps";
import { API_BASE_URL } from "../config/api";
import {
  clearPlacesCache,
  geocodeCity,
  getPlacesInRadius,
  Place,
  placeCategories,
  searchPlaces,
} from "../services/locationService";

// ─── helpers ─────────────────────────────────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  ms = 7000,
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(id);
    return r;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}
function haversineKm(a1: number, o1: number, a2: number, o2: number) {
  const R = 6371,
    dA = ((a2 - a1) * Math.PI) / 180,
    dO = ((o2 - o1) * Math.PI) / 180;
  const a =
    Math.sin(dA / 2) ** 2 +
    Math.cos((a1 * Math.PI) / 180) *
      Math.cos((a2 * Math.PI) / 180) *
      Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const { width: SW, height: SH } = Dimensions.get("window");
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const STORAGE_REVIEWS = "cromap_reviews_v4";
const STORAGE_HIDDEN = "cromap_hidden_v4";
const STORAGE_BADGES = "cromap_badges_v4";
const STORAGE_GROUPS = "cromap_groups_v4";
const STORAGE_NOTIFS = "cromap_notif_prefs_v4";

// Početni limit rezultata na karti
const INITIAL_RESULTS_LIMIT = 10;

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlaceReview {
  placeId: string;
  stars: number;
  comment: string;
  wantToReturn: boolean;
  reviewedAt: string;
}
interface VisitRecord {
  id: string;
  placeId: string;
  placeName: string;
  placeType: string;
  latitude: number;
  longitude: number;
  address?: string;
  visitedAt: string;
}
interface Badge {
  category: string;
  level: number;
  earnedAt: string;
}
interface ActivityGroup {
  id: string;
  creatorName: string;
  activity: string;
  description: string;
  latitude: number;
  longitude: number;
  locationName: string;
  maxPeople: number;
  members: string[];
  messages: { name: string; text: string; time: string }[];
  createdAt: string;
}
interface NotifPrefs {
  appEnabled: boolean;
  emailEnabled: boolean;
  email: string;
  categories: string[];
}

// ─── Category meta ────────────────────────────────────────────────────────────
const EMOJIS: Record<string, string> = {
  restaurant: "🍽️",
  cafe: "☕",
  club: "🎵",
  beach: "🏖️",
  landmark: "🏰",
  opg: "🌾",
  accommodation: "🏨",
  market: "🛒",
  paintball: "🎯",
  cinema: "🎬",
  park: "🌳",
  escapeRoom: "🔐",
  museum: "🏛️",
  theater: "🎭",
  mountain: "⛰️",
  nationalPark: "🏞️",
  cave: "🕳️",
  spa: "💧",
};

const BADGE_T = [10, 20, 30, 40, 50];
const BADGE_NAMES: Record<string, Record<number, string>> = {
  restaurant: {
    10: "Gurman I",
    20: "Gurman II",
    30: "Gurman III",
    40: "Gurman IV",
    50: "Gurman V",
  },
  cafe: {
    10: "Kafomanijak I",
    20: "Kafomanijak II",
    30: "Kafomanijak III",
    40: "Kafomanijak IV",
    50: "Kafomanijak V",
  },
  accommodation: {
    10: "Putnik I",
    20: "Putnik II",
    30: "Putnik III",
    40: "Putnik IV",
    50: "Putnik V",
  },
  market: {
    10: "Tržničar I",
    20: "Tržničar II",
    30: "Tržničar III",
    40: "Tržničar IV",
    50: "Tržničar V",
  },
  opg: {
    10: "Seljak I",
    20: "Seljak II",
    30: "Seljak III",
    40: "Seljak IV",
    50: "Seljak V",
  },
};

// ─── Storage helpers ──────────────────────────────────────────────────────────
const loadJSON = async <T,>(key: string, def: T) => {
  try {
    const r = await AsyncStorage.getItem(key);
    return r ? JSON.parse(r) : def;
  } catch {
    return def;
  }
};
const saveJSON = async (key: string, val: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  } catch {}
};

// ─── Google Places Details ────────────────────────────────────────────────────
interface PlaceDetails {
  photos: string[];
  openingHours: string | null;
  rating?: number;
  phone?: string;
}
async function fetchGoogleDetails(
  name: string,
  lat: number,
  lng: number,
): Promise<PlaceDetails | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const findRes = await fetchWithTimeout(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name)}&inputtype=textquery&locationbias=circle:500@${lat},${lng}&fields=place_id&key=${GOOGLE_KEY}`,
    );
    if (!findRes.ok) return null;
    const findData = await findRes.json();
    if (findData.status !== "OK") return null;
    const placeId = findData.candidates?.[0]?.place_id;
    if (!placeId) return null;
    const detRes = await fetchWithTimeout(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=opening_hours,photos,rating,formatted_phone_number&key=${GOOGLE_KEY}`,
    );
    if (!detRes.ok) return null;
    const det = await detRes.json();
    if (det.status !== "OK") return null;
    const r = det.result;
    const photos = (r.photos || [])
      .slice(0, 3)
      .map(
        (p: any) =>
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${GOOGLE_KEY}`,
      );
    let openingHours: string | null = null;
    if (r.opening_hours?.weekday_text?.length)
      openingHours = r.opening_hours.weekday_text.join("\n");
    else if (r.opening_hours?.open_now !== undefined)
      openingHours = r.opening_hours.open_now
        ? "Trenutno otvoreno"
        : "Trenutno zatvoreno";
    return {
      photos,
      openingHours,
      rating: r.rating,
      phone: r.formatted_phone_number,
    };
  } catch {
    return null;
  }
}

// ─── Backend: visits ─────────────────────────────────────────────────────────
async function backendAddVisit(v: VisitRecord) {
  try {
    const t = await AsyncStorage.getItem("token");
    if (!t) return false;
    const r = await fetch(`${API_BASE_URL}/api/visits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify(v),
    });
    return r.ok;
  } catch {
    return false;
  }
}
async function backendGetVisits(): Promise<VisitRecord[]> {
  try {
    const t = await AsyncStorage.getItem("token");
    if (!t) return [];
    const r = await fetch(`${API_BASE_URL}/api/visits`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    // Tiho ignorira network grešku — vraća prazan niz
    return [];
  }
}
async function backendDeleteVisit(id: string) {
  try {
    const t = await AsyncStorage.getItem("token");
    if (!t) return false;
    const r = await fetch(`${API_BASE_URL}/api/visits/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ─── badge helpers ────────────────────────────────────────────────────────────
async function checkBadges(
  placeType: string,
  visits: VisitRecord[],
): Promise<Badge[]> {
  const badges = await loadJSON<Badge[]>(STORAGE_BADGES, []);
  const count = visits.filter((v) => v.placeType === placeType).length;
  const newB: Badge[] = [];
  for (const t of BADGE_T) {
    if (
      count >= t &&
      !badges.find((b: Badge) => b.category === placeType && b.level === t)
    ) {
      const nb = {
        category: placeType,
        level: t,
        earnedAt: new Date().toISOString(),
      };
      badges.push(nb);
      newB.push(nb);
    }
  }
  if (newB.length) await saveJSON(STORAGE_BADGES, badges);
  return newB;
}

// ══════════════════════════════════════════════════════════════════════════════
// MARKER COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function UserLocationMarker() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.4,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <View
      style={{
        width: 56,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: "rgba(102,126,234,0.22)",
          transform: [{ scale: pulse }],
        }}
      />
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "#667eea",
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 3,
          borderColor: "#fff",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 4,
          elevation: 6,
        }}
      >
        <Text style={{ fontSize: 20 }}>🧑</Text>
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 7,
  },
  emoji: { fontSize: 22 },
  pin: {
    width: 5,
    height: 12,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    marginTop: -2,
  },
});

function PlaceMarker({
  place,
  onPress,
  isVisited = false,
}: {
  place: Place;
  onPress: () => void;
  isVisited?: boolean;
}) {
  const cat = placeCategories[place.type as keyof typeof placeCategories];
  const color = cat?.color || "#667eea";
  const emoji = EMOJIS[place.type] || "📍";
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isVisited) {
      pulse.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.5,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isVisited]);

  return (
    <Marker
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      onPress={onPress}
      tracksViewChanges={isVisited}
    >
      <View style={{ alignItems: "center", width: 56, height: 64 }}>
        {/* Vibrirajući prsten za posjećena mjesta — na istom markeru */}
        {isVisited && (
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              width: 52,
              height: 52,
              borderRadius: 26,
              borderWidth: 2.5,
              borderColor: "#34c759",
              transform: [{ scale: pulse }],
              opacity: 0.8,
            }}
          />
        )}
        <View style={[ms.circle, { backgroundColor: color }]}>
          <Text style={ms.emoji}>{emoji}</Text>
        </View>
        {/* Zelena kvačica badge za posjećena */}
        {isVisited && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: 0,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "#34c759",
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 2,
              borderColor: "#fff",
              elevation: 8,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>
              ✓
            </Text>
          </View>
        )}
        <View style={[ms.pin, { backgroundColor: color }]} />
      </View>
    </Marker>
  );
}

// PLACE DETAIL MODAL
// ══════════════════════════════════════════════════════════════════════════════

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity key={s} onPress={() => onChange(s)}>
          <Text
            style={{ fontSize: 28, color: s <= value ? "#ff9500" : "#ddd" }}
          >
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PlaceDetailModal({
  place,
  visible,
  onClose,
  onMarkVisited,
  onHidePlace,
  isVisited,
  notifPrefs,
  onToggleNotif,
}: {
  place: Place | null;
  visible: boolean;
  onClose: () => void;
  onMarkVisited: (p: Place) => void;
  onHidePlace: (id: string) => void;
  isVisited: boolean;
  notifPrefs: NotifPrefs;
  onToggleNotif: (catId: string) => void;
}) {
  const { t } = useTranslation();
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [wantReturn, setWantReturn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!place || !visible) {
      setDetails(null);
      setPhotoIdx(0);
      setStars(0);
      setComment("");
      setWantReturn(false);
      setSaved(false);
      return;
    }
    setLoading(true);
    fetchGoogleDetails(place.name, place.latitude, place.longitude).then(
      (d) => {
        setDetails(d);
        setLoading(false);
      },
    );
    loadJSON<PlaceReview[]>(STORAGE_REVIEWS, []).then((reviews) => {
      const r = reviews.find((x: PlaceReview) => x.placeId === place.id);
      if (r) {
        setStars(r.stars);
        setComment(r.comment);
        setWantReturn(r.wantToReturn);
        setSaved(true);
      }
    });
  }, [place, visible]);

  if (!place) return null;
  const cat = placeCategories[place.type as keyof typeof placeCategories];
  const color = cat?.color || "#667eea";
  const emoji = EMOJIS[place.type] || "📍";
  const photos = details?.photos || [];
  const isNotified = notifPrefs.categories.includes(place.type);

  const handleSave = async () => {
    if (stars === 0) {
      Alert.alert(t("map.noReview"), t("map.ratingRequired"));
      return;
    }
    setSaving(true);
    const reviews = await loadJSON<PlaceReview[]>(STORAGE_REVIEWS, []);
    const idx = reviews.findIndex((x: PlaceReview) => x.placeId === place.id);
    const rev = {
      placeId: place.id,
      stars,
      comment: comment.trim(),
      wantToReturn: wantReturn,
      reviewedAt: new Date().toISOString(),
    };
    if (idx >= 0) reviews[idx] = rev;
    else reviews.push(rev);
    await saveJSON(STORAGE_REVIEWS, reviews);
    setSaving(false);
    setSaved(true);
    Alert.alert("✅", t("map.reviewSaved"));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={dm.overlay}>
          <View style={dm.sheet}>
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={dm.imageBox}>
                {loading ? (
                  <View style={[dm.imgPh, { backgroundColor: color + "22" }]}>
                    <ActivityIndicator color={color} size="large" />
                    <Text style={{ color: "#999", marginTop: 8, fontSize: 13 }}>
                      {t("common.loading")}
                    </Text>
                  </View>
                ) : photos[photoIdx] ? (
                  <Image
                    source={{ uri: photos[photoIdx] }}
                    style={dm.img}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[dm.imgPh, { backgroundColor: color + "22" }]}>
                    <Text style={{ fontSize: 72 }}>{emoji}</Text>
                  </View>
                )}
                {photos.length > 1 && (
                  <View style={dm.dots}>
                    {photos.map((_, i) => (
                      <TouchableOpacity key={i} onPress={() => setPhotoIdx(i)}>
                        <View style={[dm.dot, i === photoIdx && dm.dotA]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity style={dm.closeBtn} onPress={onClose}>
                  <Text
                    style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={dm.hideBtn}
                  onPress={() =>
                    Alert.alert(
                      t("map.hidePlace"),
                      t("map.hidePlaceConfirm", { name: place.name }),
                      [
                        { text: t("common.cancel"), style: "cancel" },
                        {
                          text: "Ukloni 🚫",
                          style: "destructive",
                          onPress: () => {
                            onHidePlace(place.id);
                            onClose();
                          },
                        },
                      ],
                    )
                  }
                >
                  <Text style={{ fontSize: 18 }}>🚫</Text>
                </TouchableOpacity>
              </View>

              <View style={dm.body}>
                <View style={[dm.badge, { backgroundColor: color }]}>
                  <Text style={dm.badgeTxt}>
                    {emoji}{" "}
                    {t(`categories.${place.type}`, {
                      defaultValue: place.type,
                    })}
                  </Text>
                </View>
                <Text style={dm.name}>{place.name}</Text>
                {place.address ? (
                  <Text style={dm.meta}>📍 {place.address}</Text>
                ) : null}
                {place.distance !== undefined ? (
                  <Text style={dm.meta}>
                    📏 {place.distance.toFixed(2)} km od vas
                  </Text>
                ) : null}
                {details?.rating || place.rating ? (
                  <Text style={dm.rating}>
                    ⭐ {(details?.rating || place.rating)?.toFixed(1)} / 5
                  </Text>
                ) : null}
                {details?.phone ? (
                  <Text style={dm.meta}>📞 {details.phone}</Text>
                ) : null}

                <View style={dm.hoursBox}>
                  <Text style={dm.hoursTitle}>🕐 {t("map.openingHours")}</Text>
                  {loading ? (
                    <ActivityIndicator size="small" color={color} />
                  ) : details?.openingHours ? (
                    <Text style={dm.hoursText}>{details.openingHours}</Text>
                  ) : (
                    <Text style={{ color: "#999", fontSize: 12 }}>
                      {t("map.notAvailable")}
                    </Text>
                  )}
                </View>

                <View style={dm.notifRow}>
                  <Text style={dm.notifLabel}>
                    🔔{" "}
                    {t("map.notifications", {
                      category: t(`categories.${place.type}`, {
                        defaultValue: place.type,
                      }),
                    })}
                  </Text>
                  <Switch
                    value={isNotified}
                    onValueChange={() => onToggleNotif(place.type)}
                    trackColor={{ true: "#667eea", false: "#ccc" }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={dm.reviewBox}>
                  <Text style={dm.reviewTitle}>✍️ {t("map.noReview")}</Text>
                  <StarRating value={stars} onChange={setStars} />
                  <TextInput
                    ref={commentInputRef}
                    style={dm.commentInput}
                    placeholder="Ostavite komentar..."
                    placeholderTextColor="#bbb"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    maxLength={300}
                    onFocus={() => {
                      // Scroll dolje kad se tipkovnica otvori
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 350);
                    }}
                  />
                  <TouchableOpacity
                    style={[dm.returnToggle, wantReturn && dm.returnA]}
                    onPress={() => setWantReturn((v) => !v)}
                  >
                    <Text style={dm.returnTxt}>
                      {wantReturn ? "✅ " : "⬜ "}
                      {t("map.wantToReturn")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[dm.reviewBtn, { backgroundColor: color }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={dm.reviewBtnTxt}>
                        {saved ? t("map.updateReview") : t("map.saveReview")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {!isVisited ? (
                  <TouchableOpacity
                    style={[dm.visitBtn, { backgroundColor: color }]}
                    onPress={() => {
                      onMarkVisited(place);
                      onClose();
                    }}
                  >
                    <Text style={dm.visitBtnTxt}>
                      ✅ {t("map.markVisited")}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={dm.visitedBadge}>
                    <Text
                      style={{
                        color: "#34c759",
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      ✓ {t("map.visited")}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const dm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SH * 0.92,
  },
  imageBox: { position: "relative" },
  imgPh: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  img: { width: "100%", height: 220 },
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotA: { backgroundColor: "#fff" },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  hideBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  body: { padding: 20, paddingBottom: 36 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  name: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 6 },
  meta: { fontSize: 14, color: "#666", marginBottom: 4 },
  rating: { fontSize: 15, color: "#ff9500", marginBottom: 8 },
  hoursBox: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  hoursTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  hoursText: { fontSize: 13, color: "#555", lineHeight: 20 },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0f0ff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  notifLabel: { fontSize: 14, color: "#333", fontWeight: "600", flex: 1 },
  reviewBox: {
    backgroundColor: "#fafafa",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  reviewTitle: { fontSize: 15, fontWeight: "700", color: "#333" },
  commentInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#333",
    minHeight: 80,
    textAlignVertical: "top",
  },
  returnToggle: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#f0f0f0",
    alignSelf: "flex-start",
  },
  returnA: { backgroundColor: "#e8f5e9" },
  returnTxt: { fontSize: 14, color: "#333", fontWeight: "600" },
  reviewBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  reviewBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  visitBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  visitBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  visitedBadge: {
    backgroundColor: "#e8f5e9",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#34c759",
  },
});

// ─── Notification Settings Modal ──────────────────────────────────────────────
function NotificationSettingsModal({
  visible,
  prefs,
  onClose,
  onSave,
}: {
  visible: boolean;
  prefs: NotifPrefs;
  onClose: () => void;
  onSave: (p: NotifPrefs) => void;
  getAllCategories: () => {
    id: string;
    name: string;
    icon: string;
    color: string;
  }[];
}) {
  const { t } = useTranslation();
  const getAllCategories = useCallback(() => {
    return Object.entries(placeCategories).map(([id, c]) => ({
      id,
      name: t(`categories.${id}`, { defaultValue: id }),
      icon: EMOJIS[id] || "📍",
      color: c.color,
    }));
  }, [t]);
  const [p, setP] = useState<NotifPrefs>(prefs);
  useEffect(() => {
    setP(prefs);
  }, [visible, prefs]);
  const toggle = (cat: string) =>
    setP((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: SH * 0.9,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: "#eee",
            }}
          >
            <Text style={{ fontSize: 19, fontWeight: "800" }}>
              🔔 {t("map.notifSettings")}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                style={{ fontSize: 16, color: "#667eea", fontWeight: "600" }}
              >
                {t("common.close")}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700" }}>
                {t("map.appNotifications")}
              </Text>
              <Switch
                value={p.appEnabled}
                onValueChange={(v) => setP((x) => ({ ...x, appEnabled: v }))}
                trackColor={{ true: "#667eea", false: "#ccc" }}
                thumbColor="#fff"
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700" }}>
                {t("map.emailNotifications")}
              </Text>
              <Switch
                value={p.emailEnabled}
                onValueChange={(v) => setP((x) => ({ ...x, emailEnabled: v }))}
                trackColor={{ true: "#667eea", false: "#ccc" }}
                thumbColor="#fff"
              />
            </View>
            {p.emailEnabled && (
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: "#e0e0e0",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 14,
                  color: "#333",
                  marginBottom: 16,
                }}
                placeholder={t("auth.emailPlaceholder")}
                placeholderTextColor="#bbb"
                value={p.email}
                onChangeText={(v) => setP((x) => ({ ...x, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                marginBottom: 12,
                marginTop: 8,
              }}
            >
              {t("profile.notifications")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {getAllCategories().map((cat) => {
                const on = p.categories.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: on ? cat.color : "#f0f0f0",
                    }}
                    onPress={() => toggle(cat.id)}
                  >
                    <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: on ? "#fff" : "#555",
                      }}
                    >
                      {cat.name}{" "}
                      {/* cat.name ovdje postoji jer getAllCategories vraća object s name property */}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: "#667eea",
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 24,
              }}
              onPress={() => {
                onSave(p);
                onClose();
                Alert.alert(
                  t("profile.savedSuccess"),
                  t("profile.updateSettingsSuccess"),
                );
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {t("common.save")}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const ACTIVITY_TEMPLATES = [
  { label: "☕ Kava", value: "cafe" },
  { label: "🍽️ Ručak/Večera", value: "restaurant" },
  { label: "🎵 Noćni izlazak", value: "club" },
  { label: "🏖️ Plaža", value: "beach" },
  { label: "🎬 Kino", value: "cinema" },
  { label: "🌳 Šetnja", value: "park" },
  { label: "🔐 Escape Room", value: "escapeRoom" },
  { label: "🎯 Paintball", value: "paintball" },
  { label: "⛰️ Planinarenje", value: "mountain" },
  { label: "💧 Toplice", value: "spa" },
];

export function ActivityGroupsModal({
  visible,
  onClose,
  userLocation,
}: {
  visible: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
}) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ActivityGroup | null>(
    null,
  );
  const [myName, setMyName] = useState("");
  const [chatMsg, setChatMsg] = useState("");
  const flatRef = useRef<FlatList>(null);
  const [showDMCompose, setShowDMCompose] = useState(false);
  const [dmTarget, setDmTarget] = useState<{
    name: string;
    userId: number | null;
  }>({
    name: "",
    userId: null,
  });
  const [dmMessage, setDmMessage] = useState("");
  const [sendingDM, setSendingDM] = useState(false);
  const [newGroup, setNewGroup] = useState({
    activity: "",
    description: "",
    locationName: "",
    maxPeople: "5",
    category: "cafe",
  });

  useEffect(() => {
    if (visible) {
      loadGroups();
      loadMyName();
    }
  }, [visible]);

  // Reset inner state when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedGroup(null);
      setShowCreate(false);
      setChatMsg("");
    }
  }, [visible]);

  const loadMyName = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        // Pokušaj dohvatiti ime sa servera
        const res = await fetch(`${API_BASE_URL}/api/auth/my-profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const profile = await res.json();
          setMyName(`${profile.firstName} ${profile.lastName}`.trim());
          return;
        }
      }
    } catch (error) {
      console.log("Error fetching profile for group name:", error);
    }

    // Fallback na AsyncStorage
    const f = await AsyncStorage.getItem("firstName");
    const l = await AsyncStorage.getItem("lastName");
    setMyName(`${f || ""} ${l || ""}`.trim() || "Korisnik");
  };

  const loadGroups = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/api/activity-groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        console.log("Raw API response:", JSON.stringify(data, null, 2));
        if (Array.isArray(data)) {
          const formattedGroups = data
            .filter((group: any) => group != null)
            .map((group: any) => ({
              id: group.id || Math.random().toString(),
              creatorName: group.creatorName || "",
              activity: group.activity || "",
              description: group.description || "",
              latitude: group.latitude || 45.815,
              longitude: group.longitude || 15.9819,
              locationName: group.locationName || "",
              maxPeople: group.maxPeople || 5,
              members: Array.isArray(group.members) ? group.members : [],
              messages: Array.isArray(group.messages) ? group.messages : [],
              createdAt: group.createdAt || new Date().toISOString(),
            }));
          setGroups(formattedGroups);
        } else {
          setGroups([]);
        }
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.log("Error loading groups:", error);
      const data = await loadJSON<ActivityGroup[]>(STORAGE_GROUPS, []);
      const active = (Array.isArray(data) ? data : []).filter(
        (g: ActivityGroup) =>
          Date.now() - new Date(g.createdAt).getTime() < 48 * 60 * 60 * 1000,
      );
      setGroups(active);
    }
  };

  // ============================================================
  // 2. createGroup - kreiranje grupe na serveru
  // ============================================================
  const createGroup = async () => {
    if (!newGroup.activity.trim() || !newGroup.locationName.trim()) {
      Alert.alert(t("common.error"), t("map.searchPlaceholder"));
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert(t("common.error"), t("auth.notLoggedIn"));
        return;
      }

      const requestBody = {
        creatorName: myName,
        activity: newGroup.activity.trim(),
        description: newGroup.description.trim(),
        latitude: userLocation?.latitude || 45.815,
        longitude: userLocation?.longitude || 15.9819,
        locationName: newGroup.locationName.trim(),
        maxPeople: Math.max(2, parseInt(newGroup.maxPeople) || 5),
      };

      const res = await fetch(`${API_BASE_URL}/api/activity-groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const newGroupData = await res.json();
        // Transformiraj podatke u frontend format
        const formattedGroup = {
          id: newGroupData.group?.id || newGroupData.id,
          creatorName: myName,
          activity: newGroup.activity.trim(),
          description: newGroup.description.trim(),
          latitude: userLocation?.latitude || 45.815,
          longitude: userLocation?.longitude || 15.9819,
          locationName: newGroup.locationName.trim(),
          maxPeople: Math.max(2, parseInt(newGroup.maxPeople) || 5),
          members: [myName],
          messages: [
            {
              name: "Sustav",
              text: `Grupa kreirana od ${myName}`,
              time: new Date().toLocaleTimeString("hr-HR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ],
          createdAt: new Date().toISOString(),
        };

        setGroups((prev) => [formattedGroup, ...prev]);
        setSelectedGroup(formattedGroup);
        setShowCreate(false);

        // Reset forme
        setNewGroup({
          activity: "",
          description: "",
          locationName: "",
          maxPeople: "5",
          category: "cafe",
        });
      } else {
        const error = await res.text();
        Alert.alert(t("common.error"), t("groups.createFailed"));
      }
    } catch (error) {
      console.error("Error creating group:", error);
      Alert.alert(t("common.error"), t("groups.createFailed"));
    }
  };

  // ============================================================
  // 3. joinGroup - pridruživanje grupi na serveru
  // ============================================================
  const joinGroup = async (groupId: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert(t("common.error"), t("auth.notLoggedIn"));
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/api/activity-groups/${groupId}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userName: myName }),
        },
      );

      if (res.ok) {
        // Osvježi grupe
        await loadGroups();
        Alert.alert(t("common.success"), t("common.ok"));
      } else {
        const error = await res.json();
        Alert.alert("Greška", error.error || "Nije moguće pridružiti se grupi");
      }
    } catch (error) {
      console.error("Error joining group:", error);
      Alert.alert(t("common.error"), t("map.locationError"));
    }
  };

  // 4. leaveGroup - napuštanje grupe na serveru
  // ============================================================
  const leaveGroup = async (groupId: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Greška", "Niste prijavljeni");
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/api/activity-groups/${groupId}/leave?userName=${encodeURIComponent(myName)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.ok) {
        await loadGroups();
        setSelectedGroup(null);
        Alert.alert(t("common.success"), t("groups.leaveSuccess"));
      } else {
        const error = await res.json();
        Alert.alert("Greška", error.error || "Nije moguće napustiti grupu");
      }
    } catch (error) {
      console.error("Error leaving group:", error);
      Alert.alert("Greška", "Nije moguće napustiti grupu");
    }
  };

  // ============================================================
  // 5. sendGroupMessage - slanje poruke na server
  // ============================================================
  const sendGroupMessage = async (groupId: string) => {
    if (!chatMsg.trim()) return;

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await fetch(
        `${API_BASE_URL}/api/activity-groups/${groupId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userName: myName,
            text: chatMsg.trim(),
          }),
        },
      );

      if (res.ok) {
        // Osvježi poruke
        await loadGroupMessages(groupId);
        setChatMsg("");
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // ============================================================
  // 6. loadGroupMessages - dohvat poruka za odabranu grupu
  // ============================================================
  const loadGroupMessages = async (groupId: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await fetch(
        `${API_BASE_URL}/api/activity-groups/${groupId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.ok) {
        const raw = await res.json();
        // Mapiraj backend format → frontend format
        const messages = (Array.isArray(raw) ? raw : []).map((m: any) => ({
          name: m.userName || m.name || "?",
          text: m.text || m.Text || "",
          time: m.time
            ? new Date(m.time).toLocaleTimeString("hr-HR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : m.Time
              ? new Date(m.Time).toLocaleTimeString("hr-HR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "",
        }));
        setSelectedGroup((prev) => (prev ? { ...prev, messages } : null));
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  // ============================================================
  // 7. deleteGroup - brisanje grupe na serveru
  // ============================================================
  const deleteGroup = async (groupId: string) => {
    const g = groups.find((x) => x.id === groupId);
    if (g?.creatorName !== myName) {
      Alert.alert(t("groups.deleteOwnOnly"), t("groups.deleteConfirm"));
      return;
    }

    Alert.alert(t("groups.deleteConfirm"), t("groups.deleteConfirmQuestion"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            if (!token) return;

            const res = await fetch(
              `${API_BASE_URL}/api/activity-groups/${groupId}?creatorName=${encodeURIComponent(myName)}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              },
            );

            if (res.ok) {
              setGroups((prev) => prev.filter((x) => x.id !== groupId));
              setSelectedGroup(null);
              Alert.alert(t("common.success"), t("groups.deleteSuccess"));
            } else {
              Alert.alert("Greška", "Nije moguće obrisati grupu");
            }
          } catch (error) {
            console.error("Error deleting group:", error);
            Alert.alert("Greška", "Nije moguće obrisati grupu");
          }
        },
      },
    ]);
  };

  // ============================================================
  // 8. Polling za poruke (osvježavanje svakih 5 sekundi)
  // ============================================================
  useEffect(() => {
    if (!selectedGroup) return;

    const interval = setInterval(async () => {
      await loadGroupMessages(selectedGroup.id);
    }, 5000); // osvježi svake 5 sekunde

    return () => clearInterval(interval);
  }, [selectedGroup?.id]);

  const handleModalBack = () => {
    if (selectedGroup) {
      setSelectedGroup(null);
      setChatMsg("");
    } else if (showCreate) setShowCreate(false);
    else onClose();
  };

  const handleMemberPress = async (memberName: string) => {
    if (memberName === myName) {
      Alert.alert(
        t("profile.cannotMessageSelf"),
        t("profile.cannotMessageSelfDesc"),
      );
      return;
    }
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const users = await res.json();
        const nameLower = memberName.toLowerCase().trim();
        const found = users.find((u: any) => {
          const fn = (u.firstName || u.firstname || "").toLowerCase();
          const ln = (u.lastName || u.lastname || "").toLowerCase();
          return `${fn} ${ln}`.trim() === nameLower || fn === nameLower;
        });
        setDmTarget({ name: memberName, userId: found?.id ?? null });
        setShowDMCompose(true);
      }
    } catch {
      Alert.alert(t("common.error"), t("userProfile.messageFailed"));
    }
  };

  const sendDM = async () => {
    if (!dmTarget.userId || !dmMessage.trim()) {
      if (!dmTarget.userId) {
        Alert.alert(
          "Korisnik nije pronađen",
          `Nije moguće pronaći korisnika "${dmTarget.name}" u sustavu.`,
        );
      }
      return;
    }
    setSendingDM(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/message/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId: dmTarget.userId,
          content: dmMessage.trim(),
        }),
      });
      if (res.ok) {
        setShowDMCompose(false);
        setDmMessage("");
        Alert.alert(
          t("messages.messageSent"),
          t("messages.messageSentTo", { name: dmTarget.name }),
        );
      } else {
        Alert.alert("Greška", "Poruka nije poslana. Pokušajte ponovo.");
      }
    } catch {
      Alert.alert("Greška", "Nije moguće poslati poruku.");
    } finally {
      setSendingDM(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleModalBack}
    >
      {/* JEDAN Modal, tri različita "ekrana" unutar njega */}
      {selectedGroup ? (
        // ─── Chat ekran ───────────────────────────────────────────────────────
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "#fff" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={ag.chatHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedGroup(null);
                setChatMsg("");
              }}
            >
              <Text style={ag.chatHeaderBack}>←</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={ag.chatHeaderTitle} numberOfLines={1}>
                {EMOJIS[selectedGroup.activity] || "🤝"}{" "}
                {selectedGroup.activity}
              </Text>
              <Text style={ag.chatHeaderSub}>
                📍 {selectedGroup.locationName} · {selectedGroup.members.length}
                /{selectedGroup.maxPeople} članova
              </Text>
            </View>
            {selectedGroup.creatorName === myName ? (
              <TouchableOpacity onPress={() => deleteGroup(selectedGroup.id)}>
                <Text style={{ fontSize: 20 }}>🗑️</Text>
              </TouchableOpacity>
            ) : selectedGroup.members.includes(myName) ? (
              <TouchableOpacity onPress={() => leaveGroup(selectedGroup.id)}>
                <Text style={{ color: "#fff", fontSize: 13 }}>
                  {t("groups.leave")}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Članovi */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={ag.membersRow}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 14,
            }}
          >
            {selectedGroup.members.map((m, i) => {
              const isMe = m === myName;
              return (
                <TouchableOpacity
                  key={i}
                  style={{ alignItems: "center" }}
                  onPress={() => handleMemberPress(m)}
                  activeOpacity={isMe ? 1 : 0.7}
                >
                  <View
                    style={[
                      ag.memberAvatar,
                      isMe && { borderWidth: 2, borderColor: "#fff" },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {m[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={ag.memberName} numberOfLines={1}>
                    {m.split(" ")[0]}
                  </Text>
                  {!isMe && (
                    <Text
                      style={{
                        fontSize: 9,
                        color: "#667eea",
                        fontWeight: "700",
                        marginTop: 1,
                      }}
                    >
                      DM
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
            {Array.from({
              length: selectedGroup.maxPeople - selectedGroup.members.length,
            }).map((_, i) => (
              <View key={`e_${i}`} style={{ alignItems: "center" }}>
                <View style={ag.memberAvatarEmpty}>
                  <Text style={{ color: "#ccc", fontSize: 18 }}>+</Text>
                </View>
                <Text style={{ fontSize: 10, color: "#ccc", marginTop: 2 }}>
                  {t("groups.freeSpots")}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Poruke */}
          <FlatList
            ref={flatRef}
            data={selectedGroup.messages || []}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            renderItem={({ item }) => {
              // Zaštita od undefined/null itema
              if (!item || typeof item !== "object") return null;

              const name = item.name || "?";
              const text = item.text || "";
              const time = item.time || "";

              const isMe = name === myName;
              const isSys = name === "Sustav";

              if (isSys)
                return (
                  <View style={{ alignItems: "center", marginVertical: 6 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#999",
                        fontStyle: "italic",
                      }}
                    >
                      {text}
                    </Text>
                  </View>
                );
              return (
                <View
                  style={[
                    ag.msgRow,
                    isMe
                      ? { justifyContent: "flex-end" }
                      : { justifyContent: "flex-start" },
                  ]}
                >
                  {!isMe && (
                    <View style={ag.msgAvatar}>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {name[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ maxWidth: "70%" }}>
                    {!isMe && <Text style={ag.msgSender}>{name}</Text>}
                    <View
                      style={[ag.bubble, isMe ? ag.bubbleMine : ag.bubbleOther]}
                    >
                      <Text
                        style={{
                          color: isMe ? "#fff" : "#1a1a1a",
                          fontSize: 14,
                        }}
                      >
                        {text}
                      </Text>
                    </View>
                    <Text
                      style={[ag.msgTime, isMe ? { textAlign: "right" } : {}]}
                    >
                      {time}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Input */}
          {(selectedGroup.members || []).includes(myName) ? (
            <View style={ag.inputRow}>
              <TextInput
                style={ag.input}
                placeholder={t("groups.sendMessage")}
                placeholderTextColor="#aaa"
                value={chatMsg}
                onChangeText={setChatMsg}
                returnKeyType="send"
                onSubmitEditing={() => sendGroupMessage(selectedGroup.id)}
              />
              <TouchableOpacity
                style={[
                  ag.sendBtn,
                  !chatMsg.trim() && { backgroundColor: "#ddd" },
                ]}
                onPress={() => sendGroupMessage(selectedGroup.id)}
                disabled={!chatMsg.trim()}
              >
                <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#eee" }}
            >
              <TouchableOpacity
                style={ag.joinBtn}
                onPress={() => joinGroup(selectedGroup.id)}
              >
                <Text style={ag.joinBtnText}>{t("groups.joinGroup")}</Text>
              </TouchableOpacity>
            </View>
          )}
          {showDMCompose && (
            <View style={ag.dmOverlay}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={() => {
                  setShowDMCompose(false);
                  setDmMessage("");
                }}
              />
              <View style={ag.dmSheet}>
                <View style={ag.dmHandle} />

                {/* Header */}
                <View style={ag.dmHeader}>
                  <View style={ag.dmAvatar}>
                    <Text
                      style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}
                    >
                      {dmTarget.name[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ag.dmTitle}>{t("groups.privateMessage")}</Text>
                    <Text style={ag.dmSubtitle}>→ {dmTarget.name}</Text>
                  </View>
                  {!dmTarget.userId && (
                    <View style={ag.dmWarnBadge}>
                      <Text
                        style={{
                          color: "#ff9500",
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        ⚠️ Nije nađen
                      </Text>
                    </View>
                  )}
                </View>

                {/* Input */}
                <TextInput
                  style={ag.dmInput}
                  placeholder={`Napiši poruku za ${dmTarget.name}...`}
                  placeholderTextColor="#bbb"
                  value={dmMessage}
                  onChangeText={setDmMessage}
                  multiline
                  maxLength={500}
                  autoFocus
                  textAlignVertical="top"
                />

                {/* Quick messages */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 10 }}
                >
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {["Hej! 👋", "Idemo? 🚀", "Gdje si? 📍", "OK! ✅"].map(
                      (q) => (
                        <TouchableOpacity
                          key={q}
                          style={ag.dmQuickBtn}
                          onPress={() => setDmMessage(q)}
                        >
                          <Text style={ag.dmQuickText}>{q}</Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                </ScrollView>

                {/* Actions */}
                <View style={ag.dmActions}>
                  <TouchableOpacity
                    style={ag.dmCancelBtn}
                    onPress={() => {
                      setShowDMCompose(false);
                      setDmMessage("");
                    }}
                  >
                    <Text style={ag.dmCancelText}>{t("common.cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      ag.dmSendBtn,
                      (!dmMessage.trim() || sendingDM || !dmTarget.userId) &&
                        ag.dmSendBtnDisabled,
                    ]}
                    onPress={sendDM}
                    disabled={
                      !dmMessage.trim() || sendingDM || !dmTarget.userId
                    }
                  >
                    {sendingDM ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={ag.dmSendText}>{t("groups.sendDM")} 💬</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      ) : showCreate ? (
        // ─── Forma za kreiranje ───────────────────────────────────────────────
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "#fff" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={ag.navHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={ag.navHeaderLink}>← {t("common.back")}</Text>
            </TouchableOpacity>
            <Text style={ag.navHeaderTitle}>Nova aktivnost</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={ag.formLabel}>{t("groups.activityType")}</Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 20,
              }}
            >
              {ACTIVITY_TEMPLATES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    ag.templateChip,
                    newGroup.category === t.value && ag.templateChipActive,
                  ]}
                  onPress={() =>
                    setNewGroup((p) => ({
                      ...p,
                      category: t.value,
                      activity: t.label,
                    }))
                  }
                >
                  <Text
                    style={[
                      ag.templateChipText,
                      newGroup.category === t.value && { color: "#fff" },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={ag.formLabel}>{t("groups.activityDesc")}</Text>
            <TextInput
              style={ag.formInput}
              placeholder={t("groups.activityPlaceholder")}
              value={newGroup.activity}
              onChangeText={(v) => setNewGroup((p) => ({ ...p, activity: v }))}
              maxLength={80}
            />
            <Text style={ag.formLabel}>{t("groups.location")}</Text>
            <TextInput
              style={ag.formInput}
              placeholder={t("groups.locationPlaceholder")}
              value={newGroup.locationName}
              onChangeText={(v) =>
                setNewGroup((p) => ({ ...p, locationName: v }))
              }
              maxLength={100}
            />
            <Text style={ag.formLabel}>{t("groups.shortDescription")}</Text>
            <TextInput
              style={[ag.formInput, { minHeight: 70 }]}
              placeholder={t("groups.descriptionPlaceholder")}
              value={newGroup.description}
              onChangeText={(v) =>
                setNewGroup((p) => ({ ...p, description: v }))
              }
              multiline
              maxLength={200}
            />
            <Text style={ag.formLabel}>{t("groups.maxPeople")}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
              {[2, 3, 4, 5, 8, 10].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[
                    ag.templateChip,
                    newGroup.maxPeople === String(n) && ag.templateChipActive,
                  ]}
                  onPress={() =>
                    setNewGroup((p) => ({ ...p, maxPeople: String(n) }))
                  }
                >
                  <Text
                    style={[
                      ag.templateChipText,
                      newGroup.maxPeople === String(n) && { color: "#fff" },
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={ag.joinBtn} onPress={createGroup}>
              <Text style={ag.joinBtnText}>{t("groups.postActivity")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        // ─── Lista grupa ──────────────────────────────────────────────────────
        <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
          <View style={ag.listHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: "#fff", fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
            <Text style={ag.listHeaderTitle}>{t("groups.title")}</Text>
            <TouchableOpacity
              style={ag.newBtn}
              onPress={() => setShowCreate(true)}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                + {t("groups.createNew")}
              </Text>
            </TouchableOpacity>
          </View>

          {groups.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
              }}
            >
              <Text style={{ fontSize: 64 }}>🤝</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#333" }}>
                {t("groups.noActivities")}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#999",
                  textAlign: "center",
                  paddingHorizontal: 40,
                }}
              >
                {t("groups.beFirst")}
              </Text>
              <TouchableOpacity
                style={ag.joinBtn}
                onPress={() => setShowCreate(true)}
              >
                <Text style={ag.joinBtnText}>{t("groups.create")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={groups}
              keyExtractor={(g) => g.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item: g }) => {
                if (!g || typeof g !== "object") return null;

                const members = Array.isArray(g.members) ? g.members : [];
                const messages = Array.isArray(g.messages) ? g.messages : [];

                const isMember = members.includes(myName);
                const isFull = members.length >= (g.maxPeople || 0);
                const isCreator = g.creatorName === myName;

                // IZVAN renderItem-a (kao konstanta na razini komponente):
                const activityToCategory: Record<string, string> = {
                  "☕ Kava": "cafe",
                  "🍽️ Ručak/Večera": "restaurant",
                  "🎵 Noćni izlazak": "club",
                  "🏖️ Plaža": "beach",
                  "🎬 Kino": "cinema",
                  "🌳 Šetnja": "park",
                  "🔐 Escape Room": "escapeRoom",
                  "🎯 Paintball": "paintball",
                  "⛰️ Planinarenje": "mountain",
                  "💧 Toplice": "spa",
                  Kavica: "cafe",
                };

                const categoryKey = activityToCategory[g.activity] ?? "";
                // SIGURNO dohvati color — bez spreada ili Object.keys
                const color =
                  (categoryKey &&
                    placeCategories[categoryKey as keyof typeof placeCategories]
                      ?.color) ||
                  "#667eea";

                const timeAgo = Math.floor(
                  (Date.now() - new Date(g.createdAt || Date.now()).getTime()) /
                    60000,
                );
                const timeStr =
                  timeAgo < 60
                    ? `Prije ${timeAgo} min`
                    : `Prije ${Math.floor(timeAgo / 60)}h`;

                return (
                  <TouchableOpacity
                    style={[ag.groupCard, { borderLeftColor: color }]}
                    onPress={() => setSelectedGroup(g)}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={ag.groupTitle} numberOfLines={1}>
                          {g.activity || "Aktivnost"}
                        </Text>
                        <Text style={ag.groupLocation}>
                          📍 {g.locationName || "Nepoznata lokacija"}
                        </Text>
                        {g.description ? (
                          <Text style={ag.groupDesc} numberOfLines={2}>
                            {g.description}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          ag.groupIcon,
                          { backgroundColor: color + "22" },
                        ]}
                      >
                        <Text style={{ fontSize: 22 }}>
                          {EMOJIS[categoryKey] || "🤝"}
                        </Text>
                      </View>
                    </View>
                    <View style={ag.groupFooter}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {members.slice(0, 4).map((m, i) => (
                          <View
                            key={i}
                            style={[
                              ag.footerAvatar,
                              { marginLeft: i > 0 ? -8 : 0 },
                            ]}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: "700",
                              }}
                            >
                              {(m || "")[0]?.toUpperCase()}
                            </Text>
                          </View>
                        ))}
                        <Text style={ag.groupCount}>
                          {members.length}/{g.maxPeople || 0}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 11, color: "#bbb" }}>
                          {timeStr}
                        </Text>
                        {isCreator ? (
                          <View style={ag.badgeOwn}>
                            <Text style={ag.badgeOwnText}>
                              {t("groups.yourGroup")}
                            </Text>
                          </View>
                        ) : isMember ? (
                          <View style={ag.badgeMember}>
                            <Text style={ag.badgeMemberText}>
                              ✓ {t("groups.joined")}
                            </Text>
                          </View>
                        ) : isFull ? (
                          <View style={ag.badgeFull}>
                            <Text style={{ fontSize: 11, color: "#999" }}>
                              {t("groups.full")}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={ag.joinSmallBtn}
                            onPress={() => joinGroup(g.id)}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#fff",
                                fontWeight: "700",
                              }}
                            >
                              {t("groups.join")}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </Modal>
  );
}

// ─── Stilovi za ActivityGroupsModal ──────────────────────────────────────────
const ag = StyleSheet.create({
  // Chat
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    backgroundColor: "#667eea",
    gap: 12,
  },
  dmOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end" as const,
    zIndex: 999,
  },
  dmSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "70%",
  },
  dmHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0e0e0",
    alignSelf: "center" as const,
    marginBottom: 16,
  },
  dmHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dmAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#667eea",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  dmTitle: { fontSize: 16, fontWeight: "700" as const, color: "#1a1a1a" },
  dmSubtitle: { fontSize: 14, color: "#667eea", marginTop: 2 },
  dmWarnBadge: {
    backgroundColor: "#fff8e6",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dmInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    minHeight: 90,
    color: "#333",
    marginBottom: 12,
  },
  dmQuickBtn: {
    backgroundColor: "#f0f0ff",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dmQuickText: { fontSize: 13, color: "#667eea", fontWeight: "600" },
  dmActions: {
    flexDirection: "row" as const,
    gap: 10,
    marginTop: 4,
  },
  dmCancelBtn: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    alignItems: "center" as const,
  },
  dmCancelText: { color: "#666", fontSize: 14, fontWeight: "600" },
  dmSendBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#667eea",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  dmSendBtnDisabled: {
    backgroundColor: "#ccc",
    shadowOpacity: 0,
    elevation: 0,
  },
  dmSendText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  chatHeaderBack: { color: "#fff", fontSize: 22 },
  chatHeaderTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  chatHeaderSub: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  membersRow: {
    maxHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#f8f8ff",
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarEmpty: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  memberName: { fontSize: 10, color: "#555", marginTop: 2 },
  msgRow: { flexDirection: "row", marginVertical: 4, gap: 8 },
  msgAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  msgSender: { fontSize: 11, color: "#999", marginBottom: 2 },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: "#667eea", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#f2f2f7", borderBottomLeftRadius: 4 },
  msgTime: { fontSize: 10, color: "#bbb", marginTop: 2 },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 8,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#f2f2f7",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#333",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  joinBtn: {
    backgroundColor: "#667eea",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  joinBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  // Nav header (forma za kreiranje)
  navHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  navHeaderLink: { fontSize: 16, color: "#667eea" },
  navHeaderTitle: { fontSize: 17, fontWeight: "800" },
  formLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#333",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  templateChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "#f0f0f0",
  },
  templateChipActive: { backgroundColor: "#667eea" },
  templateChipText: { fontSize: 13, fontWeight: "600", color: "#444" },
  // Lista grupa
  listHeader: {
    backgroundColor: "#667eea",
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listHeaderTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  newBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  groupTitle: { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  groupLocation: { fontSize: 13, color: "#667eea", marginTop: 2 },
  groupDesc: { fontSize: 13, color: "#666", marginTop: 4 },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  groupFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  footerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  groupCount: { fontSize: 12, color: "#666", fontWeight: "600", marginLeft: 4 },
  badgeOwn: {
    backgroundColor: "#f0f0ff",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeOwnText: { fontSize: 11, color: "#667eea", fontWeight: "700" },
  badgeMember: {
    backgroundColor: "#e8f5e9",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeMemberText: { fontSize: 11, color: "#34c759", fontWeight: "700" },
  badgeFull: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  joinSmallBtn: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
});

// ─── Plan My Day Modal ────────────────────────────────────────────────────────
type PlanPeriod = "dan" | "vikend" | "tjedan" | "2tjedna" | "godisnji";
type CompanionType = "solo" | "partner" | "prijatelji" | "obitelj" | "misovito";
type TransportType = "auto" | "javni" | "pjesice" | "bicikl";
type PreferenceType = "otvoreno" | "zatvoreno" | "kombinirano";
type PlanStep = "form" | "loading" | "result";

// ─── Animated Progress Bar ────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: (step + 1) / total,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [step]);
  return (
    <View style={pb.track}>
      <Animated.View
        style={[
          pb.fill,
          {
            width: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}
const pb = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: "rgba(102,126,234,0.2)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 12,
  },
  fill: { height: "100%", backgroundColor: "#667eea", borderRadius: 2 },
});

// ─── Helper: dohvati stvarna mjesta iz OSM ─────────────────────────────────────
async function fetchVenuesNearCity(
  cityQuery: string,
  radiusKm: number,
  interests: string[],
): Promise<{
  geocoded: { latitude: number; longitude: number; displayName: string } | null;
  venues: Record<
    string,
    { name: string; address?: string; latitude: number; longitude: number }[]
  >;
}> {
  const geocoded = await geocodeCity(cityQuery);
  if (!geocoded) return { geocoded: null, venues: {} };

  clearPlacesCache();
  const cats =
    interests.length > 0
      ? interests
      : ["restaurant", "cafe", "beach", "landmark", "park", "museum"];

  const places = await getPlacesInRadius(
    geocoded.latitude,
    geocoded.longitude,
    radiusKm,
    cats as any,
  );

  const venues: Record<
    string,
    { name: string; address?: string; latitude: number; longitude: number }[]
  > = {};

  for (const p of places) {
    if (!venues[p.type]) venues[p.type] = [];
    // ✅ Povećano s 5 na 10 opcija po kategoriji
    if (venues[p.type].length < 10) {
      venues[p.type].push({
        name: p.name,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
      });
    }
  }

  return { geocoded, venues };
}

// ─── Template generator s pravim imenima ──────────────────────────────────────
// ─── Template generator s pravim imenima (V2 - više opcija) ────────────────────
function buildPlanWithVenues(
  destination: string,
  postalCode: string,
  accommodationAddress: string,
  period: PlanPeriod,
  people: string,
  companions: CompanionType,
  budget: string,
  activityRadius: number,
  transport: TransportType,
  preference: PreferenceType,
  interests: string[],
  venues: Record<string, { name: string; address?: string }[]>,
): string {
  const DAYS: Record<PlanPeriod, number> = {
    dan: 1,
    vikend: 2,
    tjedan: 7,
    "2tjedna": 14,
    godisnji: 10,
  };
  const days = DAYS[period] || 1;
  const ppl = parseInt(people) || 2;
  const bdg = parseInt(budget) || 500;
  const dayBudget = Math.round(bdg / days);
  const perPerson = Math.round(dayBudget / ppl);

  // Sve opcije za kategoriju (do 10) rotiraju po danima
  const get = (type: string, idx = 0): string => {
    const list = venues[type] || [];
    if (!list.length) return "";
    const item = list[idx % list.length];
    return item.address ? `${item.name} (${item.address})` : item.name;
  };

  // Prikaz svih opcija za kategoriju (za sekciju "ponuđene opcije")
  const getAll = (type: string): string => {
    const list = venues[type] || [];
    if (!list.length) return "  Nema pronađenih mjesta u odabranom radijusu";
    return list
      .map(
        (item, i) =>
          `  ${i + 1}. ${item.name}${item.address ? ` — ${item.address}` : ""}`,
      )
      .join("\n");
  };

  const COMPANION_LABELS: Record<CompanionType, string> = {
    solo: "samostalno putovanje",
    partner: "putovanje s partnerom",
    prijatelji: "putovanje s prijateljima",
    obitelj: "obiteljsko putovanje",
    misovito: "mješovita grupa",
  };
  const TRANSPORT_LABELS: Record<TransportType, string> = {
    auto: "autom",
    javni: "javnim prijevozom",
    pjesice: "pješice",
    bicikl: "biciklom",
  };

  const catLabels: Record<string, string> = {
    restaurant: "🍽️ Restorani",
    cafe: "☕ Kafići",
    club: "🎵 Noćni klubovi",
    beach: "🏖️ Plaže",
    landmark: "🏰 Znamenitosti",
    opg: "🌾 OPG",
    accommodation: "🏨 Smještaji",
    market: "🛒 Tržnice",
    paintball: "🎯 Paintball",
    cinema: "🎬 Kina",
    park: "🌳 Parkovi",
    escapeRoom: "🔐 Escape Roomovi",
    museum: "🏛️ Muzeji",
    theater: "🎭 Kazališta",
    mountain: "⛰️ Planine",
    nationalPark: "🏞️ Nacionalni parkovi",
    cave: "🕳️ Špilje",
    spa: "💧 Toplice/Spa",
  };

  let plan = `🗺️ PLAN PUTOVANJA — ${destination.toUpperCase()}`;
  if (postalCode) plan += ` ${postalCode}`;
  plan += `\n${"━".repeat(40)}\n`;
  plan += `📅 Trajanje: ${period === "dan" ? "1 dan" : period === "vikend" ? "Vikend (2 dana)" : period === "tjedan" ? "Tjedan (7 dana)" : period === "2tjedna" ? "Dva tjedna" : "Godišnji odmor (10 dana)"}\n`;
  plan += `👥 Putnici: ${people} osoba | ${COMPANION_LABELS[companions]}\n`;
  plan += `💰 Budžet: ${budget} EUR (~${perPerson} EUR/osobi/dan)\n`;
  plan += `🚗 Prijevoz: ${TRANSPORT_LABELS[transport]}\n`;
  plan += `📏 Radijus aktivnosti: ${activityRadius} km od smještaja\n`;
  if (accommodationAddress) plan += `🏨 Smještaj: ${accommodationAddress}\n`;
  plan += `\n`;

  // ✅ NOVA SEKCIJA: sve pronađene opcije po kategoriji
  plan += `\n${"━".repeat(40)}\n`;
  plan += `📋 PRONAĐENE OPCIJE PO KATEGORIJAMA (u radijusu ${activityRadius} km)\n`;
  plan += `${"━".repeat(40)}\n`;

  for (const [type, list] of Object.entries(venues)) {
    if (!list.length) continue;
    plan += `\n${catLabels[type] || type}:\n`;
    plan += `${getAll(type)}\n`;
  }

  plan += `\n${"━".repeat(40)}\n`;
  plan += `📆 DNEVNI RASPORED\n`;
  plan += `${"━".repeat(40)}\n`;

  for (let d = 1; d <= Math.min(days, 7); d++) {
    plan += `\n${"─".repeat(36)}\n`;
    plan += `📆 DAN ${d}\n`;
    plan += `${"─".repeat(36)}\n\n`;

    // Jutro
    plan += `🌅 JUTRO (8:00 – 12:00)\n`;
    const cafe = get("cafe", d - 1);
    if (cafe) plan += `  ☕ Doručak: ${cafe}\n`;
    else plan += `  ☕ Doručak u lokalnom kafiću (~10-15 EUR/os.)\n`;

    if (preference !== "zatvoreno") {
      const landmark = get("landmark", d - 1);
      const park = get("park", d - 1);
      if (landmark) plan += `  🏰 Razgledavanje: ${landmark}\n`;
      if (park && d % 2 === 0) plan += `  🌳 Šetnja: ${park}\n`;
    }
    if (preference === "zatvoreno" || preference === "kombinirano") {
      const museum = get("museum", d - 1);
      if (museum) plan += `  🏛️ Muzej: ${museum}\n`;
    }

    // Poslijepodne
    plan += `\n☀️ POSLIJEPODNE (12:00 – 18:00)\n`;
    const rest1 = get("restaurant", (d - 1) * 2);
    if (rest1) plan += `  🍽️ Ručak: ${rest1} (~20-35 EUR/os.)\n`;
    else plan += `  🍽️ Ručak u lokalnom restoranu (~20-35 EUR/os.)\n`;

    if (preference !== "zatvoreno") {
      const beach = get("beach", d - 1);
      const nationalPark = get("nationalPark", d - 1);
      const cave = get("cave", d - 1);
      if (beach) plan += `  🏖️ Plaža: ${beach}\n`;
      if (nationalPark && !beach) plan += `  🏞️ Nac. park: ${nationalPark}\n`;
      if (cave && d % 3 === 0) plan += `  🕳️ Špilja: ${cave}\n`;
    }

    if (preference !== "otvoreno") {
      const cinema = get("cinema", d - 1);
      const escapeRoom = get("escapeRoom", d - 1);
      const spa = get("spa", d - 1);
      if (escapeRoom && companions !== "solo")
        plan += `  🔐 Escape room: ${escapeRoom} (~20-30 EUR/os.)\n`;
      if (cinema && d % 2 === 0 && !escapeRoom)
        plan += `  🎬 Kino: ${cinema}\n`;
      if (spa && companions === "partner") plan += `  💧 Spa/toplice: ${spa}\n`;
    }

    // Paintball / aktivno
    if (
      (companions === "prijatelji" || companions === "misovito") &&
      d % 2 !== 0
    ) {
      const paintball = get("paintball", 0);
      if (paintball) plan += `  🎯 Paintball: ${paintball} (~25-40 EUR/os.)\n`;
    }

    // Večer
    plan += `\n🌙 VEČER (18:00 – 22:00)\n`;
    const rest2 = get("restaurant", (d - 1) * 2 + 1);
    if (rest2) plan += `  🍷 Večera: ${rest2} (~30-55 EUR/os.)\n`;
    else plan += `  🍷 Večera (~30-55 EUR/os.)\n`;

    if (companions !== "obitelj" && companions !== "solo") {
      const club = get("club", d - 1);
      const theater = get("theater", d - 1);
      if (theater && d % 3 === 0) plan += `  🎭 Kazalište: ${theater}\n`;
      else if (club) plan += `  🎵 Noćni klub: ${club}\n`;
    }

    // OPG i tržnica
    const market = get("market", d - 1);
    const opg = get("opg", d - 1);
    if (market && d === Math.floor(days / 2))
      plan += `\n  🛒 Tržnica (za uspomene / lokalne proizvode): ${market}\n`;
    if (opg && companions === "obitelj") plan += `  🌾 OPG: ${opg}\n`;

    plan += `\n💰 Procijenjeni troškovi dana: ~${dayBudget} EUR (~${perPerson} EUR/os.)\n`;
  }

  // Alternativne opcije za svaki dan
  if (Object.keys(venues).length > 0) {
    plan += `\n${"━".repeat(40)}\n`;
    plan += `🔄 ALTERNATIVNE OPCIJE\n`;
    plan += `${"━".repeat(40)}\n`;
    plan += `Sva pronađena mjesta dostupna su na karti - kliknite marker za detalje, ocjene i mogućnost označavanja posjete.\n`;
  }

  // Savjeti
  plan += `\n${"━".repeat(40)}\n`;
  plan += `💡 SAVJETI\n`;
  plan += `${"━".repeat(40)}\n`;
  if (transport === "javni")
    plan += `• Prijevozni raspored: hzpp.hr / arriva.hr / getbybus.com\n`;
  if (transport === "auto")
    plan += `• Parkirajte u garaži smještaja — lakše za dulje izlete\n`;
  if (transport === "pjesice")
    plan += `• Nosite udobnu obuću — centri starih gradova su bogati šetnicama\n`;
  plan += `• Rezervirajte restorane unaprijed (posebno u ljetnoj sezoni)\n`;
  if (preference !== "zatvoreno")
    plan += `• Nosite kremu za sunce i vodu za aktivnosti na otvorenom\n`;
  if (companions === "obitelj")
    plan += `• Provjerite ulaznice za djecu — često su besplatne do 7 god.\n`;
  plan += `\n✨ Ugodan boravak u ${destination}!\n`;
  plan += `\n📌 Napomena: konkretni prijedlozi mjesta generirani su iz OpenStreetMap podataka. Preporučujemo provjeru radnog vremena pred polazak. Kliknite marker na karti za Google Photos, radno vrijeme i mogućnost ocjenjivanja.`;

  return plan;
}
// PlaceDetailInPlan komponenta - dodajte prije PlanMyDayModal
function PlaceDetailInPlan({
  place,
}: {
  place: { name: string; latitude: number; longitude: number; type: string };
}) {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoogleDetails(place.name, place.latitude, place.longitude)
      .then((d) => {
        setDetails(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [place.name, place.latitude, place.longitude]);

  if (loading) return <ActivityIndicator color="#667eea" />;

  return (
    <ScrollView>
      {details?.photos?.[0] && (
        <Image
          source={{ uri: details.photos[0] }}
          style={{
            width: "100%",
            height: 180,
            borderRadius: 12,
            marginBottom: 12,
          }}
          resizeMode="cover"
        />
      )}
      {details?.rating && (
        <Text style={{ color: "#ff9500", marginBottom: 4 }}>
          ⭐ {details.rating.toFixed(1)} / 5
        </Text>
      )}
      {details?.openingHours && (
        <View
          style={{
            backgroundColor: "#f5f5f5",
            borderRadius: 10,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <Text style={{ fontWeight: "700", marginBottom: 4 }}>
            🕐 Radno vrijeme
          </Text>
          <Text style={{ fontSize: 13, color: "#555" }}>
            {details.openingHours}
          </Text>
        </View>
      )}
      {details?.phone && (
        <Text style={{ color: "#666", marginBottom: 4 }}>
          📞 {details.phone}
        </Text>
      )}
    </ScrollView>
  );
}

const pm = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  headerLink: {
    fontSize: 14,
    color: "#667eea",
    fontWeight: "600",
    minWidth: 60,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 10,
    marginTop: 20,
  },
  label: { fontSize: 13, color: "#666", marginBottom: 8 },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#333",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },
  row: { flexDirection: "row", marginBottom: 0 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  chipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
  },
  chipMd: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    minWidth: 64,
  },
  chipActive: { backgroundColor: "#667eea" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#555" },
  chipTextActive: { color: "#fff" },
  generateBtn: {
    backgroundColor: "#667eea",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
  },
  generateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  generateHint: {
    textAlign: "center",
    fontSize: 12,
    color: "#999",
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingIcon: { fontSize: 64, marginTop: 24, marginBottom: 8 },
  loadingText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  loadingHint: {
    fontSize: 13,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
  resultBadge: {
    backgroundColor: "#f0f0ff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  resultBadgeText: { fontSize: 13, color: "#667eea", fontWeight: "600" },
  resultText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 22,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  btnPrimary: {
    backgroundColor: "#667eea",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnSecondary: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#667eea",
  },
  btnSecondaryText: { color: "#667eea", fontSize: 15, fontWeight: "600" },
});

function PlanRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const rendered: React.ReactElement[] = [];
  let metaLines: string[] = [];
  let inMeta = false;

  const flushMeta = (key: string) => {
    if (metaLines.length === 0) return;
    rendered.push(
      <View key={`meta-${key}`} style={pr.metaCard}>
        {metaLines.map((ml, mi) => (
          <View key={mi} style={pr.metaRow}>
            <Text style={pr.metaText}>{ml}</Text>
          </View>
        ))}
      </View>,
    );
    metaLines = [];
    inMeta = false;
  };

  lines.forEach((line, i) => {
    const t = line.trim();

    if (!t) {
      flushMeta(String(i));
      rendered.push(<View key={i} style={{ height: 4 }} />);
      return;
    }
    // Skip separator lines
    if (/^[━─=]{3,}/.test(t)) return;

    // ── Title ─────────────────────────────────────────────────────────────────
    if (t.startsWith("🗺️")) {
      flushMeta(String(i));
      const dest = t
        .replace("🗺️ PLAN PUTOVANJA", "")
        .replace("—", "")
        .replace("–", "")
        .trim();
      rendered.push(
        <View key={i} style={pr.titleBox}>
          <Text style={pr.titleEmoji}>🗺️</Text>
          <View style={{ flex: 1 }}>
            <Text style={pr.titleSub}>PLAN PUTOVANJA</Text>
            <Text style={pr.titleMain}>{dest || "Vaša destinacija"}</Text>
          </View>
        </View>,
      );
      inMeta = true;
      return;
    }

    // ── Meta block (collect into card) ────────────────────────────────────────
    if (inMeta && /^[📅👥🚗📏🏨]/.test(t)) {
      metaLines.push(t);
      return;
    }
    if (inMeta && t.startsWith("💰") && !t.includes("Procijenjeni")) {
      metaLines.push(t);
      return;
    }

    // ── Day header ────────────────────────────────────────────────────────────
    if (t.startsWith("📆")) {
      flushMeta(String(i));
      rendered.push(
        <View key={i} style={pr.dayCard}>
          <Text style={pr.dayText}>{t}</Text>
        </View>,
      );
      return;
    }

    // ── Time blocks ───────────────────────────────────────────────────────────
    if (t.startsWith("🌅")) {
      flushMeta(String(i));
      rendered.push(
        <View
          key={i}
          style={[
            pr.timeBlock,
            { borderLeftColor: "#ff9500", backgroundColor: "#fff8f0" },
          ]}
        >
          <Text style={[pr.timeText, { color: "#e67e00" }]}>{t}</Text>
        </View>,
      );
      return;
    }
    if (t.startsWith("☀️")) {
      flushMeta(String(i));
      rendered.push(
        <View
          key={i}
          style={[
            pr.timeBlock,
            { borderLeftColor: "#f0c040", backgroundColor: "#fffdf0" },
          ]}
        >
          <Text style={[pr.timeText, { color: "#a07800" }]}>{t}</Text>
        </View>,
      );
      return;
    }
    if (t.startsWith("🌙")) {
      flushMeta(String(i));
      rendered.push(
        <View
          key={i}
          style={[
            pr.timeBlock,
            { borderLeftColor: "#5856D6", backgroundColor: "#f5f0ff" },
          ]}
        >
          <Text style={[pr.timeText, { color: "#5856D6" }]}>{t}</Text>
        </View>,
      );
      return;
    }

    // ── Cost estimate ─────────────────────────────────────────────────────────
    if (t.includes("Procijenjeni")) {
      flushMeta(String(i));
      rendered.push(
        <View key={i} style={pr.costBox}>
          <Text style={pr.costText}>{t}</Text>
        </View>,
      );
      return;
    }

    // ── Tips header ───────────────────────────────────────────────────────────
    if (t.startsWith("💡")) {
      flushMeta(String(i));
      rendered.push(
        <View key={i} style={pr.tipsHeader}>
          <Text style={pr.tipsTitle}>{t}</Text>
        </View>,
      );
      return;
    }

    // ── Tip bullets ───────────────────────────────────────────────────────────
    if (t.startsWith("•")) {
      rendered.push(
        <View key={i} style={pr.tipRow}>
          <Text style={pr.tipDot}>›</Text>
          <Text style={pr.tipText}>{t.slice(1).trim()}</Text>
        </View>,
      );
      return;
    }

    // ── Note / disclaimer ─────────────────────────────────────────────────────
    if (t.startsWith("📌")) {
      flushMeta(String(i));
      rendered.push(
        <View key={i} style={pr.noteBox}>
          <Text style={pr.noteText}>{t}</Text>
        </View>,
      );
      return;
    }

    // ── Closing ───────────────────────────────────────────────────────────────
    if (t.startsWith("✨")) {
      flushMeta(String(i));
      rendered.push(
        <View key={i} style={pr.closingBox}>
          <Text style={pr.closingText}>{t}</Text>
        </View>,
      );
      return;
    }

    // ── Activity item (default) ───────────────────────────────────────────────
    flushMeta(String(i));
    rendered.push(
      <View key={i} style={pr.activityCard}>
        <Text style={pr.activityText}>{t}</Text>
      </View>,
    );
  });

  flushMeta("end");
  return <View style={pr.container}>{rendered}</View>;
}

const pr = StyleSheet.create({
  container: { gap: 3, paddingBottom: 8 },

  // Title card — gradient purple
  titleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#667eea",
    borderRadius: 18,
    padding: 18,
    marginBottom: 10,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 7,
  },
  titleEmoji: { fontSize: 34 },
  titleSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  titleMain: { color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 26 },

  // Meta info card
  metaCard: {
    backgroundColor: "#f7f8ff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#eaedff",
    gap: 6,
  },
  metaRow: { flexDirection: "row" },
  metaText: { fontSize: 13, color: "#444", lineHeight: 21, flex: 1 },

  // Day card — blue-left border
  dayCard: {
    backgroundColor: "#eef1ff",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    borderLeftWidth: 5,
    borderLeftColor: "#667eea",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  dayText: { fontSize: 17, fontWeight: "900", color: "#222" },

  // Time blocks
  timeBlock: {
    borderRadius: 10,
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  timeText: { fontSize: 14, fontWeight: "700" },

  // Activity items
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginLeft: 12,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: "#f0f2f5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  activityText: { fontSize: 13, color: "#333", lineHeight: 20 },

  // Cost estimate
  costBox: {
    backgroundColor: "#fff8e6",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    marginLeft: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ff9500",
  },
  costText: { fontSize: 13, color: "#8a5c00", fontWeight: "700" },

  // Tips section
  tipsHeader: {
    backgroundColor: "#e8f5e9",
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    borderLeftWidth: 5,
    borderLeftColor: "#34c759",
  },
  tipsTitle: { fontSize: 16, fontWeight: "800", color: "#1b5e20" },
  tipRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingLeft: 14,
    gap: 8,
    alignItems: "flex-start",
  },
  tipDot: { fontSize: 18, color: "#34c759", fontWeight: "800", lineHeight: 22 },
  tipText: { fontSize: 13, color: "#333", lineHeight: 22, flex: 1 },

  // Note
  noteBox: {
    backgroundColor: "#e8f4fd",
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
    borderLeftWidth: 4,
    borderLeftColor: "#2196f3",
  },
  noteText: { fontSize: 12, color: "#0d47a1", lineHeight: 18 },

  // Closing
  closingBox: {
    backgroundColor: "#f0f9f4",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#c8e6c9",
  },
  closingText: {
    fontSize: 14,
    color: "#2D6418",
    fontWeight: "700",
    textAlign: "center",
  },
});

function venueToPlace(
  venue: {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
  },
  type: string,
): Place {
  return {
    id: `plan_${type}_${venue.name.replace(/\s+/g, "_").toLowerCase()}`,
    name: venue.name,
    latitude: venue.latitude,
    longitude: venue.longitude,
    type: type as Place["type"],
    address: venue.address,
    distance: 0,
  };
}

// PLAN MY DAY MODAL
export function PlanMyDayModal({
  visible,
  userLocation,
  onClose,
  onMarkVisited,
  visits = [],
}: {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onMarkVisited?: (place: Place) => Promise<void>;
  visits?: VisitRecord[];
}) {
  const { t } = useTranslation();
  const getAllCategories = useCallback(() => {
    return Object.entries(placeCategories).map(([id, c]) => ({
      id,
      name: t(`categories.${id}`, { defaultValue: id }),
      icon: EMOJIS[id] || "📍",
      color: c.color,
    }));
  }, [t]);
  const LOADING_MESSAGES = [
    { icon: "🌍", text: t("plan.loading1") },
    { icon: "📍", text: t("plan.loading2") },
    { icon: "🍽️", text: t("plan.loading3") },
    { icon: "🏖️", text: t("plan.loading4") },
    { icon: "🗺️", text: t("plan.loading5") },
    { icon: "✨", text: t("plan.loading6") },
  ];
  const [step, setStep] = useState<PlanStep>("form");
  const [destination, setDestination] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [accommodationAddress, setAccommodationAddress] = useState("");
  const [period, setPeriod] = useState<PlanPeriod>("vikend");
  const [people, setPeople] = useState("2");
  const [companions, setCompanions] = useState<CompanionType>("prijatelji");
  const [budget, setBudget] = useState("500");
  const [activityRadius, setActivityRadius] = useState(3);
  const [transport, setTransport] = useState<TransportType>("auto");
  const [preference, setPreference] = useState<PreferenceType>("kombinirano");
  const [interests, setInterests] = useState<string[]>([]);
  const [result, setResult] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [selectedPlaceForDetail, setSelectedPlaceForDetail] =
    useState<Place | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const mapRef = useRef<MapView>(null);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedVenues, setSelectedVenues] = useState<Record<string, number>>(
    {},
  );
  const [allVenues, setAllVenues] = useState<
    Record<
      string,
      { name: string; address?: string; latitude: number; longitude: number }[]
    >
  >({});
  const [accommodationCoords, setAccommodationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedMapPlace, setSelectedMapPlace] = useState<any>(null);

  const reset = () => {
    setStep("form");
    setResult("");
    setDestination("");
    setPostalCode("");
    setAccommodationAddress("");
    setInterests([]);
    if (loadingInterval.current) clearInterval(loadingInterval.current);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleInterest = (id: string) =>
    setInterests((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );

  const generate = async () => {
    if (!destination.trim()) {
      Alert.alert(t("plan.destination"), t("plan.destinationRequired"));
      return;
    }
    setLoadingStep(0);
    setStep("loading");

    loadingInterval.current = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2200);

    try {
      const query = [destination.trim(), postalCode.trim(), "Hrvatska"]
        .filter(Boolean)
        .join(" ");

      const { geocoded, venues } = await fetchVenuesNearCity(
        query,
        activityRadius,
        interests,
      );

      setAllVenues(venues);

      // Geocodiraj adresu smještaja
      if (accommodationAddress.trim() && geocoded) {
        const accommodationResult = await geocodeCity(
          `${accommodationAddress}, ${destination}`,
        );
        if (accommodationResult) {
          setAccommodationCoords({
            latitude: accommodationResult.latitude,
            longitude: accommodationResult.longitude,
          });
        } else {
          // Fallback — koristi centar destinacije
          setAccommodationCoords({
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
          });
        }
      } else if (geocoded) {
        setAccommodationCoords({
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
        });
      }

      if (loadingInterval.current) clearInterval(loadingInterval.current);
      setLoadingStep(5);

      // Pokušaj AI backend, fallback na template
      const token = await AsyncStorage.getItem("token");
      let text = "";

      const venueStr = Object.entries(venues)
        .map(([type, items]) => {
          return `${t(`categories.${type}`, { defaultValue: type })}: ${items.map((i) => i.name + (i.address ? ` (${i.address})` : "")).join(", ")}`;
        })
        .join("\n");

      const prompt = `Napravi detaljan plan putovanja na hrvatskom jeziku:
📍 Destinacija: ${destination}${postalCode ? ` (${postalCode})` : ""}
🏨 Smještaj: ${accommodationAddress || "nije određen"}
📅 Trajanje: ${period}
👥 Putnici: ${people} osoba (${companions})
💰 Budžet: ${budget} EUR
🚗 Prijevoz: ${transport}
🌿 Preferencija: ${preference}
📏 Radijus od smještaja: ${activityRadius} km

Pronađena stvarna mjesta u destinaciji — OBAVEZNO koristi konkretna imena:
${venueStr || "Nema pronađenih mjesta, koristi opće prijedloge"}

Plan napiši po danima s vremenima, KONKRETNIM imenima mjesta (npr. "Restoran Adriatic" ne samo "restoran"), adresama gdje dostupno, procjenama troška. Piši na hrvatskom.`;

      try {
        const resp = await fetch(`${API_BASE_URL}/api/ai/plan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ prompt }),
        });
        if (resp.ok) {
          const data = await resp.json();
          text = data.result || data.text || "";
        }
      } catch {
        /* AI nije dostupan, idemo na template */
      }

      if (!text) {
        text = buildPlanWithVenues(
          destination,
          postalCode,
          accommodationAddress,
          period,
          people,
          companions,
          budget,
          activityRadius,
          transport,
          preference,
          interests,
          venues,
        );
      }

      setResult(text);
      setStep("result");
    } catch (e) {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
      Alert.alert(t("common.error"), t("plan.planError"));
      setStep("form");
    }
  };

  const copyPlan = () => {
    Share.share({ message: result }).catch(() =>
      Alert.alert(t("common.error"), t("plan.shareFailed")),
    );
  };

  const PERIOD_OPTIONS: { key: PlanPeriod; labelKey: string }[] = [
    { key: "dan", labelKey: "plan.day1" },
    { key: "vikend", labelKey: "plan.weekend" },
    { key: "tjedan", labelKey: "plan.week" },
    { key: "2tjedna", labelKey: "plan.twoWeeks" },
    { key: "godisnji", labelKey: "plan.vacation" },
  ];
  const COMPANION_OPTIONS: {
    key: CompanionType;
    labelKey: string;
    icon: string;
  }[] = [
    { key: "solo", labelKey: "plan.solo", icon: "🧑" },
    { key: "partner", labelKey: "plan.partner", icon: "💑" },
    { key: "prijatelji", labelKey: "plan.friends", icon: "👫" },
    { key: "obitelj", labelKey: "plan.family", icon: "👨‍👩‍👧" },
    { key: "misovito", labelKey: "plan.mixed", icon: "🎉" },
  ];
  const TRANSPORT_OPTIONS: {
    key: TransportType;
    labelKey: string;
    icon: string;
  }[] = [
    { key: "auto", labelKey: "plan.car", icon: "🚗" },
    { key: "javni", labelKey: "plan.public", icon: "🚌" },
    { key: "pjesice", labelKey: "plan.walking", icon: "🚶" },
    { key: "bicikl", labelKey: "plan.bicycle", icon: "🚲" },
  ];
  const PREF_OPTIONS: {
    key: PreferenceType;
    labelKey: string;
    icon: string;
  }[] = [
    { key: "otvoreno", labelKey: "plan.outdoors", icon: "🌞" },
    { key: "zatvoreno", labelKey: "plan.indoors", icon: "🏠" },
    { key: "kombinirano", labelKey: "plan.combined", icon: "🌤️" },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* Header */}
        <View style={pm.header}>
          {step === "result" ? (
            <TouchableOpacity onPress={() => setStep("form")}>
              <Text style={pm.headerLink}>← Novi plan</Text>
            </TouchableOpacity>
          ) : step === "loading" ? (
            <View style={{ width: 60 }} />
          ) : (
            <TouchableOpacity onPress={handleClose}>
              <Text style={pm.headerLink}>✕ {t("common.close")}</Text>
            </TouchableOpacity>
          )}
          <Text style={pm.headerTitle}>
            {step === "form"
              ? t("map.planTrip")
              : step === "loading"
                ? t("map.generatingPlan")
                : t("map.tripPlan")}
          </Text>
          {step === "result" ? (
            <TouchableOpacity onPress={copyPlan}>
              <Text style={pm.headerLink}>📋 {t("common.copy")}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* LOADING VIEW */}
        {step === "loading" && (
          <View style={pm.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={pm.loadingIcon}>
              {LOADING_MESSAGES[loadingStep].icon}
            </Text>
            <Text style={pm.loadingText}>
              {LOADING_MESSAGES[loadingStep].text}
            </Text>
            <ProgressBar step={loadingStep} total={LOADING_MESSAGES.length} />
            <Text style={pm.loadingHint}>
              {t("plan.fetchingPlacesFrom", { destination })}
            </Text>
          </View>
        )}

        {/* RESULT VIEW */}
        {step === "result" && (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            {/* 🔥 Gumb za brzo označavanje posjeta - DODATI NA VRH */}
            {onMarkVisited && visits && (
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "600", marginBottom: 8 }}
                >
                  ✨ Brza akcija
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#34c759",
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  onPress={async () => {
                    // Ekstrahiraj prvo mjesto iz plana (jednostavna heuristika)
                    const lines = result.split("\n");
                    let firstPlaceName = "";
                    for (const line of lines) {
                      if (line.match(/[🍽️☕🏖️🏰]/) && line.includes(":")) {
                        const match = line.match(/:\s*(.+?)(?:\s*\(|$)/);
                        if (match) {
                          firstPlaceName = match[1].trim();
                          break;
                        }
                      }
                    }
                    if (firstPlaceName) {
                      // Pokušaj pronaći mjesto u allVenues
                      let foundPlace: Place | null = null;
                      for (const typeVenues of Object.values(allVenues)) {
                        for (const v of typeVenues) {
                          if (
                            v.name
                              .toLowerCase()
                              .includes(firstPlaceName.toLowerCase()) ||
                            firstPlaceName
                              .toLowerCase()
                              .includes(v.name.toLowerCase())
                          ) {
                            foundPlace = {
                              id: `plan_${Date.now()}`,
                              name: v.name,
                              latitude: v.latitude,
                              longitude: v.longitude,
                              type:
                                (Object.keys(placeCategories).find((t) =>
                                  allVenues[t]?.some((x) => x.name === v.name),
                                ) as Place["type"]) || "restaurant",
                              address: v.address,
                            };
                            break;
                          }
                        }
                        if (foundPlace) break;
                      }
                      if (foundPlace && onMarkVisited) {
                        await onMarkVisited(foundPlace);
                        Alert.alert(
                          "✅ Posjećeno!",
                          `${foundPlace.name} dodano u arhivu.`,
                        );
                      } else {
                        Alert.alert(
                          "⚠️ Nije pronađeno",
                          "Kliknite na marker na karti za ručno označavanje.",
                        );
                      }
                    } else {
                      Alert.alert(
                        "ℹ️ Savjet",
                        "Kliknite na bilo koji marker na karti da označite posjet.",
                      );
                    }
                  }}
                >
                  <Text style={{ fontSize: 16 }}>✅</Text>
                  <Text
                    style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}
                  >
                    {t("map.quickMarkVisited")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={mapLegend.header}>
              <View>
                <Text style={mapLegend.headerTitle}>
                  {t("map.destinationMap")}
                </Text>
                <Text style={mapLegend.headerSub}>
                  {accommodationAddress
                    ? `Smještaj: ${accommodationAddress}`
                    : "Odaberite adresu smještaja za precizniji prikaz"}
                </Text>
              </View>
              {accommodationCoords && (
                <TouchableOpacity
                  style={mapLegend.recenterBtn}
                  onPress={() => {
                    if (mapRef.current) {
                      mapRef.current.animateToRegion(
                        {
                          latitude: accommodationCoords.latitude,
                          longitude: accommodationCoords.longitude,
                          latitudeDelta: 0.05,
                          longitudeDelta: 0.05,
                        },
                        800,
                      );
                    }
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🎯</Text>
                </TouchableOpacity>
              )}
            </View>

            <MapView
              ref={mapRef}
              style={{ height: 380, borderRadius: 16, marginBottom: 8 }}
              initialRegion={{
                latitude: accommodationCoords?.latitude || 45.815,
                longitude: accommodationCoords?.longitude || 15.9819,
                latitudeDelta: 0.06,
                longitudeDelta: 0.06,
              }}
            >
              {/* Smještaj marker */}
              {accommodationCoords && (
                <Marker
                  coordinate={accommodationCoords}
                  title="🏨 Vaš smještaj"
                  description={accommodationAddress || "Adresa smještaja"}
                  pinColor="#667eea"
                />
              )}

              {/* Markeri svih mjesta po kategorijama - SVE OPCIJE (ne samo odabrane) */}
              {Object.entries(allVenues).map(([type, options]) =>
                options.map((venue, idx) => {
                  const cat =
                    placeCategories[type as keyof typeof placeCategories];
                  return (
                    <PlaceMarker
                      key={`plan_marker_${type}_${idx}`}
                      place={venueToPlace(venue, type)}
                      isVisited={
                        visits?.some(
                          (v) =>
                            v.placeName === venue.name && v.placeType === type,
                        ) ?? false
                      }
                      onPress={() => {
                        const placeObj = venueToPlace(venue, type);
                        setSelectedPlaceForDetail(placeObj);
                        setShowDetailModal(true);
                      }}
                    />
                  );
                }),
              )}
            </MapView>

            {/* Vizualna legenda */}
            <View style={mapLegend.legendContainer}>
              <Text style={mapLegend.legendTitle}>{t("plan.mapLegend")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={mapLegend.legendRow}>
                  {accommodationCoords && (
                    <View
                      style={[
                        mapLegend.chip,
                        {
                          backgroundColor: "#667eea22",
                          borderColor: "#667eea",
                        },
                      ]}
                    >
                      <View
                        style={[mapLegend.dot, { backgroundColor: "#667eea" }]}
                      />
                      <Text style={mapLegend.chipText}>🏨 Smještaj</Text>
                    </View>
                  )}
                  {Object.entries(allVenues).map(([type, options]) => {
                    const cat =
                      placeCategories[type as keyof typeof placeCategories];
                    if (!cat || !options.length) return null;
                    const hex = cat.color;
                    const isSelected = selectedVenues[type] !== undefined;
                    return (
                      <View
                        key={type}
                        style={[
                          mapLegend.chip,
                          { backgroundColor: hex + "22", borderColor: hex },
                          isSelected && { borderWidth: 2.5 },
                        ]}
                      >
                        <View
                          style={[mapLegend.dot, { backgroundColor: hex }]}
                        />
                        <Text style={mapLegend.chipText}>
                          {EMOJIS[type]}{" "}
                          {t(`categories.${type}`, { defaultValue: type })} (
                          {options.length})
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
              <Text style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                💡 Kliknite marker na karti za detalje, ocjenu i označavanje
                posjete
              </Text>
            </View>

            {/* Distance chips od smještaja */}
            {accommodationCoords && Object.entries(allVenues).length > 0 && (
              <View style={mapLegend.distanceSection}>
                <Text style={mapLegend.distanceTitle}>
                  {t("plan.distanceFromAccommodation")}
                </Text>
                <View style={mapLegend.distanceGrid}>
                  {Object.entries(allVenues).map(([type, options]) => {
                    const idx = selectedVenues[type] ?? 0;
                    const venue = options[idx];
                    if (!venue) return null;
                    const cat =
                      placeCategories[type as keyof typeof placeCategories];
                    const dist = haversineKm(
                      accommodationCoords.latitude,
                      accommodationCoords.longitude,
                      venue.latitude,
                      venue.longitude,
                    );
                    const isClose = dist < 1;
                    return (
                      <View
                        key={type}
                        style={[
                          mapLegend.distanceChip,
                          { borderLeftColor: cat?.color || "#999" },
                        ]}
                      >
                        <Text style={mapLegend.distanceEmoji}>
                          {EMOJIS[type] || "📍"}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={mapLegend.distanceName}
                            numberOfLines={1}
                          >
                            {venue.name}
                          </Text>
                          <Text
                            style={[
                              mapLegend.distanceKm,
                              { color: isClose ? "#34c759" : "#667eea" },
                            ]}
                          >
                            {isClose
                              ? `${Math.round(dist * 1000)} m`
                              : `${dist.toFixed(1)} km`}{" "}
                            {isClose ? "🟢" : "🔵"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Izbor mjesta po kategoriji */}
            {Object.entries(allVenues).map(([type, options]) => (
              <View key={type} style={{ marginBottom: 16 }}>
                <Text style={{ fontWeight: "700", marginBottom: 8 }}>
                  {EMOJIS[type]}{" "}
                  {t(`categories.${type}`, { defaultValue: type })}
                </Text>
                {options.map((venue, idx) => {
                  const dist = accommodationCoords
                    ? haversineKm(
                        accommodationCoords.latitude,
                        accommodationCoords.longitude,
                        venue.latitude,
                        venue.longitude,
                      ).toFixed(1) + " km"
                    : "";
                  const isSelected = (selectedVenues[type] ?? 0) === idx;
                  const alreadyVisited = visits?.some(
                    (v) => v.placeName === venue.name,
                  );
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: isSelected ? "#f0f0ff" : "#fafafa",
                        borderWidth: 1.5,
                        borderColor: isSelected ? "#667eea" : "#eee",
                        marginBottom: 6,
                        opacity: alreadyVisited ? 0.6 : 1,
                      }}
                      onPress={() =>
                        setSelectedVenues((prev) => ({ ...prev, [type]: idx }))
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "600" }}>
                          {venue.name}
                          {alreadyVisited && (
                            <Text
                              style={{
                                color: "#34c759",
                                fontSize: 12,
                                marginLeft: 6,
                              }}
                            >
                              {" "}
                              ✓ posjećeno
                            </Text>
                          )}
                        </Text>
                        {venue.address && (
                          <Text style={{ fontSize: 12, color: "#999" }}>
                            {venue.address}
                          </Text>
                        )}
                        <Text style={{ fontSize: 12, color: "#667eea" }}>
                          📏 {dist}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={{ color: "#667eea", fontWeight: "800" }}>
                          ✓
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Generirani tekst plana */}
            <PlanRenderer text={result} />

            <View style={{ gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={pm.btnPrimary} onPress={copyPlan}>
                <Text style={pm.btnPrimaryText}>📋 Kopiraj cijeli plan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={pm.btnSecondary}
                onPress={() => setStep("form")}
              >
                <Text style={pm.btnSecondaryText}>← Generiraj novi plan</Text>
              </TouchableOpacity>
            </View>
            {/* PlaceDetailModal za detalje mjesta */}
            <PlaceDetailModal
              place={selectedPlaceForDetail}
              visible={showDetailModal}
              onClose={() => {
                setShowDetailModal(false);
                setSelectedPlaceForDetail(null);
              }}
              onMarkVisited={async (p) => {
                if (onMarkVisited) {
                  await onMarkVisited(p);
                }
                setShowDetailModal(false);
                setSelectedPlaceForDetail(null);
                // Automatski označi u planu ako nije već odabrano
                const idx =
                  allVenues[p.type]?.findIndex((v) => v.name === p.name) ?? -1;
                if (idx >= 0) {
                  setSelectedVenues((prev) => ({ ...prev, [p.type]: idx }));
                }
              }}
              onHidePlace={() => {
                setShowDetailModal(false);
              }}
              isVisited={
                selectedPlaceForDetail
                  ? (visits?.some(
                      (v) =>
                        v.placeName === selectedPlaceForDetail.name &&
                        v.placeType === selectedPlaceForDetail.type,
                    ) ?? false)
                  : false
              }
              notifPrefs={{
                appEnabled: false,
                emailEnabled: false,
                email: "",
                categories: [],
              }}
              onToggleNotif={() => {}}
            />
          </ScrollView>
        )}

        {/* FORM VIEW */}
        {step === "form" && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Destinacija */}
              <Text style={pm.sectionTitle}>{t("map.destination")}</Text>
              <View style={pm.row}>
                <TextInput
                  style={[pm.input, { flex: 2 }]}
                  placeholder={t("plan.destinationPlaceholder")}
                  placeholderTextColor="#bbb"
                  value={destination}
                  onChangeText={setDestination}
                />
                <TextInput
                  style={[pm.input, { flex: 1, marginLeft: 8 }]}
                  placeholder={t("plan.postalCode")}
                  placeholderTextColor="#bbb"
                  value={postalCode}
                  onChangeText={setPostalCode}
                  keyboardType="numeric"
                />
              </View>
              <TextInput
                style={pm.input}
                placeholder={t("plan.accommodation")}
                placeholderTextColor="#bbb"
                value={accommodationAddress}
                onChangeText={setAccommodationAddress}
              />

              {/* Trajanje */}
              <Text style={pm.sectionTitle}>{t("map.duration")}</Text>
              <View style={pm.chipRow}>
                {PERIOD_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={[pm.chip, period === o.key && pm.chipActive]}
                    onPress={() => setPeriod(o.key)}
                  >
                    <Text
                      style={[
                        pm.chipText,
                        period === o.key && pm.chipTextActive,
                      ]}
                    >
                      {t(o.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Putnici */}
              <Text style={pm.sectionTitle}>{t("map.travelers")}</Text>
              <View style={pm.row}>
                <View style={{ flex: 1 }}>
                  <Text style={pm.label}>{t("plan.numberOfPeople")}</Text>
                  <View style={pm.chipRow}>
                    {["1", "2", "3", "4", "5+"].map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={[pm.chipSmall, people === n && pm.chipActive]}
                        onPress={() => setPeople(n === "5+" ? "6" : n)}
                      >
                        <Text
                          style={[
                            pm.chipText,
                            people === (n === "5+" ? "6" : n) &&
                              pm.chipTextActive,
                          ]}
                        >
                          {n}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={pm.label}>{t("plan.travelWith")}</Text>
              <View style={pm.chipRow}>
                {COMPANION_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={[pm.chipMd, companions === o.key && pm.chipActive]}
                    onPress={() => setCompanions(o.key)}
                  >
                    <Text style={{ fontSize: 16 }}>{o.icon}</Text>
                    <Text
                      style={[
                        { fontSize: 12, marginTop: 3, color: "#555" },
                        companions === o.key && pm.chipTextActive,
                      ]}
                    >
                      {t(o.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Budžet */}
              <Text style={pm.sectionTitle}>💰 {t("map.budgetTitle")}</Text>
              <View style={pm.chipRow}>
                {["200", "500", "1000", "2000", "5000"].map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[pm.chip, budget === b && pm.chipActive]}
                    onPress={() => setBudget(b)}
                  >
                    <Text
                      style={[pm.chipText, budget === b && pm.chipTextActive]}
                    >
                      {b} €
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[pm.input, { marginTop: 8 }]}
                placeholder={t("plan.budget")}
                placeholderTextColor="#bbb"
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
              />

              {/* Radijus */}
              <Text style={pm.sectionTitle}>{t("map.activityRadius")}</Text>
              <View style={pm.chipRow}>
                {[1, 2, 3, 5, 10, 20].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[pm.chip, activityRadius === r && pm.chipActive]}
                    onPress={() => setActivityRadius(r)}
                  >
                    <Text
                      style={[
                        pm.chipText,
                        activityRadius === r && pm.chipTextActive,
                      ]}
                    >
                      {r} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Prijevoz */}
              <Text style={pm.sectionTitle}>🚗 Prijevoz</Text>
              <View style={pm.chipRow}>
                {TRANSPORT_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={[pm.chipMd, transport === o.key && pm.chipActive]}
                    onPress={() => setTransport(o.key)}
                  >
                    <Text style={{ fontSize: 16 }}>{o.icon}</Text>
                    <Text
                      style={[
                        { fontSize: 12, marginTop: 3, color: "#555" },
                        transport === o.key && pm.chipTextActive,
                      ]}
                    >
                      {t(o.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preferencija */}
              <Text style={pm.sectionTitle}>{t("map.activities")}</Text>
              <View style={pm.chipRow}>
                {PREF_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={[pm.chipMd, preference === o.key && pm.chipActive]}
                    onPress={() => setPreference(o.key)}
                  >
                    <Text style={{ fontSize: 16 }}>{o.icon}</Text>
                    <Text
                      style={[
                        { fontSize: 12, marginTop: 3, color: "#555" },
                        preference === o.key && pm.chipTextActive,
                      ]}
                    >
                      {t(o.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Interesi */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text style={pm.sectionTitle}>
                  {t("map.interestsOptional")}
                </Text>
                {interests.length > 0 && (
                  <TouchableOpacity onPress={() => setInterests([])}>
                    <Text style={{ fontSize: 13, color: "#667eea" }}>
                      {t("plan.clearInterests")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 24,
                }}
              >
                {getAllCategories().map((cat) => {
                  const on = interests.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 11,
                        paddingVertical: 7,
                        borderRadius: 18,
                        backgroundColor: on ? cat.color : "#f0f0f0",
                      }}
                      onPress={() => toggleInterest(cat.id)}
                    >
                      <Text style={{ fontSize: 13 }}>{cat.icon}</Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: on ? "#fff" : "#555",
                        }}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Gumb */}
              <TouchableOpacity style={pm.generateBtn} onPress={generate}>
                <Text style={pm.generateBtnText}>{t("map.generatePlan")}</Text>
              </TouchableOpacity>
              <Text style={pm.generateHint}>
                {t("plan.generateHint", {
                  destination: destination || t("plan.destination"),
                })}
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* 🔥 MODAL ZA DETALJE MJESTA - NA KRAJU, PRIJE ZATVARANJA */}
        {selectedMapPlace && (
          <Modal
            visible={true}
            transparent
            animationType="slide"
            onRequestClose={() => setSelectedMapPlace(null)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.5)",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 20,
                  maxHeight: "70%",
                }}
              >
                <TouchableOpacity
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    zIndex: 1,
                  }}
                  onPress={() => setSelectedMapPlace(null)}
                >
                  <Text style={{ fontSize: 18 }}>✕</Text>
                </TouchableOpacity>

                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "800",
                    marginBottom: 8,
                  }}
                >
                  {EMOJIS[selectedMapPlace.type]} {selectedMapPlace.name}
                </Text>

                <PlaceDetailInPlan place={selectedMapPlace} />

                <TouchableOpacity
                  style={{
                    backgroundColor: "#667eea",
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: "center",
                    marginTop: 16,
                  }}
                  onPress={() => {
                    setSelectedVenues((prev) => ({
                      ...prev,
                      [selectedMapPlace.type]:
                        allVenues[selectedMapPlace.type]?.findIndex(
                          (v) => v.name === selectedMapPlace.name,
                        ) ?? 0,
                    }));
                    setSelectedMapPlace(null);
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    {t("plan.selectBtn")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const mapLegend = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  headerSub: { fontSize: 12, color: "#888", marginTop: 2, maxWidth: "90%" },
  recenterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f0f0ff",
    justifyContent: "center",
    alignItems: "center",
  },
  legendContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  legendRow: { flexDirection: "row", gap: 8, paddingBottom: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 11, fontWeight: "600", color: "#333" },
  distanceSection: {
    backgroundColor: "#f8f9ff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  distanceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  distanceGrid: { gap: 8 },
  distanceChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 4,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  distanceEmoji: { fontSize: 22 },
  distanceName: { fontSize: 13, fontWeight: "600", color: "#333" },
  distanceKm: { fontSize: 12, fontWeight: "700", marginTop: 2 },
});

// ─── Visit Archive Modal ──────────────────────────────────────────────────────
function VisitArchiveModal({
  visible,
  onClose,
  visits,
  onSelectVisit,
  onDeleteVisit,
}: {
  visible: boolean;
  onClose: () => void;
  visits: VisitRecord[];
  onSelectVisit: (v: VisitRecord) => void;
  onDeleteVisit: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<string | null>(null);
  const filtered = filter
    ? visits.filter((v) => v.placeType === filter)
    : visits;
  const usedTypes = [...new Set(visits.map((v) => v.placeType))];
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: SH * 0.88,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: "#eee",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800" }}>
              📋 {t("map.visitArchive", { count: visits.length })}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                style={{ color: "#667eea", fontSize: 15, fontWeight: "600" }}
              >
                {t("common.close")}
              </Text>
            </TouchableOpacity>
          </View>
          {usedTypes.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{
                maxHeight: 52,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
              }}
              contentContainerStyle={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                gap: 8,
              }}
            >
              <TouchableOpacity
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  backgroundColor: !filter ? "#667eea" : "#f0f0f0",
                  borderRadius: 20,
                }}
                onPress={() => setFilter(null)}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: !filter ? "#fff" : "#555",
                  }}
                >
                  {t("common.all")}
                </Text>
              </TouchableOpacity>
              {usedTypes.map((type) => {
                const cat =
                  placeCategories[type as keyof typeof placeCategories];
                const active = filter === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      backgroundColor: active
                        ? cat?.color || "#667eea"
                        : "#f0f0f0",
                      borderRadius: 20,
                    }}
                    onPress={() => setFilter(active ? null : type)}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: active ? "#fff" : "#555",
                      }}
                    >
                      {EMOJIS[type]}{" "}
                      {t(`categories.${type}`, { defaultValue: type })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {filtered.length === 0 ? (
            <View style={{ alignItems: "center", padding: 60, gap: 12 }}>
              <Text style={{ fontSize: 48 }}>🗺️</Text>
              <Text style={{ fontSize: 15, color: "#999" }}>
                {visits.length === 0
                  ? t("map.noPlaces")
                  : t("common.noResults")}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const cat =
                  placeCategories[
                    item.placeType as keyof typeof placeCategories
                  ];
                const color = cat?.color || "#667eea";
                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#fafafa",
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 10,
                      gap: 12,
                    }}
                    onPress={() => {
                      onSelectVisit(item);
                      onClose();
                    }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        backgroundColor: color,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>
                        {EMOJIS[item.placeType] || "📍"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: "#1a1a1a",
                        }}
                        numberOfLines={1}
                      >
                        {item.placeName}
                      </Text>
                      {item.address ? (
                        <Text
                          style={{ fontSize: 12, color: "#999", marginTop: 2 }}
                          numberOfLines={1}
                        >
                          {item.address}
                        </Text>
                      ) : null}
                      <Text
                        style={{ fontSize: 12, color: "#667eea", marginTop: 3 }}
                      >
                        {new Date(item.visitedAt).toLocaleDateString("hr-HR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{
                        padding: 8,
                        borderRadius: 10,
                        backgroundColor: "#fff0f0",
                      }}
                      onPress={() =>
                        Alert.alert(
                          t("map.hidePlace"),
                          `${t("map.hidePlaceConfirm", { name: item.placeName })}`,
                          [
                            { text: t("common.cancel"), style: "cancel" },
                            {
                              text: t("common.remove"),
                              style: "destructive",
                              onPress: () => onDeleteVisit(item.id),
                            },
                          ],
                        )
                      }
                    >
                      <Text style={{ fontSize: 18 }}>🗑️</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Badges Modal ─────────────────────────────────────────────────────────────
function BadgesModal({
  visible,
  onClose,
  visits,
  getAllCategories,
}: {
  visible: boolean;
  onClose: () => void;
  visits: VisitRecord[];
  getAllCategories: () => {
    id: string;
    name: string;
    icon: string;
    color: string;
  }[];
}) {
  const { t } = useTranslation();

  const [badges, setBadges] = useState<Badge[]>([]);
  useEffect(() => {
    if (visible) loadJSON<Badge[]>(STORAGE_BADGES, []).then(setBadges);
  }, [visible]);
  const counts: Record<string, number> = {};
  visits.forEach((v) => {
    counts[v.placeType] = (counts[v.placeType] || 0) + 1;
  });
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: SH * 0.88,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: "#eee",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#1a1a1a" }}>
              🏆 {t("map.badges")}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                style={{ color: "#667eea", fontSize: 15, fontWeight: "600" }}
              >
                {t("map.badgesClose")}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {getAllCategories().map((cat) => {
              const count = counts[cat.id] || 0;
              const earned = BADGE_T.filter((t) =>
                badges.find((b) => b.category === cat.id && b.level === t),
              );
              const next = BADGE_T.find((t) => count < t);
              return (
                <View
                  key={cat.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    backgroundColor: "#fafafa",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: cat.color,
                    gap: 10,
                  }}
                >
                  <Text style={{ fontSize: 28, marginTop: 2 }}>{cat.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: "#1a1a1a",
                      }}
                    >
                      {cat.name}
                    </Text>
                    <Text
                      style={{ fontSize: 13, color: "#667eea", marginTop: 2 }}
                    >
                      {t("map.visitCount", { count })}
                    </Text>
                    {next && (
                      <Text
                        style={{ fontSize: 12, color: "#999", marginTop: 2 }}
                      >
                        {t("map.nextBadgeIn", { count: next - count })}
                      </Text>
                    )}
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 6,
                        marginTop: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {BADGE_T.map((t) => {
                        const e = earned.includes(t);
                        return (
                          <View
                            key={t}
                            style={{
                              borderRadius: 10,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              backgroundColor: e ? cat.color : "#e0e0e0",
                              minWidth: 40,
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: "800",
                              }}
                            >
                              {t}x
                            </Text>
                            {e && (
                              <Text
                                style={{
                                  color: "#fff",
                                  fontSize: 9,
                                  fontWeight: "600",
                                }}
                              >
                                {(BADGE_NAMES[cat.id]?.[t] || "").split(" ")[0]}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const CELL_W = (SW - 32 - 16) / 3;
const TIME_CATS: Record<string, string[]> = {
  jutro: ["cafe", "park", "landmark", "museum", "market"],
  poslijepodne: ["restaurant", "museum", "beach", "cinema", "opg", "market"],
  vecer: ["club", "theater", "restaurant", "spa"],
};

export default function DashboardScreen() {
  const { t } = useTranslation();
  const getAllCategories = useCallback(() => {
    return Object.entries(placeCategories).map(([id, c]) => ({
      id,
      name: t(`categories.${id}`, { defaultValue: id }),
      icon: EMOJIS[id] || "📍",
      color: c.color,
    }));
  }, [t]);
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  // Dodaj uz ostale state-ove:
  const [realNotificationCount, setRealNotificationCount] = useState(0);
  const [searchLocation, setSearchLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [searchLocationName, setSearchLocationName] = useState<string>("");
  const [cityQuery, setCityQuery] = useState("");
  const [citySearching, setCitySearching] = useState(false);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [radius, setRadius] = useState(5);
  // Svi pronađeni rezultati (neograničeni)
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  // Broj koji se prikazuje na karti
  const [displayLimit, setDisplayLimit] = useState(INITIAL_RESULTS_LIMIT);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [activeTimeOfDay, setActiveTimeOfDay] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [showPlanMyDay, setShowPlanMyDay] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showPlaceDetail, setShowPlaceDetail] = useState(false);

  const [showRadiusCircle, setShowRadiusCircle] = useState(true);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [showOnlyVisited, setShowOnlyVisited] = useState(false);
  const [hiddenPlaceIds, setHiddenPlaceIds] = useState<string[]>([]);

  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);

  // Izbrišite gornju konstantu i dodajte OVO unutar DashboardScreen komponente:
  const getAgeGroups = useCallback(() => {
    return [
      {
        id: "minors",
        label: t("ageGroups.minors"),
        emoji: "👦",
        desc: "< 18",
        cats: ["park", "cinema", "beach", "museum", "escapeRoom"],
        color: "#3498DB",
      },
      {
        id: "youth",
        label: t("ageGroups.youth"),
        emoji: "🧑",
        desc: "18–25",
        cats: [
          "club",
          "cinema",
          "beach",
          "escapeRoom",
          "paintball",
          "park",
          "cafe",
        ],
        color: "#9B59B6",
      },
      {
        id: "students",
        label: t("ageGroups.students"),
        emoji: "🎓",
        desc: t("ageGroups.studentDesc"),
        cats: [
          "cafe",
          "cinema",
          "museum",
          "theater",
          "park",
          "escapeRoom",
          "restaurant",
        ],
        color: "#667eea",
      },
      {
        id: "adults",
        label: t("ageGroups.adults"),
        emoji: "👔",
        desc: "26–60",
        cats: [
          "restaurant",
          "cafe",
          "spa",
          "theater",
          "museum",
          "landmark",
          "market",
          "accommodation",
        ],
        color: "#E67E22",
      },
      {
        id: "retired",
        label: t("ageGroups.retired"),
        emoji: "👴",
        desc: "60+",
        cats: [
          "restaurant",
          "cafe",
          "spa",
          "museum",
          "landmark",
          "park",
          "market",
        ],
        color: "#27AE60",
      },
    ];
  }, [t]);

  // Logika filtriranja po dobi (dodaj ISPOD deklaracije `places`):
  // Promijenite ovisnosti za ageAllowedCats:
  const ageAllowedCats = useMemo(() => {
    if (selectedAgeGroups.length === 0) return null;
    return [
      ...new Set(
        selectedAgeGroups.flatMap(
          (gId) => getAgeGroups().find((g) => g.id === gId)?.cats ?? [],
        ),
      ),
    ];
  }, [selectedAgeGroups, getAgeGroups]);

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    appEnabled: true,
    emailEnabled: false,
    email: "",
    categories: [],
  });

  const activeSearchLoc = searchLocation || userLocation;
  // Rezultati koji se prikazuju na karti (ograničeni na displayLimit)
  const places = allPlaces.slice(0, displayLimit);

  const initialRegion: Region = {
    latitude: 45.815,
    longitude: 15.9819,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  useEffect(() => {
    // Tiho dohvati posjete — ne crashaj ako nema mreže
    backendGetVisits()
      .then((sv) => {
        if (sv.length > 0) setVisits(sv);
      })
      .catch(() => {});
    loadJSON<string[]>(STORAGE_HIDDEN, []).then(setHiddenPlaceIds);
    loadJSON<NotifPrefs>(STORAGE_NOTIFS, {
      appEnabled: true,
      emailEnabled: false,
      email: "",
      categories: [],
    }).then(setNotifPrefs);
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (activeSearchLoc && selectedTypes.length > 0 && !showOnlyVisited) {
      // Reset limit svaki put kad se promijene filteri/lokacija
      setDisplayLimit(INITIAL_RESULTS_LIMIT);
      const t = setTimeout(() => loadPlacesInRadius(), 400);
      return () => clearTimeout(t);
    } else if (!showOnlyVisited) {
      setAllPlaces([]);
    }
  }, [activeSearchLoc, radius, selectedTypes, showOnlyVisited]);

  // ── BRZA LOKACIJA ──────────────────────────────────────────────────────────
  // Korak 1: Balanced (brzo ~1-3s) → odmah centrira kartu
  // Korak 2: High (točno, 5-10s) → tiho ažurira u pozadini
  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("map.locationError"), t("map.locationDenied"));
      return;
    }
    setLocationPermission(true);
    getLocationFast();
  };

  const getLocationFast = async () => {
    try {
      // KORAK 1 — Balanced: brzo, manje precizno
      const fastLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      applyLocation(fastLoc.coords.latitude, fastLoc.coords.longitude);

      // KORAK 2 — High: precizno, u pozadini
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        .then((precLoc) => {
          applyLocation(precLoc.coords.latitude, precLoc.coords.longitude);
        })
        .catch(() => {
          // Ignorira — već imamo Balanced lokaciju
        });
    } catch {
      Alert.alert(t("common.error"), t("map.locationError"));
    }
  };

  const applyLocation = (latitude: number, longitude: number) => {
    setUserLocation({ latitude, longitude });
    const region = {
      latitude,
      longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
    setMapRegion(region);
    mapRef.current?.animateToRegion(region, 800);
  };

  const getCurrentLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      applyLocation(loc.coords.latitude, loc.coords.longitude);
    } catch {
      Alert.alert(t("common.error"), t("map.locationError"));
    }
  };

  const handleCitySearch = async () => {
    if (!cityQuery.trim()) return;
    setCitySearching(true);
    try {
      const result = await geocodeCity(cityQuery.trim());
      if (!result) {
        Alert.alert(
          t("common.noResults"),
          `${t("common.noResults")}: "${cityQuery}"`,
        );
        return;
      }
      setSearchLocation({
        latitude: result.latitude,
        longitude: result.longitude,
      });
      setSearchLocationName(result.displayName);
      clearPlacesCache();
      const region = {
        latitude: result.latitude,
        longitude: result.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
      setMapRegion(region);
      mapRef.current?.animateToRegion(region, 1000);
      Alert.alert(
        t("map.locationChanged"),
        t("map.searchingAround", { name: result.displayName }),
      );
    } catch {
      Alert.alert(t("common.error"), t("map.locationError"));
    } finally {
      setCitySearching(false);
    }
  };

  const clearCitySearch = () => {
    setSearchLocation(null);
    setSearchLocationName("");
    setCityQuery("");
    clearPlacesCache();
    if (userLocation) {
      const region = {
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setMapRegion(region);
      mapRef.current?.animateToRegion(region, 800);
    }
  };

  const loadPlacesInRadius = async () => {
    if (!activeSearchLoc || selectedTypes.length === 0) return;
    setIsLoadingPlaces(true);
    try {
      const raw = await getPlacesInRadius(
        activeSearchLoc.latitude,
        activeSearchLoc.longitude,
        radius,
        selectedTypes as any,
      );
      const seen = new Set<string>();
      const deduped = raw.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      const filtered = deduped.filter(
        (p) =>
          !hiddenPlaceIds.includes(p.id) &&
          haversineKm(
            activeSearchLoc.latitude,
            activeSearchLoc.longitude,
            p.latitude,
            p.longitude,
          ) <= radius,
      );
      setAllPlaces(filtered);
      setDisplayLimit(INITIAL_RESULTS_LIMIT);

      // Centriraj kartu na prvih 10
      const forMap = filtered.slice(0, INITIAL_RESULTS_LIMIT);
      if (forMap.length > 0 && mapRef.current) {
        mapRef.current.fitToCoordinates(
          [
            ...forMap.map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            })),
            {
              latitude: activeSearchLoc.latitude,
              longitude: activeSearchLoc.longitude,
            },
          ],
          {
            edgePadding: { top: 110, right: 60, bottom: 150, left: 60 },
            animated: true,
          },
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchPlaces(
        searchQuery,
        activeSearchLoc?.latitude,
        activeSearchLoc?.longitude,
      );
      setSearchResults(results);
      setShowSearchResults(true);
    } catch {
      Alert.alert(t("common.error"), t("common.tryAgain"));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (place: Place) => {
    mapRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      800,
    );
    setSearchQuery(place.name);
    setShowSearchResults(false);
    setSelectedPlace(place);
    setShowPlaceDetail(true);
  };

  const toggleType = useCallback((type: string) => {
    setActiveTimeOfDay(null);
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  const applyTimeOfDay = (tod: string) => {
    if (activeTimeOfDay === tod) {
      setActiveTimeOfDay(null);
      setSelectedTypes([]);
    } else {
      setActiveTimeOfDay(tod);
      setSelectedTypes(TIME_CATS[tod] || []);
    }
  };

  const handleMarkVisited = async (place: Place) => {
    if (visits.find((v) => v.placeId === place.id)) {
      Alert.alert(
        t("map.markedVisited"),
        t("map.alreadyVisited", { name: place.name }),
      );
      return;
    }
    const nv: VisitRecord = {
      id: `${Date.now()}_${place.id}`,
      placeId: place.id,
      placeName: place.name,
      placeType: place.type,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      visitedAt: new Date().toISOString(),
    };
    const updated = [nv, ...visits];
    setVisits(updated);
    await backendAddVisit(nv);
    const newBadges = await checkBadges(place.type, updated);
    if (newBadges.length > 0) {
      for (const b of newBadges)
        Alert.alert(
          "🏆 Nova značka!",
          `Zaradili ste:\n"${BADGE_NAMES[b.category]?.[b.level] || `Značka ${b.level}`}"`,
        );
    } else
      Alert.alert(
        t("map.markedVisited"),
        t("map.addedToArchive", { name: place.name }),
      );
  };

  const handleDeleteVisit = async (id: string) => {
    await backendDeleteVisit(id);
    setVisits((prev) => prev.filter((v) => v.id !== id));
  };

  const handleHidePlace = async (placeId: string) => {
    const updated = [...hiddenPlaceIds, placeId];
    setHiddenPlaceIds(updated);
    await saveJSON(STORAGE_HIDDEN, updated);
    setAllPlaces((prev) => prev.filter((p) => p.id !== placeId));
  };

  const handleRestorePlace = async (placeId: string) => {
    const updated = hiddenPlaceIds.filter((id) => id !== placeId);
    setHiddenPlaceIds(updated);
    await saveJSON(STORAGE_HIDDEN, updated);
  };

  const handleToggleNotif = (catId: string) => {
    const newPrefs = {
      ...notifPrefs,
      categories: notifPrefs.categories.includes(catId)
        ? notifPrefs.categories.filter((c) => c !== catId)
        : [...notifPrefs.categories, catId],
    };
    setNotifPrefs(newPrefs);
    saveJSON(STORAGE_NOTIFS, newPrefs);
  };

  const isVisited = (placeId: string) =>
    visits.some((v) => v.placeId === placeId);
  const ageFilteredPlaces =
    ageAllowedCats && !showOnlyVisited
      ? places.filter((p) => ageAllowedCats.includes(p.type))
      : places;
  const placesForMap = showOnlyVisited ? [] : ageFilteredPlaces;

  // Ima li još rezultata koji nisu prikazani
  const hasMore = allPlaces.length > displayLimit;
  const showMoreCount = Math.min(allPlaces.length - displayLimit, 10);

  return (
    <View style={s.container}>
      <MapView
        ref={mapRef}
        style={s.map}
        region={mapRegion || initialRegion}
        onRegionChangeComplete={setMapRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        loadingEnabled
        loadingIndicatorColor="#667eea"
        zoomControlEnabled={Platform.OS === "android"}
      >
        {showRadiusCircle && activeSearchLoc && (
          <Circle
            center={activeSearchLoc}
            radius={radius * 1000}
            strokeWidth={2}
            strokeColor="#667eea"
            fillColor="rgba(102,126,234,0.08)"
          />
        )}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <UserLocationMarker />
          </Marker>
        )}
        {(() => {
          // Posjećena mjesta koja NISU u trenutnom placesForMap prikazu
          const displayedIds = new Set(placesForMap.map((p) => p.id));
          const extraVisited = visits
            .filter((v) => !displayedIds.has(v.placeId))
            .map((v) => ({
              id: v.placeId,
              name: v.placeName,
              latitude: v.latitude,
              longitude: v.longitude,
              type: v.placeType as Place["type"],
              address: v.address,
              _isVisited: true as const,
            }));

          const allMarkers = [
            ...placesForMap.map((p) => ({
              ...p,
              _isVisited: visits.some((v) => v.placeId === p.id),
            })),
            ...extraVisited,
          ];

          return allMarkers.map((place, i) => (
            <PlaceMarker
              key={`marker_${place.id}_${i}`}
              place={place}
              isVisited={(place as any)._isVisited}
              onPress={() => {
                setSelectedPlace(place);
                setShowPlaceDetail(true);
              }}
            />
          ));
        })()}
      </MapView>

      {/* Top bar */}
      <View style={s.topBar}>
        <View style={s.citySearchRow}>
          <TextInput
            style={s.cityInput}
            placeholder={t("map.searchCityPlaceholder")}
            placeholderTextColor="#999"
            value={cityQuery}
            onChangeText={setCityQuery}
            onSubmitEditing={handleCitySearch}
            returnKeyType="search"
          />
          {citySearching ? (
            <ActivityIndicator
              size="small"
              color="#667eea"
              style={{ marginRight: 8 }}
            />
          ) : (
            <TouchableOpacity
              style={s.citySearchBtn}
              onPress={handleCitySearch}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                {t("common.go")}
              </Text>
            </TouchableOpacity>
          )}
          {searchLocation && (
            <TouchableOpacity style={s.clearCityBtn} onPress={clearCitySearch}>
              <Text
                style={{ color: "#ff4757", fontSize: 12, fontWeight: "700" }}
              >
                ✕ {t("map.myLocationShort")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {searchLocation && (
          <View style={s.remoteBadge}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
              📍 {searchLocationName}
            </Text>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TouchableOpacity
            style={s.topBtn}
            onPress={() => setShowFilterPanel(true)}
          >
            <Text style={s.topBtnText}>
              {t("map.filters")}
              {selectedTypes.length > 0 ? ` (${selectedTypes.length})` : ""}
            </Text>
          </TouchableOpacity>
          {(["jutro", "poslijepodne", "vecer"] as const).map((tod) => (
            <TouchableOpacity
              key={tod}
              style={[s.todBtn, activeTimeOfDay === tod && s.todBtnA]}
              onPress={() => applyTimeOfDay(tod)}
            >
              <Text
                style={[s.todTxt, activeTimeOfDay === tod && { color: "#fff" }]}
              >
                {tod === "jutro" ? "🌅" : tod === "poslijepodne" ? "☀️" : "🌙"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Side panel */}
      <View style={s.sidePanel}>
        <TouchableOpacity style={s.sideBtn} onPress={getCurrentLocation}>
          <Text style={s.sideBtnTxt}>📍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.sideBtn}
          onPress={() => setShowRadiusCircle((v) => !v)}
        >
          <Text style={s.sideBtnTxt}>{showRadiusCircle ? "🔘" : "⚪"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.sideBtn, showOnlyVisited && s.sideBtnA]}
          onPress={() => setShowOnlyVisited((v) => !v)}
        >
          <Text style={[s.sideBtnTxt, showOnlyVisited && { color: "#fff" }]}>
            ✓
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.sideBtn}
          onPress={() => setShowPlanMyDay(true)}
        >
          <Text style={s.sideBtnTxt}>🗺️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={() => setShowGroups(true)}>
          <Text style={s.sideBtnTxt}>🤝</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.sideBtn}
          onPress={() => setShowArchive(true)}
        >
          <Text style={s.sideBtnTxt}>📋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={() => setShowBadges(true)}>
          <Text style={s.sideBtnTxt}>🏆</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.sideBtn}
          onPress={() => setShowNotifSettings(true)}
        >
          <Text style={s.sideBtnTxt}>🔔</Text>
          {realNotificationCount > 0 && (
            <View style={s.notifDot}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
                {realNotificationCount > 99 ? "99+" : realNotificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Loading / count bar */}
      {isLoadingPlaces && (
        <View style={s.loadingBar}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={s.loadingTxt}>{t("map.loading")}</Text>
        </View>
      )}
      {!isLoadingPlaces && (allPlaces.length > 0 || showOnlyVisited) && (
        <View style={s.bottomBar}>
          <Text style={s.countTxt}>
            {showOnlyVisited
              ? `✓ ${visits.length} ${t("map.visitedOnly")}`
              : t("map.shown", {
                  shown: Math.min(displayLimit, allPlaces.length),
                  total: allPlaces.length,
                })}
          </Text>
          {/* Prikaži više gumb */}
          {!showOnlyVisited && hasMore && (
            <TouchableOpacity
              style={s.showMoreBtn}
              onPress={() => {
                const newLimit = displayLimit + 10;
                setDisplayLimit(newLimit);
                // Centriraj kartu na nova mjesta
                const newSlice = allPlaces.slice(displayLimit, newLimit);
                if (newSlice.length > 0 && mapRef.current && activeSearchLoc) {
                  mapRef.current.fitToCoordinates(
                    [
                      ...allPlaces.slice(0, newLimit).map((p) => ({
                        latitude: p.latitude,
                        longitude: p.longitude,
                      })),
                      {
                        latitude: activeSearchLoc.latitude,
                        longitude: activeSearchLoc.longitude,
                      },
                    ],
                    {
                      edgePadding: {
                        top: 110,
                        right: 60,
                        bottom: 150,
                        left: 60,
                      },
                      animated: true,
                    },
                  );
                }
              }}
            >
              <Text style={s.showMoreTxt}>
                {t("map.showMore", { count: showMoreCount })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter Panel Modal */}
      <Modal
        visible={showFilterPanel}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowFilterPanel(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 20,
              paddingTop: Platform.OS === "ios" ? 54 : 36,
              borderBottomWidth: 1,
              borderBottomColor: "#eee",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#1a1a1a" }}>
              🔍 {t("map.filters")}
            </Text>
            <TouchableOpacity onPress={() => setShowFilterPanel(false)}>
              <Text
                style={{ fontSize: 15, color: "#667eea", fontWeight: "600" }}
              >
                ✕ {t("common.close")}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Search */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#333",
                  marginBottom: 12,
                }}
              >
                {t("map.searchPlaceholder")}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: "#f2f2f2",
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 15,
                    color: "#333",
                  }}
                  placeholder={t("common.placeNamePlaceholder")}
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={{
                    backgroundColor: "#667eea",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                    justifyContent: "center",
                  }}
                  onPress={handleSearch}
                >
                  {isSearching ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      {t("common.searchBtnShort")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              {showSearchResults && searchResults.length > 0 && (
                <View
                  style={{
                    marginTop: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#eee",
                    overflow: "hidden",
                  }}
                >
                  {searchResults.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 12,
                        gap: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: "#f0f0f0",
                      }}
                      onPress={() => {
                        handleSelectSearchResult(r);
                        setShowFilterPanel(false);
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>
                        {EMOJIS[r.type] || "📍"}
                      </Text>
                      <View>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: "#333",
                          }}
                        >
                          {r.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: "#999" }}>
                          {t(`categories.${r.type}`, { defaultValue: r.type })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Doba dana */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#333",
                  marginBottom: 12,
                }}
              >
                {t("map.timeOfDay")}
              </Text>
              <View style={{ gap: 8 }}>
                {[
                  {
                    key: "jutro",
                    label: `🌅 ${t("map.morning")}`,
                    sub: t("map.morningDesc"),
                  },
                  {
                    key: "poslijepodne",
                    label: `☀️ ${t("map.afternoon")}`,
                    sub: t("map.afternoonDesc"),
                  },
                  {
                    key: "vecer",
                    label: `🌙 ${t("map.evening")}`,
                    sub: t("map.eveningDesc"),
                  },
                ].map((tod) => (
                  <TouchableOpacity
                    key={tod.key}
                    style={[
                      {
                        backgroundColor: "#f8f8f8",
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 2,
                        borderColor: "transparent",
                        position: "relative",
                      },
                      activeTimeOfDay === tod.key && {
                        backgroundColor: "#f0f0ff",
                        borderColor: "#667eea",
                      },
                    ]}
                    onPress={() => applyTimeOfDay(tod.key)}
                  >
                    <Text
                      style={{ fontSize: 15, fontWeight: "700", color: "#333" }}
                    >
                      {tod.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#999", marginTop: 3 }}>
                      {tod.sub}
                    </Text>
                    {activeTimeOfDay === tod.key && (
                      <View
                        style={{
                          position: "absolute",
                          top: 10,
                          right: 10,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: "#667eea",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Kategorije 3x3 */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: "#333" }}
                >
                  {t("map.categories")}
                </Text>
                {selectedTypes.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedTypes([]);
                      setActiveTimeOfDay(null);
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#667eea",
                        fontWeight: "600",
                      }}
                    >
                      {t("map.clearAll")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {getAllCategories().map((cat) => {
                  const active = selectedTypes.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={{
                        width: CELL_W,
                        aspectRatio: 1,
                        backgroundColor: active ? cat.color : "#f5f5f5",
                        borderRadius: 14,
                        justifyContent: "center",
                        alignItems: "center",
                        padding: 8,
                        borderWidth: 2,
                        borderColor: active ? cat.color : "transparent",
                      }}
                      onPress={() => toggleType(cat.id)}
                    >
                      <Text style={{ fontSize: 28, marginBottom: 4 }}>
                        {cat.icon}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: active ? "#fff" : "#444",
                          textAlign: "center",
                        }}
                        numberOfLines={2}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Radijus */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#333",
                  marginBottom: 12,
                }}
              >
                {t("map.radius")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[1, 5, 10, 20, 50, 100].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      backgroundColor: radius === r ? "#667eea" : "#f0f0f0",
                      borderRadius: 20,
                    }}
                    onPress={() => setRadius(r)}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: radius === r ? "#fff" : "#555",
                        fontWeight: radius === r ? "700" : "400",
                      }}
                    >
                      {r} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Dobne grupe */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: "#333" }}
                >
                  {t("map.forAgeGroup")}
                </Text>
                {selectedAgeGroups.length > 0 && (
                  <TouchableOpacity onPress={() => setSelectedAgeGroups([])}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#667eea",
                        fontWeight: "600",
                      }}
                    >
                      Očisti
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {getAgeGroups().map((grp) => {
                  const active = selectedAgeGroups.includes(grp.id);
                  return (
                    <TouchableOpacity
                      key={grp.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 24,
                        backgroundColor: active ? grp.color : "#f0f0f0",
                        borderWidth: 2,
                        borderColor: active ? grp.color : "transparent",
                      }}
                      onPress={() =>
                        setSelectedAgeGroups((prev) =>
                          prev.includes(grp.id)
                            ? prev.filter((x) => x !== grp.id)
                            : [...prev, grp.id],
                        )
                      }
                    >
                      <Text style={{ fontSize: 16 }}>{grp.emoji}</Text>
                      <View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: active ? "#fff" : "#444",
                          }}
                        >
                          {grp.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: active ? "rgba(255,255,255,0.8)" : "#999",
                          }}
                        >
                          {grp.desc}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedAgeGroups.length > 0 && (
                <View
                  style={{
                    marginTop: 10,
                    backgroundColor: "#f0f0ff",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#667eea",
                      fontWeight: "600",
                    }}
                  >
                    🔍 {t("map.displayLimit")}
                    {selectedAgeGroups
                      .map(
                        (id) => getAgeGroups().find((g) => g.id === id)?.label,
                      )
                      .join(", ")}
                  </Text>
                </View>
              )}
            </View>

            {/* Limit prikaza */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#333",
                  marginBottom: 4,
                }}
              >
                📊{" "}
                {t("map.displayOnMap", {
                  shown: Math.min(displayLimit, allPlaces.length),
                  total: allPlaces.length,
                })}
              </Text>
              <Text style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
                {t("map.displayLimitHint")}
              </Text>
              {allPlaces.length > 0 && (
                <View
                  style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                >
                  {[10, 20, 50, 100]
                    .filter((n) => n <= allPlaces.length || n === 10)
                    .map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          backgroundColor:
                            displayLimit === n ? "#667eea" : "#f0f0f0",
                          borderRadius: 20,
                        }}
                        onPress={() => setDisplayLimit(n)}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: displayLimit === n ? "#fff" : "#555",
                            fontWeight: displayLimit === n ? "700" : "400",
                          }}
                        >
                          {n}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  {allPlaces.length > 0 && (
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        backgroundColor:
                          displayLimit >= allPlaces.length
                            ? "#667eea"
                            : "#f0f0f0",
                        borderRadius: 20,
                      }}
                      onPress={() => setDisplayLimit(allPlaces.length)}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color:
                            displayLimit >= allPlaces.length ? "#fff" : "#555",
                        }}
                      >
                        Svi ({allPlaces.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Skrivena mjesta */}
            {hiddenPlaceIds.length > 0 && (
              <View style={{ padding: 16 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: "#333",
                    marginBottom: 8,
                  }}
                >
                  🚫 Skrivena mjesta ({hiddenPlaceIds.length})
                </Text>
                {hiddenPlaceIds.map((id) => (
                  <TouchableOpacity
                    key={id}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#f9f9f9",
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8,
                    }}
                    onPress={() => handleRestorePlace(id)}
                  >
                    <Text
                      style={{ fontSize: 12, color: "#999", flex: 1 }}
                      numberOfLines={1}
                    >
                      ID: {id.split("_").slice(-1)[0]}
                    </Text>
                    <Text style={{ color: "#34c759", fontWeight: "700" }}>
                      ↩ Vrati
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={{
                margin: 16,
                backgroundColor: "#667eea",
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: "center",
              }}
              onPress={() => setShowFilterPanel(false)}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {t("map.apply")}
                {selectedTypes.length > 0
                  ? ` (${selectedTypes.length} kategorija)`
                  : ""}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modali */}
      <PlaceDetailModal
        place={selectedPlace}
        visible={showPlaceDetail}
        onClose={() => setShowPlaceDetail(false)}
        onMarkVisited={handleMarkVisited}
        onHidePlace={handleHidePlace}
        isVisited={selectedPlace ? isVisited(selectedPlace.id) : false}
        notifPrefs={notifPrefs}
        onToggleNotif={handleToggleNotif}
      />
      <VisitArchiveModal
        visible={showArchive}
        onClose={() => setShowArchive(false)}
        visits={visits}
        onSelectVisit={(v) => {
          setTimeout(
            () =>
              mapRef.current?.animateToRegion(
                {
                  latitude: v.latitude,
                  longitude: v.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                800,
              ),
            300,
          );
        }}
        onDeleteVisit={handleDeleteVisit}
      />
      <BadgesModal
        visible={showBadges}
        onClose={() => setShowBadges(false)}
        visits={visits}
        getAllCategories={getAllCategories}
      />
      <PlanMyDayModal
        visible={showPlanMyDay}
        userLocation={userLocation}
        onClose={() => setShowPlanMyDay(false)}
        onMarkVisited={handleMarkVisited}
        visits={visits}
      />
      <NotificationSettingsModal
        visible={showNotifSettings}
        prefs={notifPrefs}
        onClose={() => setShowNotifSettings(false)}
        onSave={(p) => {
          setNotifPrefs(p);
          saveJSON(STORAGE_NOTIFS, p);
        }}
        getAllCategories={getAllCategories}
      />
      <ActivityGroupsModal
        visible={showGroups}
        onClose={() => setShowGroups(false)}
        userLocation={userLocation}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 36,
    left: 12,
    right: 12,
    gap: 8,
  },
  citySearchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  cityInput: { flex: 1, fontSize: 14, color: "#333", paddingVertical: 8 },
  citySearchBtn: {
    backgroundColor: "#667eea",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  clearCityBtn: {
    backgroundColor: "#fff0f0",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  remoteBadge: {
    backgroundColor: "#667eea",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  topBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  topBtnText: { fontSize: 14, fontWeight: "600", color: "#333" },
  todBtn: {
    backgroundColor: "rgba(255,255,255,0.92)",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  todBtnA: { backgroundColor: "#667eea" },
  todTxt: { fontSize: 18 },
  sidePanel: { position: "absolute", right: 12, bottom: 110, gap: 8 },
  sideBtn: {
    backgroundColor: "#fff",
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  sideBtnA: { backgroundColor: "#667eea" },
  sideBtnNotif: { backgroundColor: "#fff3cd" },
  sideBtnTxt: { fontSize: 20 },
  notifDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  loadingBar: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    flexDirection: "row",
    backgroundColor: "rgba(102,126,234,0.9)",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  loadingTxt: { color: "#fff", fontSize: 14, fontWeight: "600" },
  // Bottom bar: count + "Prikaži više" gumb
  bottomBar: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countTxt: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },
  showMoreBtn: {
    backgroundColor: "#667eea",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  showMoreTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
