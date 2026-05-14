import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
  CreditCard,
  Package,
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

export function DashboardPage() {
  const { items: orders, loading: ordersLoading } = useOrders();
  const { items: clients, loading: clientsLoading } = useClients();
  const { items: products, loading: productsLoading } = useProducts();
  const { config: storeConfig } = useStoreConfig();

  // Revenue calculations matching CRM DashboardHome.tsx logic:
  // - Faturamento Total = sum of order.total where status !== 'cancelled'
  // - Valor Pago (Pix/Cartão) = sum of order.total where platform-managed payment AND paymentStatus === 'paid'
  // - Vendas (Pedidos) = count of non-cancelled orders
  const { totalRevenue, totalPaid, totalOrders, pendingOrders } = useMemo(() => {
    let revenue = 0;
    let paid = 0;
    let orderCount = 0;
    let pending = 0;

    orders.forEach((o) => {
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

    return { totalRevenue: revenue, totalPaid: paid, totalOrders: orderCount, pendingOrders: pending };
  }, [orders]);

  const totalClients = clients.length;
  const totalProducts = products.length;

  // Store name: prefer CRM storeConfig.storeName, then old fields
  const storeName = storeConfig?.storeName || storeConfig?.nomeLoja || storeConfig?.name || "Nova CRM";

  const stats = [
    {
      label: "Faturamento Total",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      color: "text-success",
      bg: "bg-success-light",
    },
    {
      label: "Valor Pago (Pix/Cartão)",
      value: formatCurrency(totalPaid),
      icon: CreditCard,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Vendas",
      value: String(totalOrders),
      icon: ShoppingCart,
      color: "text-accent",
      bg: "bg-accent-light",
    },
    {
      label: "Pedidos Pendentes",
      value: String(pendingOrders),
      icon: Package,
      color: "text-warning",
      bg: "bg-warning-light",
    },
  ];

  const isLoading = ordersLoading || clientsLoading || productsLoading;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-8 space-y-8"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral de {storeName}
        </p>
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
                Desempenho Semanal
              </h2>
              <p className="text-sm text-muted-foreground">
                Receita dos últimos 7 dias
              </p>
            </div>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <WeeklyChart orders={orders} />
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
              <RecentOrders orders={orders} />
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
