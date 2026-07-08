import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
  CreditCard,
  Package,
  Calendar,
  ChevronDown,
  X,
  CheckCircle2,
  Store,
  ExternalLink,
} from "lucide-react";
import { Card, Skeleton } from "@/components/ui";
import { useOrders, useClients, useProducts } from "@/hooks/useFirebaseData";
import { useStoreConfig } from "@/hooks/useStoreConfig";
import { formatCurrency } from "@/lib/utils";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";

// ── Field compatibility helpers (CRM vs old nova-crm) ──

function getOrderStatus(o: any): string {
  return o.status || "new";
}

function getOrderCustomerName(o: any): string {
  return o.customerName || o.clienteNome || "Cliente";
}

// Check if order is cancelled
function isCancelled(o: any): boolean {
  const status = getOrderStatus(o);
  return status === "cancelled";
}

// Check if order is a platform-managed paid payment (PIX/Credit Card with real paymentId)
function isPlatformPaid(o: any): boolean {
  const method = o.paymentMethod;
  const paymentId = o.paymentId;
  const paymentStatus = o.paymentStatus;

  const isNativePayment = method === "PIX" || method === "CREDIT_CARD";
  const isPlatformManaged = isNativePayment && paymentId && !String(paymentId).startsWith("static_");

  return isPlatformManaged && paymentStatus === "paid";
}

// Check if order is pending (new or pending_payment)
function isPending(o: any): boolean {
  const status = getOrderStatus(o);
  return status === "new" || status === "pending_payment" || status === "pending" || status === "pendente";
}

// ── Date range types ──

type PresetRange = "7d" | "30d" | "60d" | "custom";

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

const presetOptions: { key: PresetRange; label: string; days: number }[] = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "1 mês", days: 30 },
  { key: "60d", label: "2 meses", days: 60 },
  { key: "custom", label: "Personalizado", days: 0 },
];

function getDateRange(preset: PresetRange, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  if (preset === "custom" && customStart && customEnd) {
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    return {
      start,
      end,
      label: `${start.toLocaleDateString("pt-BR")} - ${end.toLocaleDateString("pt-BR")}`,
    };
  }

  const match = presetOptions.find(p => p.key === preset) || presetOptions[0];
  const days = match.days || 7;
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return {
    start,
    end: now,
    label: match.label,
  };
}

// ── Animation Variants ──

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
};

// ── Main Component ──

