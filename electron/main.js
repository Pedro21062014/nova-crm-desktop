const { app, BrowserWindow, session, ipcMain, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { autoUpdater } = require("electron-updater");

// Disable GPU acceleration for environments without display
app.disableHardwareAcceleration();

// Select the correct icon format based on platform
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
    const result = await autoUpdater.checkForUpdates();
    return {
      status: "check-initiated",
      currentVersion: app.getVersion(),
      latestVersion: result?.updateInfo?.version || null,
    };
  } catch (err) {
    console.error("[Updater] Check error:", err);
    return { status: "error", error: err.message };
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
