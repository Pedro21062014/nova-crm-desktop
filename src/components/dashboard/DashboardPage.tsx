import { motion } from "framer-motion";
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, Skeleton } from "@/components/ui";
import { useOrders, useClients, useProducts } from "@/hooks/useFirebaseData";
import { formatCurrency } from "@/lib/utils";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";

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

  const totalRevenue = orders
    .filter((o) => o.status === "pago" && o.tipo === "entrada")
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const pendingOrders = orders.filter((o) => o.status === "pendente").length;
  const totalClients = clients.length;
  const totalProducts = products.length;

  const revenueVsExpenses = orders.reduce(
    (acc, o) => {
      if (o.status === "pago") {
        if (o.tipo === "entrada") acc.entradas += o.total || 0;
        else acc.saidas += o.total || 0;
      }
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );

  const stats = [
    {
      label: "Receita Total",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      change: "+12%",
      positive: true,
      color: "text-success",
      bg: "bg-success-light",
    },
    {
      label: "Pedidos Pendentes",
      value: String(pendingOrders),
      icon: ShoppingCart,
      change: pendingOrders > 5 ? "+3" : "-2",
      positive: pendingOrders <= 5,
      color: "text-warning",
      bg: "bg-warning-light",
    },
    {
      label: "Total de Clientes",
      value: String(totalClients),
      icon: Users,
      change: "+8%",
      positive: true,
      color: "text-accent",
      bg: "bg-accent-light",
    },
    {
      label: "Produtos Ativos",
      value: String(totalProducts),
      icon: TrendingUp,
      change: "+5%",
      positive: true,
      color: "text-foreground",
      bg: "bg-muted",
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
          Visão geral do seu negócio
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
                  <Skeleton className="h-4 w-16" />
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
                    <div className="flex items-center gap-1">
                      {stat.positive ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 text-danger" />
                      )}
                      <span
                        className={`text-xs font-medium ${
                          stat.positive ? "text-success" : "text-danger"
                        }`}
                      >
                        {stat.change}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        vs. mês anterior
                      </span>
                    </div>
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
                Entradas vs Saídas dos últimos 7 dias
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
