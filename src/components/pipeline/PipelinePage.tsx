import { useState, useMemo, useCallback, memo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Sparkles,
  Percent,
  Package,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Filter,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import {
  usePipeline,
  useClients,
  useProducts,
} from "@/hooks/useFirebaseData";
import {
  type Opportunity,
  type PipelineStage,
  type OpportunityItem,
} from "@/services/firebase";
import { formatCurrency, cn } from "@/lib/utils";
import {
  sanitizeFirestoreData,
  getClientName,
  getClientPhone,
  getClientEmail,
  getProductName,
  getProductPrice,
  openExternalLink,
} from "@/lib/crmData";
import { useToast } from "@/hooks/useToast";

type PipelineOpp = Opportunity & {
  id: string;
  createdAt: number;
  updatedAt: number;
};

const PIPELINE_STAGES: {
  id: PipelineStage;
  label: string;
  accent: string;
  chip: string;
}[] = [
  { id: "lead", label: "Prospecção / Leads", accent: "text-foreground", chip: "bg-muted" },
  { id: "contact", label: "Primeiro Contato", accent: "text-blue-600", chip: "bg-accent-light" },
  { id: "proposal", label: "Proposta Enviada", accent: "text-warning", chip: "bg-warning-light" },
  { id: "negotiation", label: "Em Negociação", accent: "text-purple-600", chip: "bg-accent-light" },
  { id: "won", label: "Ganho / Fechado", accent: "text-success", chip: "bg-success-light" },
  { id: "lost", label: "Perdido", accent: "text-danger", chip: "bg-danger-light" },
];

// Probabilidade padrão aplicada ao mover para uma etapa (igual ao CRM web)
const STAGE_PROBABILITY: Record<PipelineStage, number | null> = {
  lead: null,
  contact: 30,
  proposal: 60,
  negotiation: 80,
  won: 100,
  lost: 0,
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Board memozizado: só re-renderiza quando a lista de oportunidades filtrada
// muda (snapshot novo do Firestore) — abrir/fechar o modal ou digitar no
// formulário NÃO re-renderiza o kanban inteiro.
// ─────────────────────────────────────────────────────────────────────────────
interface PipelineBoardProps {
  opps: PipelineOpp[];
  onEdit: (opp: PipelineOpp) => void;
  onDelete: (opp: PipelineOpp) => void;
  onMoveStage: (opp: PipelineOpp, stage: PipelineStage) => void;
}

const PipelineBoard = memo(function PipelineBoard({
  opps,
  onEdit,
  onDelete,
  onMoveStage,
}: PipelineBoardProps) {
  return (
    <motion.div
      variants={itemVariants}
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4"
    >
      {PIPELINE_STAGES.map((stageItem) => {
        const stageOpps = opps.filter((o) => o.stage === stageItem.id);
        const stageTotal = stageOpps.reduce((sum, o) => sum + (o.value || 0), 0);
        const stageIndex = PIPELINE_STAGES.findIndex((s) => s.id === stageItem.id);

        return (
          <div
            key={stageItem.id}
            className={cn(
              "flex flex-col rounded-2xl border bg-background p-3.5 min-h-[240px] 2xl:min-h-[480px]",
              stageItem.id === "won" && "border-success/40 bg-success-light/40",
              stageItem.id === "lost" && "border-danger/40 bg-danger-light/40"
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div>
                <h3 className={cn("font-bold text-sm", stageItem.accent)}>
                  {stageItem.label}
                </h3>
                <span className="text-xs text-muted-foreground font-medium">
                  {formatCurrency(stageTotal)}
                </span>
              </div>
              <Badge className={stageItem.chip}>{stageOpps.length}</Badge>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-3 overflow-y-auto">
              {stageOpps.length === 0 ? (
                <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl text-xs text-muted-foreground text-center px-4">
                  Nenhuma oportunidade nesta etapa
                </div>
              ) : (
                stageOpps.map((opp) => (
                  <div
                    key={opp.id}
                    className="rounded-xl border border-border bg-card p-3.5 shadow-xs hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4
                        onClick={() => onEdit(opp)}
                        className="font-bold text-sm text-foreground hover:text-accent cursor-pointer line-clamp-1"
                      >
                        {opp.title}
                      </h4>
                      <Badge
                        variant={
                          opp.priority === "high"
                            ? "danger"
                            : opp.priority === "medium"
                            ? "warning"
                            : "default"
                        }
                      >
                        {opp.priority === "high"
                          ? "Alta"
                          : opp.priority === "medium"
                          ? "Média"
                          : "Baixa"}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground font-medium mt-1 flex items-center gap-1.5">
                      <span className="truncate">{opp.clientName}</span>
                      {opp.clientPhone && (
                        <button
                          onClick={() =>
                            openExternalLink(
                              `https://wa.me/${opp.clientPhone!.replace(/\D/g, "")}`
                            )
                          }
                          className="text-success hover:text-success/70 shrink-0"
                          title="Conversar no WhatsApp"
                        >
                          <Phone className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">
                        {formatCurrency(opp.value || 0)}
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {opp.probability || 0}% prob.
                      </span>
                    </div>

                    {opp.expectedCloseDate && (
                      <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Fechamento: {opp.expectedCloseDate}</span>
                      </div>
                    )}

                    {opp.items && opp.items.length > 0 && (
                      <div className="mt-2 text-[11px] text-accent flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>{opp.items.length} produto(s) vinculado(s)</span>
                      </div>
                    )}

                    {/* Quick actions */}
                    <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-1 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {stageIndex > 0 && (
                          <button
                            onClick={() =>
                              onMoveStage(opp, PIPELINE_STAGES[stageIndex - 1].id)
                            }
                            title="Voltar etapa"
                            className="p-1 hover:text-accent transition-colors"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {stageItem.id !== "won" &&
                          stageItem.id !== "lost" &&
                          stageIndex < PIPELINE_STAGES.length - 2 && (
                            <button
                              onClick={() =>
                                onMoveStage(opp, PIPELINE_STAGES[stageIndex + 1].id)
                              }
                              title="Avançar etapa"
                              className="p-1 hover:text-accent transition-colors"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEdit(opp)}
                          title="Editar"
                          className="p-1 hover:text-accent transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(opp)}
                          title="Excluir"
                          className="p-1 hover:text-danger transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

export function PipelinePage() {
  const toast = useToast();
  const {
    items: opportunities,
    loading,
    addItem,
    editItem,
    deleteItem,
    error: pipelineError,
    clearError,
  } = usePipeline();
  const { items: clients } = useClients();
  const { items: products } = useProducts();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<PipelineOpp | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [value, setValue] = useState<number | string>("");
  const [stage, setStage] = useState<PipelineStage>("lead");
  const [probability, setProbability] = useState<number>(50);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [notes, setNotes] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [dealItems, setDealItems] = useState<OpportunityItem[]>([]);

  // ── Ações (estáveis: não quebram o React.memo do board) ──

  const openCreate = useCallback(() => {
    setEditingOpp(null);
    setTitle("");
    setSelectedClientId("");
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setValue("");
    setStage("lead");
    setProbability(50);
    setExpectedCloseDate("");
    setPriority("medium");
    setNotes("");
    setLossReason("");
    setDealItems([]);
    setActionError(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((opp: PipelineOpp) => {
    setEditingOpp(opp);
    setTitle(opp.title);
    setSelectedClientId(opp.clientId || "");
    setClientName(opp.clientName || "");
    setClientPhone(opp.clientPhone || "");
    setClientEmail(opp.clientEmail || "");
    setValue(opp.value || 0);
    setStage(opp.stage || "lead");
    setProbability(opp.probability || 50);
    setExpectedCloseDate(opp.expectedCloseDate || "");
    setPriority(opp.priority || "medium");
    setNotes(opp.notes || "");
    setLossReason(opp.lossReason || "");
    setDealItems(
      (opp.items || []).map((it) => ({
        productId: it.productId || "",
        productName: it.productName || "",
        quantity: it.quantity || 1,
        price: it.price || 0,
      }))
    );
    setActionError(null);
    setModalOpen(true);
  }, []);

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const client = clients.find((c) => c.id === clientId) as any;
    if (!client) return;
    setClientName(getClientName(client));
    setClientPhone(getClientPhone(client));
    setClientEmail(getClientEmail(client));
    if (!title) setTitle(`Negociação - ${getClientName(client)}`);
  };

  const handleAddProduct = (prodId: string) => {
    if (!prodId) return;
    const prod = products.find((p) => p.id === prodId) as any;
    if (!prod) return;
    const name = getProductName(prod);
    const price = getProductPrice(prod);
    const existing = dealItems.find((p) => p.productId === prodId);
    let updated: OpportunityItem[];
    if (existing) {
      updated = dealItems.map((p) =>
        p.productId === prodId ? { ...p, quantity: p.quantity + 1 } : p
      );
    } else {
      updated = [
        ...dealItems,
        { productId: prod.id, productName: name, quantity: 1, price },
      ];
    }
    setDealItems(updated);
    setValue(updated.reduce((acc, c) => acc + c.price * c.quantity, 0));
  };

  const handleRemoveProduct = (prodId: string) => {
    const updated = dealItems.filter((p) => p.productId !== prodId);
    setDealItems(updated);
    setValue(updated.reduce((acc, c) => acc + c.price * c.quantity, 0));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Informe o título da oportunidade.");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    const numValue =
      typeof value === "string" ? parseFloat(value) || 0 : value;

    setSaving(true);
    setActionError(null);
    try {
      const data = sanitizeFirestoreData({
        title: title.trim(),
        clientId: selectedClientId || undefined,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        value: numValue,
        stage,
        probability: Number(probability),
        expectedCloseDate: expectedCloseDate || undefined,
        priority,
        notes: notes.trim() || undefined,
        lossReason: stage === "lost" ? lossReason.trim() : undefined,
        items: dealItems,
      });

      if (editingOpp) {
        await editItem(editingOpp.id, data as Record<string, unknown>);
        toast.success("Oportunidade atualizada com sucesso!");
      } else {
        await addItem(data as Record<string, unknown>);
        toast.success("Nova oportunidade criada no Pipeline!");
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar oportunidade:", err);
      setActionError(err.message || "Erro ao salvar oportunidade.");
      toast.error("Erro ao salvar oportunidade.");
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = useCallback(
    async (opp: PipelineOpp, newStage: PipelineStage) => {
      try {
        const updatedProb = STAGE_PROBABILITY[newStage];
        await editItem(opp.id, {
          stage: newStage,
          ...(updatedProb !== null ? { probability: updatedProb } : {}),
        });
        const label = PIPELINE_STAGES.find((s) => s.id === newStage)?.label;
        toast.success(`Movido para "${label}"`);
      } catch (err: any) {
        console.error("Erro ao mover oportunidade:", err);
        toast.error("Erro ao mover oportunidade.");
      }
    },
    [editItem, toast]
  );

  const handleDelete = useCallback(
    async (opp: PipelineOpp) => {
      if (!confirm("Tem certeza que deseja excluir esta oportunidade?")) return;
      try {
        await deleteItem(opp.id);
        toast.success("Oportunidade removida.");
      } catch (err: any) {
        console.error("Erro ao excluir:", err);
        toast.error("Erro ao excluir.");
      }
    },
    [deleteItem, toast]
  );

  // ── Métricas ──

  const totalPipelineValue = useMemo(
    () =>
      opportunities
        .filter((o) => o.stage !== "lost")
        .reduce((sum, o) => sum + (o.value || 0), 0),
    [opportunities]
  );

  const forecastValue = useMemo(
    () =>
      opportunities
        .filter((o) => o.stage !== "lost" && o.stage !== "won")
        .reduce(
          (sum, o) => sum + ((o.value || 0) * (o.probability || 0)) / 100,
          0
        ),
    [opportunities]
  );

  const wonDeals = useMemo(
    () => opportunities.filter((o) => o.stage === "won"),
    [opportunities]
  );
  const wonValue = wonDeals.reduce((sum, o) => sum + (o.value || 0), 0);
  const winRate =
    opportunities.length > 0
      ? ((wonDeals.length / opportunities.length) * 100).toFixed(0)
      : "0";

  const filteredOpps = useMemo(() => {
    const s = search.toLowerCase();
    return (opportunities as PipelineOpp[]).filter((opp) => {
      const matchesSearch =
        !s ||
        opp.title.toLowerCase().includes(s) ||
        (opp.clientName || "").toLowerCase().includes(s) ||
        (opp.notes || "").toLowerCase().includes(s);
      const matchesStage =
        stageFilter === "all" || opp.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [opportunities, search, stageFilter]);

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
            <TrendingUp className="h-6 w-6 text-accent" />
            Pipeline de Vendas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe suas negociações, propostas e previsões de fechamento em tempo real
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nova Oportunidade
        </Button>
      </motion.div>

      {/* Error Banner */}
      {(actionError || pipelineError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm text-danger flex-1">
            {actionError || pipelineError}
          </p>
          <button
            onClick={() => {
              setActionError(null);
              clearError();
            }}
            className="text-danger/60 hover:text-danger transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Metric Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total no Funil
            </span>
            <DollarSign className="h-4 w-4 text-accent" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {formatCurrency(totalPipelineValue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {opportunities.filter((o) => o.stage !== "lost").length}{" "}
            negociações ativas
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Previsão (Forecast)
            </span>
            <Sparkles className="h-4 w-4 text-warning" />
          </div>
          <p className="mt-2 text-2xl font-bold text-warning">
            {formatCurrency(forecastValue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ponderado pela probabilidade %
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Negócios Ganhos
            </span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-bold text-success">
            {formatCurrency(wonValue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {wonDeals.length} contratos fechados
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Taxa de Conversão
            </span>
            <Percent className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-600">{winRate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Oportunidades convertidas
          </p>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-96">
          <Input
            placeholder="Buscar por oportunidade, cliente ou notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
          >
            <option value="all">Todas as etapas</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Kanban Board */}
      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <PipelineBoard
          opps={filteredOpps}
          onEdit={openEdit}
          onDelete={handleDelete}
          onMoveStage={handleMoveStage}
        />
      )}

      {/* Modal Nova / Editar Oportunidade */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingOpp ? "Editar Oportunidade" : "Nova Oportunidade de Venda"}
        size="lg"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}

          <Input
            label="Título da Negociação *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Fornecimento Anual de Produtos"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Selecionar Cliente Cadastrado
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="">-- Cliente Avulso ou Novo --</option>
                {clients.map((c) => {
                  const cc = c as any;
                  return (
                    <option key={c.id} value={c.id}>
                      {getClientName(cc)} {getClientPhone(cc) ? `(${getClientPhone(cc)})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <Input
              label="Nome do Cliente / Empresa *"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome do contato ou empresa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Telefone / WhatsApp"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
            <Input
              label="E-mail"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Valor Estimado (R$)"
              type="number"
              step="0.01"
              value={value === "" ? "" : String(value)}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
            />
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Etapa Atual
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as PipelineStage)}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Probabilidade ({probability}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={probability}
                onChange={(e) => setProbability(Number(e.target.value))}
                className="mt-3 w-full accent-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Previsão de Fechamento"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "low" | "medium" | "high")
                }
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          {/* Deal items */}
          <div className="pt-2 border-t border-border">
            <label className="text-sm font-medium text-foreground/80">
              Itens / Produtos da Negociação
            </label>
            <select
              value=""
              onChange={(e) => handleAddProduct(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
            >
              <option value="">+ Adicionar produto do catálogo...</option>
              {products.map((p) => {
                const pp = p as any;
                return (
                  <option key={p.id} value={p.id}>
                    {getProductName(pp)} - R$ {getProductPrice(pp).toFixed(2)}
                  </option>
                );
              })}
            </select>

            {dealItems.length > 0 && (
              <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-muted/50 p-2.5">
                {dealItems.map((item, idx) => (
                  <div
                    key={`${item.productId || idx}`}
                    className="flex items-center justify-between rounded-lg bg-card px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium text-foreground">
                      {item.quantity}x {item.productName}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(item.productId!)}
                        className="text-danger hover:text-danger/70"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80">
              Observações / Próximos Passos
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações relevantes sobre a negociação..."
              className="mt-1.5 flex h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
            />
          </div>

          {stage === "lost" && (
            <Input
              label="Motivo da Perda"
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              placeholder="Ex: Preço alto, optou por concorrente..."
            />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingOpp ? "Salvar Alterações" : "Criar Oportunidade"}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
