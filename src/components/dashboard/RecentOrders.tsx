import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";
import type { Order } from "@/services/firebase";

interface RecentOrdersProps {
  orders: Order[];
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  const navigate = useNavigate();

  const sorted = [...orders]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6);

  const statusMap = {
    pago: { label: "Pago", variant: "success" as const },
    pendente: { label: "Pendente", variant: "warning" as const },
    cancelado: { label: "Cancelado", variant: "danger" as const },
  };

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((order, i) => {
        const status = statusMap[order.status] || statusMap.pendente;
        return (
          <div
            key={i}
            onClick={() => navigate("/pedidos")}
            className="flex items-center justify-between rounded-xl p-2.5 hover:bg-muted cursor-pointer transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {order.clienteNome || "Cliente"}
              </p>
              <p className="text-xs text-muted-foreground">
                {order.createdAt ? formatRelativeDate(order.createdAt) : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                {formatCurrency(order.total || 0)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
