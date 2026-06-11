// Type declarations for Electron webview element
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
