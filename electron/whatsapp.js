// ── WhatsApp Web.js Service ──
// Runs in the Electron main process.
// Manages the WhatsApp Web client using whatsapp-web.js library.
// Communicates with the renderer via IPC events.

const { Client, LocalAuth } = require("whatsapp-web.js");
const path = require("path");
const fs = require("fs");

let client = null;
let isInitialized = false;
let isConnected = false;
let qrCodeData = null;
let connectionStatus = "disconnected"; // disconnected | connecting | qr | connected | error

// Store session data in the user data directory
function getSessionPath() {
  const { app } = require("electron");
  return path.join(app.getPath("userData"), "whatsapp-session");
}

// Send event to renderer
function sendToRenderer(mainWindow, channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ── Initialize WhatsApp Client ──
function initClient(mainWindow) {
  if (client) {
    console.log("[WhatsApp] Client already exists, destroying first...");
    destroyClient();
  }

  const sessionPath = getSessionPath();
  console.log("[WhatsApp] Session path:", sessionPath);

  connectionStatus = "connecting";
  sendToRenderer(mainWindow, "whatsapp:status", { status: "connecting" });

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionPath,
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
    // Use the Chromium that comes with Electron
    // This avoids downloading a separate Chrome instance
    // Override the WhatsApp Web version — pinning avoids breakage when
    // WhatsApp rolls out a new web build that whatsapp-web.js hasn't
    // shipped support for yet. If empty, uses the library default.
    webVersionCache: {
      type: "remote",
      remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
  });

  // ── Loading screen event (debug visibility) ──
  client.on("loading_screen", (percent, message) => {
    console.log("[WhatsApp] Loading:", percent, message);
  });

  // ── QR Code Event ──
  client.on("qr", (qr) => {
    console.log("[WhatsApp] QR Code received, length:", qr?.length || 0);
    qrCodeData = qr;
    connectionStatus = "qr";
    sendToRenderer(mainWindow, "whatsapp:qr", { qr });
    sendToRenderer(mainWindow, "whatsapp:status", { status: "qr" });
  });

  // ── Ready Event ──
  client.on("ready", () => {
    console.log("[WhatsApp] Client is ready!");
    isConnected = true;
    qrCodeData = null;
    connectionStatus = "connected";
    sendToRenderer(mainWindow, "whatsapp:status", { status: "connected" });
  });

  // ── Authenticated Event ──
  client.on("authenticated", () => {
    console.log("[WhatsApp] Authenticated successfully");
    connectionStatus = "authenticated";
    sendToRenderer(mainWindow, "whatsapp:status", { status: "authenticated" });
  });

  // ── Auth Failure Event ──
  client.on("auth_failure", (msg) => {
    console.error("[WhatsApp] Auth failure:", msg);
    isConnected = false;
    connectionStatus = "error";
    sendToRenderer(mainWindow, "whatsapp:status", {
      status: "error",
      error: "Falha na autenticação. Escaneie o QR Code novamente.",
    });
  });

  // ── Disconnected Event ──
  client.on("disconnected", (reason) => {
    console.log("[WhatsApp] Disconnected:", reason);
    isConnected = false;
    connectionStatus = "disconnected";
    sendToRenderer(mainWindow, "whatsapp:status", {
      status: "disconnected",
      reason: reason || "Conexão perdida",
    });
  });

  // ── Message Event ──
  client.on("message", async (msg) => {
    try {
      const contact = await msg.getContact();
      const chat = await msg.getChat();

      const messageData = {
        id: msg.id._serialized,
        body: msg.body,
        from: msg.from,
        fromMe: msg.fromMe,
        author: msg.author || "",
        timestamp: msg.timestamp,
        type: msg.type,
        hasMedia: msg.hasMedia,
        contactName: contact.pushname || contact.name || contact.number || "Desconhecido",
        contactNumber: contact.number || "",
        chatId: chat.id._serialized,
        chatName: chat.name || contact.pushname || contact.number || "Desconhecido",
        isGroup: chat.isGroup,
      };

      sendToRenderer(mainWindow, "whatsapp:message", messageData);
    } catch (err) {
      console.error("[WhatsApp] Error processing incoming message:", err);
    }
  });

  // ── Message ACK (read receipts) ──
  client.on("message_ack", async (msg, ack) => {
    try {
      const ackMap = {
        0: "sent",
        1: "delivered",
        2: "read",
        3: "played",
      };

      sendToRenderer(mainWindow, "whatsapp:message_ack", {
        id: msg.id._serialized,
        ack: ack,
        ackStatus: ackMap[ack] || "unknown",
        fromMe: msg.fromMe,
      });
    } catch (err) {
      console.error("[WhatsApp] Error processing message ack:", err);
    }
  });

  // Initialize the client
  try {
    client.initialize();
    isInitialized = true;
    console.log("[WhatsApp] Client initializing...");
  } catch (err) {
    console.error("[WhatsApp] Error initializing client:", err);
    connectionStatus = "error";
    sendToRenderer(mainWindow, "whatsapp:status", {
      status: "error",
      error: "Erro ao inicializar o WhatsApp: " + err.message,
    });
  }
}

