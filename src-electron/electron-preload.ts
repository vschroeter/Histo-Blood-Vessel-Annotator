/**
 * This file is used specifically for security reasons.
 * Here you can access Nodejs stuff and inject functionality into
 * the renderer thread (accessible there through the "window" object)
 *
 * WARNING!
 * If you import anything from node_modules, then make sure that the package is specified
 * in package.json > dependencies and NOT in devDependencies
 *
 * Example (injects window.myAPI.doAThing() into renderer thread):
 *
 *   import { contextBridge } from 'electron'
 *
 *   contextBridge.exposeInMainWorld('myAPI', {
 *     doAThing: () => {}
 *   })
 *
 * WARNING!
 * If accessing Node functionality (like importing @electron/remote) then in your
 * electron-main.ts you will need to set the following when you instantiate BrowserWindow:
 *
 * mainWindow = new BrowserWindow({
 *   // ...
 *   webPreferences: {
 *     // ...
 *     sandbox: false // <-- to be able to import @electron/remote in preload script
 *   }
 * }
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getTiffFiles: (folder: string) => ipcRenderer.invoke('get-tiff-files', folder),
  getTiffData: (imagePath: string) => ipcRenderer.invoke('get-tiff-data', imagePath),
  getPngData: (imagePath: string) => ipcRenderer.invoke('get-png-data', imagePath),
  saveAnnotationsData: (imagePath: string, data: string) => ipcRenderer.invoke('save-annotations-data', imagePath, data),
  loadAnnotationsData: (imagePath: string) => ipcRenderer.invoke('get-annotations-data', imagePath),
  checkAnnotationExists: (filePath: string) => ipcRenderer.invoke('check-annotation-exists', filePath)
});
