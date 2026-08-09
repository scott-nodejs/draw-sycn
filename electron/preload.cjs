const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('whiteboardDesktop', {
  platform: process.platform,
  version: process.versions.electron,
})
