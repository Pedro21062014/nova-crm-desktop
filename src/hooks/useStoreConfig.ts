import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribeMerchant,
  getMerchantData,
  updateMerchantData,
  createWithId,
  merchantExists,
  type StoreConfig,
} from "@/services/firebase";
import { useAuth } from "@/hooks/useAuth";
import { toMs } from "@/services/firebase";

export function useStoreConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      setConfig(null);
      setLoading(false);
      setError(null);
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

        if (cancelled) return;

        // Clean up previous subscription
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        console.log(`[Firestore] Subscribing to merchant doc: ${user.uid}`);

        const unsubscribe = subscribeMerchant<StoreConfig>(
          (data) => {
            if (!cancelled) {
              setConfig(data);
              setLoading(false);
              setError(null);
            }
          },
          (err) => {
            if (!cancelled) {
              console.error(`[Firestore] Merchant subscription error:`, err);
              setError(`Erro ao carregar dados da loja`);
              setLoading(false);
            }
          }
        );

        unsubscribeRef.current = unsubscribe;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error(`[Firestore] Merchant setup error:`, err);
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
  }, [user]);

  const saveConfig = useCallback(
    async (data: Partial<StoreConfig>) => {
      if (!user) throw new Error("Usuário não autenticado");

      const exists = await merchantExists();
      if (exists) {
        await updateMerchantData(data);
      } else {
        // Create merchant document if it doesn't exist
        await createWithId("merchants", user.uid, {
          ...data,
          isSuperuser: false,
          isBlocked: false,
        } as Record<string, unknown>);
      }
    },
    [user]
  );

  return { config, loading, error, saveConfig };
}
