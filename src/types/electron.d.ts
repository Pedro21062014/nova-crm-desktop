// Type declarations for Electron APIs
// The <webview> tag is an Electron-specific element that embeds web content

interface UpdateInfo {
  version: string;
  releaseNotes: string | { note: string; version: string }[];
  releaseName: string;
}

interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

interface UpdateStatusData {
  status: "checking" | "available" | "not-available" | "downloaded" | "error";
  info?: UpdateInfo;
  currentVersion?: string;
  error?: string;
}

// ── WhatsApp Types ──

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  isReadOnly: boolean;
  unreadCount: number;
  timestamp: number;
  lastMessage: {
    body: string;
    fromMe: boolean;
    timestamp: number;
    type: string;
  } | null;
  profilePicUrl: string | null;
}

interface WhatsAppMessage {
  id: string;
  body: string;
  from: string;
  fromMe: boolean;
  author: string;
  timestamp: number;
  type: string;
  hasMedia: boolean;
  contactName: string;
  contactNumber: string;
  chatId?: string;
  chatName?: string;
  isGroup?: boolean;
  ack?: number;
}

interface WhatsAppContact {
  id: string;
  name: string;
  number: string;
  pushname: string;
  isBusiness: boolean;
}

interface WhatsAppContactInfo {
  id: string;
  name: string;
  pushname: string;
  number: string;
  isBusiness: boolean;
  isEnterprise: boolean;
  isMyContact: boolean;
  profilePicUrl: string | null;
  about: string;
}

interface WhatsAppStatusData {
  status: "disconnected" | "connecting" | "qr" | "authenticated" | "connected" | "error";
  error?: string;
  reason?: string;
}

interface WhatsAppQRData {
  qr: string;
}

interface WhatsAppMessageAckData {
  id: string;
  ack: number;
  ackStatus: "sent" | "delivered" | "read" | "played" | "unknown";
  fromMe: boolean;
}

interface ElectronAPI {
  platform: string;
  isElectron: boolean;

  // AI Chat — key never reaches renderer
  aiChat: (messages: any[]) => Promise<{ success: boolean; error?: string }>;
  onAiChunk: (callback: (chunk: string) => void) => () => void;
  onAiDone: (callback: () => void) => () => void;
  onAiError: (callback: (err: string) => void) => () => void;
  removeAllAiListeners: () => void;

  // Auto-Update
  checkForUpdates: () => Promise<{
    status: "dev" | "check-initiated" | "error";
    currentVersion?: string;
    latestVersion?: string;
    error?: string;
  }>;
  downloadUpdate: () => Promise<{
    status: "downloading" | "already-downloaded" | "error";
    error?: string;
  }>;
  installUpdate: () => Promise<{
    status: "installing" | "error";
    error?: string;
  }>;
  getUpdateState: () => Promise<{
    currentVersion: string;
    updateAvailable: boolean;
    updateDownloaded: boolean;
    updateInfo: UpdateInfo | null;
    downloadProgress: DownloadProgress | null;
    updateError: string | null;
  }>;
  getAppVersion: () => Promise<string>;
  onUpdateStatus: (callback: (data: UpdateStatusData) => void) => () => void;
  onUpdateProgress: (callback: (data: DownloadProgress) => void) => () => void;
  removeAllUpdateListeners: () => void;

  // Shell — open external URL in default browser
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;

  // WhatsApp (whatsapp-web.js)
  whatsappInit: () => Promise<{ status: "initializing" | "error"; error?: string }>;
  whatsappGetStatus: () => Promise<{
    status: "disconnected" | "connecting" | "qr" | "authenticated" | "connected" | "error";
    isConnected: boolean;
    isInitialized: boolean;
    hasQrCode: boolean;
    qrCode?: string | null;
    error?: string;
  }>;
  whatsappGetChats: () => Promise<{ success: boolean; chats?: WhatsAppChat[]; error?: string }>;
  whatsappGetMessages: (chatId: string, limit?: number) => Promise<{ success: boolean; messages?: WhatsAppMessage[]; error?: string }>;
  whatsappSendMessage: (chatId: string, text: string) => Promise<{
    success: boolean;
    message?: { id: string; body: string; from: string; fromMe: boolean; timestamp: number; status: string };
    error?: string;
  }>;
  whatsappSendToNumber: (phoneNumber: string, text: string) => Promise<{
    success: boolean;
    message?: { id: string; body: string; from: string; fromMe: boolean; timestamp: number; status: string };
    error?: string;
  }>;
  whatsappGetContact: (contactId: string) => Promise<{ success: boolean; contact?: WhatsAppContactInfo; error?: string }>;
  whatsappGetProfilePic: (chatId: string) => Promise<{ success: boolean; profilePicUrl: string | null }>;
  whatsappSearchContacts: (query: string) => Promise<{ success: boolean; contacts?: WhatsAppContact[]; error?: string }>;
  whatsappLogout: () => Promise<{ success: boolean; error?: string }>;
  whatsappDestroy: () => Promise<{ success: boolean; error?: string }>;

  // WhatsApp event listeners
  onWhatsappStatus: (callback: (data: WhatsAppStatusData) => void) => () => void;
  onWhatsappQr: (callback: (data: WhatsAppQRData) => void) => () => void;
  onWhatsappMessage: (callback: (data: WhatsAppMessage) => void) => () => void;
  onWhatsappMessageAck: (callback: (data: WhatsAppMessageAckData) => void) => () => void;
  removeAllWhatsappListeners: () => void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          partition?: string;
          useragent?: string;
          allowpopups?: string;
          preload?: string;
          httpreferrer?: string;
          disablewebsecurity?: string;
          webpreferences?: string;
        },
        HTMLElement
      >;
    }
  }

  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
