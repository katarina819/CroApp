import AsyncStorage from "@react-native-async-storage/async-storage";

// Tipovi definirani inline
export interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
}

export interface Conversation {
  userId: string;
  firstName: string;
  lastName: string;
  lastMessage: string;
  timestamp: string;
  avatar?: string;
}

// Konstante za AsyncStorage ključeve
const STORAGE_KEYS = {
  CONVERSATIONS: "conversations",
  MESSAGES_PREFIX: "messages_",
  CURRENT_USER_ID: "currentUserId",
};

// Dohvati trenutnog korisnika (id, ime, prezime)
export const getCurrentUser = async () => {
  const userId = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
  const firstName = await AsyncStorage.getItem("firstName");
  const lastName = await AsyncStorage.getItem("lastName");
  if (!userId) return null;
  return { userId, firstName, lastName };
};

// Dohvati sve razgovore
export const getConversations = async (): Promise<Conversation[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
  return data ? JSON.parse(data) : [];
};

// Spremi cijelu listu razgovora
const saveConversations = async (conversations: Conversation[]) => {
  await AsyncStorage.setItem(
    STORAGE_KEYS.CONVERSATIONS,
    JSON.stringify(conversations),
  );
};

// Dodaj ili ažuriraj jedan razgovor (pošalji novu poruku)
export const updateConversation = async (
  otherUserId: string,
  lastMessage: string,
  timestamp: string,
  firstName?: string,
  lastName?: string,
) => {
  const conversations = await getConversations();
  const index = conversations.findIndex((c) => c.userId === otherUserId);
  if (index !== -1) {
    conversations[index].lastMessage = lastMessage;
    conversations[index].timestamp = timestamp;
  } else {
    // Ako razgovor ne postoji, dodaj novi
    conversations.push({
      userId: otherUserId,
      firstName: firstName || "Korisnik",
      lastName: lastName || "",
      lastMessage,
      timestamp,
    });
  }
  await saveConversations(conversations);
};

// Dohvati poruke za određenog korisnika
export const getMessages = async (otherUserId: string): Promise<Message[]> => {
  const key = STORAGE_KEYS.MESSAGES_PREFIX + otherUserId;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

// Spremi poruke za određenog korisnika
export const saveMessages = async (
  otherUserId: string,
  messages: Message[],
) => {
  const key = STORAGE_KEYS.MESSAGES_PREFIX + otherUserId;
  await AsyncStorage.setItem(key, JSON.stringify(messages));
};

// Dodaj novu poruku
export const sendMessage = async (otherUserId: string, text: string) => {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Nije prijavljen");

  const newMessage: Message = {
    id: Date.now().toString(),
    text,
    senderId: currentUser.userId,
    receiverId: otherUserId,
    createdAt: new Date().toISOString(),
  };

  const messages = await getMessages(otherUserId);
  const updatedMessages = [...messages, newMessage];
  await saveMessages(otherUserId, updatedMessages);

  // Ažuriraj zadnju poruku u razgovoru
  const firstName = currentUser.firstName || "";
  const lastName = currentUser.lastName || "";
  await updateConversation(
    otherUserId,
    text,
    newMessage.createdAt,
    firstName,
    lastName,
  );

  return newMessage;
};

// Inicijaliziraj dummy podatke ako nema nijednog razgovora
export const initializeMockData = async () => {
  const conversations = await getConversations();
  if (conversations && conversations.length > 0) return;

  const dummyUsers = [
    { userId: "user1", firstName: "Marko", lastName: "Marković" },
    { userId: "user2", firstName: "Ana", lastName: "Anić" },
    { userId: "user3", firstName: "Ivan", lastName: "Ivić" },
  ];

  const currentUserId = await AsyncStorage.getItem(
    STORAGE_KEYS.CURRENT_USER_ID,
  );
  if (!currentUserId) return;

  for (const user of dummyUsers) {
    // Inicijaliziraj praznu listu poruka za svakog korisnika
    await saveMessages(user.userId, []);
    // Dodaj konverzaciju koristeći updateConversation
    await updateConversation(
      user.userId,
      "Započnite razgovor",
      new Date().toISOString(),
      user.firstName,
      user.lastName,
    );
  }
};
