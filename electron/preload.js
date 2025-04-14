const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    uploadFile: (fileData) => ipcRenderer.invoke('upload-file', fileData)
}); 