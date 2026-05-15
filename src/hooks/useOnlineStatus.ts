import { useState, useEffect, useCallback, useRef } from "react";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "@/lib/firebase";

type OnlineStatus = "online" | "offline" | "syncing";

/**
 * Hook that monitors browser online/offline status and provides
 * a syncing state when coming back online.
 *
 * Uses Firebase's `waitForPendingWrites` to detect when all local
 * changes have been synchronized with the server, instead of a
 * fixed timeout.
 *
 * - "offline" → no internet connection
 * - "syncing" → just came back online, syncing pending writes to Firebase
 * - "online"  → connected and fully synced
 */
export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>(
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline"
  );
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const goOffline = useCallback(() => {
    // Clear any pending sync timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    setStatus("offline");
  }, []);

  const goOnline = useCallback(() => {
    // Show syncing state first
    setStatus("syncing");

    // Use Firebase waitForPendingWrites to detect when sync is complete
    waitForPendingWrites(db)
      .then(() => {
        if (isMountedRef.current) {
          setStatus("online");
        }
      })
      .catch((err) => {
        console.warn("[OnlineStatus] waitForPendingWrites failed, falling back to timeout:", err);
        // Fallback: wait 3 seconds then mark as online
        if (isMountedRef.current) {
          syncTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setStatus("online");
            }
            syncTimeoutRef.current = null;
          }, 3000);
        }
      });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [goOffline, goOnline]);

  const isOffline = status === "offline";
  const isSyncing = status === "syncing";
  const isOnline = status === "online";

  return { status, isOffline, isSyncing, isOnline };
}
