import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Plus,
  Clock,
  Send,
  Trash2,
  Edit2,
  Calendar,
  Repeat,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useScheduledMessages } from "@/hooks/useFirebaseData";
import { type ScheduledMessage } from "@/services/firebase";
import { formatDate, cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const recorrenciaConfig: Record<string, { label: string; color: string }> = {
  unica: { label: "Única", color: "bg-accent-light text-accent" },
  diario: { label: "Diário", color: "bg-success-light text-success" },
  semanal: { label: "Semanal", color: "bg-warning-light text-warning" },
  mensal: { label: "Mensal", color: "bg-info-light text-info" },
};

const statusIcon: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  agendada: { icon: Clock, color: "text-warning" },
  enviada: { icon: CheckCircle2, color: "text-success" },
  falhou: { icon: XCircle, color: "text-danger" },
};

const emptyForm: Omit<ScheduledMessage, "createdAt" | "updatedAt"> = {
  titulo: "",
  mensagem: "",
  destinatario: "",
  dataHora: 0,
  recorrencia: "unica",
  status: "agendada",
};

export function WhatsAppPage() {
  const { items: messages, loading, addItem, editItem, deleteItem } = useScheduledMessages();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"todas" | "agendada" | "enviada" | "falhou">("todas");

  const filtered = messages.filter((m) => {
    if (filter === "todas") return true;
    return m.status === filter;
  });

  const sorted = [...filtered].sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (msg: ScheduledMessage & { id: string }) => {
    setEditingId(msg.id);
    setForm({
      titulo: msg.titulo || "",
      mensagem: msg.mensagem || "",
      destinatario: msg.destinatario || "",
      dataHora: msg.dataHora || 0,
      recorrencia: msg.recorrencia || "unica",
      status: msg.status || "agendada",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await editItem(editingId, form as Partial<Record<string, unknown>>);
      } else {
        await addItem(form as Record<string, unknown>);
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar mensagem:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta mensagem?")) {
      await deleteItem(id);
    }
  };

  const openWhatsApp = (destinatario: string, mensagem: string) => {
    const phone = destinatario.replace(/\D/g, "");
    const text = encodeURIComponent(mensagem);
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${text}`, "_blank");
  };

  const stats = {
    agendadas: messages.filter((m) => m.status === "agendada").length,
    enviadas: messages.filter((m) => m.status === "enviada").length,
    falhas: messages.filter((m) => m.status === "falhou").length,
  };

  // Convert date input value to ms and back
  const dateToInputValue = (ms: number) => {
    if (!ms) return "";
    const d = new Date(ms);
    return d.toISOString().slice(0, 16);
  };

  const inputValueToDate = (val: string) => {
    if (!val) return 0;
    return new Date(val).getTime();
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-500" />
            WhatsApp
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mensagens programadas e integração com WhatsApp Web
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nova Mensagem
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-5">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-light">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Agendadas</p>
              <p className="text-lg font-semibold text-warning">{stats.agendadas}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-light">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enviadas</p>
              <p className="text-lg font-semibold text-success">{stats.enviadas}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-light">
              <AlertCircle className="h-5 w-5 text-danger" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Falhas</p>
              <p className="text-lg font-semibold text-danger">{stats.falhas}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Filter tabs */}
      <motion.div variants={itemVariants} className="flex items-center gap-1.5">
        {(["todas", "agendada", "enviada", "falhou"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize",
              filter === f ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "todas" ? "Todas" : f === "agendada" ? "Agendadas" : f === "enviada" ? "Enviadas" : "Falhas"}
          </button>
        ))}
      </motion.div>

      {/* Messages List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <MessageCircle className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma mensagem programada</p>
          <Button variant="secondary" className="mt-4" onClick={openCreate}>
            Criar primeira mensagem
          </Button>
        </div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {sorted.map((msg) => {
            const recorrencia = recorrenciaConfig[msg.recorrencia] || recorrenciaConfig.unica;
            const stIcon = statusIcon[msg.status] || statusIcon.agendada;
            const StatusIcon = stIcon.icon;
            return (
              <motion.div key={msg.id} variants={itemVariants}>
                <Card hover className="group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        msg.status === "enviada" ? "bg-success-light" :
                        msg.status === "falhou" ? "bg-danger-light" : "bg-warning-light"
                      )}>
                        <StatusIcon className={cn("h-5 w-5", stIcon.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{msg.titulo || "Sem título"}</p>
                          <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", recorrencia.color)}>
                            <Repeat className="h-3 w-3 mr-1" />
                            {recorrencia.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{msg.mensagem}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {msg.dataHora ? formatDate(msg.dataHora) : "Sem data"}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {msg.destinatario || "Sem destinatário"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Send className="h-3.5 w-3.5" />}
                        onClick={() => openWhatsApp(msg.destinatario, msg.mensagem)}
                      >
                        Enviar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Edit2 className="h-3.5 w-3.5" />}
                        onClick={() => openEdit(msg as ScheduledMessage & { id: string })}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => handleDelete(msg.id)}
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Info Banner */}
      <motion.div variants={itemVariants}>
        <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
          <div className="flex items-start gap-3">
            <MessageCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Como funciona</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1 leading-relaxed">
                Programe suas mensagens e envie pelo WhatsApp Web com um clique. Defina a data, hora e recorrência.
                Ao clicar em "Enviar", o WhatsApp Web será aberto com a mensagem pronta para envio.
                Você pode agendar lembretes, mensagens de cobrança, promoções e muito mais.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar Mensagem" : "Nova Mensagem Programada"}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex: Lembrete de pagamento"
          />

          <div>
            <label className="text-sm font-medium text-foreground/80">Mensagem</label>
            <textarea
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              placeholder="Digite a mensagem que será enviada pelo WhatsApp..."
              rows={4}
              className="mt-1.5 flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all resize-none"
            />
          </div>

          <Input
            label="Destinatário (WhatsApp)"
            value={form.destinatario}
            onChange={(e) => setForm({ ...form, destinatario: e.target.value })}
            placeholder="5511999999999 (com código do país)"
            icon={<MessageCircle className="h-4 w-4" />}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80">Data e Hora</label>
              <input
                type="datetime-local"
                value={dateToInputValue(form.dataHora)}
                onChange={(e) => setForm({ ...form, dataHora: inputValueToDate(e.target.value) })}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80">Recorrência</label>
              <select
                value={form.recorrencia}
                onChange={(e) => setForm({ ...form, recorrencia: e.target.value as ScheduledMessage["recorrencia"] })}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="unica">Única vez</option>
                <option value="diario">Diário</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingId ? "Salvar Alterações" : "Agendar Mensagem"}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
