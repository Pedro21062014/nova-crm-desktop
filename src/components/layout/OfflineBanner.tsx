import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Banner no topo do app (mesma posição do banner de atualização):
 * - OFFLINE (amarelo): avisa que não há internet e que as alterações serão
 *   salvas localmente e sincronizadas automaticamente ao reconectar.
 * - SINCRONIZANDO: mostra o progresso real da sincronização com porcentagem
 *   e barra de progresso (cada escrita confirmada pelo servidor avança a barra).
 */
export function OfflineBanner() {
  const { isOffline, isSyncing, syncPercent } = useOnlineStatus();
  const showBanner = isOffline || isSyncing;
  const percent = Math.max(0, Math.min(100, Math.round(syncPercent)));

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          {isOffline ? (
            <div className="flex flex-col items-center justify-center gap-0.5 bg-warning px-4 py-2 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <WifiOff className="h-4 w-4 shrink-0" />
                <span>Sem conexão com a internet</span>
              </div>
              <p className="text-xs text-white/85">
                Suas alterações serão salvas localmente e sincronizadas automaticamente quando a
                conexão voltar.
              </p>
            </div>
          ) : (
            <div className="bg-accent text-white">
              <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium">
                {percent >= 100 ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                )}
                <span className="min-w-0 truncate">
                  {percent >= 100
                    ? "Sincronização concluída"
                    : "Sincronizando alterações salvas localmente..."}
                </span>
                <span className="ml-auto shrink-0 font-semibold tabular-nums">{percent}%</span>
              </div>
              {percent < 100 && (
                <div className="h-1 w-full bg-white/20">
                  <motion.div
                    className="h-full bg-white"
                    initial={false}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
