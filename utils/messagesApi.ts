import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../app/config/api";
import i18n from "../app/config/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  isRead: boolean;
  sentAt: string;
  senderName?: string;
  receiverName?: string;
}

export interface Conversation {
  userId: number;
  firstName: string;
  lastName: string;
  username?: string;
  avatar?: string | null;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getToken = async (): Promise<string | null> =>
  AsyncStorage.getItem("token");

// Poruke sa slikom/videom se šalju kao poseban tekstualni marker + JSON
// (npr. "__CROMAP_IMAGE__{"url":"..."}") koji chat ekran prepoznaje i
// prikazuje kao pravu sliku/video. Popis razgovora prije nije znao za taj
// format pa je korisniku prikazivao sirovi marker i URL umjesto razumljivog
// pregleda poput drugih aplikacija za poruke. Tekst je pune rečenice i
// prevodi se na jezik koji je korisnik odabrao (bez ikona ispred).
function formatLastMessagePreview(content: string, sentByMe: boolean): string {
  if (content?.startsWith("__CROMAP_IMAGE__")) {
    return sentByMe
      ? i18n.t("messages.youSentImage")
      : i18n.t("messages.userSentYouImage");
  }
  if (content?.startsWith("__CROMAP_VIDEO__")) {
    return sentByMe
      ? i18n.t("messages.youSentVideo")
      : i18n.t("messages.userSentYouVideo");
  }
  return content;
}

export const getCurrentUserId = async (): Promise<number | null> => {
  const stored = await AsyncStorage.getItem("userId");
  if (stored && stored !== "0") return parseInt(stored, 10);

  // Fallback: parse from JWT
  const token = await AsyncStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const uid =
      payload[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
      ];
    return uid ? parseInt(uid, 10) : null;
  } catch {
    return null;
  }
};

// ─── API calls ────────────────────────────────────────────────────────────────

/** Avatar iz baze pretvori u nešto što <Image> može prikazati.
 *  Preset avatari ("avatar:male"/"avatar:female") nisu URL-ovi — za njih
 *  vraćamo null pa se prikažu inicijali, kao i dosad. */
const toAvatarUrl = (raw?: string | null): string | null => {
  if (!raw || raw.trim() === "" || raw.startsWith("avatar:")) return null;
  return raw.startsWith("http://") || raw.startsWith("https://")
    ? raw
    : `${API_BASE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

/**
 * Popis razgovora — SAMO korisnici s kojima stvarno postoji razmijenjena
 * poruka.
 *
 * Backend za to sad ima jedan endpoint (/api/message/conversations) koji sve
 * vrati u jednom upitu. Dok ta verzija backenda nije objavljena, koristi se
 * stari način (spoj pratitelja i praćenih), ali sada s filtrom: kontakti bez
 * ijedne poruke se izbacuju, pa se popis ponaša isto u oba slučaja.
 */
export const getConversations = async (): Promise<Conversation[]> => {
  const token = await getToken();
  const userId = await getCurrentUserId();

  if (!token || !userId) throw new Error("Not authenticated");

  try {
    const res = await fetch(`${API_BASE_URL}/api/message/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const rows: any[] = await res.json();
      return rows.map((r) => ({
        userId: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        username: r.username,
        avatar: toAvatarUrl(r.avatar),
        lastMessage: formatLastMessagePreview(
          r.lastMessage ?? "",
          r.lastMessageSenderId === userId,
        ),
        timestamp: r.timestamp,
        unreadCount: r.unreadCount ?? 0,
      }));
    }
  } catch {
    // padamo na stari način ispod
  }

  // ── Stari način (backend bez /conversations) ──────────────────────────────
  // Dohvati sve korisnike koje korisnik prati i koji prate njega
  const [followingRes, followersRes] = await Promise.all([
    fetch(`${API_BASE_URL}/api/follow/following/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${API_BASE_URL}/api/follow/followers/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  const following = followingRes.ok ? await followingRes.json() : [];
  const followers = followersRes.ok ? await followersRes.json() : [];

  // Kombiniraj i ukloni duplikate
  const allUsers = [...following, ...followers];
  const uniqueUsers = Array.from(
    new Map(allUsers.map((u) => [u.id, u])).values(),
  );

  // Za svakog korisnika dohvati zadnju poruku
  const conversations = await Promise.all(
    uniqueUsers.map(async (user) => {
      // Avatar više ne dohvaćamo posebnim zahtjevom po korisniku — popis
      // pratitelja/praćenih ga već vraća (FollowRepository ga spaja iz
      // user_profiles), pa je to bio jedan suvišan zahtjev po kontaktu.
      const avatar = toAvatarUrl(user.avatar);

      // Dohvati zadnju poruku
      const messagesRes = await fetch(
        `${API_BASE_URL}/api/message/conversation/${user.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      let lastMessage = "";
      let timestamp = "";
      let unreadCount = 0;

      if (messagesRes.ok) {
        const messages = await messagesRes.json();
        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          lastMessage = formatLastMessagePreview(
            lastMsg.content,
            lastMsg.senderId === userId,
          );
          timestamp = lastMsg.sentAt;
          unreadCount = messages.filter(
            (m: any) => !m.isRead && m.receiverId === userId,
          ).length;
        }
      }

      return {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        avatar: avatar,
        lastMessage,
        timestamp,
        unreadCount,
      };
    }),
  );

  // Zadrži samo kontakte s kojima STVARNO postoji poruka. Prazan timestamp
  // znači da razgovor nikad nije započet — takvi su se dosad prikazivali u
  // popisu poruka iako nije razmijenjena nijedna poruka.
  return conversations
    .filter((c) => c.timestamp !== "")
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
};

/**
 * Dohvati sve poruke s određenim korisnikom.
 */
export const getConversationMessages = async (
  otherUserId: number,
): Promise<Message[]> => {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(
    `${API_BASE_URL}/api/message/conversation/${otherUserId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error("Failed to fetch conversation");
  return res.json();
};

/**
 * Pošalji poruku korisniku. Vraća i status kod da pozivatelj može
 * razlikovati "previše zahtjeva" (429, privremeno, pokušaj kasnije) od
 * stvarnog neuspjeha — dosad se oboje prikazivalo kao ista generička
 * "poruka nije poslana" greška.
 */
export const sendMessage = async (
  receiverId: number,
  content: string,
): Promise<{ ok: boolean; rateLimited: boolean }> => {
  const token = await getToken();
  if (!token) return { ok: false, rateLimited: false };

  const res = await fetch(`${API_BASE_URL}/api/message/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ receiverId, content }),
  });
  return { ok: res.ok, rateLimited: res.status === 429 };
};

/**
 * Označi poruku kao pročitanu.
 */
export const markAsRead = async (messageId: number): Promise<void> => {
  const token = await getToken();
  if (!token) return;

  await fetch(`${API_BASE_URL}/api/message/read/${messageId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
};

/**
 * Dohvati broj nepročitanih poruka.
 */
export const getUnreadCount = async (): Promise<number> => {
  const token = await getToken();
  if (!token) return 0;

  const res = await fetch(`${API_BASE_URL}/api/message/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.unreadCount ?? 0;
};

/**
 * Dohvati avatar korisnika po ID-u.
 */
export const getUserAvatar = async (userId: number): Promise<string | null> => {
  const token = await getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const userData = await res.json();
      if (userData.avatar) {
        return userData.avatar.startsWith("http")
          ? userData.avatar
          : `${API_BASE_URL}${userData.avatar}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching user avatar:", error);
    return null;
  }
};
