const { app, BrowserWindow, session, ipcMain, Notification, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { autoUpdater } = require("electron-updater");
const whatsapp = require("./whatsapp");

// Disable GPU acceleration for environments without display
app.disableHardwareAcceleration();

// ── Windows Taskbar / Shortcut identity ──
// Without an explicit AppUserModelID, Windows groups the app under
// "electron.exe" in the taskbar and shows the generic Electron icon
// for desktop/start-menu shortcuts, EVEN IF the .exe has the correct
// icon embedded and BrowserWindow.icon is set.
// Setting this before any window is created makes the OS associate
// the running process with our appId (com.novacrm.desktop), which
// matches the appId configured in electron-builder (package.json).
if (process.platform === "win32") {
  app.setAppUserModelId("com.novacrm.desktop");
}

// Select the correct icon format based on platform.
// In packaged mode, __dirname is inside app.asar/electron/, so
// ../build/icon.{ico,png} resolves to the asar root (build/**/* is
// included via the electron-builder `files` config).
const iconPath = path.join(__dirname, "../build/" + (process.platform === "win32" ? "icon.ico" : "icon.png"));

// ── AI Chat Configuration ──
// API key is loaded from a gitignored file — NEVER hardcoded in source.
// The key lives in electron/.ai-key (not committed to git).
let OPENROUTER_API_KEY = "";
let AI_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

// Load AI config from external file
function loadAIConfig() {
  try {
    const keyFile = path.join(__dirname, ".ai-key");
    if (fs.existsSync(keyFile)) {
      const lines = fs.readFileSync(keyFile, "utf8").split("\n").map(l => l.trim()).filter(Boolean);
      OPENROUTER_API_KEY = lines[0] || "";
      if (lines[1]) AI_MODEL = lines[1];
      console.log("[AI] Config loaded. Model:", AI_MODEL);
    } else {
      console.warn("[AI] No .ai-key file found. AI chat will be unavailable.");
      // Fallback: try environment variable
      OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
    }
  } catch (err) {
    console.error("[AI] Error loading config:", err);
  }
}
loadAIConfig();

let mainWindow;

// ── Auto-Updater Configuration ──
autoUpdater.autoDownload = false; // We want to control download manually
autoUpdater.autoInstallOnAppQuit = true; // Install on quit if downloaded
autoUpdater.forceDevUpdateConfig = false; // Don't check for updates in dev

// Explicitly set the feed URL so autoUpdater always knows where to look,
// even if the publish config in package.json isn't picked up correctly.
// This makes the update check robust across builds and platforms.
try {
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "Pedro21062014",
    repo: "nova-crm-desktop",
  });
  console.log("[Updater] Feed URL set to github:Pedro21062014/nova-crm-desktop");
} catch (err) {
  console.warn("[Updater] Could not set feed URL explicitly:", err.message);
}

// Track update state
let updateInfo = null; // { version, releaseNotes, releaseName }
let downloadProgress = null; // { bytesPerSecond, percent, transferred, total }
let updateDownloaded = false;
let updateError = null;

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ── Auto-Updater Events ──
autoUpdater.on("checking-for-update", () => {
  console.log("[Updater] Checking for updates...");
  updateError = null;
  sendToRenderer("update:status", { status: "checking" });
});

autoUpdater.on("update-available", (info) => {
  console.log("[Updater] Update available:", info.version);
  updateInfo = {
    version: info.version,
    releaseNotes: info.releaseNotes || "",
    releaseName: info.releaseName || `v${info.version}`,
  };
  updateError = null;
  sendToRenderer("update:status", {
    status: "available",
    info: updateInfo,
  });

  // Show native notification
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: "Nova CRM - Atualização disponível!",
      body: `Versão ${info.version} está disponível. Clique para baixar.`,
      icon: iconPath,
      silent: false,
    });
    notif.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
    notif.show();
  }
});

autoUpdater.on("update-not-available", (info) => {
  console.log("[Updater] No updates available. Current:", app.getVersion());
  sendToRenderer("update:status", { status: "not-available", currentVersion: app.getVersion() });
});