export function DashboardPage() {
  const { items: orders, loading: ordersLoading } = useOrders();
  const { items: clients, loading: clientsLoading } = useClients();
  const { items: products, loading: productsLoading } = useProducts();
  const { config: storeConfig } = useStoreConfig();

  // Time filter state
  const [activePreset, setActivePreset] = useState<PresetRange>("7d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const dateRange = useMemo(
    () => getDateRange(activePreset, customStart, customEnd),
    [activePreset, customStart, customEnd]
  );

  // Filtered orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter((o: any) => {
      const ts = o.createdAt;
      if (!ts) return false;
      const date = new Date(typeof ts === "number" ? ts : ts);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [orders, dateRange]);

  // Revenue calculations matching CRM DashboardHome.tsx logic
  const { totalRevenue, totalPaid, totalOrders, pendingOrders, periodComparison } = useMemo(() => {
    let revenue = 0;
    let paid = 0;
    let orderCount = 0;
    let pending = 0;

    filteredOrders.forEach((o: any) => {
      const orderTotal = Number(o.total || 0);

      if (!isCancelled(o) && !isNaN(orderTotal)) {
        orderCount++;
        revenue += orderTotal;

        if (isPlatformPaid(o)) {
          paid += orderTotal;
        }
      }

      if (isPending(o)) {
        pending++;
      }
    });

    // Comparison with previous period
    const periodDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const prevEnd = new Date(dateRange.start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (periodDays - 1));
    prevStart.setHours(0, 0, 0, 0);

    let prevRevenue = 0;
    let prevOrderCount = 0;

    orders.forEach((o: any) => {
      const ts = o.createdAt;
      if (!ts) return;
      const date = new Date(typeof ts === "number" ? ts : ts);
      if (date >= prevStart && date <= prevEnd) {
        const orderTotal = Number(o.total || 0);
        if (!isCancelled(o) && !isNaN(orderTotal)) {
          prevOrderCount++;
          prevRevenue += orderTotal;
        }
      }
    });

    const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : revenue > 0 ? 100 : 0;
    const ordersChange = prevOrderCount > 0 ? ((orderCount - prevOrderCount) / prevOrderCount) * 100 : orderCount > 0 ? 100 : 0;

    return {
      totalRevenue: revenue,
      totalPaid: paid,
      totalOrders: orderCount,
      pendingOrders: pending,
      periodComparison: { revenueChange, ordersChange, prevRevenue, prevOrderCount },
    };
  }, [filteredOrders, orders, dateRange]);

  const totalClients = clients.length;
  const totalProducts = products.length;

  // Store name: prefer CRM storeConfig.storeName, then old fields
  const storeName = storeConfig?.storeName || storeConfig?.nomeLoja || storeConfig?.name || "Nova CRM";

  const formatChange = (change: number) => {
    if (change === 0) return { text: "Sem alteração", positive: true };
    const sign = change > 0 ? "+" : "";
    return { text: `${sign}${change.toFixed(1)}%`, positive: change >= 0 };
  };

  const revenueChange = formatChange(periodComparison.revenueChange);
  const ordersChange = formatChange(periodComparison.ordersChange);

  const stats = [
    {
      label: "Faturamento",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      color: "text-success",
      bg: "bg-success-light",
      change: revenueChange,
    },
    {
      label: "Valor Pago (Pix/Cartão)",
      value: formatCurrency(totalPaid),
      icon: CreditCard,
      color: "text-blue-500",
      bg: "bg-blue-50",
      change: null,
    },
    {
      label: "Vendas",
      value: String(totalOrders),
      icon: ShoppingCart,
      color: "text-accent",
      bg: "bg-accent-light",
      change: ordersChange,
    },
    {
      label: "Pedidos Pendentes",
      value: String(pendingOrders),
      icon: Package,
      color: "text-warning",
      bg: "bg-warning-light",
      change: null,
    },
  ];

  const isLoading = ordersLoading || clientsLoading || productsLoading;

  // Helper to format date for input[type=date]
  const toInputDate = (d: Date) => d.toISOString().split("T")[0];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-8 space-y-8"
    >
      {/* Page Header + Time Filter */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão geral de {storeName}
          </p>
        </div>

        {/* Right-side actions: Ver Loja + Time Filter */}
        <div className="flex items-center gap-3">
          {/* Ver Loja — abre o marketplace no navegador padrão */}
          <button
            onClick={() => {
              const url = "https://marketplace.novacrm.com.br";
              if (typeof window !== "undefined" && window.electronAPI?.openExternal) {
                window.electronAPI.openExternal(url).catch((err) => {
                  console.error("Failed to open store URL:", err);
                  window.open(url, "_blank", "noopener,noreferrer");
                });
              } else {
                window.open(url, "_blank", "noopener,noreferrer");
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold shadow-sm hover:bg-accent/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            title="Ver sua loja no marketplace"
          >
            <Store className="h-4 w-4" />
            Ver Loja
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </button>

          {/* Time Filter */}
          <div className="flex bg-muted p-1 rounded-xl gap-0.5">
            {presetOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => {
                  if (opt.key === "custom") {
                    setShowDatePicker(true);
                    // Set default custom dates if not set
                    if (!customStart) {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 29);
                      setCustomStart(toInputDate(start));
                      setCustomEnd(toInputDate(end));
                    }
                  } else {
                    setShowDatePicker(false);
                  }
                  setActivePreset(opt.key);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activePreset === opt.key
                    ? "bg-card text-accent shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Custom Date Picker */}
      <AnimatePresence>
        {showDatePicker && activePreset === "custom" && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium text-foreground">Período:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="h-9 px-3 border border-border rounded-lg bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  />
                  <span className="text-muted-foreground text-sm">até</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="h-9 px-3 border border-border rounded-lg bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  />
                </div>
                {customStart && customEnd && (
                  <span className="text-xs text-muted-foreground">
                    {Math.ceil((new Date(customEnd).getTime() - new Date(customStart).getTime()) / (1000 * 60 * 60 * 24)) + 1} dias
                  </span>
                )}
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Period Info */}
      <motion.div variants={itemVariants} className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">
            {dateRange.start.toLocaleDateString("pt-BR")} - {dateRange.end.toLocaleDateString("pt-BR")}
          </span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-5">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-32">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              </Card>
            ))
          : stats.map((stat) => (
              <Card key={stat.label} hover>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-semibold tracking-tight">
                      {stat.value}
                    </p>
                    {stat.change && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${stat.change.positive ? "text-success" : "text-danger"}`}>
                        {stat.change.positive ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3 rotate-180" />
                        )}
                        {stat.change.text} vs período anterior
                      </div>
                    )}
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}
                  >
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </Card>
            ))}
      </motion.div>

      {/* Charts and Recent Orders */}
      <div className="grid grid-cols-3 gap-5">
        <motion.div variants={itemVariants} className="col-span-2">
          <Card>
            <div className="mb-6">
              <h2 className="text-base font-semibold text-foreground">
                Desempenho
              </h2>
              <p className="text-sm text-muted-foreground">
                Receita do período selecionado ({dateRange.label})
              </p>
            </div>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <WeeklyChart orders={filteredOrders} dateRange={dateRange} />
            )}
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <div className="mb-6">
              <h2 className="text-base font-semibold text-foreground">
                Pedidos Recentes
              </h2>
              <p className="text-sm text-muted-foreground">
                Últimas atualizações
              </p>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <RecentOrders orders={filteredOrders} />
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
