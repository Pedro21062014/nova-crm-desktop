import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const { isOffline, isSyncing } = useOnlineStatus();
  const showBanner = isOffline || isSyncing;

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
          {isOffline && (
            <div className="flex items-center justify-center gap-2 bg-warning/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <CloudOff className="h-4 w-4 shrink-0" />
              <span>Você está offline</span>
              <span className="text-white/70">·</span>
              <span className="text-white/80">Tudo salvo localmente</span>
            </div>
          )}
          {isSyncing && (
            <div className="flex items-center justify-center gap-2 bg-accent/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
              <span>Sincronizando...</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
