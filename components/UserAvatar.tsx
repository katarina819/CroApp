// components/UserAvatar.tsx
// Reusable avatar: slika → muški avatar → ženski avatar → inicijali
//
// Sva logika odabira (ugrađeni avatar, URL, inicijali) i dohvat s
// predmemorijom su u utils/avatarUtils — ovdje je samo prikaz. Bez toga se
// isti korisnik znao razlikovati od ekrana do ekrana.
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import {
  AvatarInfo,
  fetchAvatarInfo,
  getCachedAvatarInfo,
  getInitials,
  primeAvatarCache,
  resolveAvatarSource,
} from "../utils/avatarUtils";

interface UserAvatarProps {
  userId?: number;
  avatar?: string | null;
  firstName?: string;
  lastName?: string;
  username?: string;
  size?: number;
  backgroundColor?: string;
  style?: object;
}

export default function UserAvatar({
  userId,
  avatar: propAvatar,
  firstName = "",
  lastName = "",
  username = "",
  size = 40,
  backgroundColor = "#2D6418",
  style,
}: UserAvatarProps) {
  // Avatar predan kroz prop uvijek ima prednost — pozivatelj ga je već
  // dobio uz svoje podatke, pa nema razloga za mrežni poziv.
  const hasInlineAvatar =
    propAvatar !== undefined && propAvatar !== null && propAvatar !== "";

  const [fetched, setFetched] = useState<AvatarInfo | null>(() =>
    hasInlineAvatar || !userId ? null : (getCachedAvatarInfo(userId) ?? null),
  );
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setFailed(false);
  }, [userId, propAvatar]);

  useEffect(() => {
    if (hasInlineAvatar) {
      primeAvatarCache(userId, {
        avatar: propAvatar,
        firstName,
        lastName,
        username,
      });
      return;
    }

    if (!userId) {
      setFetched(null);
      return;
    }

    const cached = getCachedAvatarInfo(userId);
    if (cached) {
      setFetched(cached);
      return;
    }

    fetchAvatarInfo(userId).then((info) => {
      if (info && mountedRef.current) setFetched(info);
    });
  }, [userId, propAvatar, firstName, lastName, username, hasInlineAvatar]);

  const effectiveAvatar = hasInlineAvatar
    ? propAvatar
    : (fetched?.avatar ?? null);
  const resolved = resolveAvatarSource(effectiveAvatar);
  const radius = size / 2;

  if (resolved.kind === "preset") {
    return (
      <Image
        source={resolved.source}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
        resizeMode="cover"
      />
    );
  }

  if (resolved.kind === "url" && !failed) {
    return (
      <Image
        source={{ uri: resolved.uri }}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }

  const initials = getInitials(
    firstName || fetched?.firstName,
    lastName || fetched?.lastName,
    username || fetched?.username,
  );
  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: radius, backgroundColor },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  initials: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
});
