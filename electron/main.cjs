const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const WINDOW_WIDTH = 380;
const WINDOW_HEIGHT = 430;
const PET_LEFT = 86;
const PET_TOP = 198;
const PET_RIGHT = 294;
const PET_BOTTOM = 416;
const WALK_STEP_MS = 24;
const WALK_STEP_PIXELS = 2;
const DRAG_STEP_MS = 16;
const LAYOUT_VERSION = 3;
const DEV_MODE = process.argv.includes("--dev");
const CAPTURE_PATH = process.env.BUBU_CAPTURE_PATH;
const CAPTURE_COMMAND = process.env.BUBU_CAPTURE_COMMAND;
const WALK_DEBUG = process.env.BUBU_WALK_DEBUG === "1";

let mainWindow = null;
let tray = null;
let isQuitting = false;
let menuOpen = false;
let dragging = false;
let lastIgnored = null;
let cursorTimer = null;
let walkTimer = null;
let dragTimer = null;
let dragOrigin = null;
let walkDirection = -1;
let walkLeftLimit = 0;
let walkRightLimit = 0;
let pinned = true;
let settings = {};

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(next) {
  settings = { ...settings, ...next };
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
  } catch (error) {
    console.warn("Unable to save desktop pet settings:", error);
  }
}

function isVisibleOnAnyDisplay(bounds) {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

function getDefaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - PET_RIGHT - 48),
    y: Math.round(workArea.y + workArea.height - PET_BOTTOM - 48)
  };
}

function loadPosition() {
  const saved = settings.position;
  if (
    saved &&
    settings.layoutVersion === LAYOUT_VERSION &&
    Number.isFinite(saved.x) &&
    Number.isFinite(saved.y) &&
    isVisibleOnAnyDisplay({
      x: saved.x,
      y: saved.y,
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT
    })
  ) {
    return saved;
  }
  return getDefaultPosition();
}

function clampWindowPosition(x, y) {
  if (!mainWindow) return { x, y };
  const current = mainWindow.getBounds();
  const display = screen.getDisplayMatching({
    x,
    y,
    width: current.width,
    height: current.height
  });
  const area = display.workArea;
  return {
    x: Math.round(Math.min(Math.max(x, area.x - PET_LEFT), area.x + area.width - PET_RIGHT)),
    y: Math.round(Math.min(Math.max(y, area.y - PET_TOP), area.y + area.height - PET_BOTTOM))
  };
}

function moveWindowTo(x, y) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const current = mainWindow.getBounds();
  mainWindow.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: current.width,
    height: current.height
  });
}

function stopDragTracking() {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
  dragOrigin = null;
}

function beginDragTracking() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  stopDragTracking();
  dragging = true;
  const cursor = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();
  dragOrigin = {
    cursorX: cursor.x,
    cursorY: cursor.y,
    windowX: bounds.x,
    windowY: bounds.y
  };

  dragTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !dragging || !dragOrigin) {
      stopDragTracking();
      return;
    }
    const currentCursor = screen.getCursorScreenPoint();
    const next = clampWindowPosition(
      dragOrigin.windowX + currentCursor.x - dragOrigin.cursorX,
      dragOrigin.windowY + currentCursor.y - dragOrigin.cursorY
    );
    moveWindowTo(next.x, next.y);
  }, DRAG_STEP_MS);

  refreshInteractionState();
  return bounds;
}

function setMouseIgnored(ignored) {
  if (!mainWindow || mainWindow.isDestroyed() || ignored === lastIgnored) return;
  lastIgnored = ignored;
  if (ignored) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
}

function cursorIsOverPet() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return false;
  if (menuOpen || dragging) return true;

  const cursor = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();
  const x = cursor.x - bounds.x;
  const y = cursor.y - bounds.y;

  return x >= 78 && x <= bounds.width - 78 && y >= 184 && y <= bounds.height;
}

function refreshInteractionState() {
  setMouseIgnored(!cursorIsOverPet());
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: mainWindow?.isVisible() ? "把布布藏起来" : "叫布布出来",
        click: () => toggleWindow()
      },
      {
        label: "摸摸布布",
        click: () => sendCommand("pat")
      },
      {
        label: "让布布散步",
        click: () => sendCommand("walk")
      },
      { type: "separator" },
      {
        label: "保持置顶",
        type: "checkbox",
        checked: pinned,
        click: (item) => setPinned(item.checked)
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.setToolTip("一二布布桌宠");
}

function createTray() {
  const trayPath = path.join(__dirname, "..", "build", "tray.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(trayPath).resize({ width: 20, height: 20 });
  } catch {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  tray.on("click", () => toggleWindow());
  refreshTrayMenu();
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
    refreshInteractionState();
  }
  refreshTrayMenu();
}

function sendCommand(command) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.webContents.send("pet:command", command);
}

function setPinned(nextPinned) {
  pinned = Boolean(nextPinned);
  mainWindow?.setAlwaysOnTop(pinned, "floating");
  writeSettings({ pinned });
  mainWindow?.webContents.send("pin:changed", pinned);
  refreshTrayMenu();
  return pinned;
}

