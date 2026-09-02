import { useState, useEffect, useCallback, useRef } from "react";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { pendingWrites, onPendingWritesChange } from "@/lib/syncTracker";

type OnlineStatus = "online" | "offline" | "syncing";

/** Duração mínima do estado "sincronizando" (evita o banner pisca-pisca quando não há nada na fila). */
const MIN_SYNCING_MS = 1200;

/**
 * Hook que monitora o status de conexão (online/offline) e o progresso REAL
 * da sincronização ao reconectar.
 *
 * - "offline" → sem internet
 * - "syncing" → conexão voltou; escrevas enfileiradas sendo enviadas
 *   (a porcentagem vem do syncTracker: cada ack do servidor avança o progresso)
 * - "online"  → conectado e tudo sincronizado
 */
export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>(
    () => (typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline")
  );
  const [syncPercent, setSyncPercent] = useState(100);

  const isMountedRef = useRef(true);
  // Estado da sincronização em curso: quantas escritas estavam na fila quando
  // a conexão voltou (baseline) e se o Firestore já confirmou que está em dia.
  const syncRef = useRef<{ baseline: number; fsSettled: boolean; startedAt: number } | null>(null);
  const minTimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (minTimeTimerRef.current) {
      clearTimeout(minTimeTimerRef.current);
      minTimeTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const tryFinish = useCallback(() => {
    const s = syncRef.current;
    if (!s || !isMountedRef.current) return;
    const elapsed = Date.now() - s.startedAt >= MIN_SYNCING_MS;
    if (s.fsSettled && pendingWrites() === 0 && elapsed) {
      syncRef.current = null;
      clearTimers();
      setSyncPercent(100);
      setStatus("online");
    }
  }, [clearTimers]);

  // Cada ack de escrita avança a porcentagem (e pode concluir a sincronização)
  useEffect(
    () =>
      onPendingWritesChange((count) => {
        const s = syncRef.current;
        if (!s || !isMountedRef.current) return;

        if (s.baseline <= 0) {
          setSyncPercent(100);
        } else {
          const pct = Math.round((1 - count / s.baseline) * 100);
          // Enquanto ainda houver pendentes, fica no máx. 99% (100% = concluído)
          setSyncPercent(count > 0 ? Math.min(99, Math.max(0, pct)) : 100);
        }
        tryFinish();
      }),
    [tryFinish]
  );

  const goOffline = useCallback(() => {
    clearTimers();
    syncRef.current = null;
    setSyncPercent(100);
    setStatus("offline");
  }, [clearTimers]);

  const goOnline = useCallback(() => {
    clearTimers();

    const baseline = pendingWrites();
    syncRef.current = { baseline, fsSettled: false, startedAt: Date.now() };
    setSyncPercent(baseline > 0 ? 0 : 100);
    setStatus("syncing");

    // Firestore: espera todas as escritas persistidas (persistence offline)
    // serem confirmadas — cobre escritas que não passam pelo syncTracker
    waitForPendingWrites(db)
      .catch((err) => {
        console.warn("[OnlineStatus] waitForPendingWrites falhou, seguindo só o tracker:", err);
      })
      .finally(() => {
        if (!isMountedRef.current) return;
        const s = syncRef.current;
        if (s) {
          syncRef.current = { ...s, fsSettled: true };
          tryFinish();
        }
      });

    // Dispara tryFinish quando o tempo mínimo terminar (caso as escritas
    // recebam ack antes — senão nada mais chamaria o tryFinish)
    minTimeTimerRef.current = setTimeout(tryFinish, MIN_SYNCING_MS + 50);

    // Segurança: se algo travar (ex: sem ack por muito tempo), força o fim
    // da sincronização após 60s
    safetyTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && syncRef.current) {
        syncRef.current = null;
        clearTimers();
        setSyncPercent(100);
        setStatus("online");
      }
    }, 60000);
  }, [tryFinish, clearTimers]);

  useEffect(() => {
    isMountedRef.current = true;

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      clearTimers();
    };
  }, [goOffline, goOnline, clearTimers]);

  const isOffline = status === "offline";
  const isSyncing = status === "syncing";
  const isOnline = status === "online";

  return { status, isOffline, isSyncing, isOnline, syncPercent };
}
