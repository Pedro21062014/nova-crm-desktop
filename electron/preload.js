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
});
