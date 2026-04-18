/**
 * VARA App — Design System
 * Forest green + silver metallic palette
 */

import { Platform } from "react-native";

// ─── Core palette ─────────────────────────────────────────────────────────────
export const VaraColors = {
  // Primary greens (from logo background)
  green900: "#0D2406",
  green800: "#142F09",
  green700: "#1B3F0E",
  green600: "#245213",
  green500: "#2D6418", // main brand green
  green400: "#3A7D1F",
  green300: "#4E9E30",
  green200: "#7DC05B",
  green100: "#B8DFA1",
  green50: "#EAF4E2",

  // Silver / metallic (logo V and accents)
  silver900: "#1C2120",
  silver800: "#2E3534",
  silver700: "#424B49",
  silver600: "#5C6765",
  silver500: "#7A8886", // mid silver
  silver400: "#9AA9A7",
  silver300: "#B8C4C2",
  silver200: "#D1DADB",
  silver100: "#E8EEEE",
  silver50: "#F4F7F7",

  // Map / terrain (cream beige for map screens)
  cream: "#F2EDE4",
  creamDark: "#E4DDD3",

  // Semantic
  danger: "#C0392B",
  dangerLight: "#FDECEA",
  success: "#27AE60",
  successLight: "#E8F8EF",
  warning: "#E67E22",
  warningLight: "#FEF3E8",

  // Neutrals
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
};

// ─── Semantic tokens ──────────────────────────────────────────────────────────
export const Colors = {
  light: {
    text: VaraColors.green900,
    textSecondary: VaraColors.silver600,
    textInverse: VaraColors.white,
    background: VaraColors.white,
    backgroundSecondary: VaraColors.silver50,
    backgroundTertiary: VaraColors.cream,
    tint: VaraColors.green500,
    tintDark: VaraColors.green700,
    tintLight: VaraColors.green100,
    border: VaraColors.silver200,
    borderStrong: VaraColors.silver400,
    icon: VaraColors.silver500,
    tabIconDefault: VaraColors.silver400,
    tabIconSelected: VaraColors.green500,
    card: VaraColors.white,
    cardBorder: VaraColors.silver100,
    danger: VaraColors.danger,
    success: VaraColors.success,
  },
  dark: {
    text: VaraColors.silver50,
    textSecondary: VaraColors.silver300,
    textInverse: VaraColors.green900,
    background: VaraColors.green900,
    backgroundSecondary: VaraColors.green800,
    backgroundTertiary: VaraColors.green700,
    tint: VaraColors.green300,
    tintDark: VaraColors.green200,
    tintLight: VaraColors.green700,
    border: VaraColors.green700,
    borderStrong: VaraColors.green600,
    icon: VaraColors.silver400,
    tabIconDefault: VaraColors.silver500,
    tabIconSelected: VaraColors.green300,
    card: VaraColors.green800,
    cardBorder: VaraColors.green700,
    danger: "#E74C3C",
    success: "#2ECC71",
  },
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

// ─── Spacing scale ────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// ─── Border radius ────────────────────────────────────────────────────────────
export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: VaraColors.green900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: VaraColors.green900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: VaraColors.green900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
};

// ─── Button styles ────────────────────────────────────────────────────────────
export const ButtonStyles = {
  primary: {
    backgroundColor: VaraColors.green500,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: "center" as const,
    ...Shadow.md,
  },
  primaryText: {
    color: VaraColors.white,
    fontSize: 16,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
  },
  secondary: {
    backgroundColor: VaraColors.transparent,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: VaraColors.green500,
    paddingVertical: 15,
    alignItems: "center" as const,
  },
  secondaryText: {
    color: VaraColors.green500,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  danger: {
    backgroundColor: VaraColors.danger,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: "center" as const,
  },
  dangerText: {
    color: VaraColors.white,
    fontSize: 16,
    fontWeight: "600" as const,
  },
};

// ─── Input styles ─────────────────────────────────────────────────────────────
export const InputStyles = {
  container: {
    backgroundColor: VaraColors.silver50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: VaraColors.silver200,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: VaraColors.green900,
  },
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: VaraColors.silver600,
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  focusBorder: VaraColors.green500,
};

export default {
  Colors,
  VaraColors,
  Fonts,
  Spacing,
  Radius,
  Shadow,
  ButtonStyles,
  InputStyles,
};
