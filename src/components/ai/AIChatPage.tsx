import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Trash2, Plus, AlertCircle, X,
  ArrowDown, RotateCcw, Copy, Check,
} from "lucide-react";

// ── Types ──

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

// ── CSS Animations ──

const STYLE_ID = "nova-ai-animations-v2";

function injectAnimations() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes gradient-shift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes thinking-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    @keyframes shimmer-line {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(200%); }
    }
    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ai-gradient-text {
      background: linear-gradient(90deg, #a855f7, #6366f1, #3b82f6, #a855f7);
      background-size: 300% 100%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradient-shift 4s ease infinite;
    }
    .ai-gradient-bar {
      background: linear-gradient(90deg, #a855f7, #6366f1, #3b82f6, #a855f7);
      background-size: 300% 100%;
      animation: gradient-shift 2s ease infinite;
    }
    .ai-thinking-dot {
      animation: thinking-pulse 1.2s infinite ease-in-out both;
    }
    .ai-thinking-dot:nth-child(1) { animation-delay: 0s; }
    .ai-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
    .ai-thinking-dot:nth-child(3) { animation-delay: 0.4s; }
    .ai-cursor::after {
      content: '';
      display: inline-block;
      width: 2px;
      height: 1em;
      background: #a855f7;
      margin-left: 2px;
      vertical-align: text-bottom;
      animation: cursor-blink 0.8s step-end infinite;
    }
    .ai-fade-in {
      animation: fade-in 0.25s ease-out;
    }
    /* Scrollbar */
    .ai-scroll::-webkit-scrollbar { width: 6px; }
    .ai-scroll::-webkit-scrollbar-track { background: transparent; }
    .ai-scroll::-webkit-scrollbar-thumb { background: rgba(100,100,100,0.2); border-radius: 3px; }
    .ai-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100,100,100,0.35); }
    /* Sidebar scrollbar */
    .ai-sidebar-scroll::-webkit-scrollbar { width: 4px; }
    .ai-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
    .ai-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
    /* Markdown */
    .ai-md p { margin-bottom: 0.6em; }
    .ai-md p:last-child { margin-bottom: 0; }
    .ai-md code {
      background: rgba(139,92,246,0.1);
      color: #c4b5fd;
      padding: 0.15em 0.45em;
      border-radius: 5px;
      font-size: 0.87em;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }
    .ai-md pre {
      background: #1e1b2e;
      border: 1px solid rgba(139,92,246,0.15);
      padding: 1em;
      border-radius: 10px;
      overflow-x: auto;
      margin: 0.75em 0;
    }
    .ai-md pre code {
      background: none;
      padding: 0;
      color: #e2e8f0;
    }
    .ai-md ul, .ai-md ol { padding-left: 1.5em; margin: 0.5em 0; }
    .ai-md li { margin-bottom: 0.3em; }
    .ai-md strong { font-weight: 600; color: #f1f5f9; }
    .ai-md em { color: #cbd5e1; }
    .ai-md h1,.ai-md h2,.ai-md h3 { font-weight: 700; margin-top: 0.8em; margin-bottom: 0.3em; color: #f8fafc; }
    .ai-md h1 { font-size: 1.3em; }
    .ai-md h2 { font-size: 1.15em; }
    .ai-md h3 { font-size: 1.05em; }
    .ai-md blockquote {
      border-left: 3px solid #7c3aed;
      padding-left: 0.8em;
      margin: 0.5em 0;
      color: #94a3b8;
    }
  `;
  document.head.appendChild(style);
}

// ── Markdown ──

function renderMarkdown(text: string): string {
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';
  return html;
}

// ── Suggestions ──

const suggestions = [
  { emoji: "💡", title: "Aumentar vendas", desc: "Ideias práticas para aumentar minhas vendas" },
  { emoji: "📱", title: "Presença digital", desc: "Como melhorar minha presença online" },
  { emoji: "📊", title: "Análise de métricas", desc: "Ajude-me a analisar métricas do meu negócio" },
  { emoji: "🎯", title: "Estratégia de marketing", desc: "Crie uma estratégia de marketing eficaz" },
];

// ── Main Component ──

export function AIChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const messages = activeConv?.messages || [];

  useEffect(() => { injectAnimations(); }, []);

  // Scroll helpers
  const scrollToBottom = useCallback((smooth = true) => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeConvId]);

  useEffect(() => { scrollToBottom(); }, [messages.length, streamingContent, isStreaming, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  // ── New conversation ──
  const newConversation = () => {
    const conv: Conversation = {
      id: Date.now().toString(),
      title: "Nova conversa",
      messages: [],
      createdAt: Date.now(),
    };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
    setStreamingContent("");
    setError(null);
  };

  // ── Send message ──
  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || isStreaming) return;

    setInput("");
    setError(null);

    // Create conversation if needed
    let convId = activeConvId;
    let convs = [...conversations];

    if (!convId) {
      const conv: Conversation = {
        id: Date.now().toString(),
        title: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
        messages: [],
        createdAt: Date.now(),
      };
      convs = [conv, ...convs];
      convId = conv.id;
      setActiveConvId(convId);
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content, timestamp: Date.now() };

    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? content.slice(0, 40) + (content.length > 40 ? "..." : "") : c.title } : c
    ));

    setIsStreaming(true);
    setStreamingContent("");

    const allMessages = [...(convs.find(c => c.id === convId)?.messages || []), userMsg];

    const apiMessages = [
      { role: "system", content: "Você é a Nova IA, uma assistente inteligente e amigável do Nova CRM. Você ajuda lojistas e empreendedores com dicas de negócios, marketing, vendas, atendimento ao cliente e gestão. Responda sempre em português brasileiro, de forma clara, prática e bem estruturada. Use formatação Markdown quando útil." },
      ...allMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    try {
      const api = (window as any).electronAPI;
      if (!api?.aiChat) throw new Error("API de IA não disponível.");

      let accumulated = "";

      const removeChunk = api.onAiChunk((chunk: string) => {
        accumulated += chunk;
        setStreamingContent(accumulated);
      });

      const removeDone = api.onAiDone(() => {
        const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: accumulated, timestamp: Date.now() };
        setConversations(prev => prev.map(c =>
          c.id === convId ? { ...c, messages: [...c.messages, assistantMsg] } : c
        ));
        setStreamingContent("");
        setIsStreaming(false);
        cleanup();
      });

      const removeError = api.onAiError((err: string) => {
        setError(err);
        setIsStreaming(false);
        setStreamingContent("");
        cleanup();
      });

      const cleanup = () => { removeChunk(); removeDone(); removeError(); };

      await api.aiChat(apiMessages);
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com a IA.");
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [input, conversations, activeConvId, isStreaming]);

  // ── Delete conversation ──
  const deleteConv = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
  };

  // ── Copy ──
  const copyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Retry ──
  const retryLast = () => {
    if (!activeConv) return;
    const lastUser = [...activeConv.messages].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    setConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c;
      const lastAi = c.messages.findLastIndex(m => m.role === "assistant");
      if (lastAi >= 0) return { ...c, messages: c.messages.slice(0, lastAi) };
      return c;
    }));
    setTimeout(() => sendMessage(lastUser.content), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full overflow-hidden relative" style={{ background: "#0f0d1a" }}>
      {/* ── Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="absolute inset-0 bg-black/50 z-30 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="absolute md:relative z-40 h-full w-[280px] flex flex-col shrink-0"
              style={{ background: "#171428" }}
            >
              {/* New Chat Button */}
              <div className="p-3">
                <button
                  onClick={newConversation}
                  className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/10 text-sm font-medium text-white/80 hover:bg-white/5 hover:border-white/20 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Nova conversa
                </button>
              </div>

              {/* Conversations list */}
              <div className="flex-1 overflow-y-auto ai-sidebar-scroll px-2 pb-3 space-y-0.5">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => { setActiveConvId(conv.id); setSidebarOpen(false); }}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm ${
                      conv.id === activeConvId
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate flex-1">{conv.title}</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteConv(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Sidebar footer */}
              <div className="p-3 border-t border-white/5">
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/80">Nova IA</p>
                    <p className="text-[10px] text-white/30">Nemotron 120B</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: "#0f0d1a" }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            <span className="text-sm font-medium hidden sm:inline">
              {activeConv?.title || "Nova IA"}
            </span>
          </button>

          {!sidebarOpen && (
            <button
              onClick={newConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova conversa
            </button>
          )}
        </div>

        {/* ── Chat Messages ── */}
        <div ref={chatRef} className="flex-1 overflow-y-auto ai-scroll">
          {!hasMessages && !isStreaming ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center h-full px-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center max-w-xl"
              >
                {/* Logo */}
                <div className="relative mx-auto w-20 h-20 mb-8">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 opacity-25 blur-2xl scale-125" />
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-white" />
                  </div>
                </div>

                <h1 className="text-3xl font-bold text-white mb-2">
                  Nova <span className="ai-gradient-text">IA</span>
                </h1>
                <p className="text-white/40 text-sm mb-10 leading-relaxed">
                  Sua assistente inteligente para impulsionar seu negócio
                </p>

                {/* Suggestion cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                  {suggestions.map((s, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.06 }}
                      onClick={() => sendMessage(s.desc)}
                      className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all text-left group"
                    >
                      <span className="text-lg mt-0.5 shrink-0">{s.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{s.title}</p>
                        <p className="text-xs text-white/30 mt-0.5 line-clamp-2">{s.desc}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            /* ── Messages List ── */
            <div className="max-w-3xl mx-auto px-4 py-4">
              {messages.map((msg) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  copiedId={copiedId}
                  onCopy={copyMsg}
                />
              ))}

              {/* Streaming */}
              {isStreaming && (
                <div className="ai-fade-in">
                  {streamingContent ? (
                    <MessageRow
                      msg={{ id: "streaming", role: "assistant", content: streamingContent, timestamp: Date.now() }}
                      isStreaming
                      copiedId={copiedId}
                      onCopy={copyMsg}
                    />
                  ) : (
                    /* Thinking indicator */
                    <div className="flex gap-4 py-5 px-2">
                      <div className="shrink-0 mt-1">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-purple-400 ai-thinking-dot" />
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 ai-thinking-dot" />
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 ai-thinking-dot" />
                          </div>
                          <span className="text-xs ai-gradient-text font-medium">Pensando...</span>
                        </div>
                        {/* Gradient progress bar */}
                        <div className="mt-3 h-[2px] w-40 rounded-full overflow-hidden bg-white/5">
                          <div className="h-full ai-gradient-bar rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Scroll to bottom ── */}
        <AnimatePresence>
          {showScrollDown && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scrollToBottom()}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10 h-8 w-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ArrowDown className="h-3.5 w-3.5 text-white/70" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mx-4 mb-2 flex items-center gap-2.5 rounded-xl px-4 py-2.5"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-300">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Retry */}
        {error && !isStreaming && hasMessages && (
          <div className="flex justify-center mb-2">
            <button
              onClick={retryLast}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── Input Area ── */}
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <div
              className="relative flex items-end gap-2 rounded-2xl p-2 transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Envie uma mensagem..."
                rows={1}
                disabled={isStreaming}
                className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-white/90 placeholder:text-white/25 focus:outline-none disabled:opacity-40 max-h-[200px]"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isStreaming}
                className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
                  input.trim() && !isStreaming
                    ? "bg-white text-[#0f0d1a] hover:bg-white/90 active:scale-95"
                    : "bg-white/5 text-white/20 cursor-not-allowed"
                }`}
              >
                {isStreaming ? (
                  <div className="h-4 w-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-center text-[10px] text-white/20 mt-2.5">
              Nova IA pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Message Row (ChatGPT style: full-width rows, avatar on left for AI) ──

function MessageRow({
  msg,
  isStreaming,
  copiedId,
  onCopy,
}: {
  msg: ChatMessage;
  isStreaming?: boolean;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`py-4 ai-fade-in group ${isUser ? "" : ""}`}>
      {/* User message */}
      {isUser && (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed text-white"
            style={{ background: "rgba(139,92,246,0.2)" }}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      )}

      {/* AI message */}
      {!isUser && (
        <div className="flex gap-4 px-2">
          {/* Avatar */}
          <div className="shrink-0 mt-1">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className={`text-sm leading-relaxed text-white/85 ai-md ${isStreaming ? "ai-cursor" : ""}`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
            {/* Actions */}
            {!isStreaming && msg.id !== "streaming" && (
              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onCopy(msg.id, msg.content)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
                >
                  {copiedId === msg.id ? (
                    <><Check className="h-3 w-3" /> Copiado</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copiar</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
