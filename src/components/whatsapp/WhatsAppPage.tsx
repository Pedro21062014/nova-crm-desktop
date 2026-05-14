import { useState, useRef, useEffect, useCallback } from "react";
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
  CheckCircle2,
  AlertCircle,
  XCircle,
  AlertCircle as ErrorIcon,
  X,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
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

type Tab = "whatsapp" | "mensagens";

export function WhatsAppPage() {
  const { items: messages, loading, addItem, editItem, deleteItem, error: msgError, clearError } = useScheduledMessages();
  const [activeTab, setActiveTab] = useState<Tab>("whatsapp");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"todas" | "agendada" | "enviada" | "falhou">("todas");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isWhatsappLoaded, setIsWhatsappLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const webviewRef = useRef<any>(null);

  const filtered = messages.filter((m) => {
    if (filter === "todas") return true;
    return m.status === filter;
  });

  const sorted = [...filtered].sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setActionError(null);
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
    setActionError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setActionError(null);
    try {
      if (editingId) {
        await editItem(editingId, form as Partial<Record<string, unknown>>);
      } else {
        await addItem(form as Record<string, unknown>);
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar mensagem:", err);
      setActionError(err.message || "Erro ao salvar mensagem.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta mensagem?")) {
      setActionError(null);
      try {
        await deleteItem(id);
      } catch (err: any) {
        setActionError(err.message || "Erro ao excluir mensagem.");
      }
    }
  };

  const sendToWhatsApp = (destinatario: string, mensagem: string) => {
    const phone = destinatario.replace(/\D/g, "");
    const text = encodeURIComponent(mensagem);
    // Open in the embedded webview if on WhatsApp tab, otherwise open externally
    if (webviewRef.current && activeTab === "whatsapp") {
      const webview = webviewRef.current;
      webview.loadURL(`https://web.whatsapp.com/send?phone=${phone}&text=${text}`);
    } else {
      window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${text}`, "_blank");
    }
  };

  const reloadWhatsApp = () => {
    if (webviewRef.current) {
      webviewRef.current.loadURL("https://web.whatsapp.com");
      setIsWhatsappLoaded(false);
    }
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
    // Format for datetime-local input in local timezone
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      className={cn(
        "flex flex-col",
        isFullscreen && activeTab === "whatsapp" ? "h-screen -m-8" : "p-8 space-y-6"
      )}
    >
      {/* Header - hidden in fullscreen */}
      {!(isFullscreen && activeTab === "whatsapp") && (
        <>
          <motion.div variants={itemVariants} className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                <MessageCircle className="h-6 w-6 text-green-500" />
                WhatsApp
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                WhatsApp Web e mensagens programadas
              </p>
            </div>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={openCreate}
            >
              Nova Mensagem
            </Button>
          </motion.div>

          {/* Tab Switcher */}
          <motion.div variants={itemVariants} className="flex items-center gap-1 bg-muted rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                activeTab === "whatsapp"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              WhatsApp Web
            </button>
            <button
              onClick={() => setActiveTab("mensagens")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                activeTab === "mensagens"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mensagens Programadas
              {stats.agendadas > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {stats.agendadas}
                </span>
              )}
            </button>
          </motion.div>
        </>
      )}

      {/* Fullscreen toggle bar */}
      {isFullscreen && activeTab === "whatsapp" && (
        <div className="flex items-center justify-between bg-card border-b border-border px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-foreground">WhatsApp Web</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reloadWhatsApp}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Recarregar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsFullscreen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Sair da tela cheia"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Web Tab */}
      {activeTab === "whatsapp" && (
        <motion.div
          variants={itemVariants}
          className={cn(
            "flex flex-col",
            isFullscreen ? "flex-1" : ""
          )}
        >
          {!isFullscreen && (
            <div className="flex items-center justify-end gap-2 mb-3">
              <button
                onClick={reloadWhatsApp}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Recarregar WhatsApp"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsFullscreen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Tela cheia"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* WebView Container */}
          <div
            className={cn(
              "rounded-xl border border-border overflow-hidden bg-muted",
              isFullscreen ? "flex-1" : "h-[calc(100vh-320px)] min-h-[400px]"
            )}
          >
            {/* @ts-ignore - webview is not in React types but works in Electron */}
            <webview
              ref={webviewRef}
              src="https://web.whatsapp.com"
              className="w-full h-full"
              partition="persist:whatsapp"
              useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
              allowpopups={true as any}
              onLoad={() => setIsWhatsappLoaded(true)}
            />
          </div>

          {!isFullscreen && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Escaneie o QR Code com seu WhatsApp para conectar. Sua sessão será mantida.
            </p>
          )}
        </motion.div>
      )}

      {/* Messages Tab */}
      {activeTab === "mensagens" && (
        <>
          {/* Error Banner */}
          {(actionError || msgError) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
            >
              <ErrorIcon className="h-4 w-4 text-danger shrink-0" />
              <p className="text-sm text-danger flex-1">{actionError || msgError}</p>
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
                            onClick={() => sendToWhatsApp(msg.destinatario, msg.mensagem)}
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
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar Mensagem" : "Nova Mensagem Programada"}
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
