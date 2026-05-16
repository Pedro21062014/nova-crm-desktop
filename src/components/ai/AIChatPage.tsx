import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Trash2, Bot, User, AlertCircle, X,
  ArrowDown, RotateCcw, Copy, Check,
} from "lucide-react";

// ── Types ──

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

// ── Gradient Animation Keyframes (CSS) ──
// Injected once via useEffect

const STYLE_ID = "nova-ai-animations";

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
    @keyframes thinking-bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    @keyframes shimmer-line {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ai-thinking-dot {
      animation: thinking-bounce 1.4s infinite ease-in-out both;
    }
    .ai-thinking-dot:nth-child(1) { animation-delay: -0.32s; }
    .ai-thinking-dot:nth-child(2) { animation-delay: -0.16s; }
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
    .ai-shimmer {
      position: relative;
      overflow: hidden;
    }
    .ai-shimmer::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
      animation: shimmer-line 2s infinite;
    }
    .ai-msg-enter {
      animation: fade-in-up 0.3s ease-out;
    }
    /* Custom scrollbar */
    .ai-chat-scroll::-webkit-scrollbar { width: 6px; }
    .ai-chat-scroll::-webkit-scrollbar-track { background: transparent; }
    .ai-chat-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.25); border-radius: 3px; }
    .ai-chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.4); }
    /* Markdown-ish formatting */
    .ai-content p { margin-bottom: 0.5em; }
    .ai-content p:last-child { margin-bottom: 0; }
    .ai-content code {
      background: rgba(139,92,246,0.12);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.88em;
      font-family: 'SFMono-Regular', Consolas, monospace;
    }
    .ai-content pre {
      background: rgba(0,0,0,0.3);
      padding: 1em;
      border-radius: 8px;
      overflow-x: auto;
      margin: 0.75em 0;
    }
    .ai-content pre code {
      background: none;
      padding: 0;
    }
    .ai-content ul, .ai-content ol {
      padding-left: 1.5em;
      margin: 0.5em 0;
    }
    .ai-content li { margin-bottom: 0.25em; }
    .ai-content strong { font-weight: 600; }
    .ai-content h1,.ai-content h2,.ai-content h3 {
      font-weight: 600;
      margin-top: 0.75em;
      margin-bottom: 0.25em;
    }
  `;
  document.head.appendChild(style);
}

// ── Simple Markdown renderer ──

function renderMarkdown(text: string): string {
  let html = text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Unordered lists
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Line breaks → paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap loose <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
  // Wrap in paragraph if not already wrapped
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';

  return html;
}

// ── Suggestion chips ──

const suggestions = [
  { icon: "💡", text: "Ideias para aumentar minhas vendas" },
  { icon: "📱", text: "Como melhorar minha presença digital" },
  { icon: "📊", text: "Analise métricas do meu negócio" },
  { icon: "🎯", text: "Crie uma estratégia de marketing" },
  { icon: "💰", text: "Dicas para fidelizar clientes" },
  { icon: "🚀", text: "Como escalar meu negócio" },
];

// ── Main Component ──

export function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Inject CSS animations
  useEffect(() => { injectAnimations(); }, []);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    const el = chatContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  }, []);

  // Track scroll position for "scroll to bottom" button
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setShowScrollDown(!nearBottom);
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll when new content arrives
  useEffect(() => {
    if (isStreaming || messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, streamingContent, isStreaming, scrollToBottom]);

  // ── Send message ──
  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || isStreaming) return;

    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsStreaming(true);
    setStreamingContent("");

    // Build API messages array
    const apiMessages = [
      {
        role: "system",
        content: "Você é a Nova IA, uma assistente inteligente e amigável do Nova CRM. Você ajuda lojistas e empreendedores com dicas de negócios, marketing, vendas, atendimento ao cliente e gestão. Responda sempre em português brasileiro, de forma clara e prática. Use emojis com moderação para tornar a conversa mais agradável.",
      },
      ...updatedMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    try {
      const api = (window as any).electronAPI;
      if (!api?.aiChat) {
        throw new Error("API de IA não disponível. Verifique se o app está atualizado.");
      }

      // Set up streaming listeners
      const removeChunk = api.onAiChunk((chunk: string) => {
        setStreamingContent(prev => prev + chunk);
      });
      const removeDone = api.onAiDone(() => {
        setStreamingContent(prev => {
          const assistantMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: prev,
            timestamp: Date.now(),
          };
          setMessages(msgs => [...msgs, assistantMsg]);
          return "";
        });
        setIsStreaming(false);
        removeChunk();
        removeDone();
        removeError();
      });
      const removeError = api.onAiError((err: string) => {
        setError(err);
        setIsStreaming(false);
        setStreamingContent("");
        removeChunk();
        removeDone();
        removeError();
      });

      await api.aiChat(apiMessages);
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com a IA.");
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [input, messages, isStreaming]);

  // ── Clear chat ──
  const clearChat = () => {
    setMessages([]);
    setStreamingContent("");
    setError(null);
    setIsStreaming(false);
    const api = (window as any).electronAPI;
    api?.removeAllAiListeners?.();
  };

  // ── Copy message ──
  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Retry last message ──
  const retryLast = () => {
    if (messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (!lastUserMsg) return;
    // Remove last assistant message
    setMessages(prev => {
      const newMsgs = [...prev];
      const lastIdx = newMsgs.findLastIndex(m => m.role === "assistant");
      if (lastIdx >= 0) newMsgs.splice(lastIdx, 1);
      return newMsgs;
    });
    // Re-send
    setTimeout(() => sendMessage(lastUserMsg.content), 100);
  };

  // ── Handle keyboard ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Auto-resize textarea ──
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, [input]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-card" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Nova IA</h1>
            <p className="text-xs text-muted-foreground">
              {isStreaming ? (
                <span className="ai-gradient-text font-medium">Pensando...</span>
              ) : (
                "Assistente inteligente para seu negócio"
              )}
            </p>
          </div>
        </div>
        {hasMessages && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-danger hover:bg-danger-light transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* ── Chat Area ── */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto ai-chat-scroll"
      >
        {!hasMessages ? (
          /* ── Welcome Screen ── */
          <div className="flex flex-col items-center justify-center h-full px-6 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-lg"
            >
              {/* Logo grande com gradiente */}
              <div className="relative mx-auto w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 opacity-20 blur-xl scale-110" />
                <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center shadow-xl shadow-purple-500/25 ai-shimmer">
                  <Sparkles className="h-11 w-11 text-white" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-foreground mb-2">
                Olá! Eu sou a <span className="ai-gradient-text">Nova IA</span>
              </h2>
              <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                Sua assistente inteligente para impulsionar seu negócio.
                Posso ajudar com estratégias de vendas, marketing, atendimento e muito mais.
              </p>

              {/* Suggestion chips */}
              <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => sendMessage(s.text)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted hover:border-purple-500/30 transition-all text-left group"
                  >
                    <span className="text-base shrink-0">{s.icon}</span>
                    <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground line-clamp-2">{s.text}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-1">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                copiedId={copiedId}
                onCopy={copyMessage}
              />
            ))}

            {/* Streaming message */}
            {isStreaming && (
              <div className="ai-msg-enter">
                {streamingContent ? (
                  <MessageBubble
                    msg={{
                      id: "streaming",
                      role: "assistant",
                      content: streamingContent,
                      timestamp: Date.now(),
                    }}
                    isStreaming
                    copiedId={copiedId}
                    onCopy={copyMessage}
                  />
                ) : (
                  /* Thinking animation */
                  <div className="flex gap-3 py-4">
                    <div className="shrink-0">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/60">
                          <div className="h-2 w-2 rounded-full bg-purple-400 ai-thinking-dot" />
                          <div className="h-2 w-2 rounded-full bg-indigo-400 ai-thinking-dot" />
                          <div className="h-2 w-2 rounded-full bg-blue-400 ai-thinking-dot" />
                        </div>
                        <span className="text-xs text-muted-foreground ai-gradient-text font-medium">
                          Pensando...
                        </span>
                      </div>
                      {/* Shimmer bar */}
                      <div className="mt-3 h-1 w-48 rounded-full overflow-hidden bg-muted">
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

      {/* ── Scroll to bottom button ── */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 h-8 w-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowDown className="h-3.5 w-3.5 text-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Error Banner ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mx-6 mb-2 flex items-center gap-3 rounded-xl bg-danger-light border border-danger/20 px-4 py-3"
          >
            <AlertCircle className="h-4 w-4 text-danger shrink-0" />
            <p className="text-sm text-danger flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-danger/60 hover:text-danger">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Retry button ── */}
      {error && !isStreaming && messages.length > 0 && (
        <div className="flex justify-center mb-2">
          <button
            onClick={retryLast}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-sm font-medium text-foreground hover:bg-border transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Input Area ── */}
      <div className="shrink-0 px-6 pb-6 pt-3">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-purple-500/40 focus-within:shadow-lg focus-within:shadow-purple-500/5 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo sobre seu negócio..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 max-h-[150px]"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
              className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
                input.trim() && !isStreaming
                  ? "bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 text-white shadow-md shadow-purple-500/25 hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105 active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isStreaming ? (
                <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground/60 mt-2">
            Nova IA pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble Component ──

function MessageBubble({
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
    <div className={`flex gap-3 py-3 ai-msg-enter group ${isUser ? "justify-end" : ""}`}>
      {/* AI avatar */}
      {!isUser && (
        <div className="shrink-0 mt-0.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? "order-first" : ""}`}>
        {/* Message content */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 text-white rounded-br-md"
              : "bg-muted/60 text-foreground rounded-bl-md"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div
              className={`ai-content ${isStreaming ? "ai-gradient-text" : ""}`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          )}
        </div>

        {/* Actions for assistant messages */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-1 mt-1.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onCopy(msg.id, msg.content)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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

      {/* User avatar */}
      {isUser && (
        <div className="shrink-0 mt-0.5">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  );
}
