const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,

  // AI Chat — key never reaches renderer
  aiChat: (messages) => ipcRenderer.invoke("ai:chat", messages),
  onAiChunk: (callback) => {
    const handler = (_event, chunk) => callback(chunk);
    ipcRenderer.on("ai:chat:chunk", handler);
    return () => ipcRenderer.removeListener("ai:chat:chunk", handler);
  },
  onAiDone: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("ai:chat:done", handler);
    return () => ipcRenderer.removeListener("ai:chat:done", handler);
  },
  onAiError: (callback) => {
    const handler = (_event, err) => callback(err);
    ipcRenderer.on("ai:chat:error", handler);
    return () => ipcRenderer.removeListener("ai:chat:error", handler);
  },
  removeAllAiListeners: () => {
    ipcRenderer.removeAllListeners("ai:chat:chunk");
    ipcRenderer.removeAllListeners("ai:chat:done");
    ipcRenderer.removeAllListeners("ai:chat:error");
  },

  // ── Auto-Update ──
  // Check for updates
  checkForUpdates: () => ipcRenderer.invoke("update:check"),

  // Download the available update
  downloadUpdate: () => ipcRenderer.invoke("update:download"),

  // Install the downloaded update (quits and restarts)
  installUpdate: () => ipcRenderer.invoke("update:install"),

  // Get current update state
  getUpdateState: () => ipcRenderer.invoke("update:get-state"),

  // Get app version
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),

  // Listen for update status changes
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("update:status", handler);
    return () => ipcRenderer.removeListener("update:status", handler);
  },

  // Listen for download progress
  onUpdateProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },

  // Remove all update listeners
  removeAllUpdateListeners: () => {
    ipcRenderer.removeAllListeners("update:status");
    ipcRenderer.removeAllListeners("update:progress");
  },
});
