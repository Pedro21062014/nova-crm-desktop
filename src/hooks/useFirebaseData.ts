import { useState, useEffect, useRef, useCallback } from "react";
import {
  getAll,
  subscribe,
  detectDataPath,
  resolvePath,
  create as firebaseCreate,
  updateItem as firebaseUpdateItem,
  removeItem as firebaseRemoveItem,
  type Product,
  type Client,
  type Order,
  type StoreConfig,
  PATHS,
} from "@/services/firebase";
import { useAuth } from "@/hooks/useAuth";

export function useFirebaseList<T>(basePath: string) {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedPathRef = useRef<string>(basePath);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pathDetectedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      setError(null);
      pathDetectedRef.current = false;
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        setLoading(true);
        setError(null);

        // Detect correct path (user-scoped or root-level)
        let resolvedPath: string;
        if (pathDetectedRef.current) {
          // Already detected, use cached path with current uid
          resolvedPath = resolvePath(basePath, user.uid);
        } else {
          resolvedPath = await detectDataPath(basePath, user.uid);
          pathDetectedRef.current = true;
        }
        resolvedPathRef.current = resolvedPath;

        if (cancelled) return;

        // Clean up previous subscription
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        // Set up real-time listener (this will also get initial data)
        const unsubscribe = subscribe<T>(
          resolvedPath,
          (snapshot) => {
            if (!cancelled) {
              setData(snapshot);
              setLoading(false);
              setError(null);
            }
          },
          (err) => {
            if (!cancelled) {
              console.error(`[Firebase] Subscription error for ${resolvedPath}:`, err);
              setError(`Erro ao carregar dados: ${err.message}`);
              setLoading(false);
            }
          }
        );

        unsubscribeRef.current = unsubscribe;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
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
  }, [basePath, user]);

  const items = data
    ? Object.entries(data).map(([id, item]) => ({ id, ...item }))
    : [];

  // CRUD operations that use the resolved path
  const path = resolvedPathRef.current;

  const addItem = useCallback(
    async (itemData: Record<string, unknown>) => {
      return firebaseCreate(path, itemData);
    },
    [path]
  );

  const editItem = useCallback(
    async (id: string, itemData: Partial<Record<string, unknown>>) => {
      return firebaseUpdateItem(path, id, itemData);
    },
    [path]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      return firebaseRemoveItem(path, id);
    },
    [path]
  );

  return { data, items, loading, error, path, addItem, editItem, deleteItem };
}

export function useProducts() {
  return useFirebaseList<Product>(PATHS.PRODUCTS);
}

export function useClients() {
  return useFirebaseList<Client>(PATHS.CLIENTS);
}

export function useOrders() {
  return useFirebaseList<Order>(PATHS.ORDERS);
}

export function useStoreConfig() {
  return useFirebaseList<StoreConfig>(PATHS.STORE_CONFIG);
}
