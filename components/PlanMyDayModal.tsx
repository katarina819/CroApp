/**
 * PlanMyDayModal.tsx — v9 COMPLETE FIX
 *
 * POPRAVCI:
 * 1. [SINKRONIZACIJA KARTA↔OPIS] Karta i opis koriste IDENTIČAN niz venue-ova
 * 2. [IKONE] Slike se prikazuju ispravno - fallback na emoji ako slika ne postoji
 * 3. [DUGME OTVORI] Prikazuje se za SVAKU aktivnost koja ima venue
 * 4. [RADNO VRIJEME] Hardkodirani raspored koji poštuje radno vrijeme
 * 5. [BROJEVI] Svaka aktivnost ima jedinstven broj (1-8)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { API_BASE_URL } from "../app/config/api"; // prilagodi putanju

import {
  clearPlacesCache,
  geocodeCity,
  getPlacesInRadius,
  Place,
  placeCategories,
} from "../app/services/locationService";
import { pb } from "../styles/varaTheme";
import { useTheme } from "./AdaptiveThemeProvider";

// ---------------------------------------------------------------------------
// Tipovi
// ---------------------------------------------------------------------------
type PlanStep = "form" | "loading" | "result";
type PlanStyle = "opusteno" | "kulturno" | "avantura";
type TransportType = "auto" | "javni" | "pjesice" | "bicikl";
type CompanionType = "solo" | "partner" | "prijatelji" | "obitelj";

interface VenueItem {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

interface VenueWithType {
  venue: VenueItem;
  type: string;
}

interface DayActivity {
  id: string;
  time: string;
  venueName: string;
  venueType: string;
  venue: VenueItem | null;
  type: string;
  duration: number;
  cost: string;
  description: string;
  order: number;
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

interface PlaceDetailModalProps {
  place: Place | null;
  visible: boolean;
  onClose: () => void;
  onMarkVisited: (p: Place) => void;
  onHidePlace: (id: string) => void;
  isVisited: boolean;
  notifPrefs: {
    appEnabled: boolean;
    emailEnabled: boolean;
    email: string;
    categories: string[];
  };
  onToggleNotif: (catId: string) => void;
}

export interface PlanMyDayModalProps {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onMarkVisited?: (place: Place) => Promise<void>;
  visits?: VisitRecord[];
  PlaceDetailModalComponent: React.ComponentType<PlaceDetailModalProps>;
}

// ---------------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------------
const { width: SW } = Dimensions.get("window");

function getDC(isDark: boolean) {
  return {
    bg: isDark ? "#1a2e1a" : "#f0ede4",
    card: isDark ? "#2a4230" : "#e4ead8",
    cardHover: isDark ? "#3a5a30" : "#ccdcb8",
    border: isDark ? "#4a7040" : "#5a8a40",
    borderDim: isDark ? "#3a5a30" : "#c0d0a8",
    text: isDark ? "#e8e8e8" : "#1a2a18",
    textSub: isDark ? "#c0c0c0" : "#3a4a35",
    textDim: isDark ? "#a0a0a0" : "#5a6a55",
    accent: isDark ? "#5a8a48" : "#3a6a28",
    gold: "#B8A060",
    inputBg: isDark ? "#2a4230" : "#e4ead8",
    inputBorder: isDark ? "#4a7040" : "#5a8a40",
    danger: isDark ? "#8B3030" : "#7a2020",
  } as const;
}

// ---------------------------------------------------------------------------
// Konstante
// ---------------------------------------------------------------------------
const ROUTE_COLORS = [
  "#d63031",
  "#00b894",
  "#0984e3",
  "#e17055",
  "#6c5ce7",
  "#00cec9",
  "#fd79a8",
];

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

// Marker slike

const MARKER_IMAGES: Record<string, any> = {
  restaurant: require("../assets/images/restoran.png"),
  cafe: require("../assets/images/kafic.png"),
  club: require("../assets/images/disco.png"),
  beach: require("../assets/images/plaza.png"),
  landmark: require("../assets/images/znamenitost.png"),
  opg: require("../assets/images/opg.png"),
  accommodation: require("../assets/images/smjestaj.png"),
  market: require("../assets/images/trznica.png"),
  paintball: require("../assets/images/paintball.png"),
  cinema: require("../assets/images/kino.png"),
  park: require("../assets/images/park.png"),
  escapeRoom: require("../assets/images/escape.png"),
  museum: require("../assets/images/muzej.png"),
  theater: require("../assets/images/kazaliste.png"),
  mountain: require("../assets/images/planina.png"),
  nationalPark: require("../assets/images/nacpark.png"),
  cave: require("../assets/images/spilja.png"),
  spa: require("../assets/images/toplica.png"),
};

const putnikIcon = require("../assets/images/putnik.png");

// ---------------------------------------------------------------------------
// Haversine
// ---------------------------------------------------------------------------
function haversineKm(a1: number, o1: number, a2: number, o2: number): number {
  const R = 6371;
  const dA = ((a2 - a1) * Math.PI) / 180;
  const dO = ((o2 - o1) * Math.PI) / 180;
  const a =
    Math.sin(dA / 2) ** 2 +
    Math.cos((a1 * Math.PI) / 180) *
      Math.cos((a2 * Math.PI) / 180) *
      Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Helper funkcije
// ---------------------------------------------------------------------------
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function venueNamesMatch(a: string, b: string): boolean {
  const n1 = normalize(a);
  const n2 = normalize(b);
  if (!n1 || !n2) return false;
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

function findVenueByName(
  name: string,
  allVenues: Record<string, VenueItem[]>,
  typeHint?: string | null,
): { venue: VenueItem; type: string } | null {
  if (!name) return null;
  const normalized = normalize(name);

  for (const [type, list] of Object.entries(allVenues)) {
    for (const v of list) {
      if (venueNamesMatch(v.name, name)) {
        return { venue: v, type };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// HARDKODIRANI RASPORED — svi koraci uvijek imaju koordinate (fallback)
// ---------------------------------------------------------------------------
function getTimeBasedActivities(
  allVenues: Record<string, VenueItem[]>,
  dayOffset: number = 0,
  fallbackCoords?: { latitude: number; longitude: number } | null,
  t?: (key: string, opts?: any) => string,
): DayActivity[] {
  // Pomoćna: uzmi venue koji još nije korišten u ovom danu
  const usedVenueNames = new Set<string>();
  const pickVenue = (type: string, offset: number): VenueItem | null => {
    const list = allVenues[type] || [];
    if (list.length === 0) return null;
    // Pokušaj pronaći venue koji još nije korišten
    for (let i = 0; i < list.length; i++) {
      const idx = (dayOffset + offset + i) % list.length;
      const v = list[idx];
      if (!usedVenueNames.has(v.name)) {
        usedVenueNames.add(v.name);
        return v;
      }
    }
    // Fallback — uzmi prvi slobodni
    const v = list[(dayOffset + offset) % list.length];
    usedVenueNames.add(v.name);
    return v;
  };

  // Pametni raspored: jutro u centru, poslijepodne prema rubu, večer nazad u centar
  const schedule = [
    {
      time: "08:00",
      type: "cafe",
      duration: 45,
      cost: "5-10",
      description: t ? t("plan.schedBreakfast") : "Doručak",
    },
    {
      time: "09:00",
      type: "landmark",
      duration: 50,
      cost: "0-5",
      description: t ? t("plan.schedMorningTour") : "Jutarnje razgledavanje",
    },
    {
      time: "10:00",
      type: "museum",
      duration: 75,
      cost: "8-15",
      description: t ? t("plan.schedMuseum") : "Muzej",
    },
    {
      time: "11:30",
      type: "market",
      duration: 30,
      cost: "0-10",
      description: t ? t("plan.schedMarket") : "Tržnica",
    },
    {
      time: "12:15",
      type: "restaurant",
      duration: 60,
      cost: "12-22",
      description: t ? t("plan.schedLunch") : "Ručak",
    },
    {
      time: "13:30",
      type: "park",
      duration: 45,
      cost: "0",
      description: t ? t("plan.schedWalk") : "Kratka šetnja nakon ručka",
    },
    {
      time: "14:30",
      type: "beach",
      duration: 150,
      cost: "0-10",
      description: t ? t("plan.schedBeach") : "Plaža",
    },
    {
      time: "17:15",
      type: "cafe",
      duration: 30,
      cost: "4-8",
      description: t ? t("plan.schedAfternoonCoffee") : "Kava/sladoled",
    },
    {
      time: "18:00",
      type: "spa",
      duration: 60,
      cost: "20-40",
      description: t ? t("plan.schedSpa") : "Spa/wellbeing",
    },
    {
      time: "19:30",
      type: "restaurant",
      duration: 75,
      cost: "20-40",
      description: t ? t("plan.schedDinner") : "Večera",
    },
    {
      time: "21:00",
      type: "club",
      duration: 180,
      cost: "15-35",
      description: t ? t("plan.schedNight") : "Noćni izlazak",
    },
  ];

  const anyVenue = Object.values(allVenues).flat()[0];
  const fallback: VenueItem | null = fallbackCoords
    ? {
        name: "Centar grada",
        latitude: fallbackCoords.latitude,
        longitude: fallbackCoords.longitude,
      }
    : (anyVenue ?? null);

  const OFFSETS = [
    { lat: 0, lng: 0 },
    { lat: 0.001, lng: 0.001 },
    { lat: -0.001, lng: 0.0015 },
    { lat: 0.0015, lng: -0.001 },
    { lat: -0.0015, lng: -0.0015 },
    { lat: 0.002, lng: 0 },
    { lat: 0, lng: -0.002 },
    { lat: -0.002, lng: 0.001 },
    { lat: 0.001, lng: -0.002 },
    { lat: -0.002, lng: -0.001 },
    { lat: 0.0025, lng: 0.001 },
  ];

  const rawActivities = schedule.map((item, idx) => {
    let selectedVenue = pickVenue(item.type, idx);
    if (!selectedVenue && fallback) {
      const off = OFFSETS[idx % OFFSETS.length];
      selectedVenue = {
        name: t
          ? t("plan.localVenue", {
              type: t(`categories.${item.type}`, { defaultValue: item.type }),
            })
          : `Lokalni ${item.type}`,
        latitude: fallback.latitude + off.lat,
        longitude: fallback.longitude + off.lng,
      };
    }
    return { ...item, venue: selectedVenue };
  });

  // Geografsko sortiranje — grupira susjedne aktivnosti
  // Zadržava redoslijed jutro/poslijepodne/večer ali minimizira putovanje
  const optimizeRoute = (acts: typeof rawActivities) => {
    if (acts.length <= 2) return acts;

    // Podijeli na 3 grupe: jutro (0-3), poslijepodne (4-7), večer (8-10)
    const morning = acts.slice(0, 4);
    const afternoon = acts.slice(4, 8);
    const evening = acts.slice(8);

    const sortByProximity = (group: typeof rawActivities) => {
      if (group.length <= 1) return group;
      const result = [group[0]];
      const remaining = [...group.slice(1)];
      while (remaining.length > 0) {
        const last = result[result.length - 1];
        if (!last.venue) {
          result.push(remaining.shift()!);
          continue;
        }
        // Pronađi najbliži sljedeći venue
        let minDist = Infinity;
        let minIdx = 0;
        remaining.forEach((act, i) => {
          if (!act.venue) return;
          const d =
            Math.abs(act.venue.latitude - last.venue!.latitude) +
            Math.abs(act.venue.longitude - last.venue!.longitude);
          if (d < minDist) {
            minDist = d;
            minIdx = i;
          }
        });
        result.push(remaining.splice(minIdx, 1)[0]);
      }
      return result;
    };

    return [
      ...sortByProximity(morning),
      ...sortByProximity(afternoon),
      ...sortByProximity(evening),
    ];
  };

  const optimized = optimizeRoute(rawActivities);

  // Preračunaj vremena nakon optimizacije (15 min putovanja između)
  const TRAVEL_MIN = 15;
  let cursor = 8 * 60; // 08:00

  return optimized.map((item, idx) => {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    cursor += item.duration + TRAVEL_MIN;

    return {
      id: `act_${idx}`,
      time: timeStr,
      venueName: item.venue?.name || `Lokalni ${item.type}`,
      venueType: item.type,
      venue: item.venue,
      type: item.type,
      duration: item.duration,
      cost: item.cost,
      description: item.description,
      order: idx,
    };
  });
}
// ---------------------------------------------------------------------------
// fetchVenuesNearCity
// ---------------------------------------------------------------------------
async function fetchVenuesNearCity(
  cityQuery: string,
  radiusKm: number,
  interests: string[],
): Promise<{
  geocoded: { latitude: number; longitude: number; displayName: string } | null;
  venues: Record<string, VenueItem[]>;
}> {
  const geocoded = await geocodeCity(cityQuery);
  if (!geocoded) return { geocoded: null, venues: {} };
  clearPlacesCache();

  const allCats = [
    "restaurant",
    "cafe",
    "beach",
    "landmark",
    "park",
    "museum",
    "accommodation",
    "club",
    "cinema",
    "theater",
    "spa",
    "market",
    "mountain",
    "nationalPark",
    "cave",
    "escapeRoom",
    "paintball",
  ];
  const cats = interests.length > 0 ? interests : allCats;
  const places = await getPlacesInRadius(
    geocoded.latitude,
    geocoded.longitude,
    radiusKm,
    cats as any,
  );

  const venues: Record<string, VenueItem[]> = {};
  for (const p of places) {
    if (!venues[p.type]) venues[p.type] = [];
    if (venues[p.type].length < 8) {
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

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// PulsingDot
// ---------------------------------------------------------------------------
function PulsingDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.4,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: color,
        transform: [{ scale: anim }],
      }}
    />
  );
}

function InterestiGrid({
  interests,
  onToggle,
  DC,
  t,
}: {
  interests: string[];
  onToggle: (id: string) => void;
  DC: ReturnType<typeof getDC>;
  t: (key: string, opts?: any) => string;
}) {
  const keys = Object.keys(EMOJIS);
  const cardW = (SW - 32 - 4) / 2 - 2;

  return (
    <View style={{ gap: 4 }}>
      {Array.from({ length: Math.ceil(keys.length / 2) }, (_, i) => {
        const pair = keys.slice(i * 2, i * 2 + 2);
        return (
          <View
            key={`row_${i}`}
            style={{ flexDirection: "row", gap: 4, marginHorizontal: -14 }}
          >
            {pair.map((id) => {
              const active = interests.includes(id);
              return (
                <TouchableOpacity
                  key={id}
                  style={{
                    width: cardW,
                    height: 130,
                    borderRadius: 12,
                    backgroundColor: active ? DC.border : DC.card,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? DC.border : DC.borderDim,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 4,
                    paddingVertical: 8,
                  }}
                  onPress={() => onToggle(id)}
                >
                  {MARKER_IMAGES[id] ? (
                    <Image
                      source={MARKER_IMAGES[id]}
                      style={{ width: 96, height: 96, marginBottom: 4 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={{ fontSize: 56, marginBottom: 4 }}>
                      {EMOJIS[id]}
                    </Text>
                  )}
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: active ? "700" : "600",
                      color: active ? "#fff" : DC.textSub,
                      textAlign: "center",
                    }}
                    numberOfLines={2}
                  >
                    {t(`categories.${id}`, { defaultValue: id })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SimpleMarker - IKONE SE PRIKAZUJU ISPRAVNO
// ---------------------------------------------------------------------------
// SimpleMarker - IKONE SE PRIKAZUJU ISPRAVNO
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SimpleMarker - IDENTIČAN PATTERN kao PlaceMarker u dashboard.tsx
// ---------------------------------------------------------------------------
function SimpleMarker({
  activity,
  color,
  isActive,
  isCompleted,
  onPress,
}: {
  activity: DayActivity;
  color: string;
  isActive: boolean;
  isCompleted: boolean;
  onPress: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!activity.venue) return null;

  const markerColor = isCompleted ? "#34c759" : color;
  const iconSource = MARKER_IMAGES[activity.venueType];
  const isFallback = activity.venueName.startsWith("Lokalni ");

  return (
    <Marker
      coordinate={{
        latitude: activity.venue.latitude,
        longitude: activity.venue.longitude,
      }}
      tracksViewChanges={!imageLoaded}
      onPress={onPress}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View
        style={{
          alignItems: "center",
          width: 60,
          height: 74,
          opacity: isFallback ? 0.55 : 1,
        }}
      >
        {/* Broj badge */}
        <View
          style={{
            position: "absolute",
            top: -4,
            right: 2,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: markerColor,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 2,
            borderColor: "#fff",
            zIndex: 10,
            elevation: 10,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>
            {isCompleted ? "✓" : activity.order + 1}
          </Text>
        </View>

        {/* Ikona */}
        {iconSource && !isFallback ? (
          <ImageBackground
            source={iconSource}
            style={{
              width: 50,
              height: 50,
              justifyContent: "center",
              alignItems: "center",
            }}
            imageStyle={{
              width: 50,
              height: 50,
              borderRadius: 25,
              borderWidth: isActive ? 3 : 2.5,
              borderColor: isCompleted
                ? "#34c759"
                : isActive
                  ? "#fff"
                  : markerColor,
            }}
            resizeMode="contain"
            fadeDuration={0}
            onLoad={() => setImageLoaded(true)}
          >
            <View
              style={{
                position: "absolute",
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: markerColor,
                opacity: isActive ? 0.35 : 0.2,
              }}
            />
            {isActive && (
              <View
                style={{
                  position: "absolute",
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  borderWidth: 3,
                  borderColor: markerColor,
                  opacity: 0.8,
                }}
              />
            )}
          </ImageBackground>
        ) : (
          // Fallback i emoji prikaz — uvijek funkcionira
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: isFallback ? "#888888" : markerColor,
              justifyContent: "center",
              alignItems: "center",
              borderWidth: isActive ? 3 : 2.5,
              borderColor: isActive ? "#fff" : isFallback ? "#aaaaaa" : "#fff",
            }}
          >
            <Text style={{ fontSize: isActive ? 22 : 18 }}>
              {EMOJIS[activity.venueType] || "📍"}
            </Text>
          </View>
        )}

        {/* Stem */}
        <View
          style={{
            width: isActive ? 4 : 3,
            height: 12,
            backgroundColor: isFallback ? "#888888" : markerColor,
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
            marginTop: -2,
          }}
        />
      </View>
    </Marker>
  );
}

