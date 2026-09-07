// utils/notificationsApi.ts
//
// Obavijesti o novim objavama korisnika koje pratite, filtrirane po
// kategorijama koje ste sami odabrali.
//
// Postavke se sada čuvaju NA POSLUŽITELJU, ne samo na uređaju: dok su živjele
// isključivo u AsyncStorageu, poslužitelj nije mogao znati koga koja
// kategorija zanima, pa obavijesti nije ni bilo kako slati. AsyncStorage
// ostaje kao brzi lokalni predložak da se ekran postavki odmah iscrta.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../app/config/api";

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  category: string | null;
  videoId: number | null;
  actorUserId: number | null;
  actorName: string;
  actorAvatar: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  appEnabled: boolean;
  emailEnabled: boolean;
  email: string;
  /** Stabilne oznake kategorija ("club", "museum"…), ne prevedeni nazivi. */
  categories: string[];
}

const BASE = `${API_BASE_URL}/api/notification`;

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await AsyncStorage.getItem("token");
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

/** Popis obavijesti. Vraća prazan niz kad korisnik nije prijavljen. */
export async function getNotifications(
  limit = 30,
  offset = 0,
): Promise<AppNotification[]> {
  const headers = await authHeaders();
  if (!headers) return [];
  try {
    const res = await fetch(`${BASE}?limit=${limit}&offset=${offset}`, {
      headers,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Broj nepročitanih — koristi ga značka na zvonu. */
export async function getUnreadCount(): Promise<number> {
  const headers = await authHeaders();
  if (!headers) return 0;
  try {
    const res = await fetch(`${BASE}/unread-count`, { headers });
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data?.count === "number" ? data.count : 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: number): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(`${BASE}/${id}/read`, { method: "POST", headers });
    return res.ok;
  } catch {
    return false;
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(`${BASE}/read-all`, { method: "POST", headers });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteNotification(id: number): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE", headers });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${BASE}/preferences`, { headers });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      appEnabled: !!(d.appEnabled ?? d.AppEnabled),
      emailEnabled: !!(d.emailEnabled ?? d.EmailEnabled),
      email: d.email ?? d.Email ?? "",
      categories: Array.isArray(d.categories ?? d.Categories)
        ? (d.categories ?? d.Categories)
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Spremi postavke na poslužitelj. Vraća false kad nije uspjelo, da ekran može
 * reći korisniku da obavijesti neće stizati — tiho ignoriranje bi značilo da
 * korisnik misli da je sve uključeno, a ništa ne dolazi.
 */
export async function saveNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(`${BASE}/preferences`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        appEnabled: prefs.appEnabled,
        emailEnabled: prefs.emailEnabled,
        email: prefs.email || null,
        categories: prefs.categories,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
