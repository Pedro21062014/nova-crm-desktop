import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Plus,
  CheckCircle2,
  Clock,
  UserPlus,
  ShoppingBag,
  FileText,
  Trash2,
  Edit2,
  ArrowRight,
  Bot,
  AlertCircle,
  X,
} from "lucide-react";
import { Card, Button, Input, Skeleton, Modal } from "@/components/ui";
import { useAutomations } from "@/hooks/useFirebaseData";
import {
  type CRMAutomation,
  type CRMAutomationTrigger,
} from "@/services/firebase";
import { cn } from "@/lib/utils";
import { sanitizeFirestoreData } from "@/lib/crmData";
import { useToast } from "@/hooks/useToast";

type AutomationRec = CRMAutomation & {
  id: string;
  createdAt: number;
  updatedAt: number;
};

// Mesmas receitas padrão do CRM web — semeadas na primeira visita
const DEFAULT_RECIPES: Array<{
  name: string;
  description: string;
  isActive: boolean;
  trigger: CRMAutomationTrigger;
  actionType: CRMAutomation["actionType"];
  actionConfig: Record<string, any>;
}> = [
  {
    name: "Follow-up de Boas-Vindas para Novo Cliente",
    description:
      "Quando um novo cliente for cadastrado, cria automaticamente uma tarefa de primeiro contato em 24h.",
    isActive: true,
    trigger: "client_created",
    actionType: "create_task",
    actionConfig: {
      taskTitle: "Fazer contato de boas-vindas com o cliente",
      taskType: "whatsapp",
      delayDays: 1,
    },
  },
  {
    name: "Pós-Venda Automático após Pedido Pago",
    description:
      "Quando um pedido for marcado como pago, cria uma tarefa de follow-up pós-venda após 7 dias.",
    isActive: true,
    trigger: "order_paid",
    actionType: "create_task",
    actionConfig: {
      taskTitle: "Pesquisa de satisfação e suporte pós-venda",
      taskType: "call",
      delayDays: 7,
    },
  },
  {
    name: "Reativação de Clientes Inativos (30 dias)",
    description:
      "Gera alertas e tarefas para reengajar clientes que não compram há mais de 1 mês.",
    isActive: true,
    trigger: "inactive_client_30d",
    actionType: "create_task",
    actionConfig: {
      taskTitle: "Enviar cupom de desconto para cliente inativo",
      taskType: "whatsapp",
      delayDays: 0,
    },
  },
  {
    name: "Notificação de Proposta Comercial Aprovada",
    description:
      "Gera uma notificação de alta prioridade quando uma proposta for aceita pelo cliente.",
    isActive: true,
    trigger: "proposal_approved",
    actionType: "add_notification",
    actionConfig: {
      message: "Proposta comercial aprovada! Inicie a separação do pedido.",
    },
  },
];

const TRIGGER_INFO: Record<
  CRMAutomationTrigger,
  { label: string; icon: React.ComponentType<{ className?: string }>; chip: string }
