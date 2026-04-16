// app/(tabs)/dashboard.tsx  ─  v4  ─  full rewrite with all requested features
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
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
const ALL_CATS = Object.entries(placeCategories).map(([id, c]) => ({
  id,
  name: c.name,
  icon: EMOJIS[id] || "📍",
  color: c.color,
}));
const TOD: Record<string, string[]> = {
  jutro: ["cafe", "park", "landmark", "museum", "market"],
  poslijepodne: ["restaurant", "museum", "beach", "cinema", "opg", "market"],
  vecer: ["club", "theater", "restaurant", "spa"],
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

// ─── User location marker (pulsing person) ────────────────────────────────────
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

// ─── Normal place marker ──────────────────────────────────────────────────────
function PlaceMarker({
  place,
  onPress,
}: {
  place: Place;
  onPress: () => void;
}) {
  const cat = placeCategories[place.type as keyof typeof placeCategories];
  const color = cat?.color || "#667eea";
  const emoji = EMOJIS[place.type] || "📍";
  return (
    <Marker
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={{ alignItems: "center" }}>
        <View style={[pm.circle, { backgroundColor: color }]}>
          <Text style={pm.emoji}>{emoji}</Text>
        </View>
        <View style={[pm.pin, { backgroundColor: color }]} />
      </View>
    </Marker>
  );
}
const pm = StyleSheet.create({
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

// ─── VISITED MARKER — intense black glow + radiating rings ───────────────────
function VisitedMarker({
  visit,
  onPress,
}: {
  visit: VisitRecord;
  onPress: () => void;
}) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const cat = placeCategories[visit.placeType as keyof typeof placeCategories];
  const color = cat?.color || "#667eea";
  const emoji = EMOJIS[visit.placeType] || "📍";

  useEffect(() => {
    const pulse = (a: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(a, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(a, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    pulse(ring1, 0);
    pulse(ring2, 300);
    pulse(ring3, 600);
  }, []);

  const RingView = ({ anim }: { anim: Animated.Value }) => (
    <Animated.View
      style={{
        position: "absolute",
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "#000",
        opacity: anim.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0, 0.7, 0],
        }),
        transform: [
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 2.8],
            }),
          },
        ],
      }}
    />
  );

  return (
    <Marker
      coordinate={{ latitude: visit.latitude, longitude: visit.longitude }}
      onPress={onPress}
      tracksViewChanges
    >
      {/* Horizontal: [category circle + pin] + [black glow circle] */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 5 }}>
        {/* Category marker */}
        <View style={{ alignItems: "center" }}>
          <View style={[pm.circle, { backgroundColor: color }]}>
            <Text style={pm.emoji}>{emoji}</Text>
          </View>
          <View style={[pm.pin, { backgroundColor: color }]} />
        </View>

        {/* Black radiating glow circle */}
        <View
          style={{
            width: 28,
            height: 28,
            justifyContent: "center",
            alignItems: "center",
            marginTop: 9,
          }}
        >
          <RingView anim={ring1} />
          <RingView anim={ring2} />
          <RingView anim={ring3} />
          {/* Solid black core */}
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "#000",
              borderWidth: 2.5,
              borderColor: "#fff",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 8,
              elevation: 16,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 4,
                left: 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "rgba(255,255,255,0.35)",
              }}
            />
          </View>
        </View>
      </View>
    </Marker>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════════════════════

// ─── Star Rating ──────────────────────────────────────────────────────────────
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

