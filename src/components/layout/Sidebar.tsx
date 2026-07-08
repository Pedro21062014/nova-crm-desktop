import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Tag,
  Settings,
  ChevronLeft,
  LogOut,
  MessageCircle,
  MessageSquare,
  Store,

} from "lucide-react";
import logoSvg from "/logo.svg";
import { useAuth } from "@/hooks/useAuth";
import { useStoreConfig } from "@/hooks/useStoreConfig";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },

  { icon: Package, label: "Produtos", path: "/produtos" },
  { icon: Users, label: "Clientes", path: "/clientes" },
  { icon: ShoppingCart, label: "Pedidos", path: "/pedidos" },
  { icon: Tag, label: "Cupons", path: "/cupons" },
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: MessageCircle, label: "WhatsApp", path: "/whatsapp" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { config } = useStoreConfig();
  const { lowStockCount, unreadMessageCount } = useNotifications();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Get the store logo URL from storeConfig (CRM format) or old format
  const storeLogoUrl = config?.logoUrl || config?.logo || "";
  const storeName = config?.storeName || config?.nomeLoja || config?.name || "";

  // Get badge count for a nav item path
  const getBadge = (path: string): number => {
    if (path === "/produtos" && lowStockCount > 0) return lowStockCount;
    if (path === "/chat" && unreadMessageCount > 0) return unreadMessageCount;
    return 0;
  };

  const getBadgeColor = (path: string): string => {
    if (path === "/produtos") return "bg-amber-500";
    if (path === "/chat") return "bg-blue-500";
    return "bg-danger";
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="flex h-full flex-col border-r border-border bg-sidebar relative"
    >
      {/* Hover hint indicator — appears at the right edge when collapsed,
          gives the user a visual cue that hovering expands the sidebar. */}
      {collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pointer-events-none z-50"
        >
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-r-lg bg-border/60 text-muted-foreground text-[10px] font-medium shadow-sm">
            <ChevronLeft className="h-3 w-3 rotate-180" />
            <span className="whitespace-nowrap">Hover</span>
          </div>
        </motion.div>
      )}

      {/* Logo + Notification Bell */}
      <div className="flex h-16 items-center justify-between px-4">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <img
                src={logoSvg}
                alt="Nova CRM"
                className="h-8 w-8 rounded-lg"
              />
              <span className="text-base font-semibold text-foreground tracking-tight">
                Nova CRM
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <img
            src={logoSvg}
            alt="Nova CRM"
            className="h-8 w-8 mx-auto rounded-lg"
          />
        )}
        {/* Notification bell - only show when not collapsed */}
        {!collapsed && <NotificationBell panelPosition="top" />}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const badge = getBadge(item.path);
          const badgeColor = getBadgeColor(item.path);

          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-sidebar-active-foreground"
                  : "text-sidebar-foreground hover:text-foreground hover:bg-muted"
              )}
              whileTap={{ scale: 0.98 }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-sidebar-active"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <div className="relative">
                <Icon className={cn("relative h-[18px] w-[18px] shrink-0", isActive && "text-white")} />
                {/* Badge on icon */}
                {badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      "absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-[16px] px-0.5 rounded-full text-white text-[9px] font-bold leading-none",
                      badgeColor
                    )}
                  >
                    {badge > 9 ? "9+" : badge}
                  </motion.span>
                )}
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="relative whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip when collapsed */}
              {collapsed && hoveredItem === item.path && (
                <motion.div
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute left-full ml-2 rounded-lg bg-foreground text-background px-2.5 py-1 text-xs font-medium shadow-md z-50 flex items-center gap-1.5"
                >
                  {item.label}
                  {badge > 0 && (
                    <span className={cn("px-1 py-0.5 rounded text-[9px] font-bold text-white", badgeColor)}>
                      {badge}
                    </span>
                  )}
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Collapsed notification bell at bottom */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <NotificationBell panelPosition="bottom" />
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2">
            {/* Profile / Store Logo */}
            <div className="h-9 w-9 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center border border-border">
              {storeLogoUrl ? (
                <img
                  src={storeLogoUrl}
                  alt={storeName || "Logo"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {storeName && (
                <p className="text-xs font-semibold text-foreground truncate">{storeName}</p>
              )}
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
        {collapsed && user && (
          <div className="flex justify-center py-1">
            <div className="h-9 w-9 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center border border-border">
              {storeLogoUrl ? (
                <img
                  src={storeLogoUrl}
                  alt={storeName || "Logo"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <motion.button
            onClick={logout}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium w-full",
              "text-sidebar-foreground hover:text-danger hover:bg-danger-light transition-colors"
            )}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  Sair
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <motion.button
          onClick={onToggle}
          className={cn(
            "flex items-center justify-center rounded-xl py-2 text-sidebar-foreground hover:bg-muted hover:text-foreground w-full transition-colors"
          )}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </motion.button>
      </div>
    </motion.aside>
  );
}