// ── Destroy the client ──
async function destroyClient() {
  if (client) {
    try {
      await client.destroy();
    } catch (err) {
      console.error("[WhatsApp] Error destroying client:", err);
    }
    client = null;
    isInitialized = false;
    isConnected = false;
    qrCodeData = null;
    connectionStatus = "disconnected";
  }
}

// ── Get all chats ──
async function getChats() {
  if (!client || !isConnected) {
    throw new Error("WhatsApp não conectado");
  }
  try {
    const chats = await client.getChats();
    return chats.map((chat) => ({
      id: chat.id._serialized,
      name: chat.name || "Desconhecido",
      isGroup: chat.isGroup,
      isReadOnly: chat.isReadOnly,
      unreadCount: chat.unreadCount,
      timestamp: chat.timestamp,
      lastMessage: chat.lastMessage
        ? {
            body: chat.lastMessage.body || "",
            fromMe: chat.lastMessage.fromMe,
            timestamp: chat.lastMessage.timestamp,
            type: chat.lastMessage.type,
          }
        : null,
      profilePicUrl: null, // Will be fetched separately if needed
    }));
  } catch (err) {
    console.error("[WhatsApp] Error getting chats:", err);
    throw new Error("Erro ao buscar conversas: " + err.message);
  }
}

// ── Get messages from a chat ──
async function getChatMessages(chatId, limit = 50) {
  if (!client || !isConnected) {
    throw new Error("WhatsApp não conectado");
  }
  try {
    const chat = await client.getChatById(chatId);
    if (!chat) {
      throw new Error("Conversa não encontrada");
    }

    // Mark as read
    await chat.sendSeen();

    const messages = await chat.fetchMessages({ limit });
    const result = [];

    for (const msg of messages) {
      let contactName = "Desconhecido";
      let contactNumber = "";
      try {
        if (msg.fromMe) {
          contactName = "Você";
        } else {
          const contact = await msg.getContact();
          contactName = contact.pushname || contact.name || contact.number || "Desconhecido";
          contactNumber = contact.number || "";
        }
      } catch {
        // Skip contact info on error
      }

      result.push({
        id: msg.id._serialized,
        body: msg.body,
        from: msg.from,
        fromMe: msg.fromMe,
        author: msg.author || "",
        timestamp: msg.timestamp,
        type: msg.type,
        hasMedia: msg.hasMedia,
        contactName,
        contactNumber,
        ack: msg.ack,
      });
    }

    return result;
  } catch (err) {
    console.error("[WhatsApp] Error getting messages:", err);
    throw new Error("Erro ao buscar mensagens: " + err.message);
  }
}

