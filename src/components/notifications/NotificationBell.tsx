import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Package,
  MessageSquare,
  X,
  ChevronRight,
} from "lucide-react";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

// ── Severity colors ──

const severityStyles: Record<string, { bg: string; border: string; icon: string; dot: string }> = {
  danger: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-500",
    dot: "bg-red-500",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "text-amber-500",
    dot: "bg-amber-500",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "text-blue-500",
    dot: "bg-blue-500",
  },
};

const typeIcons: Record<string, typeof Package> = {
  low_stock: Package,
  unread_message: MessageSquare,
};

// ── Time formatting ──

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ── Main Component ──

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, lowStockCount, unreadMessageCount, loading } = useNotifications();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleNotificationClick = (notif: AppNotification) => {
    navigate(notif.path);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center h-9 w-9 rounded-xl hover:bg-muted transition-colors"
      >
        <Bell className="h-[18px] w-[18px] text-sidebar-foreground" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold leading-none"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute right-0 top-full mt-2 w-[360px] rounded-2xl bg-card border border-border shadow-lg overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Summary */}
            {unreadCount > 0 && (
              <div className="flex gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                {lowStockCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                    <Package className="h-3 w-3 text-amber-500" />
                    <span className="text-[11px] font-medium text-amber-700">{lowStockCount} estoque baixo</span>
                  </div>
                )}
                {unreadMessageCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200">
                    <MessageSquare className="h-3 w-3 text-blue-500" />
                    <span className="text-[11px] font-medium text-blue-700">{unreadMessageCount} mensagens</span>
                  </div>
                )}
              </div>
            )}

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-5 w-5 border-2 border-muted-foreground/20 border-t-accent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Tudo tranquilo por aqui!</p>
                </div>
              ) : (
                <div className="py-1">
                  {notifications.map((notif) => {
                    const styles = severityStyles[notif.severity] || severityStyles.info;
                    const Icon = typeIcons[notif.type] || Bell;

                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
                      >
                        {/* Icon */}
                        <div className={cn("shrink-0 mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center", styles.bg)}>
                          <Icon className={cn("h-4 w-4", styles.icon)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", styles.dot)} />
                            <p className="text-xs font-semibold text-foreground truncate">{notif.title}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {notif.description}
                          </p>
                        </div>

                        {/* Meta */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground/60">
                            {timeAgo(notif.timestamp)}
                          </span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-accent transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
