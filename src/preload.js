const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
  readFile: (filePath) => ipcRenderer.invoke('viewer:read-file', filePath),
  runSync: (jobs) => ipcRenderer.invoke('sync:run', jobs),
  loadSyncJobs: () => ipcRenderer.invoke('state:load-sync-jobs'),
  saveSyncJobs: (jobs) => ipcRenderer.invoke('state:save-sync-jobs', jobs)
});
