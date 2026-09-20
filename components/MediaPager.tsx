// components/MediaPager.tsx
//
// Pregled objava prelistavanjem.
//
// U profilu ("Moje") i na tuđem profilu ("Aktivnosti") objava se otvarala
// pojedinačno: da se vidi sljedeća, prethodnu je trebalo zatvoriti pa se
// vratiti u mrežicu i pogoditi sličicu. Kod desetak objava to je više
// zatvaranja nego gledanja.
//
// Ovdje se otvori ona koju si dotaknuo, a ostale su lijevo i desno. Ista
// komponenta služi oba mjesta, da se pregled ne razilazi u dvije verzije.

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CloseButton } from "./CloseButton";

/** Objava u pregledu. Polja koja objava nema jednostavno se ne prikažu. */
export interface PagerItem {
  id: number | string;
  /** Puna adresa slike ili videa. */
  url: string;
  isVideo: boolean;
  title?: string | null;
  location?: string | null;
  /** Opis objave; već sadrži "Kategorije" i "Primjereno za". */
  description?: string | null;
  isEvent?: boolean;
  eventStartAt?: string | null;
  authorName?: string | null;
}

/** Pamti želi li korisnik vidjeti podatke uz objavu ili samu sliku. */
const STORAGE_DETAILS = "vara_pager_details_v1";

/** Isti oblik kao u videima: "20.09.2026. - 12:00". */
function eventWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}. - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Jedna stranica.
 *
 * Zaseban komponent jer svaki video treba svoj player, a playeri se rade
 * hookom — koji se ne smije zvati u petlji. Svira samo onaj na vidljivoj
 * stranici; ostali stoje, inače bi se čulo troje odjednom.
 */
function PagerPage({
  item,
  isActive,
  width,
  height,
  showDetails,
}: {
  item: PagerItem;
  isActive: boolean;
  width: number;
  height: number;
  showDetails: boolean;
}) {
  const { t } = useTranslation();
  const player = useVideoPlayer(item.isVideo ? item.url : null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!item.isVideo) return;
    try {
      if (isActive) player.play();
      else player.pause();
    } catch {
      // Player zna biti otpušten prije nego efekt stigne — nije razlog za pad.
    }
  }, [isActive, item.isVideo, player]);

  return (
    <View style={{ width, height, justifyContent: "center" }}>
      {item.isVideo ? (
        <VideoView
          player={player}
          style={{ width, height: height * 0.72 }}
          contentFit="contain"
          nativeControls
        />
      ) : (
        <Image
          source={{ uri: item.url }}
          style={{ width, height: height * 0.72 }}
          resizeMode="contain"
        />
      )}

      {showDetails && (
        <ScrollView
          style={{ maxHeight: height * 0.26 }}
          contentContainerStyle={{ padding: 18, gap: 6 }}
        >
          {!!item.authorName && (
            <Text style={{ color: "#8fd06a", fontSize: 14, fontWeight: "700" }}>
              {item.authorName}
            </Text>
          )}
          {!!item.title && (
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
              {item.title}
            </Text>
          )}
          {!!item.location && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="location-outline" size={14} color="#c9c9c9" />
              <Text style={{ color: "#dcdcdc", fontSize: 13, flex: 1 }}>
                {item.location}
              </Text>
            </View>
          )}
          {item.isEvent && item.eventStartAt && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Ionicons name="calendar" size={13} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                {t("post.eventStarts", { when: eventWhen(item.eventStartAt) })}
              </Text>
            </View>
          )}
          {!!item.description && (
            <Text style={{ color: "#c9c9c9", fontSize: 13, lineHeight: 20 }}>
              {item.description}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

export function MediaPager({
  visible,
  items,
  initialIndex = 0,
  onClose,
  onDelete,
}: {
  visible: boolean;
  items: PagerItem[];
  initialIndex?: number;
  onClose: () => void;
  /** Kad je zadano, u zaglavlju stoji i gumb za brisanje trenutne objave. */
  onDelete?: (item: PagerItem) => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<PagerItem>>(null);

  const [index, setIndex] = useState(initialIndex);
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_DETAILS)
      .then((v) => {
        if (v === "0") setShowDetails(false);
      })
      .catch(() => {});
  }, []);

  const toggleDetails = () => {
    setShowDetails((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_DETAILS, next ? "1" : "0").catch(() => {});
      return next;
    });
  };

  const current = items[index];

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#000" }}
        edges={["top"]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
            {items.length > 0 ? `${index + 1} / ${items.length}` : ""}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            {/* Prekidač podataka: nekad se gleda slika, nekad se traži gdje
                je to i kome odgovara. Izbor se pamti za idući put. */}
            <TouchableOpacity
              onPress={toggleDetails}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={
                showDetails ? t("pager.hideDetails") : t("pager.showDetails")
              }
            >
              <Ionicons
                name={
                  showDetails
                    ? "information-circle"
                    : "information-circle-outline"
                }
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            {onDelete && current && (
              <TouchableOpacity
                onPress={() => onDelete(current)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t("common.delete")}
              >
                <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
              </TouchableOpacity>
            )}

            <CloseButton onPress={onClose} tone="onBlack" />
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(it) => String(it.id)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          // Bez getItemLayout initialScrollIndex na dugačkim popisima
          // promaši stranicu, jer FlatList još ne zna koliko je koja široka.
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          onMomentumScrollEnd={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / width);
            if (next !== index) setIndex(next);
          }}
          renderItem={({ item, index: i }) => (
            <PagerPage
              item={item}
              isActive={i === index}
              width={width}
              height={height}
              showDetails={showDetails}
            />
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
