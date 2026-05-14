import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribeChats,
  subscribeChatMessages,
  sendChatMessage,
  createChatConversation,
  markChatAsRead,
  type ChatMessage,
  type ChatConversation,
  setMerchantId,
} from "@/services/firebase";
import { useAuth } from "@/hooks/useAuth";

export function useChats() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Record<string, ChatConversation> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      setConversations(null);
      setLoading(false);
      setError(null);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    setMerchantId(user.uid);
    let cancelled = false;

    const unsubscribe = subscribeChats(
      (data) => {
        if (!cancelled) {
          setConversations(data);
          setLoading(false);
          setError(null);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("[useChats] Subscription error:", err);
          setError("Erro ao carregar conversas");
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
  }, [user]);

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

  const markRead = useCallback(async (chatId: string) => {
    try {
      await markChatAsRead(chatId);
    } catch (err: any) {
      console.error("[useChats] Mark read error:", err);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const chatList = conversations
    ? Object.entries(conversations).map(([id, conv]) => ({
        id,
        ...conv,
      }))
    : [];

  return { conversations: chatList, loading, error, createChat, markRead, clearError };
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
            // Sort by timestamp
            msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
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
    async (text: string, senderName: string) => {
      if (!user || !chatId) return;
      try {
        await sendChatMessage(chatId, {
          text,
          senderId: user.uid,
          senderName,
          senderRole: "merchant",
          timestamp: Date.now(),
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
