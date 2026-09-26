// components/StateView.tsx
//
// Prazno stanje i stanje greške, na jednom mjestu.
//
// Dosad je aplikacija na pet od sedam ekrana šutjela kad nešto ne uspije:
// 46 praznih `catch {}` i 34 koja samo pišu u konzolu. Za korisnika je
// neuspjeli dohvat izgledao točno kao "ovdje nema ničega" — a kako
// poslužitelj na besplatnom planu zna spavati, prvi dojam o aplikaciji
// znao je biti prazan ekran bez objašnjenja.
//
// Razlika koju ovo uvodi je mala, ali presudna: kad nešto pukne, to se
// kaže i ponudi se "Pokušaj ponovno". Kad doista nema sadržaja, kaže se
// što učiniti da ga bude.

import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { T, TAP_SLOP, V } from "../styles/varaTheme";

type Tone = "error" | "empty";

/**
 * @param tone      "error" nudi ponovni pokušaj; "empty" usmjerava na radnju.
 * @param onRetry   Kad je zadano, prikazuje se gumb za ponovni pokušaj.
 * @param action    Neobavezna radnja za prazno stanje ("Pretraži", "Objavi"…).
 */
export function StateView({
  tone,
  title,
  body,
  icon,
  onRetry,
  retrying,
  action,
  compact,
}: {
  tone: Tone;
  title: string;
  body?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onRetry?: () => void;
  retrying?: boolean;
  action?: { label: string; onPress: () => void };
  /** Za uporabu unutar kartice, gdje nema pune visine ekrana. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const tint = tone === "error" ? V.danger : V.silverDim;
  const defaultIcon: keyof typeof Ionicons.glyphMap =
    tone === "error" ? "cloud-offline-outline" : "sparkles-outline";

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingVertical: compact ? 28 : 56,
        gap: 10,
      }}
      accessibilityRole="summary"
    >
      <Ionicons
        name={icon ?? defaultIcon}
        size={compact ? 34 : 46}
        color={tint}
      />

      <Text
        style={{
          color: V.silverBright,
          fontSize: compact ? 16 : 18,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {title}
      </Text>

      {!!body && (
        <Text
          style={{
            color: V.silverDim,
            fontSize: T.body,
            lineHeight: 21,
            textAlign: "center",
          }}
        >
          {body}
        </Text>
      )}

      {!!onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          disabled={retrying}
          hitSlop={TAP_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t("common.retry")}
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: V.primary,
            borderRadius: V.radiusMd,
            paddingVertical: 11,
            paddingHorizontal: 22,
            opacity: retrying ? 0.6 : 1,
          }}
        >
          {retrying ? (
            <ActivityIndicator size="small" color={V.onPrimary} />
          ) : (
            <Ionicons name="refresh" size={16} color={V.onPrimary} />
          )}
          <Text
            style={{ color: V.onPrimary, fontWeight: "700", fontSize: T.body }}
          >
            {t("common.retry")}
          </Text>
        </TouchableOpacity>
      )}

      {!!action && (
        <TouchableOpacity
          onPress={action.onPress}
          hitSlop={TAP_SLOP}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={{
            marginTop: 8,
            borderRadius: V.radiusMd,
            borderWidth: 1,
            borderColor: V.borderGreen,
            paddingVertical: 10,
            paddingHorizontal: 20,
          }}
        >
          <Text
            style={{ color: V.accentText, fontWeight: "700", fontSize: T.body }}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Kratka traka na vrhu popisa koji već ima sadržaj — greška bez brisanja liste. */
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        margin: 12,
        padding: 12,
        borderRadius: V.radiusSm,
        borderWidth: 1,
        borderColor: V.danger,
        backgroundColor: "rgba(232,136,126,0.12)",
      }}
    >
      <Ionicons name="alert-circle-outline" size={18} color={V.danger} />
      <Text style={{ color: V.silverBright, fontSize: T.meta, flex: 1 }}>
        {message}
      </Text>
      {!!onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          hitSlop={TAP_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t("common.retry")}
        >
          <Text
            style={{ color: V.accentText, fontWeight: "700", fontSize: T.meta }}
          >
            {t("common.retry")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export type StateViewChildren = ReactNode;
