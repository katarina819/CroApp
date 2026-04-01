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
 * Dohvati sve poruke korisnika i grupiraj ih u razgovore.
 */
export const getConversations = async (): Promise<Conversation[]> => {
  const token = await getToken();
  const currentUserId = await getCurrentUserId();
  if (!token || !currentUserId) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE_URL}/api/message/my-messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch messages");

  const messages: Message[] = await res.json();

  // Grupiraj po partneru, zadrži najnoviju poruku po razgovoru
  const convMap = new Map<number, Conversation>();

  for (const msg of messages) {
    const isOwn = msg.senderId === currentUserId;
    const partnerId = isOwn ? msg.receiverId : msg.senderId;
    const partnerRawName = isOwn ? msg.receiverName : msg.senderName;

    const nameParts = (partnerRawName || "").trim().split(/\s+/);
    const firstName = nameParts[0] || `User`;
    const lastName = nameParts.slice(1).join(" ") || `${partnerId}`;

    const existing = convMap.get(partnerId);
    const msgDate = new Date(msg.sentAt).getTime();
    const existingDate = existing ? new Date(existing.timestamp).getTime() : 0;

    if (!existing || msgDate > existingDate) {
      convMap.set(partnerId, {
        userId: partnerId,
        firstName,
        lastName,
        lastMessage: msg.content,
        timestamp: msg.sentAt,
        unreadCount: existing?.unreadCount ?? 0,
      });
    }

    // Broji nepročitane poruke koje su stigle meni
    if (!isOwn && !msg.isRead) {
      const conv = convMap.get(partnerId)!;
      conv.unreadCount = (conv.unreadCount || 0) + 1;
    }
  }

  return Array.from(convMap.values()).sort(
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
