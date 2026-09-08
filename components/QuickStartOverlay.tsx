// components/QuickStartOverlay.tsx
//
// Prvo što korisnik vidi nakon prijave je karta bez ijednog rezultata i
// alatna traka s desetak kontrola — nema ničega što bi reklo čemu aplikacija
// služi ni odakle krenuti. Ovaj sloj se pokaže samo prvi put, objasni tri
// stvari koje aplikacija radi i ponudi jedan jasan sljedeći korak.
//
// Prikazuje se najviše jednom po uređaju (zapamćeno u AsyncStorage), a
// zatvara ga i tipka "natrag" na Androidu.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SEEN_KEY = "vara_quick_start_seen_v1";

interface QuickStartOverlayProps {
  /** Pozvano kad korisnik odabere "Kreni" — otvori odabir kategorija. */
  onStart: () => void;
  isDark: boolean;
}

/** Je li uvod već prikazan na ovom uređaju. */
export async function hasSeenQuickStart(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === "1";
  } catch {
    // Ako pohrana ne radi, radije ne pokazuj uvod nego ga pokazuj svaki put.
    return true;
  }
}

export default function QuickStartOverlay({
  onStart,
  isDark,
}: QuickStartOverlayProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    hasSeenQuickStart().then((seen) => {
      if (alive && !seen) setVisible(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = async (startNow: boolean) => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(SEEN_KEY, "1");
    } catch {}
    if (startNow) onStart();
  };

  const C = {
    bg: isDark ? "#1a2e1a" : "#f0ede4",
    card: isDark ? "#2a4230" : "#e4ead8",
    border: isDark ? "#4a7040" : "#5a8a40",
    borderDim: isDark ? "#3a5a30" : "#c0d0a8",
    text: isDark ? "#e8e8e8" : "#1a2a18",
    textSub: isDark ? "#c0c0c0" : "#3a4a35",
    textDim: isDark ? "#a0a0a0" : "#5a6a55",
    accent: isDark ? "#5a8a48" : "#3a6a28",
  };

  const steps = [
    {
      emoji: "🗺️",
      title: t("start.stepExplore"),
      desc: t("start.stepExploreDesc"),
    },
    {
      emoji: "🧭",
      title: t("start.stepPlan"),
      desc: t("start.stepPlanDesc"),
    },
    {
      emoji: "🎬",
      title: t("start.stepShare"),
      desc: t("start.stepShareDesc"),
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => dismiss(false)}
    >
      <View style={s.backdrop}>
        <View
          style={[s.sheet, { backgroundColor: C.bg, borderColor: C.border }]}
        >
          <ScrollView
            contentContainerStyle={{ padding: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[s.title, { color: C.text }]}>
              {t("start.welcomeTitle")}
            </Text>
            <Text style={[s.subtitle, { color: C.textSub }]}>
              {t("start.welcomeSubtitle")}
            </Text>

            <View style={{ marginTop: 20, gap: 12 }}>
              {steps.map((step) => (
                <View
                  key={step.title}
                  style={[
                    s.step,
                    { backgroundColor: C.card, borderColor: C.borderDim },
                  ]}
                >
                  <Text style={s.stepEmoji}>{step.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.stepTitle, { color: C.text }]}>
                      {step.title}
                    </Text>
                    <Text style={[s.stepDesc, { color: C.textDim }]}>
                      {step.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.cta, { backgroundColor: C.accent }]}
              onPress={() => dismiss(true)}
            >
              <Text style={s.ctaText}>{t("start.cta")}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.skip} onPress={() => dismiss(false)}>
              <Text style={[s.skipText, { color: C.textDim }]}>
                {t("start.skip")}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1.5,
    maxHeight: "88%",
    overflow: "hidden",
  },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 8 },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  stepEmoji: { fontSize: 26, lineHeight: 32 },
  stepTitle: { fontSize: 15, fontWeight: "700" },
  stepDesc: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  cta: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 22,
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  skip: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  skipText: { fontSize: 14, fontWeight: "600" },
});
