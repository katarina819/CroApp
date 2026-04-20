// components/AdaptiveThemeProvider.tsx
// Omotač koji aplicira overlay boju i pruža kontekst teme cijeloj aplikaciji

import React, { createContext, useContext, useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import {
    AdaptiveThemeState,
    useAdaptiveTheme,
} from "../hooks/useAdaptiveTheme";

// ─── Kontekst ─────────────────────────────────────────────────────────────────
const AdaptiveThemeContext = createContext<AdaptiveThemeState | null>(null);

export function useTheme(): AdaptiveThemeState {
  const ctx = useContext(AdaptiveThemeContext);
  if (!ctx) throw new Error("useTheme mora biti unutar AdaptiveThemeProvider");
  return ctx;
}

// ─── Helper: hex boja → rgba komponente ──────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (hex === "transparent") return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// ─── Provider komponenta ──────────────────────────────────────────────────────
export function AdaptiveThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useAdaptiveTheme();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const prevOverlay = useRef(theme.overlayColor);

  // Animirani prijelaz overlay neprozirnosti (500ms)
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: theme.overlayOpacity,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [theme.overlayOpacity, theme.overlayColor]);

  const rgb = hexToRgb(theme.overlayColor);
  const overlayStyle = rgb
    ? {
        backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      }
    : { backgroundColor: "transparent" };

  return (
    <AdaptiveThemeContext.Provider value={theme}>
      <View style={styles.container}>
        {children}
        {/* Overlay filtar — aplicira toplu/hladnu boju ovisno o dobu dana */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            overlayStyle,
            { opacity: opacityAnim },
          ]}
        />
      </View>
    </AdaptiveThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
