import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../app/config/api";

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

/**
 * Dohvati sve korisnike s kojima imaš razgovor (pratioci i praćeni)
 */
export const getConversations = async (): Promise<Conversation[]> => {
  const token = await getToken();
  const userId = await getCurrentUserId();

  if (!token || !userId) throw new Error("Not authenticated");

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

  // Za svakog korisnika dohvati zadnju poruku i avatar
  const conversations = await Promise.all(
    uniqueUsers.map(async (user) => {
      // Dohvati avatar korisnika
      let avatar = null;
      try {
        const userRes = await fetch(
          `${API_BASE_URL}/api/auth/users/${user.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.avatar) {
            avatar = userData.avatar.startsWith("http")
              ? userData.avatar
              : `${API_BASE_URL}${userData.avatar}`;
          }
        }
      } catch (error) {
        console.error("Error fetching user avatar:", error);
      }

      // Dohvati zadnju poruku
      const messagesRes = await fetch(
        `${API_BASE_URL}/api/message/conversation/${user.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      let lastMessage = "";
      let timestamp = new Date().toISOString();
      let unreadCount = 0;

      if (messagesRes.ok) {
        const messages = await messagesRes.json();
        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          lastMessage = lastMsg.content;
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

  // Sortiraj po zadnjoj poruci (najnovije prvo)
  return conversations.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
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
 * Pošalji poruku korisniku.
 */
export const sendMessage = async (
  receiverId: number,
  content: string,
): Promise<boolean> => {
  const token = await getToken();
  if (!token) return false;

  const res = await fetch(`${API_BASE_URL}/api/message/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ receiverId, content }),
  });
  return res.ok;
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
