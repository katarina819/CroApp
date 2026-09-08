// utils/avatarUtils.ts
//
// Jedno mjesto na kojem se odlučuje što se prikazuje kao profilna slika.
//
// Prije ovoga je svaki ekran imao svoju kopiju logike i one su se razišle:
// pretraga je avatar dobivala zajedno s popisom korisnika (/api/auth/users)
// pa je uvijek imala točan podatak, dok je feed videa za SVAKI prikaz radio
// zaseban poziv na /api/auth/users/{id}. Taj poziv nije imao ni predmemoriju
// ni ponovni pokušaj, a svaku grešku (401, 429 s rate limitera, spor odgovor)
// je tiho progutao i ostao na inicijalima — isti korisnik je tako u videima
// bio "KZ", a u pretrazi je imao sliku.
//
// Sada backend avatar šalje zajedno s videom/komentarom, a ovaj modul služi
// kao zajednički fallback: pamti dohvaćene avatare po korisniku i spaja
// istovremene zahtjeve za istog korisnika u jedan.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../app/config/api";

const AVATAR_MALE = require("../assets/images/avatar-male.png");
const AVATAR_FEMALE = require("../assets/images/avatar-female.png");

/** Ugrađeni avatari koje korisnik bira umjesto vlastite slike. */
export const PRESET_AVATARS: Record<string, any> = {
  "avatar:male": AVATAR_MALE,
  "avatar:female": AVATAR_FEMALE,
};

export interface AvatarInfo {
  avatar: string | null;
  firstName: string;
  lastName: string;
  username: string;
}

export type AvatarSource =
  | { kind: "preset"; source: any }
  | { kind: "url"; uri: string }
  | { kind: "initials" };

/** Je li vrijednost jedan od ugrađenih avatara (npr. "avatar:male"). */
export function isPresetAvatar(avatar: string | null | undefined): boolean {
  return !!avatar && avatar.startsWith("avatar:");
}

/**
 * Pretvara ono što je spremljeno u bazi u puni URL slike.
 * Vraća null za prazno i za ugrađene avatare (njih se crta iz assetsa).
 */
export function buildAvatarUrl(
  avatar: string | null | undefined,
): string | null {
  if (!avatar || isPresetAvatar(avatar)) return null;
  if (avatar.startsWith("http://") || avatar.startsWith("https://"))
    return avatar;
  return `${API_BASE_URL}${avatar.startsWith("/") ? "" : "/"}${avatar}`;
}

/**
 * Što nacrtati za zadanu vrijednost avatara.
 *
 * Namjerno NE dodaje `?_t=Date.now()`: takav "cache buster" je prisiljavao
 * ponovno preuzimanje slike na svaki render, pa je u listi koja reciklira
 * retke avatar stalno iznova treptao. Kad se avatar doista promijeni,
 * promijeni se i njegov URL (nova datoteka u pohrani).
 */
export function resolveAvatarSource(
  avatar: string | null | undefined,
): AvatarSource {
  if (isPresetAvatar(avatar) && PRESET_AVATARS[avatar as string])
    return { kind: "preset", source: PRESET_AVATARS[avatar as string] };

  const url = buildAvatarUrl(avatar);
  if (url) return { kind: "url", uri: url };

  return { kind: "initials" };
}

/** Inicijali iz imena, prezimena ili korisničkog imena — nikad prazan tekst. */
export function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  username?: string | null,
): string {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";
  const initials = `${first}${last}`.toUpperCase();
  if (initials) return initials;

  const uname = username?.trim();
  if (uname) return uname.slice(0, 2).toUpperCase();

  return "?";
}

// ─── Predmemorija ────────────────────────────────────────────────────────────

const cache = new Map<number, AvatarInfo>();
const inFlight = new Map<number, Promise<AvatarInfo | null>>();

/** Ono što je već dohvaćeno za korisnika, bez ijednog mrežnog poziva. */
export function getCachedAvatarInfo(userId: number): AvatarInfo | undefined {
  return cache.get(userId);
}

/**
 * Upiši u predmemoriju podatak koji je stigao uz neki drugi odgovor
 * (npr. avatar autora koji sada dolazi zajedno s videom), da ga kasniji
 * prikazi ne moraju dohvaćati posebno.
 */
export function primeAvatarCache(
  userId: number | null | undefined,
  info: Partial<AvatarInfo>,
): void {
  if (!userId || userId <= 0) return;

  const existing = cache.get(userId);
  cache.set(userId, {
    avatar:
      info.avatar !== undefined ? info.avatar : (existing?.avatar ?? null),
    firstName: info.firstName || existing?.firstName || "",
    lastName: info.lastName || existing?.lastName || "",
    username: info.username || existing?.username || "",
  });
}

/** Zaboravi zapamćeno za korisnika — npr. nakon što je promijenio sliku. */
export function invalidateAvatarCache(userId?: number | null): void {
  if (userId == null) {
    cache.clear();
    inFlight.clear();
    return;
  }
  cache.delete(userId);
  inFlight.delete(userId);
}

/**
 * Dohvat avatara za korisnika, s predmemorijom i spajanjem istovremenih
 * zahtjeva. Vraća null ako podatak nije dostupan (bez tokena, greška mreže,
 * 429 s rate limitera) — pozivatelj tada prikazuje inicijale.
 */
export async function fetchAvatarInfo(
  userId: number,
): Promise<AvatarInfo | null> {
  if (!userId || userId <= 0) return null;

  const cached = cache.get(userId);
  if (cached) return cached;

  const pending = inFlight.get(userId);
  if (pending) return pending;

  const request = (async (): Promise<AvatarInfo | null> => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return null;

      const res = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;

      const data = await res.json();
      const info: AvatarInfo = {
        avatar:
          data.avatar ??
          data.Avatar ??
          data.avatarUrl ??
          data.profileImage ??
          null,
        firstName: data.firstName ?? data.FirstName ?? "",
        lastName: data.lastName ?? data.LastName ?? "",
        username: data.username ?? data.Username ?? "",
      };

      cache.set(userId, info);
      return info;
    } catch {
      // Neuspjeh se namjerno ne sprema u predmemoriju — sljedeći prikaz
      // smije pokušati ponovno.
      return null;
    } finally {
      inFlight.delete(userId);
    }
  })();

  inFlight.set(userId, request);
  return request;
}
