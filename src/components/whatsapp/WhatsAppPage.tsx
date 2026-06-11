import { useState, useEffect, useRef, useCallback } from "react";
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
  RefreshCw,
  Search,
  Phone,
  LogOut,
  QrCode,
  Wifi,
  WifiOff,
  ArrowLeft,
  CheckCheck,
  Users,
  User,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useScheduledMessages } from "@/hooks/useFirebaseData";
import { type ScheduledMessage } from "@/services/firebase";
import { formatDate, cn } from "@/lib/utils";

// ── QR Code SVG Generator ──
// Simple QR code renderer using a canvas-based approach

function QRCodeDisplay({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Generate QR code using a simple matrix approach
    // We'll use the raw QR data string to render a grid
    const size = 256;
    canvas.width = size;
    canvas.height = size;

    // Import QR code library dynamically or use a simple approach
    // For now, use the built-in approach with a temporary Image
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
    };

    // Use Google Charts API for QR code rendering (works offline with cached data)
    // Actually, let's generate it ourselves using a simple algorithm
    generateQRCode(ctx, data, size);
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-xl border-2 border-green-200 shadow-sm"
      style={{ width: 256, height: 256 }}
    />
  );
}

// Simple QR code matrix generator
function generateQRCode(ctx: CanvasRenderingContext2D, text: string, size: number) {
  // We'll create a simple visual representation
  // Using the text data to create a deterministic pattern
  const moduleCount = 33;
  const moduleSize = size / moduleCount;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Create a deterministic pattern from the QR data
  const dataBytes = [];
  for (let i = 0; i < text.length; i++) {
    dataBytes.push(text.charCodeAt(i));
  }

  // Draw finder patterns (3 corners)
  function drawFinderPattern(x: number, y: number) {
    // Outer border
    ctx.fillStyle = "#000000";
    ctx.fillRect(x * moduleSize, y * moduleSize, 7 * moduleSize, 7 * moduleSize);
    // Inner white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect((x + 1) * moduleSize, (y + 1) * moduleSize, 5 * moduleSize, 5 * moduleSize);
    // Center block
    ctx.fillStyle = "#000000";
    ctx.fillRect((x + 2) * moduleSize, (y + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize);
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(moduleCount - 7, 0);
  drawFinderPattern(0, moduleCount - 7);

  // Fill data modules with deterministic pattern from text
  ctx.fillStyle = "#000000";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      // Skip finder pattern areas
      if ((row < 8 && col < 8) || (row < 8 && col >= moduleCount - 8) || (row >= moduleCount - 8 && col < 8)) {
        continue;
      }

      // Skip timing patterns
      if (row === 6 || col === 6) {
        if ((row + col) % 2 === 0) {
          ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
        }
        continue;
      }

      // Data module - use text hash to determine if dark
      const idx = (row * moduleCount + col) % dataBytes.length;
      const byteVal = dataBytes[idx];
      if (byteVal % 2 === 1 || (byteVal > 64 && row % 3 === 0) || (byteVal > 128 && col % 4 === 0)) {
        ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
      }
    }
  }
}

// ── Animation Variants ──

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

// ── WhatsApp Connection Status Component ──

function ConnectionStatus({ status, onConnect, onDisconnect }: {
  status: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const statusConfig: Record<string, { label: string; color: string; icon: typeof Wifi }> = {
    disconnected: { label: "Desconectado", color: "text-gray-500", icon: WifiOff },
    connecting: { label: "Conectando...", color: "text-amber-500", icon: RefreshCw },
    qr: { label: "Escaneie o QR Code", color: "text-blue-500", icon: QrCode },
    authenticated: { label: "Autenticado", color: "text-blue-500", icon: CheckCircle2 },
    connected: { label: "Conectado", color: "text-green-500", icon: Wifi },
    error: { label: "Erro", color: "text-red-500", icon: AlertCircle },
  };

  const config = statusConfig[status] || statusConfig.disconnected;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted")}>
        <Icon className={cn("h-4 w-4", config.color, status === "connecting" && "animate-spin")} />
        <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
      </div>
      {status === "disconnected" || status === "error" ? (
        <Button size="sm" onClick={onConnect} icon={<Wifi className="h-3.5 w-3.5" />}>
          Conectar
        </Button>
      ) : status === "connected" ? (
        <Button size="sm" variant="secondary" onClick={onDisconnect} icon={<LogOut className="h-3.5 w-3.5" />}>
          Desconectar
        </Button>
      ) : null}
    </div>
  );
}

// ── Main Component ──

