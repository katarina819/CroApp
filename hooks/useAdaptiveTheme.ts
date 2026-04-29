// hooks/useAdaptiveTheme.ts
// Automatsko prilagođavanje teme ovisno o dobu dana
// Dan (06:00–19:59) → svjetla tema | Zalazak (20:00–21:59) → prijelaz | Noć (22:00–05:59) → tamna tema

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Appearance, ColorSchemeName } from "react-native";

// ─── Tipovi ───────────────────────────────────────────────────────────────────
export type TimeZone =
  | "dawn"
  | "morning"
  | "day"
  | "evening"
  | "night"
  | "deep_night";
export type ThemeMode = "light" | "dark" | "auto";

export interface AdaptiveThemeState {
  // Trenutna tema (light/dark)
  colorScheme: "light" | "dark";
  // Zona dana
  timeZone: TimeZone;
  // Preporučena razina svjetline (0.0 – 1.0)
  brightnessLevel: number;
  // Boja overlay filtra i njegova neprozirnost
  overlayColor: string;
  overlayOpacity: number;
  // Sat i minuta
  hour: number;
  minute: number;
  // Ručni override (null = auto)
  manualOverride: ThemeMode;
  // Metode
  setManualOverride: (mode: ThemeMode) => void;
  isAutoMode: boolean;
}

// ─── Konstante zona ───────────────────────────────────────────────────────────
interface ZoneConfig {
  label: string;
  colorScheme: "light" | "dark";
  brightnessLevel: number;
  overlayColor: string;
  overlayOpacity: number;
}

const TIME_ZONES: Record<TimeZone, ZoneConfig> = {
  dawn: {
    // 05:00–06:59 — svitanje, blago toplo
    label: "Svitanje",
    colorScheme: "light",
    brightnessLevel: 0.45,
    overlayColor: "#FF8C42",
    overlayOpacity: 0.18,
  },
  morning: {
    // 07:00–10:59 — jutro, svježe
    label: "Jutro",
    colorScheme: "light",
    brightnessLevel: 0.75,
    overlayColor: "#FFD580",
    overlayOpacity: 0.1,
  },
  day: {
    // 11:00–16:59 — dan, maksimalna svjetlina
    label: "Dan",
    colorScheme: "light",
    brightnessLevel: 1.0,
    overlayColor: "transparent",
    overlayOpacity: 0.0,
  },
  evening: {
    // 17:00–19:59 — večer, toplo narančasto
    label: "Večer",
    colorScheme: "light",
    brightnessLevel: 0.65,
    overlayColor: "#FF6B35",
    overlayOpacity: 0.2,
  },
  night: {
    // 20:00–22:59 — noć, tamna tema
    label: "Noć",
    colorScheme: "dark",
    brightnessLevel: 0.35,
    overlayColor: "#1A0A2E",
    overlayOpacity: 0.3,
  },
  deep_night: {
    // 23:00–04:59 — duboka noć, minimalna svjetlina
    label: "Duboka noć",
    colorScheme: "dark",
    brightnessLevel: 0.18,
    overlayColor: "#0D0320",
    overlayOpacity: 0.45,
  },
};

// ─── Pomoćne funkcije ─────────────────────────────────────────────────────────
function getTimeZone(hour: number): TimeZone {
  if (hour >= 5 && hour <= 6) return "dawn";
  if (hour >= 7 && hour <= 10) return "morning";
  if (hour >= 11 && hour <= 16) return "day";
  if (hour >= 17 && hour <= 19) return "evening";
  if (hour >= 20 && hour <= 22) return "night";
  return "deep_night"; // 23:00–04:59
}

function getCurrentTimeData() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const zone = getTimeZone(hour);
  return { hour, minute, zone, config: TIME_ZONES[zone] };
}

const STORAGE_KEY = "vara_theme_override";

// ─── Glavni hook ──────────────────────────────────────────────────────────────
export function useAdaptiveTheme(): AdaptiveThemeState {
  const [manualOverride, setManualOverrideState] = useState<ThemeMode>("auto");
  const [timeData, setTimeData] = useState(getCurrentTimeData());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Učitaj ručni override iz storage pri inicijalizaciji
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val === "light" || val === "dark" || val === "auto") {
          setManualOverrideState(val as ThemeMode);
        }
      })
      .catch(() => {});
  }, []);

  // Provjera vremena svakih 60 sekundi
  useEffect(() => {
    const tick = () => setTimeData(getCurrentTimeData());
    tick(); // odmah pri montiranju

    intervalRef.current = setInterval(tick, 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Primijeni Appearance promjenu (utječe na React Native dark mode)
  useEffect(() => {
    let targetScheme: ColorSchemeName;
    if (manualOverride === "auto") {
      targetScheme = timeData.config.colorScheme;
    } else if (manualOverride === "dark") {
      targetScheme = "dark";
    } else {
      targetScheme = "light";
    }
    // Postavi sistemski ColorScheme (React Native 0.72+)
    try {
      Appearance.setColorScheme(targetScheme);
    } catch {
      // Starije verzije RN ne podržavaju setColorScheme — tiho ignoriraj
    }
  }, [manualOverride, timeData]);

  const setManualOverride = useCallback(async (mode: ThemeMode) => {
    setManualOverrideState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }, []);

  // Izračunaj konačnu temu
  let colorScheme: "light" | "dark";
  if (manualOverride === "light") colorScheme = "light";
  else if (manualOverride === "dark") colorScheme = "dark";
  else colorScheme = timeData.config.colorScheme;

  return {
    colorScheme,
    timeZone: timeData.zone,
    brightnessLevel: timeData.config.brightnessLevel,
    overlayColor: timeData.config.overlayColor,
    overlayOpacity:
      manualOverride === "auto" ? timeData.config.overlayOpacity : 0,
    hour: timeData.hour,
    minute: timeData.minute,
    manualOverride,
    setManualOverride,
    isAutoMode: manualOverride === "auto",
  };
}

// ─── Pomoćna funkcija za formatiranje ─────────────────────────────────────────
export function getZoneLabel(zone: TimeZone): string {
  return TIME_ZONES[zone].label;
}

export function getZoneEmoji(zone: TimeZone): string {
  const emojis: Record<TimeZone, string> = {
    dawn: "🌅",
    morning: "🌤",
    day: "☀️",
    evening: "🌇",
    night: "🌙",
    deep_night: "🌑",
  };
  return emojis[zone];
}
