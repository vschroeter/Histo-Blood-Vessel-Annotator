import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getTiffFiles: (folder: string) => ipcRenderer.invoke('get-tiff-files', folder),
  getPngData: (imagePath: string) => ipcRenderer.invoke('get-png-data', imagePath),
  saveAnnotationsData: (imagePath: string, data: string) => ipcRenderer.invoke('save-annotations-data', imagePath, data),
  loadAnnotationsData: (imagePath: string) => ipcRenderer.invoke('get-annotations-data', imagePath),
  checkAnnotationState: (filePath: string) => ipcRenderer.invoke('check-annotation-state', filePath)
});
