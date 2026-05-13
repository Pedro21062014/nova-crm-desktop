import { useState, useEffect, useRef, useCallback } from "react";
import {
  getAll,
  subscribe,
  detectDataPath,
  clearPathCache,
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
      // Clean up subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        setLoading(true);
        setError(null);

        // Detect correct path (root-level or user-scoped)
        let resolvedPath: string;
        if (pathDetectedRef.current) {
          // Already detected, reuse the resolved path
          resolvedPath = resolvedPathRef.current;
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

        console.log(`[Firebase] Subscribing to: ${resolvedPath} (user: ${user.uid})`);

        // Set up real-time listener
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
              // If the root path fails with permission denied,
              // try user-scoped path as fallback
              if (
                err.message?.includes("Permission denied") &&
                !resolvedPath.startsWith("users/")
              ) {
                console.log(`[Firebase] Root path denied, trying user-scoped path...`);
                const userPath = `users/${user.uid}/${basePath}`;
                resolvedPathRef.current = userPath;
                pathDetectedRef.current = true;

                // Subscribe to user-scoped path instead
                if (unsubscribeRef.current) {
                  unsubscribeRef.current();
                }
                const fallbackUnsubscribe = subscribe<T>(
                  userPath,
                  (snapshot) => {
                    if (!cancelled) {
                      setData(snapshot);
                      setLoading(false);
                      setError(null);
                    }
                  },
                  (fallbackErr) => {
                    if (!cancelled) {
                      console.error(`[Firebase] Fallback path also failed:`, fallbackErr);
                      setError(`Erro de permissão ao acessar dados`);
                      setLoading(false);
                    }
                  }
                );
                unsubscribeRef.current = fallbackUnsubscribe;
              } else {
                setError(`Erro ao carregar dados: ${err.message}`);
                setLoading(false);
              }
            }
          }
        );

        unsubscribeRef.current = unsubscribe;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error(`[Firebase] Setup error for ${basePath}:`, err);
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

// Clear path cache on logout — re-export for use in auth
export { clearPathCache };
