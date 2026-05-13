import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";
import { toMs, type Order } from "@/services/firebase";

// Helpers for field name compatibility
function oClientName(o: any): string { return o.clienteNome || o.customerName || ""; }
function getOrderStatus(o: any): string { return o.status || "pendente"; }

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" }> = {
  pago: { label: "Pago", variant: "success" },
  paid: { label: "Pago", variant: "success" },
  pendente: { label: "Pendente", variant: "warning" },
  pending: { label: "Pendente", variant: "warning" },
  cancelado: { label: "Cancelado", variant: "danger" },
  cancelled: { label: "Cancelado", variant: "danger" },
  completed: { label: "Concluído", variant: "success" },
};

interface RecentOrdersProps {
  orders: Order[];
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  const navigate = useNavigate();

  const sorted = [...orders]
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
    .slice(0, 6);

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
        const status = statusMap[getOrderStatus(order)] || statusMap.pendente;
        const cname = oClientName(order);
        const ts = toMs(order.createdAt);
        return (
          <div
            key={i}
            onClick={() => navigate("/pedidos")}
            className="flex items-center justify-between rounded-xl p-2.5 hover:bg-muted cursor-pointer transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {cname || "Cliente"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ts ? formatRelativeDate(ts) : "—"}
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
