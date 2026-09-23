// components/TutorialModal.tsx
//
// Kratki vodič kroz aplikaciju.
//
// VARA na prvom otvaranju pokaže kartu i tu stane. Što se krije iza
// kategorija, da se doseg "Blizu mene" može mijenjati, da objava može biti
// događaj s datumom, da zvono prati kategorije — sve to se dosad moralo
// slučajno pronaći. Ovdje su četiri koraka koji to kažu naglas.
//
// Namjerno četiri, ne deset: vodič koji traje duže od pola minute se
// preskače, a onda ne koristi nikome. Svaki korak ima jednu sliku, jedan
// naslov i jednu rečenicu.

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { useTheme } from "./AdaptiveThemeProvider";
import { V } from "../styles/varaTheme";

/**
 * Vodič se otvara preko cijelog ekrana, pa mora pratiti odabranu temu —
 * inače bi korisniku u svijetloj temi jedini tamni ekran u aplikaciji bio
 * baš onaj koji je prvi vidi.
 */
type Palette = {
  bg: string;
  title: string;
  body: string;
  dim: string;
  dot: string;
  btnText: string;
};

const LIGHT: Palette = {
  bg: "#F5F0E8",
  title: "#2A2010",
  body: "#5A4A20",
  dim: "#8A7A50",
  dot: "#E0D090",
  btnText: "#FFFDF5",
};

const DARK: Palette = {
  bg: V.forestDeep,
  title: V.silverBright,
  body: V.silver,
  dim: V.silverDim,
  dot: V.borderDim,
  btnText: V.silverBright,
};

/** Podignut broj znači da će vodič ponovno vidjeti i oni koji su ga već prošli. */
const STORAGE_KEY = "vara_tutorial_seen_v1";

/**
 * Svaki korak pokazuje ONU ikonu koju korisnik stvarno dodiruje, a ne novu
 * nacrtanu za vodič. Tri koraka vode na ikone iz aplikacije (karta i videi
 * iz donje trake, zvono s karte), a objavljivanje na gumb "+" — koji u
 * aplikaciji doista jest Ionicon u krugu, pa je ovdje prikazan onakav
 * kakav je ondje.
 *
 * Poanta je prepoznavanje: tko je vidio ikonu u vodiču, nađe je na ekranu.
 * S nacrtanom zamjenom vodič samo opisuje, umjesto da pokaže.
 */
type Step = {
  /** Slika iz aplikacije, ili gumb "+" kakav stoji u Videima. */
  image?: number;
  plusButton?: boolean;
  tint: string;
  titleKey: string;
  bodyKey: string;
};

const STEPS: Step[] = [
  {
    // Ista datoteka koju koristi donja traka (BottomNav).
    image: require("../assets/images/karta.png"),
    tint: V.visited,
    titleKey: "tutorial.s1Title",
    bodyKey: "tutorial.s1Body",
  },
  {
    image: require("../assets/images/video.png"),
    tint: "#669CB7",
    titleKey: "tutorial.s2Title",
    bodyKey: "tutorial.s2Body",
  },
  {
    plusButton: true,
    tint: V.accentGold,
    titleKey: "tutorial.s3Title",
    bodyKey: "tutorial.s3Body",
  },
  {
    // Zvono s karte (dashboard).
    image: require("../assets/images/obav.png"),
    tint: "#AD6452",
    titleKey: "tutorial.s4Title",
    bodyKey: "tutorial.s4Body",
  },
];

/** Je li vodič već prikazan. Greška u čitanju se tumači kao "jest" — bolje ga
 *  propustiti nego ga vrtjeti na svakom pokretanju. */
export async function hasSeenTutorial(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === "1";
  } catch {
    return true;
  }
}

export async function markTutorialSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Ako se ne zapiše, vodič će se pojaviti opet — neugodno, ali bezopasno.
  }
}

function StepPage({
  step,
  width,
  c,
}: {
  step: Step;
  width: number;
  c: Palette;
}) {
  const { t } = useTranslation();

  return (
    <View style={{ width, paddingHorizontal: 32, alignItems: "center" }}>
      <View
        style={{
          width: 132,
          height: 132,
          borderRadius: 66,
          backgroundColor: step.tint + "26",
          borderWidth: 1,
          borderColor: step.tint + "66",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
        }}
      >
        {step.plusButton ? (
          // Gumb za objavu iz Videa, u istom obliku kao ondje: krug s
          // rubom i plusom. Samo veći, da se vidi.
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: V.forestLight,
              borderWidth: 1.5,
              borderColor: V.borderGreen,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={44} color="#fff" />
          </View>
        ) : (
          // Slike nisu kvadratne (npr. 195×273), pa "contain" unutar
          // kvadrata — isto kao u donjoj traci.
          <Image
            source={step.image}
            style={{ width: 76, height: 76 }}
            resizeMode="contain"
          />
        )}
      </View>

      <Text
        style={{
          color: c.title,
          fontSize: 23,
          fontWeight: "800",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {t(step.titleKey)}
      </Text>

      <Text
        style={{
          color: c.body,
          fontSize: 16,
          lineHeight: 24,
          textAlign: "center",
        }}
      >
        {t(step.bodyKey)}
      </Text>
    </View>
  );
}

export function TutorialModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const c: Palette = isDark ? DARK : LIGHT;
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Step>>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const isLast = index === STEPS.length - 1;

  const finish = () => {
    markTutorialSeen();
    onClose();
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    const target = index + 1;
    listRef.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={finish}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {/* "Preskoči" stoji od prvog koraka. Vodič koji se ne da zatvoriti
            iritira više nego što pomaže. */}
        <View style={{ alignItems: "flex-end", padding: 16, paddingTop: 52 }}>
          <TouchableOpacity
            onPress={finish}
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            accessibilityRole="button"
          >
            <Text style={{ color: c.dim, fontSize: 15, fontWeight: "600" }}>
              {t("tutorial.skip")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
          <FlatList
            ref={listRef}
            data={STEPS}
            keyExtractor={(s) => s.titleKey}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            // Bez getItemLayout scrollToIndex promaši stranicu, jer FlatList
            // još ne zna koliko je koja široka.
            getItemLayout={(_, i) => ({
              length: width,
              offset: width * i,
              index: i,
            })}
            onMomentumScrollEnd={(e) => {
              const next = Math.round(e.nativeEvent.contentOffset.x / width);
              if (next !== index) setIndex(next);
            }}
            renderItem={({ item }) => (
              <StepPage step={item} width={width} c={c} />
            )}
          />
        </View>

        <View style={{ paddingHorizontal: 28, paddingBottom: 44 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              marginBottom: 24,
            }}
          >
            {STEPS.map((s, i) => (
              <View
                key={s.titleKey}
                style={{
                  width: i === index ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === index ? V.visited : c.dot,
                }}
              />
            ))}
          </View>

          <TouchableOpacity
            onPress={next}
            style={{
              backgroundColor: V.visited,
              borderRadius: 12,
              paddingVertical: 15,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(232,237,228,0.22)",
            }}
            accessibilityRole="button"
          >
            <Text style={{ color: c.btnText, fontSize: 16, fontWeight: "700" }}>
              {isLast ? t("tutorial.start") : t("tutorial.next")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
