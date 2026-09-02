import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Phone,
  Mail,
  MessageSquare,
  Users,
  FileText,
  AlertCircle,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useTasks, useClients, usePipeline } from "@/hooks/useFirebaseData";
import {
  type CRMTask,
  type CRMTaskType,
  type CRMTaskPriority,
} from "@/services/firebase";
import { cn } from "@/lib/utils";
import {
  sanitizeFirestoreData,
  getClientName,
  getClientPhone,
  todayLocalStr,
  openExternalLink,
} from "@/lib/crmData";
import { useToast } from "@/hooks/useToast";

type TaskRec = CRMTask & {
  id: string;
  createdAt: number;
  updatedAt: number;
};

const TASK_TYPES: {
  id: CRMTaskType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  chip: string;
}[] = [
  { id: "call", label: "Ligação", icon: Phone, chip: "bg-accent-light text-accent" },
  { id: "meeting", label: "Reunião", icon: Users, chip: "bg-purple-50 text-purple-600" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare, chip: "bg-success-light text-success" },
  { id: "email", label: "E-mail", icon: Mail, chip: "bg-warning-light text-warning" },
  { id: "followup", label: "Follow-up", icon: Clock, chip: "bg-accent-light text-accent" },
  { id: "proposal", label: "Enviar Proposta", icon: FileText, chip: "bg-danger-light text-danger" },
  { id: "other", label: "Geral", icon: AlertCircle, chip: "bg-muted text-muted-foreground" },
];

const PRIORITY_LABEL: Record<CRMTaskPriority, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

type TabKey = "today" | "overdue" | "upcoming" | "all" | "completed";

