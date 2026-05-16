const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (title, body) => {
    ipcRenderer.send('show-notification', { title, body });
  },
  minimizeWindow: () => {
    ipcRenderer.send('minimize-window');
  },
  hideWindow: () => {
    ipcRenderer.send('hide-window');
  },
});
