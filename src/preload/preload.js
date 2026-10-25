'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel) => (callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

// Types: src/renderer/types.ts (NcmApi / DesktopApi)
contextBridge.exposeInMainWorld('ncm', {
  getState: () => ipcRenderer.invoke('ncm:get-state'),
  /** name: play | pause | toggle | next | prev | like | unlike | toggleLike | seek(arg = seconds) */
  command: (name, arg) => ipcRenderer.invoke('ncm:command', name, arg),
  reconnect: () => ipcRenderer.invoke('ncm:reconnect'),
  onState: subscribe('ncm:state'),
  onProgress: subscribe('ncm:progress'),
});

contextBridge.exposeInMainWorld('desktop', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    setPassword: (password) => ipcRenderer.invoke('settings:set-password', password),
    clearPassword: () => ipcRenderer.invoke('settings:clear-password'),
  },
  screensaver: {
    getState: () => ipcRenderer.invoke('screensaver:get-state'),
    enter: () => ipcRenderer.invoke('screensaver:enter'),
    exit: (password) => ipcRenderer.invoke('screensaver:exit', password),
    onChange: subscribe('screensaver:state'),
  },
});
