import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  DollarSign,
  TrendingDown,
  ShoppingCart,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useOrders, useClients, useProducts } from "@/hooks/useFirebaseData";
import {
  type Order,
  type OrderItem,
} from "@/services/firebase";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const statusConfig = {
  pago: { label: "Pago", variant: "success" as const },
  pendente: { label: "Pendente", variant: "warning" as const },
  cancelado: { label: "Cancelado", variant: "danger" as const },
};

type StatusFilter = "todos" | "pago" | "pendente" | "cancelado";
type TypeFilter = "todos" | "entrada" | "saida";

const emptyOrder: Omit<Order, "createdAt" | "updatedAt"> = {
  clienteId: "",
  clienteNome: "",
  itens: [],
  total: 0,
  status: "pendente",
  tipo: "entrada",
  formaPagamento: "",
  observacoes: "",
};

export function OrdersPage() {
  const { items: orders, loading: ordersLoading, addItem: addOrder, editItem: editOrder } = useOrders();
  const { items: clients } = useClients();
  const { items: products } = useProducts();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyOrder);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Summary stats
  const summary = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === "pago");
    const entradas = paidOrders
      .filter((o) => o.tipo === "entrada")
      .reduce((s, o) => s + (o.total || 0), 0);
    const saidas = paidOrders
      .filter((o) => o.tipo === "saida")
      .reduce((s, o) => s + (o.total || 0), 0);
    return {
      entradas,
      saidas,
      saldo: entradas - saidas,
      pendentes: orders.filter((o) => o.status === "pendente").length,
    };
  }, [orders]);

  const filtered = orders.filter((o) => {
    const matchesSearch =
      o.clienteNome?.toLowerCase().includes(search.toLowerCase()) ||
      o.observacoes?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || o.status === statusFilter;
    const matchesType = typeFilter === "todos" || o.tipo === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const sorted = [...filtered].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  const openCreate = () => {
    setForm(emptyOrder);
    setOrderItems([]);
    setModalOpen(true);
  };

  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
      {
        produtoId: "",
        produtoNome: "",
        quantidade: 1,
        precoUnitario: 0,
        subtotal: 0,
      },
    ]);
  };

  const updateOrderItem = (index: number, field: string, value: string | number) => {
    const updated = [...orderItems];
    if (field === "produtoId") {
      const product = products.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        produtoId: value as string,
        produtoNome: product?.nome || "",
        precoUnitario: product?.preco || 0,
        subtotal: (product?.preco || 0) * updated[index].quantidade,
      };
    } else if (field === "quantidade") {
      updated[index] = {
        ...updated[index],
        quantidade: value as number,
        subtotal: updated[index].precoUnitario * (value as number),
      };
    }
    setOrderItems(updated);
    const total = updated.reduce((s, i) => s + i.subtotal, 0);
    setForm({ ...form, total, itens: updated });
  };

  const removeOrderItem = (index: number) => {
    const updated = orderItems.filter((_, i) => i !== index);
    setOrderItems(updated);
    const total = updated.reduce((s, i) => s + i.subtotal, 0);
    setForm({ ...form, total, itens: updated });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === form.clienteId);
      const orderData = {
        ...form,
        clienteNome: client?.nome || "",
        itens: orderItems,
        total: orderItems.reduce((s, i) => s + i.subtotal, 0),
      };
      await addOrder(orderData as Record<string, unknown>);
      setModalOpen(false);
    } catch (err) {
      console.error("Erro ao criar pedido:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: Order["status"]) => {
    await editOrder(id, { status });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-8 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão de vendas e fluxo de caixa
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Novo Pedido
        </Button>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-5">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-light">
              <ArrowUpRight className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="text-lg font-semibold text-success">
                {formatCurrency(summary.entradas)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-light">
              <ArrowDownRight className="h-5 w-5 text-danger" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="text-lg font-semibold text-danger">
                {formatCurrency(summary.saidas)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light">
              <DollarSign className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={cn("text-lg font-semibold", summary.saldo >= 0 ? "text-success" : "text-danger")}>
                {formatCurrency(summary.saldo)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-light">
              <ShoppingCart className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-lg font-semibold text-warning">{summary.pendentes}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Buscar pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          {(["todos", "pago", "pendente", "cancelado"] as StatusFilter[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                  statusFilter === status
                    ? "bg-accent text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {status === "todos" ? "Todos" : statusConfig[status]?.label}
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {(["todos", "entrada", "saida"] as TypeFilter[]).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                typeFilter === type
                  ? "bg-accent text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {type === "todos" ? "Todos" : type === "entrada" ? "Entradas" : "Saídas"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Orders List */}
      {ordersLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {sorted.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pendente;
            return (
              <motion.div key={order.id} variants={itemVariants}>
                <Card hover className="group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          order.tipo === "entrada"
                            ? "bg-success-light"
                            : "bg-danger-light"
                        )}
                      >
                        {order.tipo === "entrada" ? (
                          <ArrowUpRight className="h-5 w-5 text-success" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-danger" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {order.clienteNome || "Cliente"}
                          </p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          <Badge variant={order.tipo === "entrada" ? "success" : "danger"}>
                            {order.tipo === "entrada" ? "Entrada" : "Saída"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {order.createdAt ? formatDate(order.createdAt) : "—"}
                          {order.formaPagamento && ` · ${order.formaPagamento}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold text-foreground">
                        {formatCurrency(order.total || 0)}
                      </span>
                      {order.status === "pendente" && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleStatusChange(order.id, "pago")}
                          >
                            Marcar Pago
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStatusChange(order.id, "cancelado")}
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Create Order Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo Pedido"
        size="lg"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80">Cliente</label>
              <select
                value={form.clienteId}
                onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="">Selecione um cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as "entrada" | "saida" })
                }
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as Order["status"] })
                }
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <Input
              label="Forma de Pagamento"
              value={form.formaPagamento}
              onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}
              placeholder="Ex: PIX, Cartão, Dinheiro"
            />
          </div>

          {/* Order Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground/80">Itens do Pedido</label>
              <Button size="sm" variant="secondary" onClick={addOrderItem}>
                + Item
              </Button>
            </div>
            <div className="space-y-2">
              {orderItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                  <select
                    value={item.produtoId}
                    onChange={(e) => updateOrderItem(i, "produtoId", e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    <option value="">Selecione</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} - {formatCurrency(p.preco)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) =>
                      updateOrderItem(i, "quantidade", parseInt(e.target.value) || 1)
                    }
                    className="w-20 h-9 rounded-lg border border-border bg-background px-2 text-sm text-center"
                  />
                  <span className="text-sm font-medium w-24 text-right">
                    {formatCurrency(item.subtotal)}
                  </span>
                  <button
                    onClick={() => removeOrderItem(i)}
                    className="text-muted-foreground hover:text-danger transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 pt-3 border-t border-border">
              <span className="text-sm text-muted-foreground mr-2">Total:</span>
              <span className="text-lg font-semibold text-foreground">
                {formatCurrency(orderItems.reduce((s, i) => s + i.subtotal, 0))}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Observações (opcional)"
              rows={2}
              className="mt-1.5 flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Criar Pedido
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
