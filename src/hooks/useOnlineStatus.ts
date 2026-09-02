import { useState, useEffect, useCallback, useRef } from "react";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { pendingWrites, onPendingWritesChange } from "@/lib/syncTracker";

type OnlineStatus = "online" | "offline" | "syncing";

/** Duração mínima do estado "sincronizando" (evita o banner pisca-pisca quando não há nada na fila). */
const MIN_SYNCING_MS = 1200;
/** Intervalo do ping de conectividade (o que realmente funciona no Electron/Linux). */
const PROBE_INTERVAL_MS = 10000;
/** Timeout de cada ping. */
const PING_TIMEOUT_MS = 5000;
// PING no PRÓPRIO backend do app (RTDB do projeto). Qualquer resposta HTTP
// (200/401/etc.) prova que o backend está alcançável → online. Só ERRO DE
// REDE ou TIMEOUT → offline. (Os eventos online/offline do navegador são
// confiáveis no Electron/LINUX — bug conhecido do Electron, navigator.onLine
// sempre true lá — por isso o ping é a fonte da verdade.)
const PING_URL = "https://crm-e-vendas-default-rtdb.firebaseio.com/.json?shallow=-1";

/**
 * Testa a conectividade com o backend do app.
 * true  → o servidor respondeu (tem internet)
 * false → erro de rede / timeout (sem internet)
 */
async function pingBackend(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    await fetch(`${PING_URL}&t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    // Qualquer resposta HTTP (inclusive 401) = o backend respondeu = online
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook que monitora o status de conexão (online/offline) e o progresso REAL
 * da sincronização ao reconectar.
 *
 * - "offline" → sem internet (detectado por ping no backend ou evento do navegador)
 * - "syncing" → conexão voltou; escritas enfileiradas sendo enviadas
 *   (a porcentagem vem do syncTracker: cada ack do servidor avança o progresso)
 * - "online"  → conectado e tudo sincronizado
 */
export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>(
    () => (typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline")
  );
  const [syncPercent, setSyncPercent] = useState(100);

  const isMountedRef = useRef(true);
  const statusRef = useRef<OnlineStatus>(status);
  const failCountRef = useRef(0); // pings falhos consecutivos (2 p/ confirmar offline)
  // Estado da sincronização em curso: quantas escritas estavam na fila quando
  // a conexão voltou (baseline) e se o Firestore já confirmou que está em dia.
  const syncRef = useRef<{ baseline: number; fsSettled: boolean; startedAt: number } | null>(null);
  const minTimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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

  // ── Ping de conectividade (fonte da verdade no Electron/Linux) ──
  const runProbe = useCallback(async () => {
    const ok = await pingBackend();
    if (!isMountedRef.current) return;
    const cur = statusRef.current;

    if (!ok) {
      failCountRef.current += 1;
      // Exige 2 falhas seguidas p/ não piscar o banner numa oscilação de Wi-Fi;
      // a primeira falha ainda não muda o estado, mas já "armazena" o sinal
      if (failCountRef.current >= 2 && (cur === "online" || cur === "syncing")) {
        console.log("[OnlineStatus] 2 pings falharam → offline");
        goOffline();
      }
    } else {
      failCountRef.current = 0;
      if (cur === "offline") {
        // Backend responde e estávamos offline: reconectar → sync com %
        console.log("[OnlineStatus] Ping ok → reconectando (sync)");
        goOnline();
      }
    }
    // cur === "syncing" e ping ok → nada (a sync conclui sozinha pelo tracker)
  }, [goOffline, goOnline]);

  // Evento do navegador (caminho rápido onde funciona, ex: Windows/macOS)
  const handleBrowserOffline = useCallback(() => {
    goOffline();
  }, [goOffline]);

  const handleBrowserOnline = useCallback(() => {
    // Só volta do offline se o backend de fato responder
    void runProbe();
  }, [runProbe]);

  useEffect(() => {
    isMountedRef.current = true;

    window.addEventListener("offline", handleBrowserOffline);
    window.addEventListener("online", handleBrowserOnline);

    // Ping inicial (pega o app aberto já sem internet) + periódico
    void runProbe();
    const interval = setInterval(() => {
      void runProbe();
    }, PROBE_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("offline", handleBrowserOffline);
      window.removeEventListener("online", handleBrowserOnline);
      clearInterval(interval);
      clearTimers();
    };
  }, [handleBrowserOffline, handleBrowserOnline, runProbe, clearTimers]);

  const isOffline = status === "offline";
  const isSyncing = status === "syncing";
  const isOnline = status === "online";

  return { status, isOffline, isSyncing, isOnline, syncPercent };
}
