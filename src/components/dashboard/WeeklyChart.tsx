import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toMs, type Order } from "@/services/firebase";

// Helpers for field name compatibility
function getOrderType(o: any): "entrada" | "saida" {
  const tipo = o.tipo || o.type;
  if (tipo === "entrada" || tipo === "in") return "entrada";
  if (tipo === "saida" || tipo === "out" || tipo === "expense") return "saida";
  return "entrada";
}

function getOrderStatus(o: any): string {
  return o.status || "pendente";
}

function isPaid(status: string): boolean {
  return status === "pago" || status === "paid" || status === "completed";
}

interface WeeklyChartProps {
  orders: Order[];
}

export function WeeklyChart({ orders }: WeeklyChartProps) {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const now = new Date();

  const data = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
    const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();

    const dayOrders = orders.filter((o) => {
      const ts = toMs(o.createdAt);
      return ts >= dayStart && ts <= dayEnd;
    });

    const entradas = dayOrders
      .filter((o) => getOrderType(o) === "entrada" && isPaid(getOrderStatus(o)))
      .reduce((s, o) => s + (o.total || 0), 0);

    const saidas = dayOrders
      .filter((o) => getOrderType(o) === "saida" && isPaid(getOrderStatus(o)))
      .reduce((s, o) => s + (o.total || 0), 0);

    return {
      name: days[date.getDay()],
      Entradas: entradas,
      Saídas: saidas,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
          tickFormatter={(v) =>
            v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
          }
        />
        <Tooltip
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid var(--color-border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            fontSize: "12px",
          }}
          formatter={(value: unknown) =>
            new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(Number(value))
          }
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
        />
        <Bar
          dataKey="Entradas"
          fill="var(--color-accent)"
          radius={[6, 6, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="Saídas"
          fill="var(--color-border)"
          radius={[6, 6, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
