// components/AdaptiveThemeProvider.tsx
import React, { createContext, useContext, useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import {
  AdaptiveThemeState,
  useAdaptiveTheme,
} from "../hooks/useAdaptiveTheme";

interface ThemeContextType extends AdaptiveThemeState {
  isDark: boolean;
  // Ključne boje koje komponente trebaju koristiti
  colors: {
    background: string;
    backgroundSecondary: string;
    backgroundCard: string;
    text: string;
    textSecondary: string;
    border: string;
    tint: string;
    card: string; // DODAJTE
    primary: string;
  };
}

const AdaptiveThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme(): ThemeContextType {
  const ctx = useContext(AdaptiveThemeContext);
  if (!ctx) throw new Error("useTheme mora biti unutar AdaptiveThemeProvider");
  return ctx;
}

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

const MANUAL_LIGHT_COLORS = {
  background: "#FFFFFF", // čista bijela
  backgroundSecondary: "#FFFFFF", // potpuno bijela
  backgroundCard: "#FFFFFF",
  text: "#000000", // čista crna (maksimalan kontrast)
  textSecondary: "#222222", // još tamnija siva
  border: "#000000", // crni border za oštriji izgled
  tint: "#005500", // vrlo tamna zelena
  card: "#FFFFFF",
  primary: "#005500",
};
const DARK_COLORS = {
  background: "#0a1a0a", // vrlo tamno zelena (gotovo crna)
  backgroundSecondary: "#0e2a0e",
  backgroundCard: "#123812",
  text: "#e0f0e0", // svijetlo zelenkasto bijela
  textSecondary: "#a0c0a0",
  border: "#1e4a1e",
  tint: "#6fbf6f", // svjetlija zelena za akcente
  card: "#123812", // ista kao backgroundCard
  primary: "#6fbf6f", // ista kao tint
};

const LIGHT_COLORS = {
  background: "#F5F7FA", // lagano siva, ne čisto bijela
  backgroundSecondary: "#EEF2F6",
  backgroundCard: "#FFFFFF",
  text: "#2C3E50", // tamno plavo-siva, ne čista crna
  textSecondary: "#7F8C8D",
  border: "#D5D8DC",
  tint: "#2D6418", // vaša originalna zelena
  card: "#FFFFFF",
  primary: "#2D6418",
};

export function AdaptiveThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useAdaptiveTheme();
  const { manualOverride, colorScheme } = theme;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  // Odredi stvarni mod (dark/light) na temelju override-a i auto moda
  let actualIsDark = false;
  let actualColors;

  if (manualOverride === "light") {
    actualIsDark = false;
    actualColors = MANUAL_LIGHT_COLORS;
  } else if (manualOverride === "dark") {
    actualIsDark = true;
    actualColors = DARK_COLORS;
  } else {
    // auto mod – prati doba dana
    actualIsDark = colorScheme === "dark";
    actualColors = actualIsDark ? DARK_COLORS : LIGHT_COLORS;
  }

  // Za animaciju pozadine koristimo boje iz stvarne sheme (ali animacija neće raditi pri ručnom overrideu – može se pojednostaviti)
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: theme.overlayOpacity,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(bgAnim, {
        toValue: actualIsDark ? 1 : 0,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();
  }, [theme.overlayOpacity, actualIsDark]);

  // Za animaciju pozadine koristimo LIGHT_COLORS.background i DARK_COLORS.background (jer MANUAL_LIGHT_COLORS ima istu pozadinu kao LIGHT_COLORS)
  // Ako želite da i pozadina bude dinamička, možete proširiti.
  const animatedBg = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LIGHT_COLORS.background, DARK_COLORS.background],
  });

  const rgb = hexToRgb(theme.overlayColor);
  const overlayStyle = rgb
    ? { backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }
    : { backgroundColor: "transparent" };

  const extendedColors = {
    ...actualColors,
    card: actualColors.backgroundCard,
    primary: actualColors.tint,
  };

  const contextValue: ThemeContextType = {
    ...theme,
    isDark: actualIsDark,
    colors: extendedColors,
  };

  return (
    <AdaptiveThemeContext.Provider value={contextValue}>
      <Animated.View
        style={[styles.container, { backgroundColor: animatedBg }]}
      >
        {children}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            overlayStyle,
            { opacity: opacityAnim, zIndex: 9999 },
          ]}
        />
      </Animated.View>
    </AdaptiveThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
