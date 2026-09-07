import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";

/**
 * Jedinstveni gumb za zatvaranje — riječ "Zatvori" umjesto ikone "×".
 *
 * Ikona × je kratka i na dodir nesigurna (mala meta), a nova korisnica na
 * nekim ekranima nije bila sigurna zatvara li ona prozor ili briše unos —
 * pogotovo jer se ista ikona u aplikaciji koristi i za "očisti polje" i za
 * "odbij zahtjev". Tekst je nedvosmislen i prevodi se na svih pet jezika
 * (ključ common.close), a veći hitSlop čini metu ugodnijom za palac.
 */
export function CloseButton({
  onPress,
  tone = "light",
  style,
}: {
  onPress: () => void;
  /** "light" = svijetli tekst na tamnoj podlozi, "muted" = prigušeni ton. */
  tone?: "light" | "muted" | "onBlack";
  style?: ViewStyle;
}) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      style={style}
    >
      <Text style={[s.text, s[tone]]}>{t("common.close")}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  text: { fontSize: 15, fontWeight: "600", letterSpacing: 0.2 },
  light: { color: "#DCE7D2" },
  muted: { color: "#8A9486" },
  onBlack: { color: "#FFFFFF" },
});
