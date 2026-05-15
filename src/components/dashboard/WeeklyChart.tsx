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
function getOrderStatus(o: any): string {
  return o.status || "new";
}

// Check if order is cancelled
function isCancelled(o: any): boolean {
  return getOrderStatus(o) === "cancelled";
}

// Check if order is a platform-managed paid payment
function isPlatformPaid(o: any): boolean {
  const method = o.paymentMethod;
  const paymentId = o.paymentId;
  const paymentStatus = o.paymentStatus;
  const isNativePayment = method === "PIX" || method === "CREDIT_CARD";
  const isPlatformManaged = isNativePayment && paymentId && !String(paymentId).startsWith("static_");
  return isPlatformManaged && paymentStatus === "paid";
}

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

interface WeeklyChartProps {
  orders: Order[];
  dateRange?: DateRange;
}

export function WeeklyChart({ orders, dateRange }: WeeklyChartProps) {
  const start = dateRange?.start || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const end = dateRange?.end || new Date();

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Determine grouping strategy
  // ≤14 days: group by day
  // ≤60 days: group by week
  // >60 days: group by month
  const groupBy: "day" | "week" | "month" = totalDays <= 14 ? "day" : totalDays <= 60 ? "week" : "month";

  const data = buildChartData(orders, start, end, groupBy);

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
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          interval={data.length > 15 ? Math.floor(data.length / 8) : 0}
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
          dataKey="Faturamento"
          fill="var(--color-accent)"
          radius={[6, 6, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="Pago (Pix/Cartao)"
          fill="var(--color-border)"
          radius={[6, 6, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function buildChartData(
  orders: Order[],
  start: Date,
  end: Date,
  groupBy: "day" | "week" | "month"
) {
  if (groupBy === "day") {
    return buildDailyData(orders, start, end);
  } else if (groupBy === "week") {
    return buildWeeklyData(orders, start, end);
  } else {
    return buildMonthlyData(orders, start, end);
  }
}

function buildDailyData(orders: Order[], start: Date, end: Date) {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const result = [];

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
    const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();

    const dayOrders = orders.filter((o) => {
      const ts = toMs(o.createdAt);
      return ts >= dayStart && ts <= dayEnd;
    });

    const faturamento = dayOrders
      .filter((o) => !isCancelled(o))
      .reduce((s, o) => s + (o.total || 0), 0);

    const valorPago = dayOrders
      .filter((o) => isPlatformPaid(o))
      .reduce((s, o) => s + (o.total || 0), 0);

    const name = totalDays <= 7
      ? days[date.getDay()]
      : `${date.getDate()}/${date.getMonth() + 1}`;

    result.push({
      name,
      Faturamento: faturamento,
      "Pago (Pix/Cartao)": valorPago,
    });
  }

  return result;
}

function buildWeeklyData(orders: Order[], start: Date, end: Date) {
  const result = [];
  let currentStart = new Date(start);

  while (currentStart <= end) {
    const weekEnd = new Date(currentStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Clamp to end date
    const actualEnd = weekEnd > end ? end : weekEnd;
    actualEnd.setHours(23, 59, 59, 999);

    const periodStartMs = new Date(currentStart.setHours(0, 0, 0, 0)).getTime();
    const periodEndMs = actualEnd.getTime();

    const weekOrders = orders.filter((o) => {
      const ts = toMs(o.createdAt);
      return ts >= periodStartMs && ts <= periodEndMs;
    });

    const faturamento = weekOrders
      .filter((o) => !isCancelled(o))
      .reduce((s, o) => s + (o.total || 0), 0);

    const valorPago = weekOrders
      .filter((o) => isPlatformPaid(o))
      .reduce((s, o) => s + (o.total || 0), 0);

    const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
    result.push({
      name: `${fmt(currentStart)}-${fmt(actualEnd)}`,
      Faturamento: faturamento,
      "Pago (Pix/Cartao)": valorPago,
    });

    // Move to next week
    currentStart = new Date(actualEnd);
    currentStart.setDate(currentStart.getDate() + 1);
    currentStart.setHours(0, 0, 0, 0);
  }

  return result;
}

function buildMonthlyData(orders: Order[], start: Date, end: Date) {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const result = [];

  let currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);

  while (currentMonth <= end) {
    const monthStart = new Date(Math.max(currentMonth.getTime(), start.getTime()));
    monthStart.setHours(0, 0, 0, 0);

    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const monthEnd = new Date(Math.min(nextMonth.getTime(), end.getTime()));
    monthEnd.setHours(23, 59, 59, 999);

    const periodStartMs = monthStart.getTime();
    const periodEndMs = monthEnd.getTime();

    const monthOrders = orders.filter((o) => {
      const ts = toMs(o.createdAt);
      return ts >= periodStartMs && ts <= periodEndMs;
    });

    const faturamento = monthOrders
      .filter((o) => !isCancelled(o))
      .reduce((s, o) => s + (o.total || 0), 0);

    const valorPago = monthOrders
      .filter((o) => isPlatformPaid(o))
      .reduce((s, o) => s + (o.total || 0), 0);

    result.push({
      name: `${months[currentMonth.getMonth()]}/${String(currentMonth.getFullYear()).slice(2)}`,
      Faturamento: faturamento,
      "Pago (Pix/Cartao)": valorPago,
    });

    // Move to next month
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  }

  return result;
}
