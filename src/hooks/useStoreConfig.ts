import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribeMerchant,
  getMerchantData,
  updateMerchantData,
  createWithId,
  merchantExists,
  setMerchantId,
  getMerchantId,
  type StoreConfig,
} from "@/services/firebase";
import { useAuth } from "@/hooks/useAuth";
import { toMs } from "@/services/firebase";
import { doc, onSnapshot, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

    // Always ensure merchant ID is set from the authenticated user
    setMerchantId(user.uid);

    let cancelled = false;

    const setup = async () => {
      try {
        setLoading(true);
        setError(null);

        if (cancelled) return;

        const uid = user.uid;

        // Clean up previous subscription
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        console.log(`[useStoreConfig] Setting up subscription for merchant: ${uid}`);

        // Use direct Firestore doc subscription to the merchant document
        const docRef = doc(db, "merchants", uid);

        // Set up real-time listener directly
        const unsubscribe = onSnapshot(
          docRef,
          (snapshot) => {
            if (!cancelled) {
              if (snapshot.exists()) {
                const data = snapshot.data() as StoreConfig;
                console.log("[useStoreConfig] Received config:", data);
                setConfig(data);
              } else {
                console.log("[useStoreConfig] No merchant document exists yet");
                setConfig(null);
              }
              setLoading(false);
              setError(null);
            }
          },
          (err) => {
            if (!cancelled) {
              console.error("[useStoreConfig] Subscription error:", err);
              setError("Erro ao carregar dados da loja");
              setLoading(false);
            }
          }
        );

        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        if (!cancelled) {
          console.error("[useStoreConfig] Setup error:", err);
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

      try {
        setError(null);
        const uid = user.uid;

        // Use setDoc with merge directly on the merchant document
        const docRef = doc(db, "merchants", uid);
        await setDoc(docRef, {
          ...data,
          updatedAt: Timestamp.now(),
        } as Record<string, unknown>, { merge: true });

        console.log("[useStoreConfig] Config saved successfully");
      } catch (err: any) {
        console.error("[useStoreConfig] Save error:", err);
        const msg = err.message || "Erro ao salvar configurações";
        setError(msg);
        throw err;
      }
    },
    [user]
  );

  const clearError = useCallback(() => setError(null), []);

  return { config, loading, error, saveConfig, clearError };
}