export function TasksPage() {
  const toast = useToast();
  const {
    items: tasks,
    loading,
    addItem,
    editItem,
    deleteItem,
    error: tasksError,
    clearError,
  } = useTasks();
  const { items: clients } = useClients();
  const { items: opportunities } = usePipeline();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("today");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRec | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CRMTaskType>("followup");
  const [dueDate, setDueDate] = useState(() => todayLocalStr());
  const [dueTime, setDueTime] = useState("14:00");
  const [priority, setPriority] = useState<CRMTaskPriority>("medium");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");

  const todayStr = todayLocalStr();

  const todayTasks = useMemo(
    () =>
      (tasks as TaskRec[]).filter(
        (t) => t.status !== "completed" && t.dueDate === todayStr
      ),
    [tasks, todayStr]
  );
  const overdueTasks = useMemo(
    () =>
      (tasks as TaskRec[]).filter(
        (t) => t.status !== "completed" && t.dueDate < todayStr
      ),
    [tasks, todayStr]
  );
  const upcomingTasks = useMemo(
    () =>
      (tasks as TaskRec[]).filter(
        (t) => t.status !== "completed" && t.dueDate > todayStr
      ),
    [tasks, todayStr]
  );
  const completedTasks = useMemo(
    () => (tasks as TaskRec[]).filter((t) => t.status === "completed"),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    let list: TaskRec[];
    switch (activeTab) {
      case "today":
        list = todayTasks;
        break;
      case "overdue":
        list = overdueTasks;
        break;
      case "upcoming":
        list = upcomingTasks;
        break;
      case "completed":
        list = completedTasks;
        break;
      default:
        list = (tasks as TaskRec[]).filter((t) => t.status !== "completed");
    }
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(s) ||
          (t.clientName || "").toLowerCase().includes(s) ||
          (t.description || "").toLowerCase().includes(s)
      );
    }
    return list.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }, [activeTab, search, todayTasks, overdueTasks, upcomingTasks, completedTasks, tasks]);

  // ── Ações ──

  const openCreate = () => {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setType("followup");
    setDueDate(todayLocalStr());
    setDueTime("14:00");
    setPriority("medium");
    setSelectedClientId("");
    setClientName("");
    setClientPhone("");
    setSelectedOpportunityId("");
    setActionError(null);
    setModalOpen(true);
  };

  const openEdit = (task: TaskRec) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setType(task.type || "followup");
    setDueDate(task.dueDate);
    setDueTime(task.dueTime || "14:00");
    setPriority(task.priority || "medium");
    setSelectedClientId(task.clientId || "");
    setClientName(task.clientName || "");
    setClientPhone(task.clientPhone || "");
    setSelectedOpportunityId(task.opportunityId || "");
    setActionError(null);
    setModalOpen(true);
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const client = clients.find((c) => c.id === clientId) as any;
    if (client) {
      setClientName(getClientName(client));
      setClientPhone(getClientPhone(client));
    }
  };

  const handleToggleComplete = async (task: TaskRec) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      await editItem(task.id, {
        status: newStatus,
        completedAt: newStatus === "completed" ? Timestamp.now() : null,
      });
      if (newStatus === "completed") {
        toast.success("Tarefa concluída!");
      } else {
        toast.info("Tarefa reaberta.");
      }
    } catch (err: any) {
      console.error("Erro ao atualizar tarefa:", err);
      toast.error("Erro ao atualizar tarefa.");
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Informe o título da tarefa.");
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const data = sanitizeFirestoreData({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        dueDate,
        dueTime: dueTime || undefined,
        priority,
        status: editingTask?.status || "pending",
        clientId: selectedClientId || undefined,
        clientName: clientName.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        opportunityId: selectedOpportunityId || undefined,
      });

      if (editingTask) {
        await editItem(editingTask.id, data as Record<string, unknown>);
        toast.success("Tarefa atualizada com sucesso!");
      } else {
        await addItem(data as Record<string, unknown>);
        toast.success("Nova tarefa agendada!");
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar tarefa:", err);
      setActionError(err.message || "Erro ao salvar tarefa.");
      toast.error("Erro ao salvar tarefa.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task: TaskRec) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
    try {
      await deleteItem(task.id);
      toast.success("Tarefa removida.");
    } catch (err: any) {
      console.error("Erro ao excluir tarefa:", err);
      toast.error("Erro ao excluir tarefa.");
    }
  };

  const TABS: { key: TabKey; label: string; count: number; color: string }[] = [
    { key: "today", label: "Hoje", count: todayTasks.length, color: "bg-accent text-white" },
    { key: "overdue", label: "Atrasadas", count: overdueTasks.length, color: "bg-danger text-white" },
    { key: "upcoming", label: "Próximas", count: upcomingTasks.length, color: "bg-blue-600 text-white" },
    { key: "all", label: "Todas", count: tasks.filter((t) => t.status !== "completed").length, color: "bg-foreground text-background" },
    { key: "completed", label: "Concluídas", count: completedTasks.length, color: "bg-success text-white" },
  ];

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
            <Calendar className="h-6 w-6 text-accent" />
            Tarefas, Agenda & Follow-ups
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize seus contatos de vendas, reuniões e lembretes para nunca perder um
            cliente
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nova Tarefa
        </Button>
      </motion.div>

      {/* Error Banner */}
      {(actionError || tasksError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm text-danger flex-1">
            {actionError || tasksError}
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

      {/* Overview cards (funcionam como filtro) */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {TABS.slice(0, 4).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "rounded-2xl border p-4 text-left transition-all",
              activeTab === t.key
                ? "border-accent bg-accent-light"
                : "border-border bg-card hover:bg-muted"
            )}
          >
            <span className="text-xs font-semibold uppercase text-muted-foreground block">
              {t.label}
            </span>
            <span className="text-2xl font-bold text-foreground mt-1 block">
              {t.count}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Search & tabs */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-96">
          <Input
            placeholder="Buscar tarefa ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap",
                activeTab === t.key
                  ? t.color
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </motion.div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CheckCircle2 className="h-12 w-12 text-success/40" />
          <h3 className="mt-4 font-bold text-lg text-foreground">Tudo em dia!</h3>
          <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
            Nenhuma tarefa nesta categoria. Aproveite para planejar novos follow-ups e
            ligações de vendas.
          </p>
          <Button variant="secondary" className="mt-4" onClick={openCreate}>
            Criar nova tarefa
          </Button>
        </div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {filteredTasks.map((task) => {
            const taskTypeInfo =
              TASK_TYPES.find((t) => t.id === task.type) || TASK_TYPES[6];
            const Icon = taskTypeInfo.icon;
            const isCompleted = task.status === "completed";
            const isOverdue = !isCompleted && (task.dueDate || "") < todayStr;

            return (
              <motion.div key={task.id} variants={itemVariants}>
                <Card
                  className={cn(
                    "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
                    isCompleted && "opacity-60 bg-success-light/40 border-success/30",
                    isOverdue && "border-danger/40 bg-danger-light/30"
                  )}
                >
                  <div className="flex w-full sm:w-auto items-center gap-3">
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        isCompleted
                          ? "border-success bg-success text-white"
                          : "border-border hover:border-accent"
                      )}
                    >
                      {isCompleted && <Check className="h-3.5 w-3.5" />}
                    </button>

                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        taskTypeInfo.chip
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4
                        className={cn(
                          "font-bold text-sm text-foreground",
                          isCompleted && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {task.clientName && (
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            👤 {task.clientName}
                          </span>
                        )}
                        <span
                          className={cn(
                            "flex items-center gap-1 font-medium",
                            isOverdue && "font-bold text-danger"
                          )}
                        >
                          <Calendar className="h-3 w-3" />
                          {task.dueDate} {task.dueTime ? `às ${task.dueTime}` : ""}
                          {isOverdue && " (Atrasada)"}
                        </span>
                        <Badge
                          variant={
                            task.priority === "high"
                              ? "danger"
                              : task.priority === "medium"
                              ? "warning"
                              : "default"
                          }
                        >
                          {PRIORITY_LABEL[task.priority] || "Média"}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {task.clientPhone && (
                      <button
                        onClick={() =>
                          openExternalLink(
                            `https://wa.me/${task.clientPhone!.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Olá ${task.clientName || ""}, tudo bem?`
                            )}`
                          )
                        }
                        className="flex items-center gap-1 rounded-xl bg-success-light p-2 text-xs font-bold text-success transition-colors hover:bg-success/20"
                        title="Chamar no WhatsApp"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(task)}
                      title="Editar"
                      className="p-2 text-muted-foreground transition-colors hover:text-accent"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(task)}
                      title="Excluir"
                      className="p-2 text-muted-foreground transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Modal Criar / Editar Tarefa */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? "Editar Tarefa" : "Nova Tarefa & Lembrete"}
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
            label="Título da Tarefa *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Ligar para confirmar proposta de fornecimento"
          />

          <div>
            <label className="text-sm font-medium text-foreground/80">
              Tipo de Atividade
            </label>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TASK_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-bold transition-all",
                      type === t.id
                        ? "border-accent bg-accent-light text-accent"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Vincular Cliente (Opcional)
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="">-- Sem cliente vinculado --</option>
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
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Vincular Oportunidade (Opcional)
              </label>
              <select
                value={selectedOpportunityId}
                onChange={(e) => setSelectedOpportunityId(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="">-- Sem oportunidade --</option>
                {opportunities.map((o) => (
                  <option key={o.id} value={o.id}>
                    {(o as any).title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Data Prevista"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Input
              label="Horário"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CRMTaskPriority)}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80">
              Detalhes / Observações
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Informações adicionais para a realização da tarefa..."
              className="mt-1.5 flex h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingTask ? "Salvar Alterações" : "Criar Tarefa"}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
