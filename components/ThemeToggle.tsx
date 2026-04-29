// components/ThemeToggle.tsx
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
  const {
    manualOverride,
    setManualOverride,
    timeZone,
    hour,
    minute,
    isDark,
    colors,
  } = useTheme();

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(hour)}:${pad(minute)}`;

  return (
    <View style={s.wrapper}>
      {/* Trenutna zona */}
      <View
        style={[
          s.zoneRow,
          {
            backgroundColor: isDark ? "#1C2128" : "#f5f5f5",
            borderColor: isDark ? "#30363D" : "#e0e0e0",
          },
        ]}
      >
        <Text style={s.zoneEmoji}>{getZoneEmoji(timeZone)}</Text>
        <View>
          <Text style={[s.zoneLabel, { color: colors.text }]}>
            {getZoneLabel(timeZone)}
          </Text>
          <Text style={[s.zoneSub, { color: colors.textSecondary }]}>
            {timeStr} · Auto prilagodba
          </Text>
        </View>
      </View>

      {/* Selector gumbi */}
      <View
        style={[
          s.selector,
          { backgroundColor: isDark ? "#161B22" : "#f0f0f0" },
        ]}
      >
        {OPTIONS.map((opt) => {
          const active = manualOverride === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                s.option,
                active && [
                  s.optionActive,
                  { backgroundColor: isDark ? "#0D1117" : "#fff" },
                ],
              ]}
              onPress={() => setManualOverride(opt.key)}
              activeOpacity={0.7}
            >
              <Text style={s.optEmoji}>{opt.emoji}</Text>
              <Text
                style={[
                  s.optLabel,
                  active && { color: colors.tint, fontWeight: "600" },
                  !active && { color: colors.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Opis */}
      <Text style={[s.desc, { color: colors.textSecondary }]}>
        {manualOverride === "auto"
          ? "Tema se automatski prilagođava dobu dana."
          : manualOverride === "dark"
            ? "Tamna tema je aktivna."
            : "Svjetla tema je aktivna."}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { gap: 14 },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  zoneEmoji: { fontSize: 28 },
  zoneLabel: { fontSize: 15, fontWeight: "600" },
  zoneSub: { fontSize: 12, marginTop: 2 },
  selector: {
    flexDirection: "row",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  optEmoji: { fontSize: 16 },
  optLabel: { fontSize: 11, fontWeight: "500" },
  desc: { fontSize: 12, lineHeight: 17 },
});
