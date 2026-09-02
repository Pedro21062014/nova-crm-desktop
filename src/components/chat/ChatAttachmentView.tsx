// Visualização de anexos no chat — portado de `components/ChatAttachmentView.tsx`
// do repo CRM (mesma estrutura: barra de anexo pendente, anexo dentro da bolha
// e lightbox para zoom de imagens), com a paleta de tokens do desktop.
import { FileText, Download, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/chatAttachment";
import type { ChatMessageAttachment } from "@/services/firebase";
import { AnimatePresence, motion } from "framer-motion";

// ── Barra de anexo pendente (acima da input, antes de enviar) ───────────────
export function PendingAttachmentBar({
  attachment,
  onRemove,
}: {
  attachment: ChatMessageAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="px-4 py-2 bg-muted border-t border-border flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {attachment.isImage ? (
          <img
            src={attachment.data}
            alt={attachment.name}
            className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{attachment.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {attachment.isImage
              ? `Comprimido (${formatFileSize(attachment.compressedSize || attachment.size)})`
              : formatFileSize(attachment.size)}
          </p>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted-foreground/10 transition-colors shrink-0"
        title="Remover anexo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Anexo dentro da bolha da mensagem ───────────────────────────────────────
export function ChatMessageAttachment({
  attachment,
  isSelf,
  onOpenImage,
}: {
  attachment: ChatMessageAttachment;
  isSelf: boolean; // true = enviado pelo merchant (mesma bolha do "eu")
  onOpenImage?: (attachment: ChatMessageAttachment) => void;
}) {
  if (!attachment?.data) return null;

  const isImg =
    attachment.isImage ||
    attachment.type?.startsWith("image/") ||
    attachment.data?.startsWith("data:image/");

  // Imagem: thumbnail clicável → lightbox
  if (isImg) {
    return (
      <div className="relative mb-2 overflow-hidden rounded-xl group">
        <img
          src={attachment.data}
          alt={attachment.name || "Imagem"}
          onClick={() => onOpenImage?.(attachment)}
          className="max-h-64 max-w-full rounded-xl object-cover cursor-pointer transition-opacity hover:opacity-95"
        />
        <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ImageIcon className="h-2.5 w-2.5" />
          {formatFileSize(attachment.compressedSize || attachment.size)}
        </div>
      </div>
    );
  }

  // Documento: card com download
  return (
    <a
      href={attachment.data}
      download={attachment.name || "documento"}
      className={cn(
        "flex items-center gap-3 p-3 mb-2 rounded-xl border transition-all",
        isSelf
          ? "bg-white/15 border-white/20 text-white hover:bg-white/20"
          : "bg-card border-border text-foreground hover:bg-muted"
      )}
      title="Baixar documento"
    >
      <div
        className={cn(
          "p-2 rounded-lg shrink-0",
          isSelf ? "bg-white/15 text-white" : "bg-accent/15 text-accent"
        )}
      >
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-xs truncate">{attachment.name || "Documento"}</p>
        <p className="text-[10px] opacity-75">{formatFileSize(attachment.size)}</p>
      </div>
      <div className="p-1.5 shrink-0">
        <Download className="h-4 w-4" />
      </div>
    </a>
  );
}

// ── Lightbox: zoom de imagem em tela cheia ──────────────────────────────────
export function ImageLightboxModal({
  attachment,
  onClose,
}: {
  attachment: ChatMessageAttachment | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {attachment && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <a
              href={attachment.data}
              download={attachment.name || "imagem.jpg"}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              title="Baixar imagem"
            >
              <Download className="h-5 w-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="max-w-4xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={attachment.data}
              alt={attachment.name}
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
            />
            <div className="mt-3 text-center">
              <p className="text-white font-medium text-sm truncate max-w-xs sm:max-w-md">
                {attachment.name}
              </p>
              <p className="text-white/60 text-xs mt-0.5">
                Tamanho: {formatFileSize(attachment.compressedSize || attachment.size)}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
