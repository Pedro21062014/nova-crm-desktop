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

  // ── Shell ──
  // Open an external URL in the user's default browser.
  // Used by the "Ver Loja" button on the Dashboard.
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),

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

  // ── WhatsApp (whatsapp-web.js) ──

  // Initialize WhatsApp client
  whatsappInit: () => ipcRenderer.invoke("whatsapp:init"),

  // Get connection status
  whatsappGetStatus: () => ipcRenderer.invoke("whatsapp:status"),

  // Get all chats
  whatsappGetChats: () => ipcRenderer.invoke("whatsapp:get-chats"),

  // Get messages from a chat
  whatsappGetMessages: (chatId, limit) => ipcRenderer.invoke("whatsapp:get-messages", chatId, limit),

  // Send a message to a chat
  whatsappSendMessage: (chatId, text) => ipcRenderer.invoke("whatsapp:send-message", chatId, text),

  // Send a message to a phone number
  whatsappSendToNumber: (phoneNumber, text) => ipcRenderer.invoke("whatsapp:send-to-number", phoneNumber, text),

  // Get contact info
  whatsappGetContact: (contactId) => ipcRenderer.invoke("whatsapp:get-contact", contactId),

  // Get chat profile picture
  whatsappGetProfilePic: (chatId) => ipcRenderer.invoke("whatsapp:get-profile-pic", chatId),

  // Search contacts
  whatsappSearchContacts: (query) => ipcRenderer.invoke("whatsapp:search-contacts", query),

  // Logout / disconnect
  whatsappLogout: () => ipcRenderer.invoke("whatsapp:logout"),

  // Destroy WhatsApp client
  whatsappDestroy: () => ipcRenderer.invoke("whatsapp:destroy"),

  // Listen for WhatsApp status changes
  onWhatsappStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("whatsapp:status", handler);
    return () => ipcRenderer.removeListener("whatsapp:status", handler);
  },

  // Listen for WhatsApp QR code
  onWhatsappQr: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("whatsapp:qr", handler);
    return () => ipcRenderer.removeListener("whatsapp:qr", handler);
  },

  // Listen for incoming WhatsApp messages
  onWhatsappMessage: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("whatsapp:message", handler);
    return () => ipcRenderer.removeListener("whatsapp:message", handler);
  },

  // Listen for message ACK (delivery/read receipts)
  onWhatsappMessageAck: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("whatsapp:message_ack", handler);
    return () => ipcRenderer.removeListener("whatsapp:message_ack", handler);
  },

  // Remove all WhatsApp listeners
  removeAllWhatsappListeners: () => {
    ipcRenderer.removeAllListeners("whatsapp:status");
    ipcRenderer.removeAllListeners("whatsapp:qr");
    ipcRenderer.removeAllListeners("whatsapp:message");
    ipcRenderer.removeAllListeners("whatsapp:message_ack");
  },
});
