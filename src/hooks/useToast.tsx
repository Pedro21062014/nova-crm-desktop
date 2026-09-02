import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Sistema de toasts leve (estilo sonner) para feedback de sucesso/erro/info
// nas páginas de Pipeline, Propostas, Tarefas e Automações.
// ─────────────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextToastId = 1;

const TOAST_STYLES: Record<
  ToastType,
  { icon: ReactNode; border: string }
> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />,
    border: "border-success/30",
  },
  error: {
    icon: <AlertCircle className="h-4 w-4 shrink-0 text-danger" />,
    border: "border-danger/30",
  },
  info: {
    icon: <Info className="h-4 w-4 shrink-0 text-accent" />,
    border: "border-border",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextToastId++;
      // Mantém no máximo 4 toasts simultâneos
      setToasts((current) => [...current.slice(-3), { id, type, message }]);
      window.setTimeout(() => dismiss(id), 3800);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const style = TOAST_STYLES[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card px-3.5 py-3 shadow-lg",
                  style.border
                )}
              >
                <span className="mt-0.5">{style.icon}</span>
                <p className="flex-1 text-sm text-foreground">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
