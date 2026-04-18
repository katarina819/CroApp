// components/VaraLogo.tsx
// SVG V-shield logo matching the VARA brand image
import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

interface VaraLogoProps {
  size?: number;
  variant?: "full" | "icon";
}

export default function VaraLogo({
  size = 80,
  variant = "icon",
}: VaraLogoProps) {
  // Shield shape: pointed bottom, rounded top sides
  // The V letterform inside

  const w = size;
  const h = size * 1.15;

  // Shield path (normalized to 100x115)
  // Starts top-left, curves across top, down sides, meets at bottom point
  const scaleX = w / 100;
  const scaleY = h / 115;

  const shield = `
    M 50 5
    C 35 5, 10 12, 10 12
    L 10 55
    C 10 82, 30 100, 50 110
    C 70 100, 90 82, 90 55
    L 90 12
    C 90 12, 65 5, 50 5
    Z
  `;

  // Inner V shape (two angled strokes meeting at bottom)
  // Left arm: top-left down to center-bottom
  // Right arm: top-right down to center-bottom
  const vLeft = `M 30 28 L 50 72 L 70 28`;
  // Small serif/notch at top of V arms
  const vLeftFill = `
    M 29 26
    L 38 26
    L 50 62
    L 62 26
    L 71 26
    L 52 74
    L 50 77
    L 48 74
    Z
  `;

  // Pen nib at the bottom of V (the pointed tip detail)
  const nibPath = `M 48 74 L 50 80 L 52 74 Z`;

  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} viewBox="0 0 100 115">
        <Defs>
          {/* Shield gradient: dark green center to deeper edges */}
          <LinearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#3A7D1F" />
            <Stop offset="100%" stopColor="#1B3F0E" />
          </LinearGradient>
          {/* Shield border gradient: silver metallic */}
          <LinearGradient id="borderGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#D1DADB" />
            <Stop offset="45%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#9AA9A7" />
          </LinearGradient>
          {/* V letter gradient: silver */}
          <LinearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#E8EEEE" />
            <Stop offset="50%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#B8C4C2" />
          </LinearGradient>
        </Defs>

        {/* Shield outer border (silver stroke) */}
        <Path
          d={shield}
          fill="url(#shieldGrad)"
          stroke="url(#borderGrad)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Inner shield bevel / highlight ring */}
        <Path
          d="M 50 10 C 37 10, 16 16, 16 16 L 16 55 C 16 80, 33 96, 50 105 C 67 96, 84 80, 84 55 L 84 16 C 84 16, 63 10, 50 10 Z"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
        />

        {/* V letterform */}
        <Path d={vLeftFill} fill="url(#vGrad)" strokeWidth="0" />

        {/* Pen nib accent */}
        <Path d={nibPath} fill="#9AA9A7" />

        {/* Top highlight reflection on shield */}
        <Path
          d="M 35 12 C 28 13, 18 17, 16 19"
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
