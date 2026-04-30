const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickVault: () => ipcRenderer.invoke('vault:pick'),
  connectGithub: (repoUrl) => ipcRenderer.invoke('github:connect', repoUrl),
  loadVaultTree: (vaultPath) => ipcRenderer.invoke('vault:tree', vaultPath),
  readNote: (vaultPath, notePath) => ipcRenderer.invoke('note:read', vaultPath, notePath),
  saveNote: (vaultPath, notePath, content) => ipcRenderer.invoke('note:save', vaultPath, notePath, content),
  createNote: (vaultPath, parentRelativePath, fileName) => ipcRenderer.invoke('note:create', vaultPath, parentRelativePath, fileName)
});
