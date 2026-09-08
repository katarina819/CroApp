// components/CloseButton.tsx
//
// Jedinstveni gumb za zatvaranje. Umjesto ikone "X" prikazuje riječ
// "Zatvori" na jeziku koji je korisnik odabrao (hr / en / de / fr / it —
// prijevod je u locales/*.json pod common.close).
//
// Riječ je šira od ikone, pa gumb ima fiksnu minimalnu širinu: naslov u
// zaglavlju modala tako ostaje na istom mjestu bez obzira na to je li
// natpis "Zatvori" ili "Schließen".

import { useTranslation } from "react-i18next";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

interface CloseButtonProps {
  onPress: () => void;
  /** Boja natpisa — uskladi je s temom ekrana na kojem je gumb. */
  color?: string;
  /** "md" za zaglavlja modala, "sm" za trake i manje kartice. */
  size?: "sm" | "md";
  /** Poravnaj natpis desno (kad je gumb zadnji element u retku). */
  align?: "left" | "right";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Za čitače ekrana, ako zadana oznaka nije dovoljno jasna. */
  accessibilityLabel?: string;
}

export default function CloseButton({
  onPress,
  color = "#e8e8e8",
  size = "md",
  align = "left",
  style,
  textStyle,
  accessibilityLabel,
}: CloseButtonProps) {
  const { t } = useTranslation();
  const label = t("common.close");

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
      style={[
        s.base,
        size === "sm" ? s.baseSm : s.baseMd,
        align === "right" && s.alignRight,
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          s.label,
          size === "sm" ? s.labelSm : s.labelMd,
          { color },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  base: {
    justifyContent: "center",
  },
  baseMd: {
    minWidth: 78,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  baseSm: {
    minWidth: 60,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  alignRight: {
    alignItems: "flex-end",
  },
  label: {
    fontWeight: "600",
  },
  labelMd: {
    fontSize: 15,
  },
  labelSm: {
    fontSize: 13,
  },
});
