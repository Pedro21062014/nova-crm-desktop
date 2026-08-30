import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowUpCircle,
  Loader2,
} from "lucide-react";
import { useAutoUpdate, type UpdateStatus } from "@/hooks/useAutoUpdate";

// ── Status display config ──

const statusConfig: Record<UpdateStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  idle: { label: "", color: "", bgColor: "", borderColor: "" },
  checking: { label: "Verificando atualizações...", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  available: { label: "Atualização disponível!", color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  "not-available": { label: "App atualizado", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200" },
  downloading: { label: "Baixando atualização...", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  downloaded: { label: "Atualização pronta!", color: "text-green-700", bgColor: "bg-green-50", borderColor: "border-green-200" },
  installing: { label: "Instalando atualização...", color: "text-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-200" },
  error: { label: "Erro ao atualizar", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
  dev: { label: "Modo desenvolvimento", color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
  flatpak: { label: "Atualizações pela Flathub", color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
};

// ── Format bytes ──
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ── Format speed ──
function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + "/s";
}

// ── Component ──

export function UpdateBanner() {
  const {
    status,
    currentVersion,
    updateInfo,
    downloadProgress,
    error,
    isElectron,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  } = useAutoUpdate();

  // Don't render if not Electron or status is idle/not-available/dev
  if (!isElectron) return null;
  if (status === "idle" || status === "not-available" || status === "dev" || status === "flatpak") return null;

  const config = statusConfig[status];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden"
      >
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b ${config.bgColor} ${config.borderColor}`}>
          {/* Left: Icon + Message */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Status icon */}
            {status === "checking" && (
              <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${config.color}`} />
            )}
            {status === "available" && (
              <ArrowUpCircle className={`h-4 w-4 shrink-0 ${config.color}`} />
            )}
            {status === "downloading" && (
              <Download className={`h-4 w-4 shrink-0 ${config.color}`} />
            )}
            {status === "downloaded" && (
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${config.color}`} />
            )}
            {status === "installing" && (
              <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${config.color}`} />
            )}
            {status === "error" && (
              <AlertCircle className={`h-4 w-4 shrink-0 ${config.color}`} />
            )}

            {/* Message */}
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs font-semibold ${config.color} whitespace-nowrap`}>
                {config.label}
              </span>

              {/* Version info */}
              {updateInfo && status === "available" && (
                <span className="text-xs text-foreground/60">
                  v{currentVersion} → <span className="font-bold text-amber-700">v{updateInfo.version}</span>
                </span>
              )}

              {updateInfo && status === "downloaded" && (
                <span className="text-xs text-foreground/60">
                  v{updateInfo.version} pronta para instalar
                </span>
              )}

              {/* Download progress */}
              {status === "downloading" && downloadProgress && (
                <div className="flex items-center gap-2 flex-1 max-w-[300px]">
                  <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-500 rounded-full"
                      initial={false}
                      animate={{ width: `${downloadProgress.percent}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">
                    {downloadProgress.percent}%
                  </span>
                  <span className="text-[10px] text-blue-500/60 whitespace-nowrap">
                    {formatSpeed(downloadProgress.bytesPerSecond)}
                  </span>
                </div>
              )}

              {/* Error message */}
              {status === "error" && error && (
                <span className="text-xs text-red-500 truncate">{error}</span>
              )}
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {status === "available" && (
              <motion.button
                onClick={downloadUpdate}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors shadow-xs"
                whileTap={{ scale: 0.97 }}
              >
                <Download className="h-3.5 w-3.5" />
                Baixar
              </motion.button>
            )}

            {status === "downloaded" && (
              <motion.button
                onClick={installUpdate}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors shadow-xs"
                whileTap={{ scale: 0.97 }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reiniciar e Instalar
              </motion.button>
            )}

            {status === "error" && (
              <motion.button
                onClick={checkForUpdates}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 transition-colors"
                whileTap={{ scale: 0.97 }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar Novamente
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
