import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Tag,
  Percent,
  DollarSign,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useCoupons } from "@/hooks/useFirebaseData";
import { type Coupon } from "@/services/firebase";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

// ── Field compatibility helpers (CRM vs old nova-crm) ──

function getCouponCode(c: Coupon): string {
  return c.code || c.codigo || "";
}

function getCouponType(c: Coupon): "percentage" | "fixed" {
  const t = c.type || c.tipoDesconto;
  if (t === "percentage" || t === "porcentagem") return "percentage";
  if (t === "fixed" || t === "valor_fixo") return "fixed";
  return "percentage";
}

function getCouponValue(c: Coupon): number {
  return c.value ?? c.valorDesconto ?? 0;
}

function getCouponMinPurchase(c: Coupon): number {
  return c.minPurchase ?? c.valorMinimo ?? 0;
}

function getCouponUsageCount(c: Coupon): number {
  return c.usageCount ?? c.usosAtuais ?? 0;
}

function getCouponActive(c: Coupon): boolean {
  return c.active !== undefined ? c.active : (c.ativo !== undefined ? c.ativo : true);
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const emptyForm = {
  code: "",
  type: "percentage" as "percentage" | "fixed",
  value: 0,
  minPurchase: 0,
  active: true,
};

export function CouponsPage() {
  const { items: coupons, loading, addItem, editItem, deleteItem, error: couponsError, clearError } = useCoupons();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | "ativos" | "inativos">("todos");

  const filtered = useMemo(() => {
    let result = coupons;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (c) =>
          getCouponCode(c).toLowerCase().includes(s)
      );
    }
    if (filter === "ativos") {
      result = result.filter((c) => getCouponActive(c));
    } else if (filter === "inativos") {
      result = result.filter((c) => !getCouponActive(c));
    }
    return result;
  }, [coupons, search, filter]);

  const sorted = [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setActionError(null);
    setModalOpen(true);
  };

  const openEdit = (coupon: Coupon & { id: string }) => {
    setEditingId(coupon.id);
    setForm({
      code: getCouponCode(coupon),
      type: getCouponType(coupon),
      value: getCouponValue(coupon),
      minPurchase: getCouponMinPurchase(coupon),
      active: getCouponActive(coupon),
    });
    setActionError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      setActionError("O código do cupom é obrigatório.");
      return;
    }
    if (form.value <= 0) {
      setActionError("O valor do desconto deve ser maior que zero.");
      return;
    }
    if (form.type === "percentage" && form.value > 100) {
      setActionError("A porcentagem de desconto não pode ser maior que 100%.");
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      // Save in CRM format (matching the web app structure)
      const data: Record<string, unknown> = {
        code: form.code.toUpperCase().trim(),
        type: form.type,
        value: parseFloat(String(form.value)) || 0,
        active: form.active,
      };

      // Only include minPurchase if set
      if (form.minPurchase > 0) {
        data.minPurchase = parseFloat(String(form.minPurchase)) || 0;
      } else {
        data.minPurchase = 0;
      }

      if (editingId) {
        // When editing, preserve usageCount
        const existing = coupons.find(c => c.id === editingId);
        if (existing) {
          data.usageCount = getCouponUsageCount(existing);
        }
        await editItem(editingId, data as Partial<Record<string, unknown>>);
      } else {
        // New coupon starts with 0 usage
        data.usageCount = 0;
        await addItem(data as Record<string, unknown>);
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar cupom:", err);
      setActionError(err.message || "Erro ao salvar cupom.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cupom?")) {
      setActionError(null);
      try {
        await deleteItem(id);
      } catch (err: any) {
        setActionError(err.message || "Erro ao excluir cupom.");
      }
    }
  };

  const toggleActive = async (coupon: Coupon & { id: string }) => {
    try {
      const newActive = !getCouponActive(coupon);
      await editItem(coupon.id, { active: newActive } as Partial<Record<string, unknown>>);
    } catch (err: any) {
      setActionError(err.message || "Erro ao alterar status do cupom.");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
  };

  const isValid = (coupon: Coupon) => getCouponActive(coupon);

  const stats = useMemo(() => ({
    ativos: coupons.filter((c) => getCouponActive(c)).length,
    inativos: coupons.filter((c) => !getCouponActive(c)).length,
    totalUsos: coupons.reduce((s, c) => s + getCouponUsageCount(c), 0),
  }), [coupons]);

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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Tag className="h-6 w-6 text-accent" />
            Cupons
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie cupons de desconto para seus clientes
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Novo Cupom
        </Button>
      </motion.div>

      {/* Error Banner */}
      {(actionError || couponsError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm text-danger flex-1">{actionError || couponsError}</p>
          <button
            onClick={() => { setActionError(null); clearError(); }}
            className="text-danger/60 hover:text-danger transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-5">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-light">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-lg font-semibold text-success">{stats.ativos}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-light">
              <XCircle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inativos</p>
              <p className="text-lg font-semibold text-warning">{stats.inativos}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light">
              <Tag className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Usos</p>
              <p className="text-lg font-semibold text-accent">{stats.totalUsos}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Buscar cupom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["todos", "ativos", "inativos"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                filter === f ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "todos" ? "Todos" : f === "ativos" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Coupons List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Tag className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhum cupom encontrado</p>
          <Button variant="secondary" className="mt-4" onClick={openCreate}>
            Criar primeiro cupom
          </Button>
        </div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {sorted.map((coupon) => {
            const active = getCouponActive(coupon);
            const couponType = getCouponType(coupon);
            const couponValue = getCouponValue(coupon);
            const couponCode = getCouponCode(coupon);
            const minPurchase = getCouponMinPurchase(coupon);
            const usageCount = getCouponUsageCount(coupon);

            return (
              <motion.div key={coupon.id} variants={itemVariants}>
                <Card hover className={cn("group relative overflow-hidden", !active && "opacity-70")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl",
                        active ? "bg-accent-light" : "bg-muted"
                      )}>
                        {couponType === "percentage" ? (
                          <Percent className={cn("h-6 w-6", active ? "text-accent" : "text-muted-foreground")} />
                        ) : (
                          <DollarSign className={cn("h-6 w-6", active ? "text-accent" : "text-muted-foreground")} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold tracking-wider text-foreground bg-muted px-2.5 py-0.5 rounded-md font-mono">
                            {couponCode || "SEM_COD"}
                          </span>
                          <Badge variant={active ? "success" : "danger"}>
                            {active ? "Ativo" : "Inativo"}
                          </Badge>
                          {couponType === "percentage" ? (
                            <span className="text-sm font-semibold text-success">
                              {couponValue}% OFF
                            </span>
                          ) : (
                            <span className="text-sm font-semibold text-success">
                              {formatCurrency(couponValue)} OFF
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {minPurchase ? `Mínimo: ${formatCurrency(minPurchase)}` : "Sem mínimo"}
                          {" · "}
                          Usos: {usageCount}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyCode(couponCode)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Copiar código"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toggleActive(coupon as Coupon & { id: string })}
                      >
                        {active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Edit2 className="h-3.5 w-3.5" />}
                        onClick={() => openEdit(coupon as Coupon & { id: string })}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => handleDelete(coupon.id)}
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar Cupom" : "Novo Cupom"}
        size="lg"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código do Cupom"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="EX: PROMO20"
              icon={<Tag className="h-4 w-4" />}
            />
            <div>
              <label className="text-sm font-medium text-foreground/80">Tipo de Desconto</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "percentage" | "fixed" })}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="percentage">Porcentagem (%)</option>
                <option value="fixed">Valor Fixo (R$)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={form.type === "percentage" ? "Desconto (%)" : "Desconto (R$)"}
              type="number"
              value={form.value || ""}
              onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
              placeholder={form.type === "percentage" ? "10" : "15.90"}
              icon={form.type === "percentage" ? <Percent className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
            />
            <Input
              label="Pedido Mínimo (R$) (0 = sem mínimo)"
              type="number"
              value={form.minPurchase || ""}
              onChange={(e) => setForm({ ...form, minPurchase: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              icon={<DollarSign className="h-4 w-4" />}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground/80">Cupom ativo?</label>
            <button
              onClick={() => setForm({ ...form, active: !form.active })}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                form.active ? "bg-accent" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                  form.active ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingId ? "Salvar Alterações" : "Criar Cupom"}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