autoUpdater.on("error", (err) => {
  console.error("[Updater] Error:", err.message);
  updateError = err.message;
  sendToRenderer("update:status", { status: "error", error: err.message });
});

autoUpdater.on("download-progress", (progressInfo) => {
  downloadProgress = {
    bytesPerSecond: progressInfo.bytesPerSecond,
    percent: Math.round(progressInfo.percent),
    transferred: progressInfo.transferred,
    total: progressInfo.total,
  };
  console.log(`[Updater] Download: ${downloadProgress.percent}%`);
  sendToRenderer("update:progress", downloadProgress);
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("[Updater] Update downloaded:", info.version);
  updateDownloaded = true;
  sendToRenderer("update:status", {
    status: "downloaded",
    info: {
      version: info.version,
      releaseNotes: info.releaseNotes || "",
      releaseName: info.releaseName || `v${info.version}`,
    },
  });

  // Show native notification
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: "Nova CRM - Atualização pronta!",
      body: `Versão ${info.version} baixada. Reinicie para instalar.`,
      icon: iconPath,
      silent: false,
    });
    notif.on("click", () => {
      autoUpdater.quitAndInstall(false, true);
    });
    notif.show();
  }
});

// ── Local HTTP Server for Production ──
// Firebase Auth (Google Sign-in) requires an authorized domain (localhost).
// Serving from file:// gives origin "null" which Firebase rejects.
let serverPort = 0;

function startLocalServer() {
  const distPath = path.join(__dirname, "../dist");
  
  const MIME_TYPES = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".webp": "image/webp",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".wasm": "application/wasm",
  };

  const server = http.createServer((req, res) => {
    let urlPath = req.url.split("?")[0];
    
    // SPA fallback: serve index.html for non-file routes
    if (!urlPath.includes(".")) {
      urlPath = "/index.html";
    }

    const filePath = path.join(distPath, urlPath);
    const ext = path.extname(filePath).toLowerCase();

    // Security: prevent directory traversal
    if (!filePath.startsWith(distPath)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  });

  // Listen on port 0 = OS picks a free port automatically
  server.listen(0, "127.0.0.1", () => {
    serverPort = server.address().port;
    console.log(`[Server] Serving dist on http://localhost:${serverPort}`);
  });

  return server;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    center: true,
    resizable: true,
    frame: true,
    title: "Nova CRM",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      webviewTag: true, // Required for WhatsApp Web embed
    },
  });

  // In development, load from Vite dev server
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, serve from localhost so Firebase Auth (Google Sign-in) works.
    // Firebase requires the origin to be an authorized domain, and "null" (from file://) is not one.
    // Wait for the local server to be ready, then load from it.
    const tryLoad = () => {
      if (serverPort > 0) {
        mainWindow.loadURL(`http://localhost:${serverPort}`);
      } else {
        setTimeout(tryLoad, 50);
      }
    };
    tryLoad();
  }

  // Explicitly set the window icon after creation.
  // On Windows, when packaged, the icon passed in the BrowserWindow
  // constructor sometimes isn't applied to the taskbar thumbnail /
  // alt-tab thumbnail — calling setIcon() after creation forces the
  // OS to refresh and use our icon at all sizes (16/32/48) that the
  // .ico file provides.
  try {
    if (fs.existsSync(iconPath)) {
      mainWindow.setIcon(iconPath);
    }
  } catch (err) {
    console.warn("[Icon] Could not set window icon:", err.message);
  }

  // Open DevTools on F12 (useful for debugging)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Set User-Agent for webviews (WhatsApp compatibility)
  mainWindow.webContents.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── IPC: AI Chat Handler (streaming) ──
ipcMain.handle("ai:chat", async (event, messages) => {
  if (!OPENROUTER_API_KEY) {
    event.sender.send("ai:chat:error", "Chave da API não configurada. Crie o arquivo electron/.ai-key com sua chave OpenRouter.");
    return { success: false, error: "API key not configured" };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://novacrm.com.br",
        "X-Title": "Nova CRM Desktop",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`API error ${response.status}: ${errBody}`);
    }

    // Stream the response via IPC
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            event.sender.send("ai:chat:chunk", content);
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }

    event.sender.send("ai:chat:done");
    return { success: true };
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    event.sender.send("ai:chat:error", err.message || "Erro ao conectar com a IA.");
    return { success: false, error: err.message };
  }
});

