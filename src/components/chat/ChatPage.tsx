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
  ArrowLeft,
  Store,
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
  return conv.customerName || "Loja";
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

  const handleBackToList = useCallback(() => {
    setSelectedChatId(null);
  }, []);

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
      className="flex h-full w-full relative overflow-hidden"
    >
      <AnimatePresence mode="wait">
        {selectedChatId ? (
          <motion.div
            key="conversation"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full w-full absolute inset-0 bg-background"
          >
            <ChatView
              chatId={selectedChatId}
              conversations={conversations}
              onBack={handleBackToList}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full w-full"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 space-y-4 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      Chats com Lojas
                      {totalUnread > 0 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                          {totalUnread}
                        </span>
                      )}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {conversations.length} {conversations.length === 1 ? "conversa" : "conversas"} recentes
                    </p>
                  </div>
                </div>
                <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setModalOpen(true)}>
                  Nova
                </Button>
              </div>

              <Input
                placeholder="Buscar conversa por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
            </div>

            {/* Lista de conversas em tela cheia */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
                    <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="mt-4 text-base font-medium text-foreground">
                    {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                    {search
                      ? "Tente buscar por outro nome ou telefone"
                      : "Inicie uma nova conversa com uma loja para começar a trocar mensagens"}
                  </p>
                  {!search && (
                    <Button
                      size="sm"
                      className="mt-4"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => setModalOpen(true)}
                    >
                      Nova conversa
                    </Button>
                  )}
                </div>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                >
                  {sorted.map((conv) => {
                    const name = getConvName(conv);
                    const time = getConvTime(conv);
                    const hasUnread = (conv.unreadCount || 0) > 0;
                    return (
                      <motion.button
                        key={conv.id}
                        variants={itemVariants}
                        onClick={() => handleSelectChat(conv.id!)}
                        className={cn(
                          "group relative text-left rounded-2xl p-4 transition-all duration-200 border",
                          hasUnread
                            ? "bg-accent-light/60 border-accent/30 hover:border-accent/50 hover:shadow-md"
                            : "bg-card border-border hover:border-accent/30 hover:shadow-md hover:-translate-y-0.5"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-semibold",
                              hasUnread
                                ? "bg-accent text-white"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {name.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                                <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {name}
                              </p>
                              {hasUnread && (
                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[10px] font-bold shrink-0">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                            <p className={cn(
                              "text-xs mt-0.5 truncate",
                              hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground"
                            )}>
                              {conv.lastMessage || "Sem mensagens ainda"}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              {conv.customerPhone ? (
                                <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {conv.customerPhone}
                                </p>
                              ) : <span />}
                              {time > 0 && (
                                <p className="text-[11px] text-muted-foreground/60">
                                  {formatDate(time)}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleDeleteChat(conv.id!, e)}
                            className="p-1.5 text-muted-foreground/40 hover:text-danger rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Excluir conversa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

// ── Chat View (tela cheia de conversa) ──

function ChatView({
  chatId,
  conversations,
  onBack,
}: {
  chatId: string;
  conversations: ChatConversation[];
  onBack: () => void;
}) {
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
      {/* Chat Header — em tela cheia, com botão voltar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0 bg-background">
        <button
          onClick={onBack}
          className="flex items-center justify-center h-10 w-10 rounded-xl hover:bg-muted text-foreground transition-colors shrink-0"
          title="Voltar para lista de conversas"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white text-base font-semibold shrink-0">
          {chatName.charAt(0)?.toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground truncate flex items-center gap-1.5">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            {chatName}
          </p>
          {chatPhone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {chatPhone}
            </p>
          )}
        </div>
      </div>

      {/* Messages Area — ocupa toda tela disponível */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3 max-w-2xl mx-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={cn("h-12 w-64 rounded-xl", i % 2 === 0 ? "ml-auto" : "")} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">Envie a primeira mensagem</p>
            <p className="mt-1 text-xs text-muted-foreground">Inicie a conversa com esta loja</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {messages.map((msg) => {
              const isMerchant = isMerchantMessage(msg);
              const senderDisplay = isMerchant ? "Você" : (chatName || "Loja");
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
                      "max-w-[75%] rounded-2xl px-4 py-2.5",
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
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area — fixa no fundo, em tela cheia */}
      <div className="px-6 py-3 border-t border-border shrink-0 bg-background">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="flex-1 h-11 rounded-xl border border-border bg-background px-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent transition-all"
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
