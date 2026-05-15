import { useState, useEffect, useCallback, useRef } from "react";

type OnlineStatus = "online" | "offline" | "syncing";

/**
 * Hook that monitors browser online/offline status and provides
 * a syncing state when coming back online.
 *
 * - "offline" → no internet connection
 * - "syncing" → just came back online, syncing data
 * - "online"  → connected and synced
 */
export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>(
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline"
  );
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // After 2 seconds, mark as fully online
    syncTimeoutRef.current = setTimeout(() => {
      setStatus("online");
      syncTimeoutRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
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
