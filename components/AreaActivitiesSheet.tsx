// components/AreaActivitiesSheet.tsx
//
// Što se događa oko nekog mjesta.
//
// Dosad se sadržaj vezan uz lokaciju mogao vidjeti samo kroz vlastiti feed —
// "blizu mene" mjeri od krajeva u kojima se korisnik inače kreće. Tko dođe u
// nepoznat grad, ili ga tek planira posjetiti, time nije dobivao ništa: bio je
// daleko od svih svojih krajeva.
//
// Ovdje se bira točka na karti (ili grad iz plana) i traži što je objavljeno
// oko nje. Poslužitelj radi isti filtar po udaljenosti kao i za feed, samo
// mjeri od zadane točke.
//
// Ista komponenta služi i karti i planiranju izleta, da se dva prikaza istog
// ne raziđu u dvije verzije.

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_BASE_URL } from "@/app/config/api";
import { POST_CATEGORY_IDS } from "@/app/services/locationService";
import { CloseButton } from "./CloseButton";
import { MediaPager, PagerItem } from "./MediaPager";

/** Mjesto oko kojeg se traži. */
export interface AreaPoint {
  name: string;
  latitude: number;
  longitude: number;
}

interface AreaPost {
  id: number;
  title: string;
  filePath: string;
  mediaType?: string;
  thumbnailPath?: string | null;
  location?: string | null;
  additionalDescription?: string | null;
  categories?: string | null;
  isEvent?: boolean;
  eventStartAt?: string | null;
  userName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;
const STORAGE_RADIUS = "vara_area_radius_v1";

function fullUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function isImagePath(path?: string | null): boolean {
  const clean = (path || "").toLowerCase().split("?")[0];
  return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"].some((e) =>
    clean.endsWith(e),
  );
}

/** "20.09.2026. - 12:00" — isti oblik kao drugdje u aplikaciji. */
function eventWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}. - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Zračna udaljenost u kilometrima. */
function distanceKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = (bLat - aLat) * 111;
  const dLon = (bLon - aLon) * 111 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

export function AreaActivitiesSheet({
  visible,
  point,
  onClose,
}: {
  visible: boolean;
  point: AreaPoint | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [posts, setPosts] = useState<AreaPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pagerAt, setPagerAt] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_RADIUS)
      .then((v) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) setRadiusKm(Math.min(n, 100));
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!point) return;
    setLoading(true);
    setFailed(false);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_BASE_URL}/api/video?page=1&pageSize=50` +
          `&radiusKm=${radiusKm}&lat=${point.latitude}&lon=${point.longitude}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [point, radiusKm]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const chooseRadius = (km: number) => {
    setRadiusKm(km);
    AsyncStorage.setItem(STORAGE_RADIUS, String(km)).catch(() => {});
  };

  const toggleCat = (id: string) =>
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  // Filtriranje po kategoriji ide ovdje, ne na poslužitelju: stranica je
  // ograničena na 50 objava, pa je jeftinije nego novi zahtjev pri svakom
  // dodiru kategorije.
  const shown = selectedCats.length
    ? posts.filter((p) =>
        (p.categories || "")
          .split(",")
          .map((c) => c.trim())
          .some((c) => selectedCats.includes(c)),
      )
    : posts;

  const pagerItems: PagerItem[] = shown.map((p) => ({
    id: p.id,
    url: fullUrl(p.filePath),
    isVideo: !(p.mediaType === "image" || isImagePath(p.filePath)),
    title: p.title,
    location: p.location,
    description: p.additionalDescription,
    isEvent: p.isEvent,
    eventStartAt: p.eventStartAt,
    authorName: p.userName ? `@${p.userName}` : undefined,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
        onPress={onClose}
      >
        <View style={{ flex: 1 }} />
        <Pressable
          style={{
            height: "85%",
            backgroundColor: "#16301a",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: "#2f5a33",
          }}
          onPress={() => {}}
        >
          <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingTop: 16,
                paddingBottom: 8,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}
                  numberOfLines={1}
                >
                  {t("area.title")}
                </Text>
                {!!point?.name && (
                  <Text
                    style={{ color: "#b6cfae", fontSize: 13, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {point.name}
                  </Text>
                )}
              </View>
              <CloseButton onPress={onClose} tone="light" />
            </View>

            {/* Domet */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingVertical: 6,
                gap: 8,
              }}
            >
              {RADIUS_OPTIONS.map((km) => {
                const on = km === radiusKm;
                return (
                  <TouchableOpacity
                    key={km}
                    onPress={() => chooseRadius(km)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: on ? "#5a8a48" : "#2f5a33",
                      backgroundColor: on ? "#5a8a48" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: on ? "#fff" : "#b6cfae",
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {km} km
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Kategorije */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingVertical: 6,
                gap: 8,
              }}
            >
              {POST_CATEGORY_IDS.map((id) => {
                const on = selectedCats.includes(id);
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => toggleCat(id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: on ? "#c9a227" : "#2f5a33",
                      backgroundColor: on ? "#c9a22733" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: on ? "#f2d78a" : "#9fbc96",
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {t(`categories.${id}`, { defaultValue: id })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color="#8fd06a" />
            ) : (
              <FlatList
                data={shown}
                keyExtractor={(p) => String(p.id)}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", marginTop: 40 }}>
                    <Ionicons
                      name={failed ? "cloud-offline-outline" : "map-outline"}
                      size={44}
                      color="#2f5a33"
                    />
                    <Text
                      style={{
                        color: "#b6cfae",
                        fontSize: 14,
                        marginTop: 12,
                        textAlign: "center",
                        paddingHorizontal: 24,
                        lineHeight: 20,
                      }}
                    >
                      {failed ? t("area.loadFailed") : t("area.empty")}
                    </Text>
                  </View>
                }
                renderItem={({ item, index }) => {
                  const thumb = fullUrl(item.thumbnailPath || item.filePath);
                  const km =
                    point && item.latitude != null && item.longitude != null
                      ? distanceKm(
                          point.latitude,
                          point.longitude,
                          item.latitude,
                          item.longitude,
                        )
                      : null;
                  return (
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        padding: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "#2f5a33",
                        marginBottom: 10,
                      }}
                      onPress={() => setPagerAt(index)}
                    >
                      <Image
                        source={{ uri: thumb }}
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 8,
                          backgroundColor: "#0d1f10",
                        }}
                        resizeMode="cover"
                      />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 15,
                            fontWeight: "700",
                          }}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {!!item.location && (
                          <Text
                            style={{ color: "#b6cfae", fontSize: 12 }}
                            numberOfLines={1}
                          >
                            {item.location}
                          </Text>
                        )}
                        {item.isEvent && item.eventStartAt && (
                          <Text
                            style={{
                              color: "#f2d78a",
                              fontSize: 12,
                              fontWeight: "700",
                            }}
                          >
                            {eventWhen(item.eventStartAt)}
                          </Text>
                        )}
                        {km !== null && (
                          <Text style={{ color: "#8aa483", fontSize: 12 }}>
                            {km < 1
                              ? `${Math.round(km * 1000)} m`
                              : `${km.toFixed(1)} km`}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </SafeAreaView>
        </Pressable>
      </Pressable>

      <MediaPager
        visible={pagerAt !== null}
        items={pagerItems}
        initialIndex={pagerAt ?? 0}
        onClose={() => setPagerAt(null)}
      />
    </Modal>
  );
}