function stopWalking() {
  if (walkTimer) {
    clearInterval(walkTimer);
    walkTimer = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    writeSettings({
      position: mainWindow.getBounds(),
      layoutVersion: LAYOUT_VERSION
    });
  }
}

function startWalking() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  stopWalking();
  mainWindow.show();

  const bounds = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(bounds);
  const targetY = Math.round(workArea.y + workArea.height - PET_BOTTOM - 4);
  moveWindowTo(bounds.x, targetY);

  const screenLeft = workArea.x - PET_LEFT + 4;
  const screenRight = workArea.x + workArea.width - PET_RIGHT - 4;
  walkLeftLimit = Math.max(screenLeft, bounds.x - 160);
  walkRightLimit = Math.min(screenRight, bounds.x + 160);
  if (walkRightLimit <= walkLeftLimit) {
    walkLeftLimit = screenLeft;
    walkRightLimit = screenRight;
  }

  const distanceToLeft = bounds.x - walkLeftLimit;
  const distanceToRight = walkRightLimit - bounds.x;
  walkDirection = distanceToRight <= distanceToLeft ? 1 : -1;
  let walkPositionX = bounds.x;

  let walkTick = 0;
  walkTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      stopWalking();
      return;
    }
    const current = mainWindow.getBounds();
    walkTick += 1;
    walkPositionX += walkDirection * WALK_STEP_PIXELS;

    if (walkPositionX <= walkLeftLimit || walkPositionX >= walkRightLimit) {
      walkDirection *= -1;
      walkPositionX = Math.min(
        Math.max(walkPositionX, walkLeftLimit),
        walkRightLimit
      );
      mainWindow.webContents.send("walk:bounce", walkDirection);
    }

    if (WALK_DEBUG && (walkTick === 1 || walkTick % 20 === 0)) {
      console.log(
          `[walk] tick=${walkTick} x=${current.x} target=${walkPositionX} ` +
          `direction=${walkDirection} ` +
          `limits=${walkLeftLimit}..${walkRightLimit}`
      );
    }
    moveWindowTo(walkPositionX, targetY);
  }, WALK_STEP_MS);
}

async function captureForQa() {
  if (!CAPTURE_PATH) return;
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (process.env.BUBU_CAPTURE_MENU === "1") {
    await mainWindow.webContents.executeJavaScript(
      "document.querySelector('.pet-hitarea')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))"
    );
    await new Promise((resolve) => setTimeout(resolve, 700));
  } else if (CAPTURE_COMMAND) {
    sendCommand(CAPTURE_COMMAND);
    const waitMs = Number(
      process.env.BUBU_CAPTURE_ACTION_WAIT_MS ??
        (CAPTURE_COMMAND === "cry" ? 1200 : 700)
    );
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  const image = await mainWindow.webContents.capturePage();
  fs.mkdirSync(path.dirname(CAPTURE_PATH), { recursive: true });
  fs.writeFileSync(CAPTURE_PATH, image.toPNG());
  setTimeout(() => {
    isQuitting = true;
    app.quit();
  }, 150);
}

function createWindow() {
  settings = readSettings();
  pinned = settings.pinned !== false;
  const position = loadPosition();
  if (settings.layoutVersion !== LAYOUT_VERSION) {
    writeSettings({ position, layoutVersion: LAYOUT_VERSION });
  }

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: position.x,
    y: position.y,
    transparent: true,
    frame: false,
    resizable: true,
    minWidth: WINDOW_WIDTH,
    maxWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    maxHeight: WINDOW_HEIGHT,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: pinned,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.setAlwaysOnTop(pinned, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (DEV_MODE) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    refreshInteractionState();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    captureForQa().catch((error) => {
      console.error("Capture failed:", error);
      app.quit();
    });
  });

  mainWindow.on("close", (event) => {
    writeSettings({
      position: mainWindow.getBounds(),
      pinned,
      layoutVersion: LAYOUT_VERSION
    });
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      refreshTrayMenu();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  cursorTimer = setInterval(refreshInteractionState, 40);
}

ipcMain.on("pet:menu-open", (_event, open) => {
  menuOpen = Boolean(open);
  refreshInteractionState();
});

ipcMain.handle("window:begin-drag", () => beginDragTracking());

ipcMain.handle("window:get-placement", () => {
  if (!mainWindow) return null;
  const bounds = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(bounds);
  return { bounds, workArea };
});

ipcMain.handle("window:finish-drag", () => {
  if (!mainWindow) return null;
  stopDragTracking();
  dragging = false;
  const bounds = mainWindow.getBounds();
  const next = clampWindowPosition(bounds.x, bounds.y);
  moveWindowTo(next.x, next.y);
  writeSettings({ position: next, layoutVersion: LAYOUT_VERSION });
  refreshInteractionState();
  return mainWindow.getBounds();
});

ipcMain.handle("window:start-walk", () => {
  startWalking();
  return walkDirection;
});
ipcMain.on("window:stop-walk", () => stopWalking());

ipcMain.handle("window:set-pinned", (_event, nextPinned) => setPinned(nextPinned));

ipcMain.on("app:quit", () => {
  isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("local.bubu.desktop-pet");
  }
  createWindow();
  createTray();

  app.on("activate", () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (cursorTimer) clearInterval(cursorTimer);
  stopDragTracking();
  stopWalking();
});
