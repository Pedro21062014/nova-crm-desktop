import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribeChatsFirestore,
  subscribeChatsRTDB,
  subscribeChatMessages,
  sendChatMessage,
  createChatConversation,
  markChatAsRead,
  deleteChatConversation,
  type ChatMessage,
  type ChatConversation,
  setMerchantId,
} from "@/services/firebase";
import { useAuth } from "@/hooks/useAuth";
import type { Unsubscribe as FirestoreUnsubscribe } from "firebase/firestore";

export function useChats() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fsUnsubscribeRef = useRef<FirestoreUnsubscribe | null>(null);
  const rtdbUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      setError(null);
      if (fsUnsubscribeRef.current) {
        fsUnsubscribeRef.current();
        fsUnsubscribeRef.current = null;
      }
      if (rtdbUnsubscribeRef.current) {
        rtdbUnsubscribeRef.current();
        rtdbUnsubscribeRef.current = null;
      }
      return;
    }

    setMerchantId(user.uid);
    let cancelled = false;
    let gotFirestoreData = false;

    // Strategy: Try Firestore first (where CRM stores chats).
    // If Firestore returns data, use it. If it fails or returns empty,
    // fall back to RTDB (where nova-crm may have stored chats).

    // 1) Subscribe to Firestore chats (primary)
    console.log("[useChats] Subscribing to Firestore chats for", user.uid);
    const fsUnsubscribe = subscribeChatsFirestore(
      (chatList) => {
        if (!cancelled) {
          console.log("[useChats] Got Firestore chats:", chatList.length);
          gotFirestoreData = true;
          if (chatList.length > 0) {
            setConversations(chatList);
            setLoading(false);
            setError(null);
            // If Firestore has data, no need for RTDB subscription
            if (rtdbUnsubscribeRef.current) {
              rtdbUnsubscribeRef.current();
              rtdbUnsubscribeRef.current = null;
            }
          } else {
            // Firestore returned empty - try RTDB fallback
            setConversations([]);
            setLoading(false);
            if (!rtdbUnsubscribeRef.current) {
              setupRTDBFallback(cancelled);
            }
          }
        }
      },
      (err) => {
        if (!cancelled) {
          console.warn("[useChats] Firestore subscription failed, trying RTDB:", err);
          // Firestore failed, try RTDB
          if (!rtdbUnsubscribeRef.current) {
            setupRTDBFallback(cancelled);
          }
        }
      }
    );

    fsUnsubscribeRef.current = fsUnsubscribe;

    // Timeout: if no Firestore data after 3s, try RTDB
    setTimeout(() => {
      if (!cancelled && !gotFirestoreData && !rtdbUnsubscribeRef.current) {
        console.log("[useChats] Firestore timeout, trying RTDB fallback");
        setupRTDBFallback(cancelled);
      }
    }, 3000);

    return () => {
      cancelled = true;
      if (fsUnsubscribeRef.current) {
        fsUnsubscribeRef.current();
        fsUnsubscribeRef.current = null;
      }
      if (rtdbUnsubscribeRef.current) {
        rtdbUnsubscribeRef.current();
        rtdbUnsubscribeRef.current = null;
      }
    };
  }, [user]);

  // RTDB fallback subscription
  function setupRTDBFallback(cancelled: boolean) {
    console.log("[useChats] Setting up RTDB fallback");
    const rtdbUnsubscribe = subscribeChatsRTDB(
      (data) => {
        if (!cancelled) {
          if (data) {
            const chatList = Object.entries(data).map(([id, conv]) => ({
              id,
              ...conv,
            }));
            console.log("[useChats] Got RTDB chats:", chatList.length);
            // Only use RTDB data if Firestore hasn't provided any
            setConversations((prev) => prev.length === 0 ? chatList : prev);
          }
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("[useChats] RTDB fallback also failed:", err);
          setError("Erro ao carregar conversas");
          setLoading(false);
        }
      }
    );
    rtdbUnsubscribeRef.current = rtdbUnsubscribe;
  }

  const createChat = useCallback(async (conversation: Omit<ChatConversation, "id">) => {
    try {
      setError(null);
      return await createChatConversation(conversation);
    } catch (err: any) {
      console.error("[useChats] Create error:", err);
      setError(err.message || "Erro ao criar conversa");
      throw err;
    }
  }, []);

  const deleteChat = useCallback(async (chatId: string) => {
    try {
      await deleteChatConversation(chatId);
    } catch (err: any) {
      console.error("[useChats] Delete error:", err);
      setError(err.message || "Erro ao excluir conversa");
    }
  }, []);

  const markRead = useCallback(async (chatId: string) => {
    try {
      await markChatAsRead(chatId);
    } catch (err: any) {
      console.error("[useChats] Mark read error:", err);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { conversations, loading, error, createChat, deleteChat, markRead, clearError };
}

export function useChatMessages(chatId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user || !chatId) {
      setMessages([]);
      setLoading(false);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    setMerchantId(user.uid);
    let cancelled = false;

    const unsubscribe = subscribeChatMessages(
      chatId,
      (data) => {
        if (!cancelled) {
          if (data) {
            const msgs = Object.entries(data).map(([id, msg]) => ({
              id,
              ...msg,
            }));
            // Sort by timestamp or createdAt
            msgs.sort((a, b) => {
              const timeA = getMsgTime(a);
              const timeB = getMsgTime(b);
              return timeA - timeB;
            });
            setMessages(msgs);
          } else {
            setMessages([]);
          }
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("[useChatMessages] Subscription error:", err);
          setLoading(false);
        }
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, chatId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !chatId) return;
      try {
        await sendChatMessage(chatId, {
          text,
          sender: "merchant",
        });
      } catch (err: any) {
        console.error("[useChatMessages] Send error:", err);
        throw err;
      }
    },
    [user, chatId]
  );

  return { messages, loading, sendMessage };
}

/**
 * Extract a numeric timestamp from a message, handling both CRM and nova-crm formats.
 * CRM messages use `createdAt` (RTDB serverTimestamp = number of ms since epoch)
 * nova-crm messages use `timestamp` (ms since epoch)
 */
export function getMsgTime(msg: ChatMessage): number {
  // Try timestamp first (nova-crm format)
  if (msg.timestamp && typeof msg.timestamp === "number") return msg.timestamp;
  // Try createdAt (CRM format — RTDB serverTimestamp returns ms)
  if (msg.createdAt) {
    if (typeof msg.createdAt === "number") return msg.createdAt;
    // Firestore Timestamp-like object
    if (typeof msg.createdAt === "object" && msg.createdAt.seconds !== undefined) {
      return msg.createdAt.seconds * 1000 + (msg.createdAt.nanoseconds || 0) / 1000000;
    }
  }
  return 0;
}

/**
 * Determine if a message is from the merchant or customer.
 * Handles both CRM format (`sender: 'merchant' | 'customer'`) and
 * nova-crm format (`senderRole: 'merchant' | 'customer'`).
 */
export function isMerchantMessage(msg: ChatMessage): boolean {
  if (msg.sender === "merchant") return true;
  if (msg.sender === "customer") return false;
  if (msg.senderRole === "merchant") return true;
  if (msg.senderRole === "customer") return false;
  // Fallback: if senderId matches current user, it's merchant
  return false;
}
