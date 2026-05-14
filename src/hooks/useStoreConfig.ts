import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribeMerchantRTDB,
  getMerchantDataRTDB,
  updateMerchantDataRTDB,
  setMerchantId,
  getMerchantId,
  type StoreConfig,
} from "@/services/firebase";
import { useAuth } from "@/hooks/useAuth";
import { doc, onSnapshot, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Helper: safely convert any value to a string for form inputs
function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    const parts = [val.street, val.number, val.neighborhood, val.city, val.zip, val.state, val.complement]
      .filter((p: any) => p && typeof p !== "object");
    if (parts.length > 0) return parts.join(", ");
    const allParts = Object.values(val)
      .filter((v: any) => v && (typeof v === "string" || typeof v === "number"))
      .map(String);
    if (allParts.length > 0) return allParts.join(", ");
    return "";
  }
  return String(val);
}

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

        // ── Strategy: Try RTDB first (primary), then Firestore as fallback ──
        // Many merchants have their config in RTDB, not Firestore

        // Step 1: Try RTDB subscription
        console.log(`[useStoreConfig] Trying RTDB subscription for merchant: ${uid}`);

        let gotData = false;

        // Subscribe to RTDB merchant data
        const rtdbUnsubscribe = subscribeMerchantRTDB<StoreConfig>(
          (data) => {
            if (!cancelled) {
              if (data) {
                console.log("[useStoreConfig] Got data from RTDB:", data);
                setConfig(data);
                setLoading(false);
                setError(null);
                gotData = true;
              } else if (!gotData) {
                // RTDB returned null - try Firestore as fallback
                console.log("[useStoreConfig] RTDB returned null, trying Firestore fallback");
                tryFirestoreFallback(uid, cancelled, (firestoreData) => {
                  if (!cancelled) {
                    if (firestoreData) {
                      console.log("[useStoreConfig] Got data from Firestore fallback:", firestoreData);
                      setConfig(firestoreData);
                    }
                    setLoading(false);
                    setError(null);
                  }
                });
              }
            }
          },
          (err) => {
            if (!cancelled) {
              console.warn("[useStoreConfig] RTDB subscription failed, trying Firestore:", err);
              // RTDB failed, try Firestore
              tryFirestoreFallback(uid, cancelled, (firestoreData) => {
                if (!cancelled) {
                  if (firestoreData) {
                    setConfig(firestoreData);
                  }
                  setLoading(false);
                  setError(null);
                }
              });
            }
          }
        );

        unsubscribeRef.current = rtdbUnsubscribe;

        // Set a timeout — if no data received within 3s from RTDB, try Firestore
        setTimeout(() => {
          if (!cancelled && !gotData) {
            console.log("[useStoreConfig] RTDB timeout, trying Firestore fallback");
            tryFirestoreFallback(uid, cancelled, (firestoreData) => {
              if (!cancelled && firestoreData) {
                console.log("[useStoreConfig] Got data from Firestore after RTDB timeout:", firestoreData);
                setConfig(firestoreData);
                setLoading(false);
                setError(null);
              }
            });
          }
        }, 3000);

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

        // Save to both RTDB and Firestore to keep them in sync
        const sanitizedData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          sanitizedData[key] = safeStr(value) === "" && value != null && typeof value === "object"
            ? safeStr(value)
            : value;
        }

        // Try RTDB first
        try {
          await updateMerchantDataRTDB(data);
          console.log("[useStoreConfig] Config saved to RTDB");
        } catch (rtdbErr) {
          console.warn("[useStoreConfig] Failed to save to RTDB, trying Firestore:", rtdbErr);
        }

        // Also save to Firestore
        try {
          const docRef = doc(db, "merchants", uid);
          await setDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now(),
          } as Record<string, unknown>, { merge: true });
          console.log("[useStoreConfig] Config saved to Firestore");
        } catch (fsErr) {
          console.warn("[useStoreConfig] Failed to save to Firestore:", fsErr);
        }

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

// Helper: try to get data from Firestore as fallback
function tryFirestoreFallback(
  uid: string,
  cancelled: boolean,
  callback: (data: StoreConfig | null) => void
) {
  try {
    const docRef = doc(db, "merchants", uid);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!cancelled) {
          if (snapshot.exists()) {
            callback(snapshot.data() as StoreConfig);
          } else {
            callback(null);
          }
        }
      },
      (err) => {
        if (!cancelled) {
          console.warn("[useStoreConfig] Firestore fallback also failed:", err);
          callback(null);
        }
      }
    );
    // Auto-unsubscribe after 5 seconds to avoid lingering listeners
    setTimeout(() => {
      unsubscribe();
    }, 5000);
  } catch (err) {
    console.warn("[useStoreConfig] Firestore fallback error:", err);
    callback(null);
  }
}