// ── IPC: Auto-Update Handlers ──

// Check for updates
ipcMain.handle("update:check", async () => {
  try {
    if (!app.isPackaged) {
      console.log("[Updater] Skipping check in development mode");
      return { status: "dev", currentVersion: app.getVersion() };
    }

    console.log("[Updater] Manually checking for updates...");
    const result = await autoUpdater.checkForUpdates();
    const latestVersion = result?.updateInfo?.version || null;
    const currentVersion = app.getVersion();

    console.log(`[Updater] Check result: current=${currentVersion}, latest=${latestVersion || "none"}`);

    // Safety net: if checkForUpdates() resolved but no updateInfo AND no event
    // was emitted yet, explicitly notify the renderer that no update is available.
    // This covers edge cases where electron-updater silently resolves without
    // firing update-not-available (observed on some Windows builds).
    if (!latestVersion && !updateInfo && !updateDownloaded) {
      sendToRenderer("update:status", { status: "not-available", currentVersion });
    }

    return {
      status: "check-initiated",
      currentVersion,
      latestVersion,
    };
  } catch (err) {
    console.error("[Updater] Check error:", err);
    // Make sure the renderer knows about the error immediately, even if the
    // autoUpdater 'error' event was already fired (idempotent — renderer
    // setState is fine with receiving the same status twice).
    sendToRenderer("update:status", { status: "error", error: err.message });
    return { status: "error", error: err.message, currentVersion: app.getVersion() };
  }
});

// Download the available update
ipcMain.handle("update:download", async () => {
  try {
    if (!updateInfo && !updateDownloaded) {
      return { status: "error", error: "Nenhuma atualização disponível para download." };
    }
    if (updateDownloaded) {
      return { status: "already-downloaded" };
    }
    await autoUpdater.downloadUpdate();
    return { status: "downloading" };
  } catch (err) {
    console.error("[Updater] Download error:", err);
    return { status: "error", error: err.message };
  }
});

// Install the downloaded update (quits app and installs)
ipcMain.handle("update:install", async () => {
  try {
    if (!updateDownloaded) {
      return { status: "error", error: "Nenhuma atualização baixada para instalar." };
    }
    // quitAndInstall(isSilent, isForceRunAfter)
    autoUpdater.quitAndInstall(false, true);
    return { status: "installing" };
  } catch (err) {
    console.error("[Updater] Install error:", err);
    return { status: "error", error: err.message };
  }
});

// Get current update state
ipcMain.handle("update:get-state", () => {
  return {
    currentVersion: app.getVersion(),
    updateAvailable: !!updateInfo,
    updateDownloaded,
    updateInfo,
    downloadProgress,
    updateError,
  };
});

// Get current app version
ipcMain.handle("app:get-version", () => {
  return app.getVersion();
});

// ── IPC: Open external URL in default browser ──
// Used by the "Ver Loja" button in the Dashboard to open the marketplace
// in the user's default browser instead of a new Electron window.
ipcMain.handle("shell:open-external", async (_event, url) => {
  try {
    if (typeof url !== "string") {
      return { success: false, error: "URL must be a string" };
    }
    // Only allow http/https URLs for security
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { success: false, error: "Only http/https URLs are allowed" };
      }
    } catch {
      return { success: false, error: "Invalid URL" };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error("[Shell] openExternal error:", err);
    return { success: false, error: err.message };
  }
});

// ── IPC: WhatsApp Handlers ──

// Initialize WhatsApp client
ipcMain.handle("whatsapp:init", async () => {
  try {
    whatsapp.initClient(mainWindow);
    return { status: "initializing" };
  } catch (err) {
    console.error("[WhatsApp] Init error:", err);
    return { status: "error", error: err.message };
  }
});

// Get WhatsApp connection status
ipcMain.handle("whatsapp:status", async () => {
  try {
    return whatsapp.getStatus();
  } catch (err) {
    console.error("[WhatsApp] Status error:", err);
    return { status: "error", error: err.message };
  }
});