// ─── Place Detail Modal ───────────────────────────────────────────────────────
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
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [wantReturn, setWantReturn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      Alert.alert("Ocjena", "Odaberite najmanje 1 zvjezdicu.");
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
    Alert.alert("Hvala!", "Recenzija je sačuvana.");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={dm.overlay}>
        <View style={dm.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={dm.imageBox}>
              {loading ? (
                <View style={[dm.imgPh, { backgroundColor: color + "22" }]}>
                  <ActivityIndicator color={color} size="large" />
                  <Text style={{ color: "#999", marginTop: 8, fontSize: 13 }}>
                    Dohvaćam detalje...
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
                  Alert.alert("Ukloni s karte", `Sakriti "${place.name}"?`, [
                    { text: "Odustani", style: "cancel" },
                    {
                      text: "Ukloni 🚫",
                      style: "destructive",
                      onPress: () => {
                        onHidePlace(place.id);
                        onClose();
                      },
                    },
                  ])
                }
              >
                <Text style={{ fontSize: 18 }}>🚫</Text>
              </TouchableOpacity>
            </View>

            <View style={dm.body}>
              <View style={[dm.badge, { backgroundColor: color }]}>
                <Text style={dm.badgeTxt}>
                  {emoji} {cat?.name || place.type}
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

              {/* Radno vrijeme */}
              <View style={dm.hoursBox}>
                <Text style={dm.hoursTitle}>🕐 Radno vrijeme</Text>
                {loading ? (
                  <ActivityIndicator size="small" color={color} />
                ) : details?.openingHours ? (
                  <Text style={dm.hoursText}>{details.openingHours}</Text>
                ) : (
                  <Text style={{ color: "#999", fontSize: 12 }}>
                    Radno vrijeme nije dostupno
                  </Text>
                )}
              </View>

              {/* Notification toggle */}
              <View style={dm.notifRow}>
                <Text style={dm.notifLabel}>
                  🔔 Obavijesti za {cat?.name || "ovu kategoriju"}
                </Text>
                <Switch
                  value={isNotified}
                  onValueChange={() => onToggleNotif(place.type)}
                  trackColor={{ true: "#667eea", false: "#ccc" }}
                  thumbColor="#fff"
                />
              </View>

              {/* Review */}
              <View style={dm.reviewBox}>
                <Text style={dm.reviewTitle}>✍️ Vaša ocjena & komentar</Text>
                <StarRating value={stars} onChange={setStars} />
                <TextInput
                  style={dm.commentInput}
                  placeholder="Ostavite komentar..."
                  placeholderTextColor="#bbb"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={300}
                />
                <TouchableOpacity
                  style={[dm.returnToggle, wantReturn && dm.returnA]}
                  onPress={() => setWantReturn((v) => !v)}
                >
                  <Text style={dm.returnTxt}>
                    {wantReturn ? "✅ Želim se vratiti" : "⬜ Želim se vratiti"}
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
                      {saved ? "Ažuriraj recenziju" : "Spremi recenziju"}
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
                  <Text style={dm.visitBtnTxt}>✅ Označi kao posjećeno</Text>
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
                    ✓ Posjećeno
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
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
}) {
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
            <Text style={{ fontSize: 19, fontWeight: "800", color: "#1a1a1a" }}>
              🔔 Postavke obavijesti
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                style={{ fontSize: 16, color: "#667eea", fontWeight: "600" }}
              >
                Zatvori
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View
              style={{
                backgroundColor: "#f0f0ff",
                borderRadius: 14,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 13, color: "#555", lineHeight: 20 }}>
                Primajte obavijesti kada vlasnici mjesta objave sadržaj (eventi,
                koncerti, akcije) u kategorijama koje pratite.
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700" }}>
                📱 App obavijesti
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
                📧 Email obavijesti
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
                placeholder="Unesite email adresu"
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
              Kategorije za praćenje
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ALL_CATS.map((cat) => {
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
                      {cat.name}
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
                  "Spremljeno ✅",
                  "Postavke obavijesti su ažurirane.",
                );
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                Spremi postavke
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Plan My Day/Week/Month/Year Modal (Claude AI) ────────────────────────────
type PlanPeriod = "dan" | "vikend" | "tjedan" | "mjesec" | "godišnji";
function PlanMyDayModal({
  visible,
  userLocation,
  onClose,
}: {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<PlanPeriod>("dan");
  const [location, setLocation] = useState("");
  const [people, setPeople] = useState("2");
  const [budget, setBudget] = useState("200");
  const [accommodation, setAccom] = useState("");
  const [timeType, setTimeType] = useState<
    "jutarnji" | "poslijepodnevni" | "večernji"
  >("poslijepodnevni");
  const [interests, setInterests] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [step, setStep] = useState<"form" | "result">("form");

  const toggleInterest = (id: string) =>
    setInterests((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );

  const generate = async () => {
    if (!location.trim()) {
      Alert.alert("Lokacija", "Unesite destinaciju.");
      return;
    }
    setGenerating(true);
    try {
      const periodLabel: Record<PlanPeriod, string> = {
        dan: "1 dan",
        vikend: "vikend (2 dana)",
        tjedan: "tjedan (7 dana)",
        mjesec: "mjesec",
        godišnji: "godišnji odmor",
      };
      const interestNames =
        interests
          .map((i) => ALL_CATS.find((c) => c.id === i)?.name || i)
          .join(", ") || "sve kategorije";
      const prompt = `Napravi detaljan plan aktivnosti na hrvatskom jeziku. Budi konkretan s imenima mjesta, ulicama i vremenima.

📍 Destinacija: ${location}
📅 Trajanje: ${periodLabel[period]}
👥 Broj osoba: ${people}
💰 Budžet: ${budget} EUR
🏨 Smještaj: ${accommodation || "nije određeno"}
🕐 Tip putnika: ${timeType}
🎯 Interesi: ${interestNames}

Format odgovora:
- Plan po danima s konkretnim mjestima, adresama i vremenima
- Preporučeni restorani, atrakcije, aktivnosti
- Okvirni troškovi po stavci
- Savjeti za organizaciju (transport, rezervacije)

Prilagodi plan tipu putnika i budžetu.`;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const text =
        data.content?.find((b: any) => b.type === "text")?.text ||
        "Nije moguće generirati plan.";
      setResult(text);
      setStep("result");
    } catch {
      Alert.alert("Greška", "Nije moguće generirati plan. Provjeri konekciju.");
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setStep("form");
    setResult("");
    setLocation("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 20,
            paddingTop: Platform.OS === "ios" ? 54 : 36,
            backgroundColor: "#667eea",
          }}
        >
          <TouchableOpacity
            onPress={() => {
              reset();
              onClose();
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16 }}>✕ Zatvori</Text>
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
            🗺️ Planiraj putovanje
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {step === "form" ? (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            {/* Period selector */}
            <Text style={plan.label}>Trajanje</Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 20,
              }}
            >
              {(
                [
                  "dan",
                  "vikend",
                  "tjedan",
                  "mjesec",
                  "godišnji",
                ] as PlanPeriod[]
              ).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[plan.chip, period === p && plan.chipA]}
                  onPress={() => setPeriod(p)}
                >
                  <Text
                    style={[plan.chipTxt, period === p && { color: "#fff" }]}
                  >
                    {p === "dan"
                      ? "📅 1 dan"
                      : p === "vikend"
                        ? "🏖️ Vikend"
                        : p === "tjedan"
                          ? "📆 Tjedan"
                          : p === "mjesec"
                            ? "🗓️ Mjesec"
                            : "✈️ Godišnji"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={plan.label}>📍 Destinacija *</Text>
            <TextInput
              style={plan.input}
              placeholder="npr. Zagreb, Split, Dubrovnik..."
              placeholderTextColor="#bbb"
              value={location}
              onChangeText={setLocation}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={plan.label}>👥 Broj osoba</Text>
                <TextInput
                  style={plan.input}
                  placeholder="2"
                  placeholderTextColor="#bbb"
                  value={people}
                  onChangeText={setPeople}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={plan.label}>💰 Budžet (EUR)</Text>
                <TextInput
                  style={plan.input}
                  placeholder="200"
                  placeholderTextColor="#bbb"
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={plan.label}>🏨 Lokacija smještaja</Text>
            <TextInput
              style={plan.input}
              placeholder="Naziv hotela, adresa..."
              placeholderTextColor="#bbb"
              value={accommodation}
              onChangeText={setAccom}
            />

            <Text style={plan.label}>🕐 Tip putnika</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {(["jutarnji", "poslijepodnevni", "večernji"] as const).map(
                (t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      plan.chip,
                      timeType === t && plan.chipA,
                      { flex: 1 },
                    ]}
                    onPress={() => setTimeType(t)}
                  >
                    <Text
                      style={[
                        plan.chipTxt,
                        timeType === t && { color: "#fff" },
                        { textAlign: "center" },
                      ]}
                    >
                      {t === "jutarnji"
                        ? "🌅 Jutro"
                        : t === "poslijepodnevni"
                          ? "☀️ Podne"
                          : "🌙 Večer"}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>

            <Text style={plan.label}>🎯 Interesi (odaberi više)</Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 24,
              }}
            >
              {ALL_CATS.map((cat) => {
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

            <TouchableOpacity
              style={[plan.btn, generating && { opacity: 0.6 }]}
              onPress={generate}
              disabled={generating}
            >
              {generating ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <ActivityIndicator color="#fff" />
                  <Text style={plan.btnTxt}>AI generira plan...</Text>
                </View>
              ) : (
                <Text style={plan.btnTxt}>✨ Generiraj plan s AI</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#eee",
              }}
            >
              <TouchableOpacity
                style={[plan.chip, { flex: 1 }]}
                onPress={reset}
              >
                <Text style={[plan.chipTxt, { textAlign: "center" }]}>
                  ← Novi plan
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[plan.btn, { flex: 2, paddingVertical: 10 }]}
                onPress={() =>
                  Alert.alert("Kopiran", "Plan je kopiran u međuspremnik.")
                }
              >
                <Text style={[plan.btnTxt, { fontSize: 14 }]}>
                  📋 Kopiraj plan
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={{ fontSize: 13, color: "#333", lineHeight: 22 }}>
                {result}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}
const plan = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "700", color: "#333", marginBottom: 8 },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#333",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  chipA: { backgroundColor: "#667eea" },
  chipTxt: { fontSize: 13, fontWeight: "600", color: "#555" },
  btn: {
    backgroundColor: "#667eea",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

// ─── Nearby Activity Groups Modal ─────────────────────────────────────────────
function NearbyGroupsModal({
  visible,
  userLocation,
  onClose,
}: {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [openGroup, setOpenGroup] = useState<ActivityGroup | null>(null);
  const [msgText, setMsgText] = useState("");
  const [newG, setNewG] = useState({
    activity: "",
    description: "",
    locationName: "",
    maxPeople: "10",
  });
  const [myName, setMyName] = useState("");

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem("firstName").then((n) => setMyName(n || "Korisnik"));
    loadJSON<ActivityGroup[]>(STORAGE_GROUPS, []).then((gs) => {
      // Filter expired (> 24h old) and sort by distance
      const active = gs.filter(
        (g: ActivityGroup) =>
          Date.now() - new Date(g.createdAt).getTime() < 24 * 60 * 60 * 1000,
      );
      if (userLocation) {
        active.sort(
          (a: ActivityGroup, b: ActivityGroup) =>
            haversineKm(
              userLocation.latitude,
              userLocation.longitude,
              a.latitude,
              a.longitude,
            ) -
            haversineKm(
              userLocation.latitude,
              userLocation.longitude,
              b.latitude,
              b.longitude,
            ),
        );
      }
      setGroups(active);
    });
  }, [visible, userLocation]);

  const saveGroups = async (gs: ActivityGroup[]) => {
    await saveJSON(STORAGE_GROUPS, gs);
    setGroups(gs);
  };

  const createGroup = async () => {
    if (!newG.activity.trim()) {
      Alert.alert("Aktivnost", "Unesite naziv aktivnosti.");
      return;
    }
    if (!userLocation) {
      Alert.alert("Lokacija", "Lokacija nije dostupna.");
      return;
    }
    const g: ActivityGroup = {
      id: Date.now().toString(),
      creatorName: myName,
      activity: newG.activity.trim(),
      description: newG.description.trim(),
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      locationName: newG.locationName.trim() || "Moja lokacija",
      maxPeople: parseInt(newG.maxPeople) || 10,
      members: [myName],
      messages: [
        {
          name: "Sustav",
          text: `Grupa "${newG.activity.trim()}" je kreirana!`,
          time: new Date().toLocaleTimeString("hr-HR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ],
      createdAt: new Date().toISOString(),
    };
    const updated = [g, ...groups];
    await saveGroups(updated);
    setNewG({
      activity: "",
      description: "",
      locationName: "",
      maxPeople: "10",
    });
    setShowCreate(false);
    setOpenGroup(g);
    Alert.alert(
      "Kreirana! 🎉",
      `Grupa "${g.activity}" je kreirana i vidljiva korisnicima u blizini.`,
    );
  };

  const joinGroup = async (g: ActivityGroup) => {
    if (g.members.includes(myName)) {
      setOpenGroup(g);
      return;
    }
    if (g.members.length >= g.maxPeople) {
      Alert.alert("Popunjeno", "Grupa je popunjena.");
      return;
    }
    const msg = {
      name: "Sustav",
      text: `${myName} se pridružio/la grupi!`,
      time: new Date().toLocaleTimeString("hr-HR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    const updated = groups.map((x) =>
      x.id === g.id
        ? {
            ...x,
            members: [...x.members, myName],
            messages: [...x.messages, msg],
          }
        : x,
    );
    await saveGroups(updated);
    setOpenGroup(updated.find((x) => x.id === g.id) || null);
  };

  const sendMsg = async () => {
    if (!msgText.trim() || !openGroup) return;
    const msg = {
      name: myName,
      text: msgText.trim(),
      time: new Date().toLocaleTimeString("hr-HR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    const updated = groups.map((x) =>
      x.id === openGroup.id ? { ...x, messages: [...x.messages, msg] } : x,
    );
    await saveGroups(updated);
    setOpenGroup(updated.find((x) => x.id === openGroup.id) || null);
    setMsgText("");
  };

  const deleteMsg = async (gId: string, msgIdx: number) => {
    const updated = groups.map((x) =>
      x.id === gId
        ? { ...x, messages: x.messages.filter((_, i) => i !== msgIdx) }
        : x,
    );
    await saveGroups(updated);
    setOpenGroup(updated.find((x) => x.id === gId) || null);
  };

  const leaveGroup = async (g: ActivityGroup) => {
    const updated = groups.map((x) =>
      x.id === g.id
        ? { ...x, members: x.members.filter((m) => m !== myName) }
        : x,
    );
    await saveGroups(updated);
    setOpenGroup(null);
  };

  const getActivityIcon = (activity: string) => {
    const a = activity.toLowerCase();
    if (a.includes("kava") || a.includes("kaf")) return "☕";
    if (a.includes("izlaz") || a.includes("klub") || a.includes("night"))
      return "🎵";
    if (a.includes("plaz") || a.includes("swim")) return "🏖️";
    if (a.includes("sport") || a.includes("trci") || a.includes("fudbal"))
      return "⚽";
    if (a.includes("restoran") || a.includes("rucak") || a.includes("vecera"))
      return "🍽️";
    if (a.includes("planin") || a.includes("hik")) return "⛰️";
    return "🤝";
  };

  // Group chat view
  if (openGroup) {
    const dist = userLocation
      ? haversineKm(
          userLocation.latitude,
          userLocation.longitude,
          openGroup.latitude,
          openGroup.longitude,
        ).toFixed(1)
      : null;
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setOpenGroup(null)}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View
            style={{
              backgroundColor: "#667eea",
              padding: 16,
              paddingTop: Platform.OS === "ios" ? 54 : 36,
            }}
          >
            <TouchableOpacity
              onPress={() => setOpenGroup(null)}
              style={{ marginBottom: 8 }}
            >
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                ← Natrag na grupe
              </Text>
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>
              {getActivityIcon(openGroup.activity)} {openGroup.activity}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 13,
                marginTop: 4,
              }}
            >
              📍 {openGroup.locationName} {dist ? `• ${dist} km` : ""} • 👥{" "}
              {openGroup.members.length}/{openGroup.maxPeople}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.75)",
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Kreirao/la: {openGroup.creatorName} • Ističe za 24h
            </Text>
          </View>

          <FlatList
            data={openGroup.messages}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item, index }) => {
              const isMe = item.name === myName;
              const isSys = item.name === "Sustav";
              if (isSys)
                return (
                  <View style={{ alignItems: "center", marginVertical: 6 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#aaa",
                        backgroundColor: "#f5f5f5",
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      {item.text}
                    </Text>
                  </View>
                );
              return (
                <TouchableOpacity
                  onLongPress={() =>
                    isMe &&
                    Alert.alert("Obriši poruku", "", [
                      { text: "Odustani", style: "cancel" },
                      {
                        text: "Obriši",
                        style: "destructive",
                        onPress: () => deleteMsg(openGroup.id, index),
                      },
                    ])
                  }
                  style={{
                    alignItems: isMe ? "flex-end" : "flex-start",
                    marginBottom: 8,
                  }}
                >
                  {!isMe && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#667eea",
                        fontWeight: "600",
                        marginBottom: 2,
                      }}
                    >
                      {item.name}
                    </Text>
                  )}
                  <View
                    style={{
                      backgroundColor: isMe ? "#667eea" : "#f0f0f0",
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      maxWidth: "75%",
                    }}
                  >
                    <Text
                      style={{ color: isMe ? "#fff" : "#333", fontSize: 14 }}
                    >
                      {item.text}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
                    {item.time}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View
              style={{
                flexDirection: "row",
                padding: 12,
                borderTopWidth: 1,
                borderTopColor: "#eee",
                gap: 8,
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: "#f5f5f5",
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  fontSize: 15,
                  color: "#333",
                }}
                placeholder="Napiši poruku u grupi..."
                placeholderTextColor="#bbb"
                value={msgText}
                onChangeText={setMsgText}
              />
              <TouchableOpacity
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#667eea",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onPress={sendMsg}
              >
                <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
              </TouchableOpacity>
            </View>
            {openGroup.members.includes(myName) && (
              <TouchableOpacity
                style={{
                  margin: 12,
                  marginTop: 0,
                  padding: 12,
                  backgroundColor: "#fff0f0",
                  borderRadius: 12,
                  alignItems: "center",
                }}
                onPress={() =>
                  Alert.alert("Izlaz iz grupe", "", [
                    { text: "Odustani", style: "cancel" },
                    {
                      text: "Izađi",
                      style: "destructive",
                      onPress: () => leaveGroup(openGroup),
                    },
                  ])
                }
              >
                <Text style={{ color: "#ff4757", fontWeight: "600" }}>
                  Izađi iz grupe
                </Text>
              </TouchableOpacity>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  // Create group form
  if (showCreate) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View
            style={{
              backgroundColor: "#667eea",
              padding: 20,
              paddingTop: Platform.OS === "ios" ? 54 : 36,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={{ color: "rgba(255,255,255,0.8)" }}>← Natrag</Text>
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
              Kreiraj grupu
            </Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={plan.label}>🎯 Aktivnost *</Text>
            <TextInput
              style={plan.input}
              placeholder="npr. Idemo na kavu, Izlaz u klub..."
              placeholderTextColor="#bbb"
              value={newG.activity}
              onChangeText={(v) => setNewG((p) => ({ ...p, activity: v }))}
            />
            <Text style={plan.label}>📝 Opis (opcionalno)</Text>
            <TextInput
              style={[plan.input, { minHeight: 80, textAlignVertical: "top" }]}
              placeholder="Kratki opis aktivnosti, lokacija, uvjeti..."
              placeholderTextColor="#bbb"
              value={newG.description}
              onChangeText={(v) => setNewG((p) => ({ ...p, description: v }))}
              multiline
            />
            <Text style={plan.label}>📍 Naziv lokacije</Text>
            <TextInput
              style={plan.input}
              placeholder="npr. Centar Osijeka, Tkalčićeva..."
              placeholderTextColor="#bbb"
              value={newG.locationName}
              onChangeText={(v) => setNewG((p) => ({ ...p, locationName: v }))}
            />
            <Text style={plan.label}>👥 Maksimalan broj osoba</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {["2", "4", "6", "10", "20", "50"].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[
                    plan.chip,
                    newG.maxPeople === n && plan.chipA,
                    { flex: 1 },
                  ]}
                  onPress={() => setNewG((p) => ({ ...p, maxPeople: n }))}
                >
                  <Text
                    style={[
                      plan.chipTxt,
                      newG.maxPeople === n && { color: "#fff" },
                      { textAlign: "center" },
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View
              style={{
                backgroundColor: "#fffbe6",
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 13, color: "#856404" }}>
                ⏰ Grupu mogu vidjeti svi korisnici u blizini. Automatski se
                briše nakon 24 sata.
              </Text>
            </View>
            <TouchableOpacity style={plan.btn} onPress={createGroup}>
              <Text style={plan.btnTxt}>🤝 Kreiraj grupu</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // Groups list
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
        <View
          style={{
            backgroundColor: "#667eea",
            padding: 20,
            paddingTop: Platform.OS === "ios" ? 54 : 36,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 15 }}>
              ✕ Zatvori
            </Text>
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
            🤝 Aktivnosti u blizini
          </Text>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={{
              backgroundColor: "rgba(255,255,255,0.25)",
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>+ Nova</Text>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: 40,
            }}
          >
            <Text style={{ fontSize: 64 }}>🤝</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#1a1a1a" }}>
              Nema aktivnih grupa
            </Text>
            <Text style={{ fontSize: 14, color: "#999", textAlign: "center" }}>
              Kreiraj novu grupu i pronađi ljude za zajedničke aktivnosti.
            </Text>
            <TouchableOpacity
              style={[plan.btn, { paddingHorizontal: 32 }]}
              onPress={() => setShowCreate(true)}
            >
              <Text style={plan.btnTxt}>+ Kreiraj prvu grupu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item: g }) => {
              const dist = userLocation
                ? haversineKm(
                    userLocation.latitude,
                    userLocation.longitude,
                    g.latitude,
                    g.longitude,
                  ).toFixed(1)
                : "?";
              const full = g.members.length >= g.maxPeople;
              const isMember = g.members.includes(myName);
              const elapsed = Math.floor(
                (Date.now() - new Date(g.createdAt).getTime()) / 60000,
              );
              const timeLabel =
                elapsed < 60
                  ? `${elapsed} min`
                  : `${Math.floor(elapsed / 60)}h ${elapsed % 60}min`;
              return (
                <TouchableOpacity
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                  onPress={() => joinGroup(g)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 20 }}>
                        {getActivityIcon(g.activity)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "800",
                          color: "#1a1a1a",
                          marginTop: 4,
                        }}
                      >
                        {g.activity}
                      </Text>
                      <Text
                        style={{ fontSize: 13, color: "#666", marginTop: 2 }}
                      >
                        Kreirao/la: {g.creatorName}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <View
                        style={{
                          backgroundColor: full ? "#fff0f0" : "#e8f5e9",
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: full ? "#ff4757" : "#34c759",
                          }}
                        >
                          👥 {g.members.length}/{g.maxPeople}{" "}
                          {full ? "Popunjeno" : "mjesta"}
                        </Text>
                      </View>
                      {isMember && (
                        <View
                          style={{
                            backgroundColor: "#f0f0ff",
                            borderRadius: 10,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#667eea",
                              fontWeight: "600",
                            }}
                          >
                            ✓ Član/ica
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {g.description ? (
                    <Text
                      style={{ fontSize: 13, color: "#555", marginBottom: 8 }}
                    >
                      {g.description}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#999" }}>
                      📍 {g.locationName} • {dist} km
                    </Text>
                    <Text style={{ fontSize: 12, color: "#bbb" }}>
                      ⏱ Prije {timeLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

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
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#1a1a1a" }}>
              📋 Arhiva posjeta ({visits.length})
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                style={{ color: "#667eea", fontSize: 15, fontWeight: "600" }}
              >
                Zatvori
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
                  Sve
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
                      {EMOJIS[type]} {cat?.name || type}
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
                  ? "Još nema posjeta."
                  : "Nema posjeta za filter."}
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
                          "Ukloni posjet",
                          `Ukloniti "${item.placeName}"?`,
                          [
                            { text: "Odustani", style: "cancel" },
                            {
                              text: "Ukloni",
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
}: {
  visible: boolean;
  onClose: () => void;
  visits: VisitRecord[];
}) {
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
              🏆 Moje značke
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                style={{ color: "#667eea", fontSize: 15, fontWeight: "600" }}
              >
                Zatvori
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {ALL_CATS.map((cat) => {
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
                      {count} posjeta
                    </Text>
                    {next && (
                      <Text
                        style={{ fontSize: 12, color: "#999", marginTop: 2 }}
                      >
                        Sljedeća za {next - count} više
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD SCREEN
// ══════════════════════════════════════════════════════════════════════════════
const CELL_W = (SW - 32 - 16) / 3;
const TIME_CATS: Record<string, string[]> = {
  jutro: ["cafe", "park", "landmark", "museum", "market"],
  poslijepodne: ["restaurant", "museum", "beach", "cinema", "opg", "market"],
  vecer: ["club", "theater", "restaurant", "spa"],
};

export default function DashboardScreen() {
  const mapRef = useRef<MapView>(null);

  // Location
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  // City / remote search
  const [searchLocation, setSearchLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [searchLocationName, setSearchLocationName] = useState<string>("");
  const [cityQuery, setCityQuery] = useState("");
  const [citySearching, setCitySearching] = useState(false);

  // Places / filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [radius, setRadius] = useState(5);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [activeTimeOfDay, setActiveTimeOfDay] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Panels / modals
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [showPlanMyDay, setShowPlanMyDay] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);

  // Place detail
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showPlaceDetail, setShowPlaceDetail] = useState(false);

  // Visits / hidden
  const [showRadiusCircle, setShowRadiusCircle] = useState(true);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [showOnlyVisited, setShowOnlyVisited] = useState(false);
  const [hiddenPlaceIds, setHiddenPlaceIds] = useState<string[]>([]);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    appEnabled: true,
    emailEnabled: false,
    email: "",
    categories: [],
  });

  // The location to use for place searches (remote city OR user location)
  const activeSearchLoc = searchLocation || userLocation;

  const initialRegion: Region = {
    latitude: 45.815,
    longitude: 15.9819,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  useEffect(() => {
    backendGetVisits().then((sv) => {
      if (sv.length > 0) setVisits(sv);
    });
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
      const t = setTimeout(() => loadPlacesInRadius(), 400);
      return () => clearTimeout(t);
    } else if (!showOnlyVisited) {
      setPlaces([]);
    }
  }, [activeSearchLoc, radius, selectedTypes, showOnlyVisited]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Lokacija", "Dozvolite pristup lokaciji.");
      return;
    }
    setLocationPermission(true);
    getCurrentLocation();
  };

  const getCurrentLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });
      const region = {
        latitude,
        longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setMapRegion(region);
      mapRef.current?.animateToRegion(region, 1000);
    } catch {
      Alert.alert("Greška", "Nije moguće dohvatiti lokaciju.");
    }
  };

  // ── City/remote search ──
  const handleCitySearch = async () => {
    if (!cityQuery.trim()) return;
    setCitySearching(true);
    try {
      const result = await geocodeCity(cityQuery.trim());
      if (!result) {
        Alert.alert("Nije pronađeno", `Grad "${cityQuery}" nije pronađen.`);
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
        "📍 Lokacija promijenjena",
        `Pretraživanje oko: ${result.displayName}`,
      );
    } catch {
      Alert.alert("Greška", "Nije moguće dohvatiti lokaciju grada.");
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
      setPlaces(filtered);
      if (filtered.length > 0 && mapRef.current) {
        mapRef.current.fitToCoordinates(
          [
            ...filtered.map((p) => ({
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
      Alert.alert("Greška", "Pretraga nije uspjela.");
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
      Alert.alert("Već posjećeno", `${place.name} je već u arhivi.`);
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
    } else Alert.alert("✅ Posjećeno!", `${place.name} dodano u arhivu.`);
  };

  const handleDeleteVisit = async (id: string) => {
    await backendDeleteVisit(id);
    setVisits((prev) => prev.filter((v) => v.id !== id));
  };

  const handleHidePlace = async (placeId: string) => {
    const updated = [...hiddenPlaceIds, placeId];
    setHiddenPlaceIds(updated);
    await saveJSON(STORAGE_HIDDEN, updated);
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
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
  const placesForMap = showOnlyVisited ? [] : places;

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
        {placesForMap.map((place, i) => (
          <PlaceMarker
            key={`p_${place.id}_${i}`}
            place={place}
            onPress={() => {
              setSelectedPlace(place);
              setShowPlaceDetail(true);
            }}
          />
        ))}
        {visits.map((visit) => (
          <VisitedMarker
            key={`v_${visit.id}`}
            visit={visit}
            onPress={() => {
              const fp: Place = {
                id: visit.placeId,
                name: visit.placeName,
                latitude: visit.latitude,
                longitude: visit.longitude,
                type: visit.placeType as Place["type"],
                address: visit.address,
              };
              setSelectedPlace(fp);
              setShowPlaceDetail(true);
            }}
          />
        ))}
      </MapView>

      {/* Top bar */}
      <View style={s.topBar}>
        {/* City search bar (remote location) */}
        <View style={s.citySearchRow}>
          <TextInput
            style={s.cityInput}
            placeholder="🌍 Pretraži drugi grad..."
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
                Idi
              </Text>
            </TouchableOpacity>
          )}
          {searchLocation && (
            <TouchableOpacity style={s.clearCityBtn} onPress={clearCitySearch}>
              <Text
                style={{ color: "#ff4757", fontSize: 12, fontWeight: "700" }}
              >
                ✕ Moja lok.
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

        {/* Filter button + time of day */}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TouchableOpacity
            style={s.topBtn}
            onPress={() => setShowFilterPanel(true)}
          >
            <Text style={s.topBtnText}>
              🔍 Filtri
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

      {/* Right side panel */}
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
          style={[
            s.sideBtn,
            notifPrefs.categories.length > 0 && s.sideBtnNotif,
          ]}
          onPress={() => setShowNotifSettings(true)}
        >
          <Text style={s.sideBtnTxt}>🔔</Text>
          {notifPrefs.categories.length > 0 && (
            <View style={s.notifDot}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
                {notifPrefs.categories.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isLoadingPlaces && (
        <View style={s.loadingBar}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={s.loadingTxt}>Učitavam mjesta...</Text>
        </View>
      )}
      {!isLoadingPlaces && (places.length > 0 || showOnlyVisited) && (
        <View style={s.countBar}>
          <Text style={s.countTxt}>
            {showOnlyVisited
              ? `✓ ${visits.length} posjećenih mjesta`
              : `📍 ${places.length} mjesta u ${radius} km`}
          </Text>
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
              🔍 Filteri
            </Text>
            <TouchableOpacity onPress={() => setShowFilterPanel(false)}>
              <Text
                style={{ fontSize: 15, color: "#667eea", fontWeight: "600" }}
              >
                ✕ Zatvori
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Place search */}
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
                Pretraga mjesta
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
                  placeholder="Unesite naziv mjesta..."
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
                      Traži
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
                          {
                            placeCategories[
                              r.type as keyof typeof placeCategories
                            ]?.name
                          }
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
                Doba dana
              </Text>
              <View style={{ gap: 8 }}>
                {[
                  {
                    key: "jutro",
                    label: "🌅 Jutro",
                    sub: "Kafić, park, muzej...",
                  },
                  {
                    key: "poslijepodne",
                    label: "☀️ Poslijepodne",
                    sub: "Restoran, plaža, kino...",
                  },
                  {
                    key: "vecer",
                    label: "🌙 Večer",
                    sub: "Klub, kazalište, spa...",
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

            {/* Categories grid 3x3 */}
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
                  Kategorije
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
                      Očisti sve
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ALL_CATS.map((cat) => {
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

            {/* Radius */}
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
                📏 Radijus: {radius} km
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

            {/* Restored hidden places */}
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
                Primijeni
                {selectedTypes.length > 0
                  ? ` (${selectedTypes.length} kategorija)`
                  : ""}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* All other modals */}
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
      />

      <PlanMyDayModal
        visible={showPlanMyDay}
        userLocation={userLocation}
        onClose={() => setShowPlanMyDay(false)}
      />

      <NearbyGroupsModal
        visible={showGroups}
        userLocation={userLocation}
        onClose={() => setShowGroups(false)}
      />

      <NotificationSettingsModal
        visible={showNotifSettings}
        prefs={notifPrefs}
        onClose={() => setShowNotifSettings(false)}
        onSave={(p) => {
          setNotifPrefs(p);
          saveJSON(STORAGE_NOTIFS, p);
        }}
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
  countBar: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  countTxt: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
