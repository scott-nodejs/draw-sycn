const { contextBridge } = require('electron')
contextBridge.exposeInMainWorld('studentDesktop', { platform: process.platform, isElectron: true })
