import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  ArrowUpRight,
  Filter,
  DollarSign,
  Trash2,
  ShoppingCart,
  AlertCircle,
  X,
  Sparkles,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useOrders, useClients, useProducts } from "@/hooks/useFirebaseData";
import { type OrderItem } from "@/services/firebase";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

// ── Field compatibility helpers (CRM vs old nova-crm) ──

function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    const parts = Object.values(val).filter((v: any) => v && (typeof v === "string" || typeof v === "number")).map(String);
    return parts.length > 0 ? parts.join(", ") : "";
  }
  return String(val);
}

function pName(p: any): string { return safeStr(p.nome || p.name); }
function pPrice(p: any): number { return Number(p.preco || p.price) || 0; }
function cName(c: any): string { return safeStr(c.nome || c.name); }
function oClientName(o: any): string { return safeStr(o.customerName || o.clienteNome); }
function oPaymentMethod(o: any): string { return o.paymentMethod || o.formaPagamento || ""; }

// Check if order is cancelled
function isCancelled(o: any): boolean {
  const status = o.status || "";
  return status === "cancelled" || status === "cancelado";
}

// Check if order is pending
function isPending(o: any): boolean {
  const status = o.status || "new";
  return status === "new" || status === "pending" || status === "pending_payment" || status === "pendente";
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// CRM status config
const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info"; icon: any }> = {
  pending_payment: { label: "Pag. Pendente", variant: "warning", icon: Clock },
  new: { label: "Novo", variant: "info", icon: Sparkles },
  processing: { label: "Preparando", variant: "info", icon: Package },
  completed: { label: "Concluído", variant: "success", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", variant: "danger", icon: XCircle },
  // Old nova-crm statuses
  pago: { label: "Pago", variant: "success", icon: CheckCircle2 },
  paid: { label: "Pago", variant: "success", icon: CheckCircle2 },
  pendente: { label: "Pendente", variant: "warning", icon: Clock },
  pending: { label: "Pendente", variant: "warning", icon: Clock },
  cancelado: { label: "Cancelado", variant: "danger", icon: XCircle },
};

type StatusFilter = "todos" | "new" | "processing" | "completed" | "cancelled";

interface OrderForm {
  customerName: string;
  items: OrderItem[];
  total: number;
  status: string;
  paymentMethod: string;
  observacoes: string;
}

const emptyOrder: OrderForm = {
  customerName: "",
  items: [],
  total: 0,
  status: "new",
  paymentMethod: "",
  observacoes: "",
};

export function OrdersPage() {
  const {
    items: orders,
    loading: ordersLoading,
    error: ordersError,
    addItem: addOrder,
    editItem: editOrder,
    deleteItem: deleteOrder,
    clearError,
  } = useOrders();
  const { items: clients } = useClients();
  const { items: products } = useProducts();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [form, setForm] = useState<OrderForm>(emptyOrder);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const getStatus = (status: string) => {
    return statusConfig[status] || statusConfig.new;
  };

  // Summary stats matching CRM logic
  const summary = useMemo(() => {
    const nonCancelled = orders.filter((o) => !isCancelled(o));
    const faturamento = nonCancelled.reduce((s, o) => s + (o.total || 0), 0);

    // Platform-paid orders (PIX/Credit Card with real paymentId)
    const valorPago = nonCancelled.filter((o) => {
      const method = o.paymentMethod;
      const paymentId = o.paymentId;
      const paymentStatus = o.paymentStatus;
      const isNativePayment = method === "PIX" || method === "CREDIT_CARD";
      const isPlatformManaged = isNativePayment && paymentId && !String(paymentId).startsWith("static_");
      return isPlatformManaged && paymentStatus === "paid";
    }).reduce((s, o) => s + (o.total || 0), 0);

    return {
      faturamento,
      valorPago,
      pendentes: orders.filter((o) => isPending(o)).length,
      totalPedidos: nonCancelled.length,
    };
  }, [orders]);

  // Count new orders (created within last hour)
  const newOrdersCount = useMemo(() => {
    return orders.filter((o) => o.isNew).length;
  }, [orders]);

  const filtered = orders.filter((o) => {
    const cname = oClientName(o);
    const matchesSearch = cname?.toLowerCase().includes(search.toLowerCase());
    const orderStatus = o.status || "new";
    const matchesStatus = statusFilter === "todos" || orderStatus === statusFilter ||
      (statusFilter === "new" && (orderStatus === "pending_payment" || !o.status)) ||
      (statusFilter === "cancelled" && (orderStatus === "cancelado"));
    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  const openCreate = () => {
    setForm(emptyOrder);
    setOrderItems([]);
    setActionError(null);
    setModalOpen(true);
  };

  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
      { productId: "", productName: "", quantity: 1, price: 0 },
    ]);
  };

  const updateOrderItem = (index: number, field: string, value: string | number) => {
    const updated = [...orderItems];
    if (field === "productId") {
      const product = products.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        productId: value as string,
        productName: pName(product),
        price: pPrice(product),
      };
    } else if (field === "quantity") {
      updated[index] = {
        ...updated[index],
        quantity: value as number,
      };
    }
    setOrderItems(updated);
    const total = updated.reduce((s, i) => s + ((i.price || i.precoUnitario || 0) * (i.quantity || i.quantidade || 1)), 0);
    setForm({ ...form, total, items: updated });
  };

  const removeOrderItem = (index: number) => {
    const updated = orderItems.filter((_, i) => i !== index);
    setOrderItems(updated);
    const total = updated.reduce((s, i) => s + ((i.price || i.precoUnitario || 0) * (i.quantity || i.quantidade || 1)), 0);
    setForm({ ...form, total, items: updated });
  };

  const handleSave = async () => {
    setSaving(true);
    setActionError(null);
    try {
      const orderData: Record<string, unknown> = {
        customerName: form.customerName,
        items: orderItems.map(item => ({
          productId: item.productId || item.produtoId,
          productName: item.productName || item.produtoNome,
          quantity: item.quantity || item.quantidade,
          price: item.price || item.precoUnitario,
        })),
        total: form.total,
        status: form.status,
        paymentMethod: form.paymentMethod,
        paymentStatus: "pending",
      };
      await addOrder(orderData);
      setModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao criar pedido:", err);
      setActionError(err.message || "Erro ao criar pedido. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedOrderId) return;
    setSaving(true);
    setActionError(null);
    try {
      const update: Record<string, unknown> = { status: newStatus };
      // If marking as completed, also set paymentStatus to paid
      if (newStatus === "completed") {
        update.paymentStatus = "paid";
      }
      await editOrder(selectedOrderId, update);
      setStatusModalOpen(false);
      setSelectedOrderId(null);
    } catch (err: any) {
      console.error("Erro ao alterar status:", err);
      setActionError(err.message || "Erro ao alterar status. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (orderId: string, currentStatus: string) => {
    setSelectedOrderId(orderId);
    setNewStatus(currentStatus || "new");
    setActionError(null);
    setStatusModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este pedido?")) {
      setActionError(null);
      try {
        await deleteOrder(id);
      } catch (err: any) {
        console.error("Erro ao excluir pedido:", err);
        setActionError(err.message || "Erro ao excluir pedido. Tente novamente.");
      }
    }
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            Pedidos
            {newOrdersCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-white"
              >
                <Sparkles className="h-3 w-3" />
                {newOrdersCount} {newOrdersCount === 1 ? "novo" : "novos"}
              </motion.span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão de vendas e pedidos
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Novo Pedido
        </Button>
      </motion.div>

      {/* Error Banner */}
      {(actionError || ordersError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm text-danger flex-1">{actionError || ordersError}</p>
          <button
            onClick={() => { setActionError(null); clearError(); }}
            className="text-danger/60 hover:text-danger transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-5">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-light">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faturamento</p>
              <p className="text-lg font-semibold text-success">{formatCurrency(summary.faturamento)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <CreditCard className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pago (Pix/Cartão)</p>
              <p className="text-lg font-semibold text-blue-500">{formatCurrency(summary.valorPago)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light">
              <ShoppingCart className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pedidos</p>
              <p className="text-lg font-semibold text-accent">{summary.totalPedidos}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-light">
              <Clock className="h-5 w-5 text-warning" />
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
          {(["todos", "new", "processing", "completed", "cancelled"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                statusFilter === status ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {status === "todos" ? "Todos" : statusConfig[status]?.label || status}
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
          <Button variant="secondary" className="mt-4" onClick={openCreate}>
            Criar primeiro pedido
          </Button>
        </div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {sorted.map((order) => {
            const status = getStatus(order.status);
            const cname = oClientName(order);
            const isNew = order.isNew;
            const paymentMethod = oPaymentMethod(order);
            const isCancelledOrder = isCancelled(order);

            return (
              <motion.div key={order.id} variants={itemVariants}>
                <Card
                  hover
                  className={cn(
                    "group relative overflow-hidden",
                    isNew && "ring-2 ring-accent/30 bg-accent-light/30",
                    isCancelledOrder && "opacity-60"
                  )}
                >
                  {/* New indicator strip */}
                  {isNew && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l-2xl" />
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          isCancelledOrder ? "bg-danger-light" : "bg-success-light"
                        )}
                      >
                        {isCancelledOrder ? (
                          <XCircle className="h-5 w-5 text-danger" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5 text-success" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {cname || "Cliente"}
                          </p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {paymentMethod && (
                            <Badge variant="info">{paymentMethod}</Badge>
                          )}
                          {isNew && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wider"
                            >
                              Novo
                            </motion.span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {order.createdAt ? formatDate(order.createdAt) : "Agora"}
                          {order.discount ? ` · Desc: ${formatCurrency(order.discount)}` : ""}
                          {order.couponCode ? ` (${order.couponCode})` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-foreground">
                        {formatCurrency(order.total || 0)}
                      </span>
                      {/* Status change button */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openStatusModal(order.id, order.status || "new")}
                      >
                        Alterar Status
                      </Button>
                      {/* Delete button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => handleDelete(order.id)}
                      />
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
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome do Cliente"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="Nome do cliente"
            />
            <div>
              <label className="text-sm font-medium text-foreground/80">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="new">Novo</option>
                <option value="processing">Preparando</option>
                <option value="completed">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Forma de Pagamento"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              placeholder="PIX, CREDIT_CARD, Dinheiro"
            />
          </div>

          {/* Order Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground/80">Itens do Pedido</label>
              <Button size="sm" variant="secondary" onClick={addOrderItem}>+ Item</Button>
            </div>
            <div className="space-y-2">
              {orderItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                  <select
                    value={item.productId || item.produtoId}
                    onChange={(e) => updateOrderItem(i, "productId", e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    <option value="">Selecione</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{pName(p)} - {formatCurrency(pPrice(p))}</option>
                    ))}
                  </select>
                  <input
                    type="number" min={1}
                    value={item.quantity || item.quantidade}
                    onChange={(e) => updateOrderItem(i, "quantity", parseInt(e.target.value) || 1)}
                    className="w-20 h-9 rounded-lg border border-border bg-background px-2 text-sm text-center"
                  />
                  <span className="text-sm font-medium w-24 text-right">
                    {formatCurrency((item.price || item.precoUnitario || 0) * (item.quantity || item.quantidade || 1))}
                  </span>
                  <button onClick={() => removeOrderItem(i)} className="text-muted-foreground hover:text-danger transition-colors">×</button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 pt-3 border-t border-border">
              <span className="text-sm text-muted-foreground mr-2">Total:</span>
              <span className="text-lg font-semibold text-foreground">
                {formatCurrency(orderItems.reduce((s, i) => s + ((i.price || i.precoUnitario || 0) * (i.quantity || i.quantidade || 1)), 0))}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Observações (opcional)" rows={2}
              className="mt-1.5 flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Criar Pedido</Button>
          </div>
        </div>
      </Modal>

      {/* Change Status Modal */}
      <Modal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Alterar Status do Pedido"
        size="sm"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground/80">Novo Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
            >
              <option value="pending_payment">Pagamento Pendente</option>
              <option value="new">Novo</option>
              <option value="processing">Preparando</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleStatusChange} loading={saving}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
