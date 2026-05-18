import { useMemo } from "react";
import { useProducts } from "@/hooks/useFirebaseData";
import { useChats } from "@/hooks/useChat";

// ── Types ──

export interface AppNotification {
  id: string;
  type: "low_stock" | "unread_message";
  title: string;
  description: string;
  path: string;          // route to navigate when clicked
  severity: "warning" | "danger" | "info";
  timestamp: number;
  read?: boolean;
}

// ── Stock threshold ──
const LOW_STOCK_THRESHOLD = 5;

// ── Helper: get product stock from various field names ──
function getStock(p: any): number {
  return p.estoque ?? p.stock ?? p.quantity ?? 0;
}

function getName(p: any): string {
  return p.nome || p.name || "Sem nome";
}

// ── Hook ──

export function useNotifications() {
  const { items: products, loading: productsLoading } = useProducts();
  const { conversations, loading: chatsLoading } = useChats();

  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];

    // ── Low stock products ──
    if (products && products.length > 0) {
      for (const product of products) {
        const stock = getStock(product);
        const name = getName(product);

        if (stock === 0) {
          list.push({
            id: `stock-zero-${product.id}`,
            type: "low_stock",
            title: "Produto esgotado",
            description: `"${name}" está sem estoque`,
            path: "/produtos",
            severity: "danger",
            timestamp: product.updatedAt || product.createdAt || Date.now(),
          });
        } else if (stock > 0 && stock <= LOW_STOCK_THRESHOLD) {
          list.push({
            id: `stock-low-${product.id}`,
            type: "low_stock",
            title: "Estoque baixo",
            description: `"${name}" tem apenas ${stock} unidade${stock > 1 ? "s" : ""}`,
            path: "/produtos",
            severity: "warning",
            timestamp: product.updatedAt || product.createdAt || Date.now(),
          });
        }
      }
    }

    // ── Unread chat messages ──
    if (conversations && conversations.length > 0) {
      for (const conv of conversations) {
        const unread = conv.unreadCount || 0;
        if (unread > 0) {
          list.push({
            id: `chat-unread-${conv.id}`,
            type: "unread_message",
            title: "Mensagem não lida",
            description: `${conv.customerName || "Cliente"}: ${conv.lastMessage || "Nova mensagem"} (${unread})`,
            path: "/chat",
            severity: "info",
            timestamp: conv.lastMessageTime || Date.now(),
          });
        }
      }
    }

    // Sort by timestamp descending (newest first)
    list.sort((a, b) => b.timestamp - a.timestamp);

    return list;
  }, [products, conversations]);

  const unreadCount = notifications.length;

  const lowStockCount = notifications.filter(n => n.type === "low_stock").length;
  const unreadMessageCount = notifications.filter(n => n.type === "unread_message").length;

  return {
    notifications,
    unreadCount,
    lowStockCount,
    unreadMessageCount,
    loading: productsLoading || chatsLoading,
  };
}
