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
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
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

/** Isti oblik kao u videima: "20.09.2026. - 12:00". */
function eventWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}. - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Jedna stranica — samo medij, preko cijele visine.
 *
 * Podaci su prije stajali ispod slike i na duljim opisima ispadali ispod
 * ruba ekrana: baš ono što se htjelo pročitati (kategorije, "primjereno
 * za") bilo je odrezano. Sada ih otvara gumb u zaglavlju, u vlastitom
 * prozoru gdje ima mjesta za sve.
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
}: {
  item: PagerItem;
  isActive: boolean;
  width: number;
  height: number;
}) {
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
          style={{ width, height }}
          contentFit="contain"
          nativeControls
        />
      ) : (
        <Image
          source={{ uri: item.url }}
          style={{ width, height }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

/**
 * Podaci o objavi, u vlastitom prozoru.
 *
 * Listić se diže s dna i zauzima najviše tri četvrtine ekrana; sadržaj se
 * unutar njega pomiče, pa i dugačak opis stane bez odsijecanja.
 */
function DetailsSheet({
  item,
  visible,
  onClose,
}: {
  item: PagerItem | undefined;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)" }}
        onPress={onClose}
      >
        <View style={{ flex: 1 }} />
        <Pressable
          style={{
            maxHeight: "75%",
            backgroundColor: "#16301a",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: "#2f5a33",
            paddingBottom: 28,
          }}
          onPress={() => {}}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 10,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
              {t("pager.detailsTitle")}
            </Text>
            <CloseButton onPress={onClose} tone="light" />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 18, gap: 10 }}
          >
            {!!item.authorName && (
              <Text
                style={{ color: "#8fd06a", fontSize: 14, fontWeight: "700" }}
              >
                {item.authorName}
              </Text>
            )}
            {!!item.title && (
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>
                {item.title}
              </Text>
            )}
            {!!item.location && (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Ionicons name="location-outline" size={16} color="#b6cfae" />
                <Text style={{ color: "#dcdcdc", fontSize: 15, flex: 1 }}>
                  {item.location}
                </Text>
              </View>
            )}
            {item.isEvent && item.eventStartAt && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Ionicons name="calendar" size={15} color="#fff" />
                <Text
                  style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
                >
                  {t("post.eventStarts", {
                    when: eventWhen(item.eventStartAt),
                  })}
                </Text>
              </View>
            )}
            {!!item.description && (
              <Text style={{ color: "#d0d8cc", fontSize: 15, lineHeight: 23 }}>
                {item.description}
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setDetailsOpen(false);
    }
  }, [visible, initialIndex]);

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
            {/* Podaci o objavi. Otvaraju se preko slike, pa ih duljina
                opisa ne može istjerati ispod ruba ekrana. */}
            <TouchableOpacity
              onPress={() => setDetailsOpen(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t("pager.detailsTitle")}
            >
              <Ionicons name="information-circle" size={24} color="#fff" />
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
            />
          )}
        />

        <DetailsSheet
          item={current}
          visible={detailsOpen}
          onClose={() => setDetailsOpen(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}
