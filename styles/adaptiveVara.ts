// styles/adaptiveVara.ts
//
// Paleta koja prati svijetlu/tamnu temu — jedan izvor za oba profila.
//
// Ista je funkcija dosad stajala prepisana u app/(tabs)/profile.tsx i u
// app/profile/[userId].tsx. Kopije su se već razišle: jedna je imala
// visitedLight, overlayLight, cardBg i inputBg, druga nije. Takva razlika
// se ne primijeti dok se ne pogleda isti element na dva ekrana.
//
// Uz to, tamna pozadina je ovdje "#1a2e1a", a u varaTheme.ts "#1A2E15" —
// dvije različite zelene, obje u ulozi glavne pozadine. Razlika je u
// plavom kanalu (0x1A vs 0x15) i vidi se kao blagi odmak u tonu između
// ekrana. Usklađeno je na varaTheme vrijednost, jer je ona u sustavu boja
// i ulazi u izmjerene omjere kontrasta.

import { V } from "./varaTheme";

export function getVara(dark: boolean) {
  return {
    forestDeep: dark ? V.forestDeep : "#F0EDE4",
    forestMid: dark ? "#2A4230" : "#E4EAD8",
    forestLight: dark ? "#3A5A30" : "#CCDCB8",
    borderGreen: dark ? V.borderGreen : "#5A8A40",
    borderDim: dark ? "#3A5A30" : "#C0D0A8",
    silver: dark ? "#C0C0C0" : "#3A4A35",
    silverBright: dark ? "#E8E8E8" : "#1A2A18",
    // Podignut kao i u varaTheme: stara vrijednost nije prolazila na karticama.
    silverDim: dark ? V.silverDim : "#5A6A55",
    accentGold: V.accentGold,

    // Ploha i tekst su odvojeni iz istog razloga kao u varaTheme —
    // jedna boja ne može zadovoljiti obje uloge.
    primary: dark ? V.primary : "#3A6A28",
    onPrimary: dark ? V.onPrimary : "#FFFFFF",
    visited: dark ? V.visited : "#3A6A28",
    visitedLight: dark ? "#3A5A30" : "#CCDCB8",
    accentText: dark ? V.accentText : "#2F5A20",

    danger: dark ? V.danger : "#A33228",
    dangerFill: dark ? V.dangerFill : "#7A2020",

    overlay: dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)",
    overlayLight: dark ? V.overlayLight : "rgba(240,237,228,0.96)",
    cardBg: dark ? "#2A4230" : "#E4EAD8",
    inputBg: dark ? "#2A4230" : "#E4EAD8",

    radiusSm: V.radiusSm,
    radiusMd: V.radiusMd,
    radiusLg: V.radiusLg,
  } as const;
}

export type AdaptiveVara = ReturnType<typeof getVara>;