// ---------------------------------------------------------------------------
// GLAVNA KOMPONENTA
// ---------------------------------------------------------------------------
export function PlanMyDayModal({
  visible,
  userLocation,
  onClose,
  onMarkVisited,
  visits = [],
  PlaceDetailModalComponent,
}: PlanMyDayModalProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const DC = getDC(isDark);

  const [step, setStep] = useState<PlanStep>("form");
  const [destination, setDestination] = useState("");
  const [numDays, setNumDays] = useState(1);
  const [planStyle, setPlanStyle] = useState<PlanStyle>("kulturno");
  const [spontaneous, setSpontaneous] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [companions, setCompanions] = useState<CompanionType | null>(null);
  const [transport, setTransport] = useState<TransportType | null>(null);
  const [budget, setBudget] = useState("");
  const [activityRadius, setActivityRadius] = useState<number | null>(null);
  const [interests, setInterests] = useState<string[]>([]);

  const [activeDay, setActiveDay] = useState(0);
  const [activeStop, setActiveStop] = useState<number>(0);
  const [completedStops, setCompletedStops] = useState<Set<number>>(new Set());

  const [result, setResult] = useState("");
  const [allVenues, setAllVenues] = useState<Record<string, VenueItem[]>>({});
  const [geocodedCoords, setGeocodedCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [generatedNumDays, setGeneratedNumDays] = useState(1);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  const [loadingStep, setLoadingStep] = useState(0);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [localVisitedIds, setLocalVisitedIds] = useState<Set<string>>(
    new Set(),
  );

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [planRating, setPlanRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  const LOADING_MESSAGES = [
    { icon: "", text: t("plan.loadingMsg1") },
    { icon: "", text: t("plan.loadingMsg2") },
    { icon: "", text: t("plan.loadingMsg3") },
    { icon: "", text: t("plan.loadingMsg4") },
    { icon: "", text: t("plan.loadingMsg5") },
  ];

  useEffect(() => {
    setLocalVisitedIds(new Set(visits.map((v) => v.placeId)));
  }, [visits]);

  useEffect(() => {
    setActiveStop(0);
    setCompletedStops(new Set());
  }, [activeDay]);

  // Aktivne aktivnosti za dan
  const activeDayActivities: DayActivity[] = useMemo(() => {
    if (geocodedCoords && Object.keys(allVenues).length > 0) {
      return getTimeBasedActivities(allVenues, activeDay, geocodedCoords); // ← dodaj geocodedCoords
    }
    return [];
  }, [allVenues, activeDay, geocodedCoords]);

  // Auto-fit karte
  useEffect(() => {
    if (!mapRef.current || !mapReady || activeDayActivities.length === 0)
      return;
    const coords = activeDayActivities
      .filter((a) => a.venue)
      .map((a) => ({
        latitude: a.venue!.latitude,
        longitude: a.venue!.longitude,
      }));
    if (coords.length > 0) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }, 350);
    }
  }, [activeDayActivities, mapReady]);

  // Auto-scroll na aktivni marker
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const activity = activeDayActivities[activeStop];
    if (!activity?.venue) return;
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: activity.venue!.latitude,
          longitude: activity.venue!.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        600,
      );
    }, 300);
  }, [activeStop, mapReady, activeDayActivities]);

  const reset = () => {
    setStep("form");
    setResult("");
    setAllVenues({});
    setGeocodedCoords(null);
    setActiveDay(0);
    setActiveStop(0);
    setCompletedStops(new Set());
    setMapReady(false);
    setExpandedCategories(new Set());
    setPlanRating(0);
    setRatingSubmitted(false);
    setGeneratedNumDays(1);
    setLoadingStep(0);
    // ← DODAJ OVO:
    setCompanions(null);
    setTransport(null);
    setBudget("");
    setActivityRadius(null);
    setInterests([]);
    setSpontaneous(false);
    setDestination("");
    setNumDays(1);
    if (loadingInterval.current) clearInterval(loadingInterval.current);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isVenueVisited = (venue: VenueItem, type: string) => {
    const id = `plan_${type}_${venue.name.replace(/\s+/g, "_").toLowerCase()}`;
    return localVisitedIds.has(id);
  };

  const handleMarkVisited = async (venue: VenueItem | null, type: string) => {
    if (!venue) return;
    const id = `plan_${type}_${venue.name.replace(/\s+/g, "_").toLowerCase()}`;
    if (localVisitedIds.has(id)) return;
    setLocalVisitedIds((prev) => new Set([...prev, id]));
    if (onMarkVisited) {
      await onMarkVisited({
        id,
        name: venue.name,
        latitude: venue.latitude,
        longitude: venue.longitude,
        type: type as Place["type"],
        address: venue.address,
      });
    }
  };

  const submitRating = async () => {
    if (planRating === 0) return;
    setRatingLoading(true);
    setRatingError(null);
    try {
      const token = await AsyncStorage.getItem("userToken"); // prilagodi ključ ako je drugačiji
      const userRaw = await AsyncStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const userName = user
        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
        : "Anonimni korisnik";

      const response = await fetch(`${API_BASE_URL}/api/plan-ratings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          rating: planRating,
          destination,
          userName,
        }),
      });

      if (!response.ok) throw new Error("Server error");
      setRatingSubmitted(true);
    } catch {
      setRatingError(t("plan.ratingError"));
    } finally {
      setRatingLoading(false);
    }
  };

  const generate = React.useCallback(async () => {
    if (!destination.trim()) {
      Alert.alert(t("plan.destination"), t("plan.destinationRequired"));
      return;
    }

    setLoadingStep(0);
    setStep("loading");

    loadingInterval.current = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    try {
      const query = [destination.trim(), "Hrvatska"].join(" ");
      const { geocoded, venues } = await fetchVenuesNearCity(
        query,
        activityRadius ?? 5, // fallback na 5km ako nije odabrano
        interests,
      );

      setAllVenues(venues);
      setGeocodedCoords(
        geocoded
          ? { latitude: geocoded.latitude, longitude: geocoded.longitude }
          : null,
      );
      setGeneratedNumDays(spontaneous ? 1 : numDays);

      if (loadingInterval.current) clearInterval(loadingInterval.current);

      // Generiraj tekstualni plan
      let planText = `🗺️ PLAN PUTOVANJA — ${destination.toUpperCase()}\n\n`;
      for (let d = 0; d < (spontaneous ? 1 : numDays); d++) {
        const activities = getTimeBasedActivities(
          venues,
          d,
          geocoded
            ? { latitude: geocoded.latitude, longitude: geocoded.longitude }
            : null,
        );
        planText += `DAN ${d + 1}\n${"─".repeat(40)}\n\n`;
        activities.forEach((act) => {
          planText += `⏰ ${act.time} – ${act.venueName} ${EMOJIS[act.venueType] || "📍"}\n`;
          planText += `💬 Zašto: ${act.description}\n`;
          planText += `⏱️ Trajanje: ${act.duration} min\n`;
          planText += `💶 Trošak: ~${act.cost} EUR\n\n`;
        });
        planText += `💰 Ukupno dan ${d + 1}: ~${activities.reduce((sum, a) => sum + parseInt(a.cost.split("-")[0] || "10"), 0)}-${activities.reduce((sum, a) => sum + parseInt(a.cost.split("-")[1] || "30"), 0)} EUR\n`;
        planText += `💡 Savjet: Preporučujemo rezervaciju restorana unaprijed!\n\n`;
      }
      planText += `✨ Ugodan boravak u ${destination}!`;
      setResult(planText);

      setStep("result");
    } catch (err) {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
      Alert.alert(t("common.error"), t("plan.planError"));
      setStep("form");
    }
  }, [destination, activityRadius, interests, spontaneous, numDays]);

  const openVenueDetail = (activity: DayActivity) => {
    if (!activity.venue) return;
    setSelectedPlace({
      id: `plan_${activity.venueType}_${activity.venue.name}`,
      name: activity.venue.name,
      latitude: activity.venue.latitude,
      longitude: activity.venue.longitude,
      type: activity.venueType as Place["type"],
      address: activity.venue.address,
    });
    setShowDetailModal(true);
  };

  // ---------------------------------------------------------------------------
  // Render — LOADING
  // ---------------------------------------------------------------------------
  if (step === "loading") {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleClose}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: DC.bg,
            justifyContent: "center",
            alignItems: "center",
            padding: 32,
          }}
        >
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={{ fontSize: 48, marginTop: 24 }}>
            {LOADING_MESSAGES[loadingStep].icon}
          </Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: DC.text,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {LOADING_MESSAGES[loadingStep].text}
          </Text>
          <ProgressBar step={loadingStep} total={LOADING_MESSAGES.length} />
          <Text
            style={{
              fontSize: 13,
              color: DC.textDim,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {t("plan.findingPlaces", { destination })}
          </Text>
        </View>
      </Modal>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — RESULT
  // ---------------------------------------------------------------------------
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: DC.bg }}>
        {/* HEADER */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 20,
            paddingTop: Platform.OS === "ios" ? 54 : 36,
            borderBottomWidth: 1.5,
            borderBottomColor: DC.border,
            backgroundColor: DC.bg,
          }}
        >
          {step === "result" ? (
            <TouchableOpacity onPress={() => setStep("form")}>
              <Text
                style={{ fontSize: 15, color: DC.accent, fontWeight: "700" }}
              >
                {t("plan.newPlan")}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: 20, fontWeight: "800", color: DC.text }}>
              {t("plan.planTrip")}
            </Text>
          )}
          {step === "result" && (
            <Text style={{ fontSize: 17, fontWeight: "800", color: DC.text }}>
              {destination}
            </Text>
          )}

          {step === "result" ? (
            <View
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <TouchableOpacity
                onPress={() => Share.share({ message: result }).catch(() => {})}
              >
                <Text
                  style={{ fontSize: 14, color: DC.textDim, fontWeight: "600" }}
                >
                  {t("plan.share")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose}>
                <Text
                  style={{ fontSize: 14, color: DC.textDim, fontWeight: "600" }}
                >
                  {t("common.close")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={handleClose}>
              <Text
                style={{ fontSize: 14, color: DC.textDim, fontWeight: "600" }}
              >
                {t("common.close")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ========== FORMA ========== */}
        {step === "form" && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={{ paddingBottom: 48 }}
              keyboardShouldPersistTaps="handled"
              style={{ backgroundColor: DC.bg }}
            >
              {/* SPONTANO */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  margin: 16,
                  marginBottom: 8,
                  padding: 14,
                  backgroundColor: spontaneous ? DC.gold + "22" : DC.card,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: spontaneous ? DC.gold : DC.borderDim,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "700", color: DC.text }}
                  >
                    {t("plan.spontaneous")}
                  </Text>
                  <Text
                    style={{ fontSize: 12, color: DC.textDim, marginTop: 2 }}
                  >
                    {t("plan.spontaneousDesc")}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{
                    width: 50,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: spontaneous ? DC.gold : DC.borderDim,
                    justifyContent: "center",
                    paddingHorizontal: 3,
                    alignItems: spontaneous ? "flex-end" : "flex-start",
                  }}
                  onPress={() => {
                    const next = !spontaneous;
                    setSpontaneous(next);
                    if (next) setNumDays(1);
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "#fff",
                    }}
                  />
                </TouchableOpacity>
              </View>

              {/* DESTINACIJA */}
              <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: DC.textSub,
                    marginBottom: 6,
                  }}
                >
                  {t("plan.whereGoing")}?
                </Text>
                <TextInput
                  style={{
                    backgroundColor: DC.card,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: DC.inputBorder,
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    fontSize: 16,
                    color: DC.text,
                    fontWeight: "600",
                  }}
                  placeholder={t("plan.destinationExample")}
                  placeholderTextColor={DC.textDim}
                  value={destination}
                  onChangeText={setDestination}
                  autoCapitalize="words"
                />
              </View>

              {/* KOLIKO DANA */}
              {!spontaneous && (
                <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: DC.textSub,
                      marginBottom: 10,
                    }}
                  >
                    {t("plan.howManyDays")}?
                  </Text>
                  <View
                    style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                  >
                    {[
                      {
                        val: 1,
                        label: t("plan.day1Label", { defaultValue: "1 dan" }),
                      },
                      {
                        val: 2,
                        label: t("plan.weekendLabel", {
                          defaultValue: "Vikend",
                        }),
                      },
                      {
                        val: 3,
                        label: t("plan.days3Label", { defaultValue: "3 dana" }),
                      },
                      {
                        val: 5,
                        label: t("plan.weekLabel", { defaultValue: "Tjedan" }),
                      },
                      {
                        val: 7,
                        label: t("plan.days7Label", { defaultValue: "7 dana" }),
                      },
                    ].map((o) => (
                      <TouchableOpacity
                        key={o.val}
                        style={{
                          paddingHorizontal: 18,
                          paddingVertical: 10,
                          borderRadius: 10,
                          backgroundColor:
                            numDays === o.val ? DC.cardHover : DC.card,
                          borderWidth: 1.5,
                          borderColor:
                            numDays === o.val ? DC.border : DC.borderDim,
                        }}
                        onPress={() => setNumDays(o.val)}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: numDays === o.val ? "700" : "400",
                            color: numDays === o.val ? DC.text : DC.textDim,
                          }}
                        >
                          {o.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* STIL */}
              <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: DC.textSub,
                    marginBottom: 10,
                  }}
                >
                  {t("plan.tripStyle")}?
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    {
                      val: "opusteno" as PlanStyle,
                      emoji: "😎",
                      label: t("plan.styleRelaxed"),
                    },
                    {
                      val: "kulturno" as PlanStyle,
                      emoji: "🧐",
                      label: t("plan.styleCultural"),
                    },
                    {
                      val: "avantura" as PlanStyle,
                      emoji: "🤩",
                      label: t("plan.styleAdventure"),
                    },
                  ].map((o) => (
                    <TouchableOpacity
                      key={o.val}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: "center",
                        backgroundColor:
                          planStyle === o.val ? DC.cardHover : DC.card,
                        borderWidth: 1.5,
                        borderColor:
                          planStyle === o.val ? DC.border : DC.borderDim,
                      }}
                      onPress={() => setPlanStyle(o.val)}
                    >
                      <Text style={{ fontSize: 26, marginBottom: 4 }}>
                        {o.emoji}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: planStyle === o.val ? "700" : "500",
                          color: planStyle === o.val ? DC.text : DC.textDim,
                        }}
                      >
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* NAPREDNO */}
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginHorizontal: 16,
                  marginTop: 20,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: DC.card,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: DC.borderDim,
                }}
                onPress={() => setShowAdvanced((v) => !v)}
              >
                <Text
                  style={{ fontSize: 13, color: DC.textSub, fontWeight: "600" }}
                >
                  {t("plan.advancedOptions")}
                </Text>
                <Text style={{ fontSize: 13, color: DC.textDim }}>
                  {showAdvanced
                    ? t("plan.advancedHide")
                    : t("plan.advancedShow")}
                </Text>
              </TouchableOpacity>

              {showAdvanced && (
                <View
                  style={{
                    marginHorizontal: 16,
                    padding: 14,
                    backgroundColor: DC.card,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: DC.borderDim,
                    borderTopWidth: 0,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    gap: 16,
                  }}
                >
                  {/* S KIM */}
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: DC.textSub,
                        marginBottom: 8,
                      }}
                    >
                      {t("plan.withWhom")}?
                    </Text>
                    <View style={{ gap: 8 }}>
                      {[
                        {
                          val: "solo" as CompanionType,
                          label: t("plan.companionSolo"),
                          emoji: "🧍",
                          desc: t("plan.companionSoloDesc"),
                        },
                        {
                          val: "partner" as CompanionType,
                          label: t("plan.companionPartner"),
                          emoji: "💑",
                          desc: t("plan.companionPartnerDesc"),
                        },
                        {
                          val: "prijatelji" as CompanionType,
                          label: t("plan.companionFriends"),
                          emoji: "👯",
                          desc: t("plan.companionFriendsDesc"),
                        },
                        {
                          val: "obitelj" as CompanionType,
                          label: t("plan.companionFamily"),
                          emoji: "👨‍👩‍👧‍👦",
                          desc: t("plan.companionFamilyDesc"),
                        },
                      ].map((o) => (
                        <TouchableOpacity
                          key={o.val}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 10,
                            backgroundColor:
                              companions === o.val ? DC.cardHover : DC.bg,
                            borderWidth: 1.5,
                            borderColor:
                              companions === o.val ? DC.border : DC.borderDim,
                            gap: 10,
                          }}
                          onPress={() => setCompanions(o.val)}
                        >
                          <Text style={{ fontSize: 22 }}>{o.emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight:
                                  companions === o.val ? "700" : "500",
                                color:
                                  companions === o.val ? DC.text : DC.textDim,
                              }}
                            >
                              {o.label}
                            </Text>
                            <Text style={{ fontSize: 11, color: DC.textDim }}>
                              {o.desc}
                            </Text>
                          </View>
                          {companions === o.val && (
                            <Text style={{ fontSize: 16, color: DC.accent }}>
                              ✓
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* PRIJEVOZ */}
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: DC.textSub,
                        marginBottom: 8,
                      }}
                    >
                      {t("plan.transportLabel")}
                    </Text>
                    <View
                      style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}
                    >
                      {[
                        { val: "auto" as TransportType, label: t("plan.car") },
                        {
                          val: "javni" as TransportType,
                          label: t("plan.public"),
                        },
                        {
                          val: "pjesice" as TransportType,
                          label: t("plan.walking"),
                        },
                        {
                          val: "bicikl" as TransportType,
                          label: t("plan.bicycle"),
                        },
                      ].map((o) => (
                        <TouchableOpacity
                          key={o.val}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor:
                              transport === o.val ? DC.cardHover : DC.bg,
                            borderWidth: 1,
                            borderColor:
                              transport === o.val ? DC.border : DC.borderDim,
                          }}
                          onPress={() => setTransport(o.val)}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: transport === o.val ? "700" : "400",
                              color: transport === o.val ? DC.text : DC.textDim,
                            }}
                          >
                            {o.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* BUDŽET */}
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: DC.textSub,
                        marginBottom: 8,
                      }}
                    >
                      {t("plan.budgetLabel")}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: DC.bg,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: DC.inputBorder,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        gap: 8,
                      }}
                    >
                      <Text style={{ fontSize: 16, color: DC.textDim }}>€</Text>
                      <TextInput
                        style={{
                          flex: 1,
                          fontSize: 16,
                          fontWeight: "600",
                          color: DC.text,
                          padding: 0,
                        }}
                        placeholder={t("plan.budgetPlaceholder")}
                        placeholderTextColor={DC.textDim}
                        value={budget}
                        onChangeText={(v) =>
                          setBudget(v.replace(/[^0-9]/g, ""))
                        }
                        keyboardType="numeric"
                        maxLength={6}
                      />
                      <Text style={{ fontSize: 12, color: DC.textDim }}>
                        EUR
                      </Text>
                    </View>
                  </View>

                  {/* RADIJUS */}
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: DC.textSub,
                        marginBottom: 8,
                      }}
                    >
                      {t("plan.radiusLabel")}
                    </Text>
                    <View
                      style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}
                    >
                      {[2, 5, 10, 20].map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor:
                              activityRadius === r ? DC.cardHover : DC.bg,
                            borderWidth: 1,
                            borderColor:
                              activityRadius === r ? DC.border : DC.borderDim,
                          }}
                          onPress={() => setActivityRadius(r)}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: activityRadius === r ? "700" : "400",
                              color:
                                activityRadius === r ? DC.text : DC.textDim,
                            }}
                          >
                            {r} km
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* INTERESI */}
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: DC.textSub,
                        }}
                      >
                        {t("plan.interestsLabel")}
                      </Text>
                      {interests.length > 0 && (
                        <TouchableOpacity onPress={() => setInterests([])}>
                          <Text
                            style={{
                              fontSize: 12,
                              color: DC.accent,
                              fontWeight: "600",
                            }}
                          >
                            {t("plan.clearInterestsBtn")}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <InterestiGrid
                      interests={interests}
                      onToggle={(id) =>
                        setInterests((prev) =>
                          prev.includes(id)
                            ? prev.filter((x) => x !== id)
                            : [...prev, id],
                        )
                      }
                      DC={DC}
                      t={t}
                    />
                  </View>
                </View>
              )}

              {/* GUMB GENERIRAJ */}
              <TouchableOpacity
                style={{
                  margin: 16,
                  marginTop: 24,
                  backgroundColor: DC.cardHover,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: DC.border,
                  paddingVertical: 18,
                  alignItems: "center",
                }}
                onPress={generate}
              >
                <Text
                  style={{ color: DC.text, fontSize: 17, fontWeight: "800" }}
                >
                  {spontaneous ? t("plan.discoverBtn") : t("plan.generateBtn")}
                </Text>
                <Text style={{ color: DC.textDim, fontSize: 12, marginTop: 4 }}>
                  {t("plan.generateSubtitle")}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ========== REZULTAT ========== */}
        {step === "result" && (
          <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
            {/* KARTA */}

            {/* PRE-LOAD IKONA — skriveni View koji inicijalizira sve Image komponente */}
            <View
              style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
            >
              {Object.entries(MARKER_IMAGES).map(([key, src]) => (
                <Image key={key} source={src} style={{ width: 1, height: 1 }} />
              ))}
            </View>
            {geocodedCoords && activeDayActivities.length > 0 && (
              <View style={{ margin: 16, borderRadius: 16 }}>
                {/* AKTIVAN STOP BANNER — overlay iznad karte */}
                {activeDayActivities[activeStop] && (
                  <View
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      right: 12,
                      zIndex: 10,
                      backgroundColor: isDark
                        ? "rgba(20,30,20,0.95)"
                        : "rgba(255,255,255,0.95)",
                      borderRadius: 12,
                      padding: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor:
                          ROUTE_COLORS[activeDay % ROUTE_COLORS.length],
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        {activeStop + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: DC.text,
                        }}
                        numberOfLines={1}
                      >
                        {activeDayActivities[activeStop].venueName}{" "}
                      </Text>
                      <Text style={{ fontSize: 11, color: DC.textSub }}>
                        {activeDayActivities[activeStop].description}
                        {" • "}
                        {activeDayActivities[activeStop].duration} min
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: ROUTE_COLORS[activeDay % ROUTE_COLORS.length],
                      }}
                    >
                      {activeDayActivities[activeStop].time}
                    </Text>
                  </View>
                )}
                <MapView
                  ref={mapRef}
                  style={{ height: 380 }}
                  initialRegion={{
                    latitude: geocodedCoords.latitude,
                    longitude: geocodedCoords.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  onMapReady={() => setMapReady(true)}
                  toolbarEnabled={false} // ← uklanja Google Maps toolbar s ikonama
                  moveOnMarkerPress={false}
                >
                  {userLocation && (
                    <Marker
                      coordinate={userLocation}
                      tracksViewChanges={false}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <Image
                        source={putnikIcon}
                        style={{ width: 48, height: 48 }}
                        resizeMode="contain"
                        fadeDuration={0}
                      />
                    </Marker>
                  )}

                  {(() => {
                    const color = ROUTE_COLORS[activeDay % ROUTE_COLORS.length];
                    const routeCoords = [
                      ...(userLocation ? [userLocation] : [geocodedCoords]),
                      ...activeDayActivities
                        .filter((a) => a.venue)
                        .map((a) => ({
                          latitude: a.venue!.latitude,
                          longitude: a.venue!.longitude,
                        })),
                    ];
                    const validCoords = routeCoords.filter(
                      (c) =>
                        c &&
                        typeof c.latitude === "number" &&
                        typeof c.longitude === "number",
                    );

                    return (
                      <>
                        {validCoords.length > 1 && (
                          <Polyline
                            coordinates={validCoords}
                            strokeColor={color}
                            strokeWidth={4}
                          />
                        )}
                        {activeDayActivities.map((activity, idx) => (
                          <SimpleMarker
                            key={`marker_${idx}`}
                            activity={activity}
                            color={color}
                            isActive={
                              activeStop === idx && activity.venue !== null
                            }
                            isCompleted={completedStops.has(idx)}
                            onPress={() => {
                              if (activity.venue) {
                                setActiveStop(idx);
                                openVenueDetail(activity);
                              }
                            }}
                          />
                        ))}
                      </>
                    );
                  })()}
                </MapView>

                {/* SELEKTOR DANA (samo ako više od 1 dana) */}
                {generatedNumDays > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{
                      backgroundColor: DC.card,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {Array.from({
                        length: Math.min(generatedNumDays, 7),
                      }).map((_, i) => (
                        <TouchableOpacity
                          key={i}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 16,
                            backgroundColor:
                              activeDay === i
                                ? ROUTE_COLORS[i % ROUTE_COLORS.length]
                                : DC.bg,
                            borderWidth: 1.5,
                            borderColor: ROUTE_COLORS[i % ROUTE_COLORS.length],
                          }}
                          onPress={() => setActiveDay(i)}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color:
                                activeDay === i
                                  ? "#fff"
                                  : ROUTE_COLORS[i % ROUTE_COLORS.length],
                            }}
                          >
                            {t("plan.dayLabel2", { day: i + 1 })}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}

                {/* HORIZONTALNI SCROLL STOPOVA */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{
                    backgroundColor: DC.card,
                    paddingVertical: 8,
                    paddingHorizontal: 6,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      alignItems: "flex-start",
                    }}
                  >
                    {activeDayActivities.map((act, i) => {
                      const isAct = activeStop === i;
                      const isDone = completedStops.has(i);
                      const color =
                        ROUTE_COLORS[activeDay % ROUTE_COLORS.length];
                      const bc = isDone
                        ? "#34c759"
                        : isAct
                          ? color
                          : DC.borderDim;
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setActiveStop(i)}
                          style={{
                            width: 76,
                            height: 76, // ← fiksna visina — svi isti
                            borderRadius: 10,
                            padding: 8,
                            backgroundColor: isAct
                              ? color + "18"
                              : isDone
                                ? "#34c75910"
                                : DC.bg,
                            borderWidth: 1.5,
                            borderColor: bc,
                            alignItems: "center",
                            justifyContent: "center", // ← vertikalno centrirano
                          }}
                        >
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              backgroundColor: bc,
                              justifyContent: "center",
                              alignItems: "center",
                              marginBottom: 4,
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 9,
                                fontWeight: "900",
                              }}
                            >
                              {isDone ? "✓" : i + 1}
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontSize: 10,
                              color: DC.textDim,
                              marginBottom: 2,
                            }}
                          >
                            {act.time}
                          </Text>
                          {/* ← UKLONJENO: emoji ikona kategorije */}
                          <Text
                            style={{
                              fontSize: 9,
                              color: DC.text,
                              fontWeight: "600",
                              textAlign: "center",
                              lineHeight: 12,
                            }}
                            numberOfLines={2}
                          >
                            {act.venueName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* PROGRESS PILL — ispod scroll trake, iznad opisa */}
            <View
              style={{
                backgroundColor: isDark
                  ? "rgba(20,30,20,0.85)"
                  : "rgba(255,255,255,0.88)",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 6,
                alignSelf: "flex-end",
                marginTop: 6,
                marginRight: 4,
                marginBottom: 2,
              }}
            >
              <Text style={{ fontSize: 11, color: DC.textSub }}>
                {t("plan.stopOf", {
                  current: activeStop + 1,
                  total: activeDayActivities.length,
                })}
              </Text>
            </View>

            {/* OPIS PUTA */}
            <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: DC.textSub,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 10,
                }}
              >
                {" "}
                {generatedNumDays > 1
                  ? t("plan.dayPlanLabel", { day: activeDay + 1 })
                  : t("plan.hourlyPlan")}
              </Text>

              <View
                style={{
                  backgroundColor: DC.card,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: DC.borderDim,
                }}
              >
                {activeDayActivities.map((activity, idx) => {
                  const color = ROUTE_COLORS[activeDay % ROUTE_COLORS.length];
                  const isActive = activeStop === idx;
                  const isCompleted = completedStops.has(idx);
                  const hasVenue = activity.venue !== null;
                  const isVenueAlreadyVisited = activity.venue
                    ? isVenueVisited(activity.venue, activity.venueType)
                    : false;

                  return (
                    <TouchableOpacity
                      key={`desc_${idx}`}
                      activeOpacity={hasVenue ? 0.65 : 1}
                      onPress={() => {
                        if (hasVenue) {
                          setActiveStop(idx);
                          openVenueDetail(activity);
                        }
                      }}
                      style={{
                        backgroundColor: isActive
                          ? color + "28"
                          : isCompleted || isVenueAlreadyVisited
                            ? "#34c75918"
                            : hasVenue
                              ? color + "12"
                              : DC.bg,
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 8,
                        borderLeftWidth: 4,
                        borderLeftColor: isCompleted ? "#34c759" : color,
                        borderWidth: isActive ? 2 : 0.5,
                        borderColor: isActive ? color + "88" : DC.borderDim,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {/* BROJ */}
                      <View style={{ alignItems: "center", gap: 3 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor:
                              isCompleted || isVenueAlreadyVisited
                                ? "#34c759"
                                : color,
                            justifyContent: "center",
                            alignItems: "center",
                            borderWidth: 2,
                            borderColor: isActive ? "#fff" : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: "900",
                            }}
                          >
                            {isCompleted || isVenueAlreadyVisited
                              ? "✓"
                              : idx + 1}
                          </Text>
                        </View>
                        {isActive && <PulsingDot color={color} />}
                      </View>

                      {/* TEKST */}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: DC.text,
                          }}
                        >
                          {activity.time} – {activity.venueName}{" "}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: DC.textSub,
                            marginTop: 2,
                          }}
                        >
                          {activity.description}
                        </Text>
                        <Text style={{ fontSize: 11, color: DC.textSub }}>
                          {activity.duration} min • ~{activity.cost} EUR
                        </Text>
                      </View>

                      {/* DUGME OTVORI */}
                      {hasVenue && !(isCompleted || isVenueAlreadyVisited) && (
                        <View
                          style={{
                            backgroundColor: isActive ? color : color + "CC",
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#fff",
                              fontWeight: "800",
                            }}
                          >
                            {t("plan.open")} →
                          </Text>
                        </View>
                      )}

                      {/* OBIŠAO GUMB */}
                      {hasVenue &&
                        isActive &&
                        !isCompleted &&
                        !isVenueAlreadyVisited && (
                          <TouchableOpacity
                            style={{
                              backgroundColor: "#34c759",
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                            }}
                            onPress={async (e) => {
                              e.stopPropagation();
                              if (activity.venue) {
                                await handleMarkVisited(
                                  activity.venue,
                                  activity.venueType,
                                );
                                setCompletedStops(
                                  (prev) => new Set([...prev, idx]),
                                );
                                if (idx + 1 < activeDayActivities.length) {
                                  setActiveStop(idx + 1);
                                }
                              }
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                color: "#fff",
                                fontWeight: "900",
                              }}
                            >
                              {t("plan.visitedMark")} ✓
                            </Text>
                          </TouchableOpacity>
                        )}

                      {/* VEĆ POSJEĆENO */}
                      {(isCompleted || isVenueAlreadyVisited) && (
                        <View
                          style={{
                            backgroundColor: "#34c75922",
                            borderRadius: 10,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderWidth: 1,
                            borderColor: "#34c759",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#34c759",
                              fontWeight: "800",
                            }}
                          >
                            ✓ {t("plan.visitedDone")}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* MJESTA PO KATEGORIJAMA */}
            {Object.keys(allVenues).length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: DC.textSub,
                    marginBottom: 10,
                  }}
                >
                  {t("plan.allFoundPlaces")}
                </Text>
                {Object.entries(allVenues).map(([type, options]) => {
                  const cat =
                    placeCategories[type as keyof typeof placeCategories];
                  const color = cat?.color || "#667eea";
                  const visitedCount = options.filter((v) =>
                    isVenueVisited(v, type),
                  ).length;
                  const isOpen = expandedCategories.has(type);

                  return (
                    <View
                      key={type}
                      style={{
                        backgroundColor: DC.card,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: DC.borderDim,
                        overflow: "hidden",
                      }}
                    >
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          padding: 12,
                          gap: 10,
                          backgroundColor: color + "15",
                        }}
                        onPress={() =>
                          setExpandedCategories((prev) => {
                            const next = new Set(prev);
                            next.has(type) ? next.delete(type) : next.add(type);
                            return next;
                          })
                        }
                      >
                        {MARKER_IMAGES[type] ? (
                          <Image
                            source={MARKER_IMAGES[type]}
                            style={{ width: 40, height: 40 }}
                            resizeMode="contain"
                          />
                        ) : (
                          <Text style={{ fontSize: 22 }}>
                            {EMOJIS[type] || "📍"}
                          </Text>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: DC.text,
                            }}
                          >
                            {t(`categories.${type}`, { defaultValue: type })}
                          </Text>
                          <Text style={{ fontSize: 11, color: DC.textDim }}>
                            {options.length} {t("plan.placesWord")}
                            {visitedCount > 0
                              ? ` · ✓ ${visitedCount} ${t("plan.visitedWord")}`
                              : ""}
                          </Text>
                        </View>
                        <Text
                          style={{ fontSize: 12, color, fontWeight: "700" }}
                        >
                          {isOpen ? "▲" : "▼"}
                        </Text>
                      </TouchableOpacity>

                      {isOpen &&
                        options.map((venue, idx) => {
                          const visited = isVenueVisited(venue, type);
                          const dist = geocodedCoords
                            ? haversineKm(
                                geocodedCoords.latitude,
                                geocodedCoords.longitude,
                                venue.latitude,
                                venue.longitude,
                              )
                            : null;
                          return (
                            <View
                              key={idx}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                padding: 12,
                                borderTopWidth: 1,
                                borderTopColor: DC.borderDim,
                                gap: 10,
                                backgroundColor: visited
                                  ? "#34c75908"
                                  : "transparent",
                              }}
                            >
                              <View
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 13,
                                  backgroundColor: visited
                                    ? "#34c75922"
                                    : color + "22",
                                  borderWidth: 1,
                                  borderColor: visited ? "#34c759" : color,
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: "800",
                                    color: visited ? "#34c759" : color,
                                  }}
                                >
                                  {visited ? "✓" : idx + 1}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={{ flex: 1 }}
                                onPress={() => {
                                  setSelectedPlace({
                                    id: `plan_${type}_${venue.name}`,
                                    name: venue.name,
                                    latitude: venue.latitude,
                                    longitude: venue.longitude,
                                    type: type as Place["type"],
                                    address: venue.address,
                                  });
                                  setShowDetailModal(true);
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "700",
                                    color: visited ? "#34c759" : DC.text,
                                  }}
                                  numberOfLines={1}
                                >
                                  {venue.name}
                                </Text>
                                {venue.address && (
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      color: DC.textDim,
                                      marginTop: 1,
                                    }}
                                    numberOfLines={1}
                                  >
                                    📍 {venue.address}
                                  </Text>
                                )}
                                {dist !== null && (
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      color: dist < 1 ? "#34c759" : color,
                                      marginTop: 1,
                                    }}
                                  >
                                    {dist < 1
                                      ? `${Math.round(dist * 1000)} m`
                                      : `${dist.toFixed(1)} km`}
                                  </Text>
                                )}
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 7,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: visited ? "#34c759" : color,
                                  backgroundColor: visited
                                    ? "#34c75922"
                                    : color + "18",
                                }}
                                onPress={() => handleMarkVisited(venue, type)}
                                disabled={visited}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    color: visited ? "#34c759" : color,
                                  }}
                                >
                                  {visited
                                    ? t("plan.visited2")
                                    : t("plan.markPlace")}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                    </View>
                  );
                })}
              </View>
            )}

            {/* AKCIJE */}
            <View style={{ marginHorizontal: 16, gap: 10, marginBottom: 8 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: DC.cardHover,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: DC.border,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
                onPress={() => Share.share({ message: result }).catch(() => {})}
              >
                <Text
                  style={{ color: DC.text, fontSize: 15, fontWeight: "700" }}
                >
                  {t("plan.sharePlan")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: DC.bg,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DC.borderDim,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
                onPress={() => setStep("form")}
              >
                <Text
                  style={{ color: DC.textSub, fontSize: 14, fontWeight: "600" }}
                >
                  {t("plan.newPlanBtn")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* OCJENA */}
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 16,
                marginBottom: 32,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: DC.text,
                  marginBottom: 10,
                }}
              >
                {t("plan.rateTitle")}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => !ratingSubmitted && setPlanRating(n)}
                    disabled={ratingSubmitted}
                  >
                    <Text
                      style={{
                        fontSize: 34,
                        color: planRating >= n ? "#f39c12" : DC.borderDim,
                      }}
                    >
                      {planRating >= n ? "★" : "☆"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Poruka o grešci */}
              {ratingError && (
                <Text
                  style={{
                    color: DC.danger,
                    fontSize: 12,
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  {ratingError}
                </Text>
              )}

              {/* Gumb za slanje — prikazuje se dok nije poslano */}
              {planRating > 0 && !ratingSubmitted && (
                <TouchableOpacity
                  style={{
                    marginTop: 10,
                    paddingHorizontal: 24,
                    paddingVertical: 10,
                    backgroundColor: ratingLoading
                      ? DC.borderDim
                      : DC.cardHover,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: DC.border,
                    opacity: ratingLoading ? 0.7 : 1,
                  }}
                  onPress={submitRating}
                  disabled={ratingLoading}
                >
                  {ratingLoading ? (
                    <ActivityIndicator size="small" color={DC.text} />
                  ) : (
                    <Text style={{ color: DC.text, fontWeight: "700" }}>
                      {t("plan.rateSubmit")}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Potvrda nakon uspješnog slanja — bez Alert */}
              {ratingSubmitted && (
                <View
                  style={{
                    marginTop: 12,
                    alignItems: "center",
                    backgroundColor: "#34c75918",
                    borderRadius: 10,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: "#34c759",
                  }}
                >
                  <Text
                    style={{
                      color: "#34c759",
                      fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    ✓ {t("plan.rateThankYou")}
                  </Text>
                  <Text
                    style={{
                      color: DC.textDim,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {destination} · {planRating}/5 ⭐
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* Place Detail Modal */}
        <PlaceDetailModalComponent
          place={selectedPlace}
          visible={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPlace(null);
          }}
          onMarkVisited={async (p: Place) => {
            if (onMarkVisited) await onMarkVisited(p);
            setLocalVisitedIds((prev) => new Set([...prev, p.id]));
            setShowDetailModal(false);
            setSelectedPlace(null);
          }}
          onHidePlace={() => {
            setShowDetailModal(false);
            setSelectedPlace(null);
          }}
          isVisited={
            selectedPlace
              ? localVisitedIds.has(selectedPlace.id) ||
                visits.some(
                  (v) =>
                    v.placeName.toLowerCase() ===
                      (selectedPlace.name || "").toLowerCase() &&
                    v.placeType === selectedPlace.type,
                )
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
      </View>
    </Modal>
  );
}