// Get all chats
ipcMain.handle("whatsapp:get-chats", async () => {
  try {
    const chats = await whatsapp.getChats();
    return { success: true, chats };
  } catch (err) {
    console.error("[WhatsApp] Get chats error:", err);
    return { success: false, error: err.message };
  }
});

// Get messages from a chat
ipcMain.handle("whatsapp:get-messages", async (_event, chatId, limit) => {
  try {
    const messages = await whatsapp.getChatMessages(chatId, limit || 50);
    return { success: true, messages };
  } catch (err) {
    console.error("[WhatsApp] Get messages error:", err);
    return { success: false, error: err.message };
  }
});

// Send a text message to a chat
ipcMain.handle("whatsapp:send-message", async (_event, chatId, text) => {
  try {
    const msg = await whatsapp.sendMessage(chatId, text);
    return { success: true, message: msg };
  } catch (err) {
    console.error("[WhatsApp] Send message error:", err);
    return { success: false, error: err.message };
  }
});

// Send a text message to a phone number
ipcMain.handle("whatsapp:send-to-number", async (_event, phoneNumber, text) => {
  try {
    const msg = await whatsapp.sendMessageToNumber(phoneNumber, text);
    return { success: true, message: msg };
  } catch (err) {
    console.error("[WhatsApp] Send to number error:", err);
    return { success: false, error: err.message };
  }
});

// Get contact info
ipcMain.handle("whatsapp:get-contact", async (_event, contactId) => {
  try {
    const contact = await whatsapp.getContactInfo(contactId);
    return { success: true, contact };
  } catch (err) {
    console.error("[WhatsApp] Get contact error:", err);
    return { success: false, error: err.message };
  }
});

// Get chat profile picture
ipcMain.handle("whatsapp:get-profile-pic", async (_event, chatId) => {
  try {
    const result = await whatsapp.getChatProfilePic(chatId);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, profilePicUrl: null };
  }
});

// Search contacts
ipcMain.handle("whatsapp:search-contacts", async (_event, query) => {
  try {
    const contacts = await whatsapp.searchContacts(query);
    return { success: true, contacts };
  } catch (err) {
    console.error("[WhatsApp] Search contacts error:", err);
    return { success: false, error: err.message };
  }
});

// Disconnect/Logout WhatsApp
ipcMain.handle("whatsapp:logout", async () => {
  try {
    await whatsapp.logout();
    return { success: true };
  } catch (err) {
    console.error("[WhatsApp] Logout error:", err);
    return { success: false, error: err.message };
  }
});

// Destroy WhatsApp client
ipcMain.handle("whatsapp:destroy", async () => {
  try {
    await whatsapp.destroyClient();
    return { success: true };
  } catch (err) {
    console.error("[WhatsApp] Destroy error:", err);
    return { success: false, error: err.message };
  }
});

// Fix Firebase Auth in Electron: allow Firebase Auth to work with file:// protocol
// by granting storage access to the Firebase Auth domain
app.whenReady().then(() => {
  // Grant storage access for Firebase Auth in Electron
  // This allows Firebase Auth to store/retrieve auth tokens
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: details.requestHeaders });
  });

  // Allow webview to load WhatsApp Web properly
  session.fromPartition("persist:whatsapp").webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: details.requestHeaders });
  });

  // Start local server BEFORE creating window (production only)
  if (app.isPackaged) {
    startLocalServer();
  }

  createWindow();

  // ── Auto-Update: Check on startup ──
  // Only check in production (packaged) mode
  if (app.isPackaged) {
    // Check for updates 5 seconds after launch (give the app time to load)
    setTimeout(() => {
      console.log("[Updater] Auto-checking for updates...");
      autoUpdater.checkForUpdates().catch(err => {
        console.error("[Updater] Auto-check failed:", err.message);
      });
    }, 5000);

    // Then check every 30 minutes
    setInterval(() => {
      console.log("[Updater] Periodic check for updates...");
      autoUpdater.checkForUpdates().catch(err => {
        console.error("[Updater] Periodic check failed:", err.message);
      });
    }, 30 * 60 * 1000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