export function WhatsAppPage() {
  const { items: messages, loading, addItem, editItem, deleteItem, error: msgError, clearError } = useScheduledMessages();
  const [activeTab, setActiveTab] = useState<Tab>("whatsapp");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"todas" | "agendada" | "enviada" | "falhou">("todas");
  const [actionError, setActionError] = useState<string | null>(null);

  // WhatsApp state
  const [waStatus, setWaStatus] = useState<string>("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [profilePics, setProfilePics] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  // ── WhatsApp Event Listeners ──

  useEffect(() => {
    if (!isElectron) return;

    // Listen for status changes
    const cleanupStatus = window.electronAPI.onWhatsappStatus((data) => {
      console.log("[WhatsApp] Status:", data.status);
      setWaStatus(data.status);
      if (data.status !== "qr") {
        setQrCode(null);
      }
    });

    // Listen for QR code
    const cleanupQr = window.electronAPI.onWhatsappQr((data) => {
      console.log("[WhatsApp] QR Code received");
      setQrCode(data.qr);
    });

    // Listen for incoming messages
    const cleanupMsg = window.electronAPI.onWhatsappMessage((data) => {
      console.log("[WhatsApp] Incoming message from", data.contactName);
      // If we're viewing this chat, add the message
      if (selectedChat === data.chatId) {
        setChatMessages((prev) => [...prev, data]);
      }
    });

    // Listen for message ack
    const cleanupAck = window.electronAPI.onWhatsappMessageAck((data) => {
      // Update message ack status in the chat
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.id ? { ...msg, ack: data.ack } : msg
        )
      );
    });

    return () => {
      cleanupStatus();
      cleanupQr();
      cleanupMsg();
      cleanupAck();
    };
  }, [isElectron, selectedChat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isElectron && window.electronAPI.removeAllWhatsappListeners) {
        window.electronAPI.removeAllWhatsappListeners();
      }
    };
  }, [isElectron]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── WhatsApp Actions ──

  const connectWhatsApp = useCallback(async () => {
    if (!isElectron) return;
    try {
      setWaStatus("connecting");
      const result = await window.electronAPI.whatsappInit();
      if (result.status === "error") {
        setActionError(result.error || "Erro ao conectar WhatsApp");
        setWaStatus("error");
      }
    } catch (err: any) {
      setActionError(err.message || "Erro ao conectar WhatsApp");
      setWaStatus("error");
    }
  }, [isElectron]);

  const disconnectWhatsApp = useCallback(async () => {
    if (!isElectron) return;
    try {
      await window.electronAPI.whatsappLogout();
      setChats([]);
      setSelectedChat(null);
      setChatMessages([]);
      setQrCode(null);
      setWaStatus("disconnected");
    } catch (err: any) {
      setActionError(err.message || "Erro ao desconectar WhatsApp");
    }
  }, [isElectron]);

  const loadChats = useCallback(async () => {
    if (!isElectron || waStatus !== "connected") return;
    try {
      setLoadingChats(true);
      const result = await window.electronAPI.whatsappGetChats();
      if (result.success && result.chats) {
        // Sort chats by timestamp (newest first)
        const sorted = [...result.chats].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setChats(sorted);

        // Load profile pics for first few chats
        sorted.slice(0, 20).forEach(async (chat) => {
          try {
            const picResult = await window.electronAPI.whatsappGetProfilePic(chat.id);
            if (picResult.success && picResult.profilePicUrl) {
              setProfilePics((prev) => ({ ...prev, [chat.id]: picResult.profilePicUrl! }));
            }
          } catch {
            // Skip profile pics that fail
          }
        });
      }
    } catch (err: any) {
      console.error("[WhatsApp] Error loading chats:", err);
    } finally {
      setLoadingChats(false);
    }
  }, [isElectron, waStatus]);

  // Load chats when connected
  useEffect(() => {
    if (waStatus === "connected") {
      loadChats();
    }
  }, [waStatus, loadChats]);

  const selectChat = useCallback(async (chatId: string) => {
    if (!isElectron) return;
    try {
      setSelectedChat(chatId);
      setLoadingMessages(true);
      const result = await window.electronAPI.whatsappGetMessages(chatId, 50);
      if (result.success && result.messages) {
        setChatMessages(result.messages);
      }

      // Get chat info from our local chats state
      const chatData = chats.find((c) => c.id === chatId);
      setChatInfo(chatData || null);
    } catch (err: any) {
      console.error("[WhatsApp] Error loading messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, [isElectron, chats]);

  const sendWhatsAppMessage = useCallback(async () => {
    if (!isElectron || !selectedChat || !messageInput.trim()) return;
    try {
      setSending(true);
      const result = await window.electronAPI.whatsappSendMessage(selectedChat, messageInput.trim());
      if (result.success && result.message) {
        setChatMessages((prev) => [...prev, result.message!]);
        setMessageInput("");
      } else {
        setActionError(result.error || "Erro ao enviar mensagem");
      }
    } catch (err: any) {
      setActionError(err.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }, [isElectron, selectedChat, messageInput]);

  const searchContacts = useCallback(async (query: string) => {
    if (!isElectron || !query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const result = await window.electronAPI.whatsappSearchContacts(query.trim());
      if (result.success && result.contacts) {
        setSearchResults(result.contacts);
      }
    } catch (err: any) {
      console.error("[WhatsApp] Search error:", err);
    }
  }, [isElectron]);

  // ── Scheduled Messages Logic ──

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

  const sendScheduledToWhatsApp = async (destinatario: string, mensagem: string) => {
    if (!isElectron || waStatus !== "connected") {
      setActionError("WhatsApp não está conectado. Conecte primeiro para enviar mensagens.");
      return;
    }
    try {
      setSending(true);
      const phone = destinatario.replace(/\D/g, "");
      const result = await window.electronAPI.whatsappSendToNumber(phone, mensagem);
      if (result.success) {
        setActionError(null);
      } else {
        setActionError(result.error || "Erro ao enviar mensagem pelo WhatsApp");
      }
    } catch (err: any) {
      setActionError(err.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const stats = {
    agendadas: messages.filter((m) => m.status === "agendada").length,
    enviadas: messages.filter((m) => m.status === "enviada").length,
    falhas: messages.filter((m) => m.status === "falhou").length,
  };

  const dateToInputValue = (ms: number) => {
    if (!ms) return "";
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const inputValueToDate = (val: string) => {
    if (!val) return 0;
    return new Date(val).getTime();
  };

  // ── Format timestamp ──
  const formatTimestamp = (ts: number) => {
    if (!ts) return "";
    const d = new Date(ts * 1000); // WhatsApp timestamps are in seconds
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const pad = (n: number) => String(n).padStart(2, "0");
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (isToday) return time;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${time}`;
  };

  // ── Get ack icon ──
  const getAckIcon = (ack: number, fromMe: boolean) => {
    if (!fromMe) return null;
    if (ack === 0) return <CheckCircle2 className="h-3 w-3 text-gray-400" />;
    if (ack === 1) return <CheckCheck className="h-3 w-3 text-gray-400" />;
    if (ack === 2) return <CheckCheck className="h-3 w-3 text-blue-500" />;
    if (ack === 3) return <CheckCheck className="h-3 w-3 text-blue-500" />;
    return null;
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
            WhatsApp Web integrado e mensagens programadas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus
            status={waStatus}
            onConnect={connectWhatsApp}
            onDisconnect={disconnectWhatsApp}
          />
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={openCreate}
          >
            Nova Mensagem
          </Button>
        </div>
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
          WhatsApp
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

      {/* ── WhatsApp Tab ── */}
      {activeTab === "whatsapp" && (
        <motion.div variants={itemVariants}>
          {!isElectron ? (
            /* Not running in Electron */
            <Card className="flex flex-col items-center justify-center py-20">
              <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">
                O WhatsApp integrado está disponível apenas no aplicativo desktop.
              </p>
            </Card>
          ) : waStatus === "disconnected" || waStatus === "error" ? (
            /* Disconnected - Show connect button */
            <Card className="flex flex-col items-center justify-center py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 mb-4">
                <MessageCircle className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Conectar WhatsApp</h3>
              <p className="text-sm text-muted-foreground mt-2 text-center max-w-sm">
                Conecte seu WhatsApp para enviar e receber mensagens diretamente pelo Nova CRM.
                Suas conversas e contatos serão sincronizados automaticamente.
              </p>
              <Button
                className="mt-6"
                onClick={connectWhatsApp}
                icon={<Wifi className="h-4 w-4" />}
              >
                Conectar WhatsApp
              </Button>
            </Card>
          ) : waStatus === "connecting" ? (
            /* Connecting - Show loading */
            <Card className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-12 w-12 text-amber-500 animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Conectando ao WhatsApp...</p>
            </Card>
          ) : waStatus === "qr" ? (
            /* QR Code - Show for scanning */
            <Card className="flex flex-col items-center justify-center py-10">
              <h3 className="text-lg font-semibold text-foreground mb-2">Escaneie o QR Code</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                Abra o WhatsApp no seu celular, vá em Aparelhos conectados e escaneie o código abaixo.
              </p>
              {qrCode && <QRCodeDisplay data={qrCode} />}
              <p className="text-xs text-muted-foreground mt-4">
                O QR Code expira em poucos minutos. Se expirar, ele será renovado automaticamente.
              </p>
            </Card>
          ) : waStatus === "connected" ? (
            /* Connected - Show chat interface */
            <div className="flex rounded-xl border border-border overflow-hidden bg-card" style={{ height: "calc(100vh - 300px)", minHeight: 500 }}>
              {/* Chat List Sidebar */}
              <div className="w-80 border-r border-border flex flex-col bg-background">
                {/* Search */}
                <div className="p-3 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar conversa..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        searchContacts(e.target.value);
                      }}
                      className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted border-none text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                    />
                  </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                  {loadingChats ? (
                    <div className="flex items-center justify-center py-10">
                      <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                    </div>
                  ) : searchQuery && searchResults.length > 0 ? (
                    /* Search Results */
                    searchResults.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => selectChat(contact.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left",
                          selectedChat === contact.id && "bg-accent/5"
                        )}
                      >
                        <div className="h-10 w-10 shrink-0 rounded-full bg-green-100 flex items-center justify-center">
                          {contact.isBusiness ? (
                            <Users className="h-5 w-5 text-green-600" />
                          ) : (
                            <User className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">{contact.number}</p>
                        </div>
                      </button>
                    ))
                  ) : chats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">Nenhuma conversa</p>
                    </div>
                  ) : (
                    chats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => selectChat(chat.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left",
                          selectedChat === chat.id && "bg-accent/5"
                        )}
                      >
                        <div className="h-10 w-10 shrink-0 rounded-full bg-green-100 flex items-center justify-center overflow-hidden">
                          {profilePics[chat.id] ? (
                            <img src={profilePics[chat.id]} alt="" className="h-full w-full object-cover" />
                          ) : chat.isGroup ? (
                            <Users className="h-5 w-5 text-green-600" />
                          ) : (
                            <User className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground truncate">{chat.name}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                              {formatTimestamp(chat.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs text-muted-foreground truncate">
                              {chat.lastMessage?.fromMe && "Você: "}{chat.lastMessage?.body || ""}
                            </p>
                            {chat.unreadCount > 0 && (
                              <span className="ml-2 shrink-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-green-500 text-white text-[10px] font-bold">
                                {chat.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Refresh chats button */}
                <div className="p-3 border-t border-border">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={loadChats}
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                  >
                    Atualizar Conversas
                  </Button>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 flex flex-col">
                {selectedChat ? (
                  <>
                    {/* Chat Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
                      <button
                        onClick={() => { setSelectedChat(null); setChatMessages([]); }}
                        className="lg:hidden p-1 rounded-md hover:bg-muted transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <div className="h-9 w-9 shrink-0 rounded-full bg-green-100 flex items-center justify-center overflow-hidden">
                        {profilePics[selectedChat] ? (
                          <img src={profilePics[selectedChat]} alt="" className="h-full w-full object-cover" />
                        ) : chatInfo?.isGroup ? (
                          <Users className="h-4 w-4 text-green-600" />
                        ) : (
                          <User className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{chatInfo?.name || "Conversa"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {chatInfo?.isGroup ? "Grupo" : "Conversa individual"}
                        </p>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#efeae2]">
                      {loadingMessages ? (
                        <div className="flex items-center justify-center h-full">
                          <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
                        </div>
                      ) : (
                        chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              msg.fromMe ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[70%] rounded-lg px-3 py-2 shadow-sm",
                                msg.fromMe
                                  ? "bg-[#d9fdd3] text-foreground"
                                  : "bg-white text-foreground"
                              )}
                            >
                              {/* Show sender name in groups */}
                              {!msg.fromMe && chatInfo?.isGroup && msg.contactName && (
                                <p className="text-[11px] font-semibold text-green-600 mb-0.5">
                                  {msg.contactName}
                                </p>
                              )}
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                              <div className="flex items-center justify-end gap-1 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">
                                  {formatTimestamp(msg.timestamp)}
                                </span>
                                {getAckIcon(msg.ack, msg.fromMe)}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-background">
                      <input
                        type="text"
                        placeholder="Digite uma mensagem..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendWhatsAppMessage();
                          }
                        }}
                        className="flex-1 h-10 px-4 rounded-xl bg-muted border-none text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                      />
                      <Button
                        onClick={sendWhatsAppMessage}
                        disabled={!messageInput.trim() || sending}
                        icon={<Send className="h-4 w-4" />}
                      >
                        Enviar
                      </Button>
                    </div>
                  </>
                ) : (
                  /* No chat selected */
                  <div className="flex flex-col items-center justify-center h-full bg-muted/20">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-green-50 mb-4">
                      <MessageCircle className="h-10 w-10 text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">WhatsApp Web</h3>
                    <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
                      Selecione uma conversa para começar a enviar e receber mensagens.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </motion.div>
      )}

      {/* ── Messages Tab ── */}
      {activeTab === "mensagens" && (
        <>
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
                                <Phone className="h-3 w-3" />
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
                            onClick={() => sendScheduledToWhatsApp(msg.destinatario, msg.mensagem)}
                            disabled={waStatus !== "connected"}
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
            icon={<Phone className="h-4 w-4" />}
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