// ── Send a text message ──
async function sendMessage(chatId, text) {
  if (!client || !isConnected) {
    throw new Error("WhatsApp não conectado");
  }
  try {
    const msg = await client.sendMessage(chatId, text);
    return {
      id: msg.id._serialized,
      body: msg.body,
      from: msg.from,
      fromMe: msg.fromMe,
      timestamp: msg.timestamp,
      status: "sent",
    };
  } catch (err) {
    console.error("[WhatsApp] Error sending message:", err);
    throw new Error("Erro ao enviar mensagem: " + err.message);
  }
}

// ── Send a message to a phone number ──
async function sendMessageToNumber(phoneNumber, text) {
  if (!client || !isConnected) {
    throw new Error("WhatsApp não conectado");
  }
  try {
    // Format: number@c.us for individual chats
    const chatId = phoneNumber.includes("@") ? phoneNumber : `${phoneNumber}@c.us`;
    const msg = await client.sendMessage(chatId, text);
    return {
      id: msg.id._serialized,
      body: msg.body,
      from: msg.from,
      fromMe: msg.fromMe,
      timestamp: msg.timestamp,
      status: "sent",
    };
  } catch (err) {
    console.error("[WhatsApp] Error sending message to number:", err);
    throw new Error("Erro ao enviar mensagem: " + err.message);
  }
}

// ── Get contact info ──
async function getContactInfo(contactId) {
  if (!client || !isConnected) {
    throw new Error("WhatsApp não conectado");
  }
  try {
    const contact = await client.getContactById(contactId);
    let profilePicUrl = null;
    try {
      profilePicUrl = await contact.getProfilePicUrl();
    } catch {
      // Some contacts don't have profile pictures
    }

    return {
      id: contact.id._serialized,
      name: contact.name || "",
      pushname: contact.pushname || "",
      number: contact.number || "",
      isBusiness: contact.isBusiness || false,
      isEnterprise: contact.isEnterprise || false,
      isMyContact: contact.isMyContact || false,
      profilePicUrl,
      about: contact.about || "",
    };
  } catch (err) {
    console.error("[WhatsApp] Error getting contact info:", err);
    throw new Error("Erro ao buscar contato: " + err.message);
  }
}

// ── Get chat profile picture ──
async function getChatProfilePic(chatId) {
  if (!client || !isConnected) {
    throw new Error("WhatsApp não conectado");
  }
  try {
    const chat = await client.getChatById(chatId);
    if (chat) {
      const profilePicUrl = await chat.getProfilePicUrl();
      return { profilePicUrl };
    }
    return { profilePicUrl: null };
  } catch (err) {
    return { profilePicUrl: null };
  }
}

// ── Search contacts/chats ──
async function searchContacts(query) {
  if (!client || !isConnected) {
    throw new Error("WhatsApp não conectado");
  }
  try {
    const contacts = await client.getContacts();
    const search = query.toLowerCase();
    const filtered = contacts
      .filter((c) => {
        const name = (c.name || c.pushname || c.number || "").toLowerCase();
        return name.includes(search) && !c.isMe;
      })
      .slice(0, 20)
      .map((c) => ({
        id: c.id._serialized,
        name: c.name || c.pushname || c.number || "Desconhecido",
        number: c.number || "",
        pushname: c.pushname || "",
        isBusiness: c.isBusiness || false,
      }));
    return filtered;
  } catch (err) {
    console.error("[WhatsApp] Error searching contacts:", err);
    throw new Error("Erro ao buscar contatos: " + err.message);
  }
}

// ── Get connection status ──
function getStatus() {
  return {
    status: connectionStatus,
    isConnected,
    isInitialized,
    hasQrCode: !!qrCodeData,
  };
}

// ── Logout (clear session) ──
async function logout() {
  if (client) {
    try {
      await client.logout();
    } catch (err) {
      console.error("[WhatsApp] Error logging out:", err);
    }
    client = null;
    isInitialized = false;
    isConnected = false;
    qrCodeData = null;
    connectionStatus = "disconnected";
  }
}

module.exports = {
  initClient,
  destroyClient,
  getChats,
  getChatMessages,
  sendMessage,
  sendMessageToNumber,
  getContactInfo,
  getChatProfilePic,
  searchContacts,
  getStatus,
  logout,
};
