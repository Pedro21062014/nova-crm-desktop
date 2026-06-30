import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Plus,
  Send,
  Search,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Card, Button, Input, Badge, Skeleton, Modal } from "@/components/ui";
import { useChats, useChatMessages, getMsgTime, isMerchantMessage } from "@/hooks/useChat";
import { useClients } from "@/hooks/useFirebaseData";
import { type ChatConversation } from "@/services/firebase";
import { formatDate, cn } from "@/lib/utils";
import { toMs } from "@/services/firebase";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// Helpers for field name compatibility
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

function cName(c: any): string { return safeStr(c.nome || c.name); }
function cPhone(c: any): string { return safeStr(c.telefone || c.phone); }

/**
 * Get the display name for a conversation.
 * CRM stores `customerName`, some may have different field names.
 */
function getConvName(conv: ChatConversation): string {
  return conv.customerName || "Cliente";
}

/**
 * Get the last message time as a number for sorting and display.
 * CRM uses `updatedAt` (Firestore Timestamp), nova-crm uses `lastMessageTime` (number).
 */
function getConvTime(conv: ChatConversation): number {
  if (conv.updatedAt) return toMs(conv.updatedAt);
  if (conv.lastMessageTime) return conv.lastMessageTime;
  return 0;
}

export function ChatPage() {
  const { conversations, loading, createChat, deleteChat, markRead, error: chatsError, clearError } = useChats();
  const { items: clients } = useClients();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newChatForm, setNewChatForm] = useState({ customerName: "", customerPhone: "" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return conversations;
    return conversations.filter((c) =>
      getConvName(c).toLowerCase().includes(search.toLowerCase()) ||
      (c.customerPhone || "").includes(search)
    );
  }, [conversations, search]);

  // Sort by last message time (most recent first)
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => getConvTime(b) - getConvTime(a)),
    [filtered]
  );

  const totalUnread = useMemo(() =>
    conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    markRead(chatId);
  }, [markRead]);

  const handleCreateChat = async () => {
    setSaving(true);
    setActionError(null);
    try {
      const chatId = await createChat({
        customerName: newChatForm.customerName,
        customerPhone: newChatForm.customerPhone,
        lastMessage: "",
        lastMessageSender: "merchant",
        updatedAt: Date.now(),
        unreadCount: 0,
      });
      setModalOpen(false);
      setNewChatForm({ customerName: "", customerPhone: "" });
      setSelectedChatId(chatId);
    } catch (err: any) {
      setActionError(err.message || "Erro ao criar conversa");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Deseja excluir esta conversa permanentemente?")) {
      await deleteChat(chatId);
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-full"
    >
      {/* Left Panel - Conversation List */}
      <div className="w-80 border-r border-border flex flex-col shrink-0">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              Chat
              {totalUnread > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                  {totalUnread}
                </span>
              )}
            </h1>
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setModalOpen(true)}>
              Novo
            </Button>
          </div>
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhuma conversa encontrada
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {sorted.map((conv) => {
                const name = getConvName(conv);
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectChat(conv.id!)}
                    className={cn(
                      "w-full text-left rounded-xl p-3 transition-all duration-200 group",
                      selectedChatId === conv.id
                        ? "bg-accent-light border border-accent/20"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
                          selectedChatId === conv.id
                            ? "bg-accent text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {name.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground truncate">
                            {name}
                          </p>
                          {conv.unreadCount && conv.unreadCount > 0 ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {conv.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage || "Sem mensagens"}
                        </p>
                        {getConvTime(conv) > 0 && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {formatDate(getConvTime(conv))}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteChat(conv.id!, e)}
                        className="p-1.5 text-muted-foreground/40 hover:text-danger rounded-full opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="Excluir conversa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat Messages */}
      <div className="flex-1 flex flex-col">
        {selectedChatId ? (
          <ChatView chatId={selectedChatId} conversations={conversations} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-14 w-14 text-muted-foreground/20" />
            <p className="mt-4 text-sm text-muted-foreground">
              Selecione uma conversa para começar
            </p>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova Conversa"
        size="sm"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}
          <Input
            label="Nome do Cliente"
            value={newChatForm.customerName}
            onChange={(e) => setNewChatForm({ ...newChatForm, customerName: e.target.value })}
            placeholder="Nome completo"
            icon={<User className="h-4 w-4" />}
          />
          <Input
            label="Telefone (WhatsApp)"
            value={newChatForm.customerPhone}
            onChange={(e) => setNewChatForm({ ...newChatForm, customerPhone: e.target.value })}
            placeholder="5511999999999"
            icon={<Phone className="h-4 w-4" />}
          />

          {/* Quick select from existing clients */}
          {clients.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground/80">Ou selecione um cliente</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    const client = clients.find((c) => c.id === e.target.value);
                    if (client) {
                      setNewChatForm({
                        customerName: cName(client),
                        customerPhone: cPhone(client),
                      });
                    }
                  }
                }}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
              >
                <option value="">Selecione...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{cName(c)}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateChat}
              loading={saving}
              disabled={!newChatForm.customerName.trim()}
            >
              Criar Conversa
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

// ── Chat View (messages area) ──

function ChatView({ chatId, conversations }: { chatId: string; conversations: ChatConversation[] }) {
  const { messages, loading, sendMessage } = useChatMessages(chatId);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentChat = useMemo(() =>
    conversations.find((c) => c.id === chatId),
    [conversations, chatId]
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    setSending(true);
    try {
      await sendMessage(inputText.trim());
      setInputText("");
      inputRef.current?.focus();
    } catch (err: any) {
      console.error("Erro ao enviar mensagem:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const chatName = getConvName(currentChat || {} as ChatConversation);
  const chatPhone = currentChat?.customerPhone;

  return (
    <>
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-medium">
          {chatName.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{chatName}</p>
          {chatPhone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {chatPhone}
            </p>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={cn("h-12 w-64 rounded-xl", i % 2 === 0 ? "ml-auto" : "")} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20" />
            <p className="mt-3 text-sm text-muted-foreground">
              Envie a primeira mensagem
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMerchant = isMerchantMessage(msg);
            // For customer messages, show the customer name from the conversation
            const senderDisplay = isMerchant ? "Você" : (chatName || "Cliente");
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={cn("flex", isMerchant ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2.5",
                    isMerchant
                      ? "bg-accent text-white rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {!isMerchant && (
                    <p className="text-xs font-medium mb-0.5 text-muted-foreground">
                      {senderDisplay}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <div className={cn("flex items-center gap-1 mt-1", isMerchant ? "justify-end" : "")}>
                    <span className={cn("text-[10px]", isMerchant ? "text-white/60" : "text-muted-foreground/60")}>
                      {formatMsgTime(msg)}
                    </span>
                    {isMerchant && msg.read && (
                      <CheckCircle2 className="h-3 w-3 text-white/60" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="flex-1 h-10 rounded-xl border border-border bg-background px-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
          />
          <Button
            onClick={handleSend}
            loading={sending}
            disabled={!inputText.trim()}
            icon={<Send className="h-4 w-4" />}
          >
            Enviar
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Format a message timestamp for display.
 * Handles both CRM (`createdAt`) and nova-crm (`timestamp`) formats.
 */
function formatMsgTime(msg: any): string {
  const ms = getMsgTime(msg);
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
