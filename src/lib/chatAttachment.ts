// ─────────────────────────────────────────────────────────────────────────────
// Anexos de chat (imagens e documentos) — MESMO formato do CRM web (repo CRM):
// a imagem é comprimida silenciosamente (max 1024x1024, quality 0.75) e a
// mensagem vai para o RTDB em merchants/{uid}/chats/{chatId}/messages com o
// campo `attachment` em base64 data URL. Assim o que for enviado pelo desktop
// aparece no CRM web (e vice-versa) automaticamente.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatAttachment {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 data URL
  isImage: boolean;
  compressedSize?: number;
  originalSize?: number;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Converte um File em data URL base64, comprimindo imagens automaticamente
 * via canvas (mesma lógica de `convertFileToBase64` do repo CRM).
 */
export const convertFileToBase64 = (
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Se não for imagem, lê direto como data URL
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
      return;
    }

    // Para imagens, comprime silenciosamente com um canvas offscreen
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxWidth = options?.maxWidth || 1280;
          const maxHeight = options?.maxHeight || 1280;
          const quality = options?.quality ?? 0.82;

          let width = img.width;
          let height = img.height;

          // Redimensiona proporcionalmente se maior que as dimensões máximas
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Mantém transparência para PNG/WebP; senão converte para JPEG
          const hasAlpha = file.type === "image/png" || file.type === "image/webp";

          if (hasAlpha) {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const webpData = canvas.toDataURL("image/webp", quality);
            if (webpData.startsWith("data:image/webp")) {
              resolve(webpData);
              return;
            }

            const pngData = canvas.toDataURL("image/png");
            if (pngData.length < 500 * 1024) {
              resolve(pngData);
              return;
            }
          }

          // Fundo branco p/ JPEG (caso o PNG tenha transparência)
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const webpData = canvas.toDataURL("image/webp", quality);
          if (
            webpData.startsWith("data:image/webp") &&
            webpData.length < (e.target?.result as string).length
          ) {
            resolve(webpData);
            return;
          }

          const jpegData = canvas.toDataURL("image/jpeg", quality);
          resolve(jpegData);
        } catch (err) {
          console.warn("Falha na compressão de imagem, usando original:", err);
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Processa o arquivo anexado ao chat (mesma lógica de `processChatFile` do CRM):
 * - Imagens: comprimidas para no máx. 1024x1024 com quality 0.75
 * - Documentos: limite de 5MB, lidos como data URL
 */
export async function processChatFile(file: File): Promise<ChatAttachment> {
  const isImage = file.type.startsWith("image/");

  if (isImage) {
    const compressedDataUrl = await convertFileToBase64(file, {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.75,
    });

    const base64Content = compressedDataUrl.split(",")[1] || compressedDataUrl;
    const compressedBytes = Math.round((base64Content.length * 3) / 4);

    return {
      name: file.name,
      type: file.type || "image/jpeg",
      size: file.size,
      originalSize: file.size,
      compressedSize: compressedBytes,
      data: compressedDataUrl,
      isImage: true,
    };
  } else {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("O documento excede o limite de 5MB.");
    }

    const dataUrl = await convertFileToBase64(file);
    return {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      originalSize: file.size,
      data: dataUrl,
      isImage: false,
    };
  }
}
