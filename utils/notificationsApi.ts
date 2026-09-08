// utils/notificationsApi.ts
//
// Klijent za /api/notification. Postavke obavijesti se i dalje spremaju
// lokalno (da ekran radi i offline), ali izvor istine je poslužitelj — samo
// on može poslati e-mail i samo on zna obavijesti nastale dok je aplikacija
// bila zatvorena.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../app/config/api";

// ─── Tipovi ───────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: number;
  userId: number;
  category: string;
  title: string;
  body?: string | null;
  placeName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scheduledAt?: string | null;
  isRead: boolean;
  /** "user" = korisnikov podsjetnik, "system" = iz aktivnosti u aplikaciji. */
  source: string;
  createdBy?: number | null;
  emailSent: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  appEnabled: boolean;
  emailEnabled: boolean;
  email: string;
  categories: string[];
  ageGroups: string[];
}

export interface CreateNotificationInput {
  title: string;
  body?: string;
  category?: string;
  placeName?: string;
  latitude?: number;
  longitude?: number;
  scheduledAt?: string | null;
  sendEmail?: boolean;
}

export const EMPTY_PREFS: NotificationPrefs = {
  appEnabled: false,
  emailEnabled: false,
  email: "",
  categories: [],
  ageGroups: [],
};

// ─── Pomoćno ──────────────────────────────────────────────────────────────────

const getToken = () => AsyncStorage.getItem("token");

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  if (!token) throw new Error("NO_TOKEN");

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

// ─── Obavijesti ───────────────────────────────────────────────────────────────

export async function getNotifications(
  page = 1,
  pageSize = 30,
): Promise<AppNotification[]> {
  const res = await authedFetch(
    `/api/notification?page=${page}&pageSize=${pageSize}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Broj nepročitanih. Namjerno ne baca grešku — koristi se samo za brojku na
 * ikoni, pa je 0 sasvim prihvatljiv ishod kad poziv ne prođe.
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const res = await authedFetch("/api/notification/unread-count");
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data?.count === "number" ? data.count : 0;
  } catch {
    return 0;
  }
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<AppNotification> {
  const res = await authedFetch("/api/notification", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function markNotificationRead(
  id: number,
  read = true,
): Promise<void> {
  const res = await authedFetch(`/api/notification/${id}/read?read=${read}`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await authedFetch("/api/notification/read-all", {
    method: "PUT",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function deleteNotification(id: number): Promise<void> {
  const res = await authedFetch(`/api/notification/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function deleteAllNotifications(): Promise<void> {
  const res = await authedFetch("/api/notification", { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ─── Postavke ─────────────────────────────────────────────────────────────────

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const res = await authedFetch("/api/notification/preferences");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  return {
    appEnabled: !!data?.appEnabled,
    emailEnabled: !!data?.emailEnabled,
    email: data?.email ?? "",
    categories: Array.isArray(data?.categories) ? data.categories : [],
    ageGroups: Array.isArray(data?.ageGroups) ? data.ageGroups : [],
  };
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<void> {
  const res = await authedFetch("/api/notification/preferences", {
    method: "PUT",
    body: JSON.stringify({
      appEnabled: prefs.appEnabled,
      emailEnabled: prefs.emailEnabled,
      // Prazan string znači "koristi e-mail s računa" — poslužitelj ga
      // pretvara u null.
      email: prefs.email?.trim() ? prefs.email.trim() : null,
      categories: prefs.categories,
      ageGroups: prefs.ageGroups,
    }),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {}
    throw new Error(message);
  }
}
