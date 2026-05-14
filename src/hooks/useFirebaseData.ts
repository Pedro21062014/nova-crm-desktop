import { useState, useEffect, useRef, useCallback } from "react";
import {
  getAll,
  subscribe,
  create as firebaseCreate,
  updateItem as firebaseUpdateItem,
  removeItem as firebaseRemoveItem,
  setMerchantId,
  merchantExists,
  type Product,
  type Client,
  type Order,
  type ScheduledMessage,
  COLLECTIONS,
} from "@/services/firebase";
import { useAuth } from "@/hooks/useAuth";
import { toMs } from "@/services/firebase";

export function useFirebaseList<T>(subcollection: string) {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      setError(null);
      setMerchantId(null);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    // Set the merchant ID for Firestore path resolution
    setMerchantId(user.uid);

    let cancelled = false;

    const setup = async () => {
      try {
        setLoading(true);
        setError(null);

        if (cancelled) return;

        // Clean up previous subscription
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        console.log(`[Firestore] Subscribing to: merchants/${user.uid}/${subcollection}`);

        // Set up real-time listener
        const unsubscribe = subscribe<T>(
          subcollection,
          (snapshot) => {
            if (!cancelled) {
              setData(snapshot);
              setLoading(false);
              setError(null);
            }
          },
          (err) => {
            if (!cancelled) {
              console.error(`[Firestore] Subscription error for ${subcollection}:`, err);
              setError(`Erro de permissão ao acessar dados. Verifique as regras do Firestore.`);
              setLoading(false);
            }
          }
        );

        unsubscribeRef.current = unsubscribe;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error(`[Firestore] Setup error for ${subcollection}:`, err);
          setError(err instanceof Error ? err.message : "Erro ao carregar dados");
          setLoading(false);
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [subcollection, user]);

  const items = data
    ? Object.entries(data).map(([id, item]) => ({
        id,
        ...item,
        // Convert Firestore Timestamps to ms for UI compatibility
        createdAt: toMs((item as any).createdAt),
        updatedAt: toMs((item as any).updatedAt),
      }))
    : [];

  // CRUD operations
  const addItem = useCallback(
    async (itemData: Record<string, unknown>) => {
      return firebaseCreate(subcollection, itemData);
    },
    [subcollection]
  );

  const editItem = useCallback(
    async (id: string, itemData: Partial<Record<string, unknown>>) => {
      return firebaseUpdateItem(subcollection, id, itemData);
    },
    [subcollection]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      return firebaseRemoveItem(subcollection, id);
    },
    [subcollection]
  );

  return { data, items, loading, error, addItem, editItem, deleteItem };
}

export function useProducts() {
  return useFirebaseList<Product>(COLLECTIONS.PRODUCTS);
}

export function useClients() {
  return useFirebaseList<Client>(COLLECTIONS.CLIENTS);
}

export function useOrders() {
  return useFirebaseList<Order>(COLLECTIONS.ORDERS);
}

export function useScheduledMessages() {
  return useFirebaseList<ScheduledMessage>(COLLECTIONS.SCHEDULED_MESSAGES);
}
