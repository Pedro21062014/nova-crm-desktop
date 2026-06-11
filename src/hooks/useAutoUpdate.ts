import { useState, useEffect, useCallback } from "react";

// ── Types ──

export type UpdateStatus =
  | "idle"          // No check done yet
  | "checking"      // Checking for updates
  | "available"     // Update available
  | "not-available" // App is up to date
  | "downloading"   // Downloading update
  | "downloaded"    // Update downloaded, ready to install
  | "installing"    // Installing (app is about to quit)
  | "error"         // Error occurred
  | "dev";          // Running in development mode

export interface UpdateInfo {
  version: string;
  releaseNotes: string | { note: string; version: string }[];
  releaseName: string;
}

export interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface AutoUpdateState {
  status: UpdateStatus;
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
  error: string | null;
}

// ── Hook ──

export function useAutoUpdate() {
  const [state, setState] = useState<AutoUpdateState>({
    status: "idle",
    currentVersion: "",
    updateInfo: null,
    downloadProgress: null,
    error: null,
  });

  // Check if electron API is available
  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  // Get initial state on mount
  useEffect(() => {
    if (!isElectron) return;

    const loadInitialState = async () => {
      try {
        const version = await window.electronAPI.getAppVersion();
        setState(prev => ({ ...prev, currentVersion: version }));
      } catch (err) {
        console.error("[AutoUpdate] Error getting version:", err);
      }
    };

    loadInitialState();
  }, [isElectron]);

  // Listen for update status changes
  useEffect(() => {
    if (!isElectron) return;

    const cleanup = window.electronAPI.onUpdateStatus((data: any) => {
      setState(prev => {
        const newState = { ...prev };

        switch (data.status) {
          case "checking":
            newState.status = "checking";
            newState.error = null;
            break;
          case "available":
            newState.status = "available";
            newState.updateInfo = data.info || null;
            newState.error = null;
            break;
          case "not-available":
            newState.status = "not-available";
            newState.currentVersion = data.currentVersion || prev.currentVersion;
            break;
          case "downloaded":
            newState.status = "downloaded";
            newState.updateInfo = data.info || prev.updateInfo;
            newState.downloadProgress = null;
            break;
          case "error":
            newState.status = "error";
            newState.error = data.error || "Erro desconhecido";
            break;
          default:
            break;
        }

        return newState;
      });
    });

    return cleanup;
  }, [isElectron]);

  // Listen for download progress
  useEffect(() => {
    if (!isElectron) return;

    const cleanup = window.electronAPI.onUpdateProgress((data: DownloadProgress) => {
      setState(prev => ({
        ...prev,
        status: "downloading",
        downloadProgress: data,
      }));
    });

    return cleanup;
  }, [isElectron]);

  // ── Actions ──

  const checkForUpdates = useCallback(async () => {
    if (!isElectron) return;

    try {
      setState(prev => ({ ...prev, status: "checking", error: null }));
      const result = await window.electronAPI.checkForUpdates();

      if (result.status === "dev") {
        setState(prev => ({ ...prev, status: "dev", currentVersion: result.currentVersion || prev.currentVersion }));
      }
      // Other statuses will come through the onUpdateStatus listener
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        status: "error",
        error: err.message || "Erro ao verificar atualizações",
      }));
    }
  }, [isElectron]);

  const downloadUpdate = useCallback(async () => {
    if (!isElectron) return;

    try {
      const result = await window.electronAPI.downloadUpdate();
      if (result.status === "error") {
        setState(prev => ({
          ...prev,
          status: "error",
          error: result.error || "Erro ao baixar atualização",
        }));
      } else if (result.status === "already-downloaded") {
        setState(prev => ({ ...prev, status: "downloaded" }));
      }
      // Download progress will be tracked via onUpdateProgress listener
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        status: "error",
        error: err.message || "Erro ao baixar atualização",
      }));
    }
  }, [isElectron]);

  const installUpdate = useCallback(async () => {
    if (!isElectron) return;

    try {
      setState(prev => ({ ...prev, status: "installing" }));
      await window.electronAPI.installUpdate();
      // App will quit and install after this
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        status: "error",
        error: err.message || "Erro ao instalar atualização",
      }));
    }
  }, [isElectron]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isElectron && window.electronAPI.removeAllUpdateListeners) {
        window.electronAPI.removeAllUpdateListeners();
      }
    };
  }, [isElectron]);

  return {
    ...state,
    isElectron,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
