'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel) => (callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('ncm', {
  getState: () => ipcRenderer.invoke('ncm:get-state'),
  /** name: play | pause | toggle | next | prev | like | unlike | toggleLike | seek(arg = seconds) */
  command: (name, arg) => ipcRenderer.invoke('ncm:command', name, arg),
  onState: subscribe('ncm:state'),
  onProgress: subscribe('ncm:progress'),
});
