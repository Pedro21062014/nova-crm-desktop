const { app, BrowserWindow, protocol } = require("electron");
const path = require("path");

// Disable GPU acceleration for headless environments
app.disableHardwareAcceleration();

// Select the correct icon format based on platform
const iconPath = path.join(__dirname, "../build/" + (process.platform === "win32" ? "icon.ico" : "icon.png"));

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
    },
  });

  // In development, load from Vite dev server
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load built files
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Open DevTools on F12
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Register a custom protocol to handle file:// properly for Firebase Auth
// This ensures Firebase Auth works correctly in the packaged Electron app
app.whenReady().then(() => {
  // Allow Firebase Auth to work in Electron by handling the redirect
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "nova-crm",
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
      },
    },
  ]);

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
