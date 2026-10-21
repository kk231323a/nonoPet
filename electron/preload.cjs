const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("desktopPet", {
  setMenuOpen: (open) => ipcRenderer.send("pet:menu-open", Boolean(open)),
  beginDrag: () => ipcRenderer.invoke("window:begin-drag"),
  finishDrag: () => ipcRenderer.invoke("window:finish-drag"),
  getPlacement: () => ipcRenderer.invoke("window:get-placement"),
  startWalk: () => ipcRenderer.invoke("window:start-walk"),
  stopWalk: () => ipcRenderer.send("window:stop-walk"),
  setAlwaysOnTop: (pinned) => ipcRenderer.invoke("window:set-pinned", Boolean(pinned)),
  quit: () => ipcRenderer.send("app:quit"),
  onCommand: (callback) => subscribe("pet:command", callback),
  onWalkBounce: (callback) => subscribe("walk:bounce", callback),
  onPinnedChange: (callback) => subscribe("pin:changed", callback)
});
