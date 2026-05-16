const { app, BrowserWindow, session, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

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
    // In production, load built files from dist/
    // Use loadFile for file:// protocol (works with HashRouter)
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
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

  createWindow();

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
