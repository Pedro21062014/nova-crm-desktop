import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribe as firebaseSubscribe,
  create as firebaseCreate,
  updateItem as firebaseUpdateItem,
  removeItem as firebaseRemoveItem,
  setMerchantId,
  getMerchantId,
  type Product,
  type Client,
  type Order,
  type Coupon,
  type Opportunity,
  type CommercialProposal,
  type CRMTask,
  type CRMAutomation,
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

        // Ensure merchant ID is set before subscribing
        const mid = getMerchantId();
        if (!mid) {
          console.error("[useFirebaseList] No merchant ID available after setting it");
          setError("Erro de autenticação. Tente fazer login novamente.");
          setLoading(false);
          return;
        }

        // Clean up previous subscription
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        console.log(`[Firestore] Subscribing to: merchants/${mid}/${subcollection}`);

        // Set up real-time listener
        const unsubscribe = firebaseSubscribe<T>(
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
              const msg = err.message || "";
              const isPermissionDenied = msg.includes("permission-denied") || msg.includes("Permissão") || msg.includes("Missing or insufficient permissions");
              if (isPermissionDenied) {
                // For optional subcollections (coupons, etc.), permission errors are non-critical
                // Just log a warning and show empty data instead of blocking the whole page
                const isCoreCollection = subcollection === "products" || subcollection === "clients" || subcollection === "orders";
                if (isCoreCollection) {
                  console.error(`[Firestore] Permission denied for core collection ${subcollection}:`, err);
                  setError("Permissão negada. Verifique as regras do Firestore.");
                } else {
                  console.warn(`[Firestore] Permission denied for ${subcollection} - this is expected if the subcollection rules are not set up yet`);
                  setError(null);
                }
                setData(null);
                setLoading(false);
              } else {
                console.error(`[Firestore] Subscription error for ${subcollection}:`, err);
                setError("Erro ao carregar dados. Verifique sua conexão.");
                setLoading(false);
              }
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
    ? Object.entries(data).map(([id, item]) => {
        const createdAtMs = toMs((item as any).createdAt);
        const updatedAtMs = toMs((item as any).updatedAt);
        // Mark as "new" if created within the last hour
        const isNew = createdAtMs > 0 && (Date.now() - createdAtMs) < 3600000;
        return {
          id,
          ...item,
          createdAt: createdAtMs,
          updatedAt: updatedAtMs,
          isNew,
        };
      })
    : [];

  // CRUD operations with better error handling
  const addItem = useCallback(
    async (itemData: Record<string, unknown>) => {
      try {
        setError(null);
        return await firebaseCreate(subcollection, itemData);
      } catch (err: any) {
        const msg = err.message || "Erro ao criar item";
        console.error(`[useFirebaseList] Create error:`, err);
        setError(msg);
        throw err; // Re-throw so caller can handle
      }
    },
    [subcollection]
  );

  const editItem = useCallback(
    async (id: string, itemData: Partial<Record<string, unknown>>) => {
      try {
        setError(null);
        await firebaseUpdateItem(subcollection, id, itemData);
      } catch (err: any) {
        const msg = err.message || "Erro ao atualizar item";
        console.error(`[useFirebaseList] Update error:`, err);
        setError(msg);
        throw err; // Re-throw so caller can handle
      }
    },
    [subcollection]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await firebaseRemoveItem(subcollection, id);
      } catch (err: any) {
        const msg = err.message || "Erro ao excluir item";
        console.error(`[useFirebaseList] Delete error:`, err);
        setError(msg);
        throw err; // Re-throw so caller can handle
      }
    },
    [subcollection]
  );

  const clearError = useCallback(() => setError(null), []);

  return { data, items, loading, error, addItem, editItem, deleteItem, clearError };
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

export function useCoupons() {
  return useFirebaseList<Coupon>(COLLECTIONS.COUPONS);
}

// ── Advanced CRM (mesmas coleções usadas pelo CRM web) ──

export function usePipeline() {
  return useFirebaseList<Opportunity>(COLLECTIONS.PIPELINE);
}

export function useProposals() {
  return useFirebaseList<CommercialProposal>(COLLECTIONS.PROPOSALS);
}

export function useTasks() {
  return useFirebaseList<CRMTask>(COLLECTIONS.TASKS);
}

export function useAutomations() {
  return useFirebaseList<CRMAutomation>(COLLECTIONS.AUTOMATIONS);
}