> = {
  client_created: { label: "Novo Cliente Cadastrado", icon: UserPlus, chip: "bg-accent-light text-accent" },
  order_created: { label: "Novo Pedido Realizado", icon: ShoppingBag, chip: "bg-warning-light text-warning" },
  order_paid: { label: "Pagamento Confirmado", icon: CheckCircle2, chip: "bg-success-light text-success" },
  proposal_approved: { label: "Proposta Comercial Aprovada", icon: FileText, chip: "bg-purple-50 text-purple-600" },
  opportunity_won: { label: "Negócio Ganho no Pipeline", icon: Zap, chip: "bg-accent-light text-accent" },
  inactive_client_30d: { label: "Cliente Inativo (30 dias)", icon: Clock, chip: "bg-danger-light text-danger" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function AutomationsPage() {
  const toast = useToast();
  const {
    items: automations,
    loading,
    addItem,
    editItem,
    deleteItem,
    error: automationsError,
    clearError,
  } = useAutomations();

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAuto, setEditingAuto] = useState<AutomationRec | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<CRMAutomationTrigger>("client_created");
  const [taskTitle, setTaskTitle] = useState("Entrar em contato com o cliente");
  const [taskType, setTaskType] = useState("whatsapp");
  const [delayDays, setDelayDays] = useState(1);

  // ── Seed das receitas padrão (igual ao CRM web) ──
  const seedingRef = useRef(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (loading || seedingRef.current || automations.length > 0) return;
    seedingRef.current = true;
    setSeeding(true);
    (async () => {
      try {
        for (const recipe of DEFAULT_RECIPES) {
          await addItem(
            sanitizeFirestoreData({ ...recipe, executionsCount: 0 }) as Record<
              string,
              unknown
            >
          );
        }
        toast.info("Receitas padrão de automação criadas.");
      } catch (err) {
        console.error("Erro ao semear automações padrão:", err);
        seedingRef.current = false; // permite tentar novamente
      } finally {
        setSeeding(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, automations.length]);

  // ── Ações ──

  const handleToggleActive = async (auto: AutomationRec) => {
    try {
      const newActive = !auto.isActive;
      await editItem(auto.id, { isActive: newActive });
      toast.success(newActive ? "Automação ativada!" : "Automação pausada.");
    } catch (err: any) {
      console.error("Erro ao atualizar status:", err);
      toast.error("Erro ao atualizar status.");
    }
  };

  const openCreate = () => {
    setEditingAuto(null);
    setName("");
    setDescription("");
    setTrigger("client_created");
    setTaskTitle("Entrar em contato com o cliente");
    setTaskType("whatsapp");
    setDelayDays(1);
    setActionError(null);
    setModalOpen(true);
  };

  const openEdit = (auto: AutomationRec) => {
    setEditingAuto(auto);
    setName(auto.name);
    setDescription(auto.description || "");
    setTrigger(auto.trigger);
    setTaskTitle(auto.actionConfig?.taskTitle || "Entrar em contato");
    setTaskType(auto.actionConfig?.taskType || "whatsapp");
    setDelayDays(Number(auto.actionConfig?.delayDays ?? 1));
    setActionError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome da automação.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const data = sanitizeFirestoreData({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger,
        actionType: editingAuto?.actionType || "create_task",
        actionConfig: {
          taskTitle,
          taskType,
          delayDays: Number(delayDays),
        },
        isActive: editingAuto ? editingAuto.isActive : true,
        executionsCount: editingAuto?.executionsCount ?? 0,
      });

      if (editingAuto) {
        await editItem(editingAuto.id, data as Record<string, unknown>);
        toast.success("Regra de automação atualizada!");
      } else {
        await addItem(data as Record<string, unknown>);
        toast.success("Nova automação criada com sucesso!");
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar automação:", err);
      setActionError(err.message || "Erro ao salvar automação.");
      toast.error("Erro ao salvar automação.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (auto: AutomationRec) => {
    if (!confirm("Tem certeza que deseja excluir esta automação?")) return;
    try {
      await deleteItem(auto.id);
      toast.success("Automação excluída.");
    } catch (err: any) {
      console.error("Erro ao excluir:", err);
      toast.error("Erro ao excluir.");
    }
  };

  const sorted = useMemo(
    () =>
      (automations as AutomationRec[]).sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      ),
    [automations]
  );

  const activeCount = sorted.filter((a) => a.isActive).length;

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
            <Zap className="h-6 w-6 text-warning fill-warning" />
            Automações & Regras de CRM
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automatize tarefas de vendas, follow-ups de pós-venda e reativação de
            clientes sem esforço manual
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nova Automação
        </Button>
      </motion.div>

      {/* Info banner */}
      <motion.div
        variants={itemVariants}
        className="flex items-center gap-3.5 rounded-2xl border border-accent/30 bg-accent-light/60 p-4"
      >
        <Bot className="h-8 w-8 shrink-0 text-accent" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <span className="block text-sm font-bold text-accent">
            Robô de Automações Ativo
          </span>
          As regras abaixo monitoram eventos de clientes, propostas e pedidos para
          disparar tarefas e lembretes em tempo real.{" "}
          <span className="font-semibold text-foreground">
            {activeCount} de {sorted.length} ativas
          </span>
        </div>
      </motion.div>

      {/* Error Banner */}
      {(actionError || automationsError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm text-danger flex-1">
            {actionError || automationsError}
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

      {/* Automations grid */}
      {loading || seeding ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Zap className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma automação configurada
          </p>
          <Button variant="secondary" className="mt-4" onClick={openCreate}>
            Criar primeira automação
          </Button>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {sorted.map((auto) => {
            const trigInfo = TRIGGER_INFO[auto.trigger] || TRIGGER_INFO.client_created;
            const TrigIcon = trigInfo.icon;

            return (
              <motion.div key={auto.id} variants={itemVariants}>
                <Card
                  className={cn(
                    "flex h-full flex-col justify-between",
                    !auto.isActive && "opacity-60"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            trigInfo.chip
                          )}
                        >
                          <TrigIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-foreground">
                            {auto.name}
                          </h3>
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            Gatilho: {trigInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggleActive(auto)}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                          auto.isActive ? "bg-accent" : "bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                            auto.isActive ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>

                    {auto.description && (
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        {auto.description}
                      </p>
                    )}

                    {/* Flow visualizer */}
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-muted/50 p-3 text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        ⚡ {trigInfo.label}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-bold text-accent">
                        {auto.actionType === "add_notification"
                          ? "🔔 Notificação"
                          : `✅ Criar Tarefa (${auto.actionConfig?.delayDays ?? 0}d)`}
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>
                      Executado {auto.executionsCount || 0} vez(es)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(auto)}
                        title="Editar"
                        className="p-1.5 transition-colors hover:text-accent"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(auto)}
                        title="Excluir"
                        className="p-1.5 transition-colors hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Modal Criar / Editar Automação */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingAuto ? "Editar Regra de Automação" : "Nova Regra de Automação"
        }
      >
        <div className="space-y-4">
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}

          <Input
            label="Nome da Regra *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Follow-up 3 dias após proposta"
          />

          <div>
            <label className="text-sm font-medium text-foreground/80">
              Quando isso acontecer (Gatilho)
            </label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as CRMAutomationTrigger)}
              className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
            >
              <option value="client_created">👤 Novo Cliente Cadastrado</option>
              <option value="order_created">🛍️ Novo Pedido Realizado</option>
              <option value="order_paid">💰 Pedido Marcado como Pago</option>
              <option value="proposal_approved">📑 Proposta Comercial Aprovada</option>
              <option value="opportunity_won">🏆 Negócio Ganho no Pipeline</option>
              <option value="inactive_client_30d">⏳ Cliente Sem Compras há 30 dias</option>
            </select>
          </div>

          {/* Action config */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
            <label className="block text-xs font-bold uppercase text-accent">
              Ação Automática: Criar Tarefa & Follow-up
            </label>

            <Input
              label="Título da Tarefa Gerada"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground/80">
                  Canal
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
                >
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="call">📞 Ligação</option>
                  <option value="meeting">🤝 Reunião</option>
                  <option value="email">✉️ E-mail</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/80">
                  Prazo (Dias após o gatilho)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={delayDays}
                  onChange={(e) => setDelayDays(Number(e.target.value))}
                  className="text-center"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80">
              Descrição (Opcional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 flex h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingAuto ? "Salvar Alterações" : "Criar Automação"}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
