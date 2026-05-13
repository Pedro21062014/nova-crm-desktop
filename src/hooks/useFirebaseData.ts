import { useState, useEffect } from "react";
import {
  getAll,
  subscribe,
  type Product,
  type Client,
  type Order,
  type StoreConfig,
  PATHS,
} from "@/services/firebase";

export function useFirebaseList<T>(path: string) {
  const [data, setData] = useState<Record<string, T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await getAll<T>(path);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time listener
    unsubscribe = subscribe<T>(path, (snapshot) => {
      setData(snapshot);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [path]);

  const items = data
    ? Object.entries(data).map(([id, item]) => ({ id, ...item }))
    : [];

  return { data, items, loading, error };
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
