// components/ThemeToggle.tsx
// UI komponenta za ručno prebacivanje teme (u Postavkama profila)

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
    getZoneEmoji,
    getZoneLabel,
    ThemeMode,
} from "../hooks/useAdaptiveTheme";
import { useTheme } from "./AdaptiveThemeProvider";

const OPTIONS: { key: ThemeMode; label: string; emoji: string }[] = [
  { key: "light", label: "Svjetla", emoji: "☀️" },
  { key: "auto", label: "Automatski", emoji: "🕐" },
  { key: "dark", label: "Tamna", emoji: "🌙" },
];

export function ThemeToggle() {
  const { manualOverride, setManualOverride, timeZone, hour, minute } =
    useTheme();

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(hour)}:${pad(minute)}`;

  return (
    <View style={s.wrapper}>
      {/* Trenutna zona */}
      <View style={s.zoneRow}>
        <Text style={s.zoneEmoji}>{getZoneEmoji(timeZone)}</Text>
        <View>
          <Text style={s.zoneLabel}>{getZoneLabel(timeZone)}</Text>
          <Text style={s.zoneSub}>{timeStr} · Auto prilagodba</Text>
        </View>
      </View>

      {/* Selector gumbi */}
      <View style={s.selector}>
        {OPTIONS.map((opt) => {
          const active = manualOverride === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[s.option, active && s.optionActive]}
              onPress={() => setManualOverride(opt.key)}
              activeOpacity={0.7}
            >
              <Text style={s.optEmoji}>{opt.emoji}</Text>
              <Text style={[s.optLabel, active && s.optLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Opis zone */}
      <Text style={s.desc}>
        {manualOverride === "auto"
          ? "Tema se automatski prilagođava dobu dana. Možete postaviti ručni override."
          : `Ručni override aktivan. Automatsko prilagođavanje je isključeno.`}
      </Text>
    </View>
  );
}

const GREEN = "#2D6418";

const s = StyleSheet.create({
  wrapper: {
    gap: 14,
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 12,
  },
  zoneEmoji: { fontSize: 28 },
  zoneLabel: { fontSize: 15, fontWeight: "600", color: "#333" },
  zoneSub: { fontSize: 12, color: "#999", marginTop: 2 },
  selector: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  option: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 9,
    gap: 3,
  },
  optionActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  optEmoji: { fontSize: 16 },
  optLabel: { fontSize: 11, color: "#888", fontWeight: "500" },
  optLabelActive: { color: GREEN, fontWeight: "600" },
  desc: { fontSize: 12, color: "#aaa", lineHeight: 17 },
});
