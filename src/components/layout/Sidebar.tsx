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
  Sparkles,
} from "lucide-react";
import logoSvg from "/logo.svg";
import { useAuth } from "@/hooks/useAuth";
import { useStoreConfig } from "@/hooks/useStoreConfig";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Sparkles, label: "Nova IA", path: "/ia" },
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Get the store logo URL from storeConfig (CRM format) or old format
  const storeLogoUrl = config?.logoUrl || config?.logo || "";
  const storeName = config?.storeName || config?.nomeLoja || config?.name || "";

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="flex h-full flex-col border-r border-border bg-sidebar"
    >
      {/* Logo */}
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

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
              <Icon className={cn("relative h-[18px] w-[18px] shrink-0", isActive && "text-white")} />
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
                  className="absolute left-full ml-2 rounded-lg bg-foreground text-background px-2.5 py-1 text-xs font-medium shadow-md z-50"
                >
                  {item.label}
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </nav>

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
