import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import sharp from 'sharp';

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

const currentDir = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: BrowserWindow | undefined;

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(currentDir, 'icons/icon.png'), // tray icon
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(
        currentDir,
        path.join(process.env.QUASAR_ELECTRON_PRELOAD_FOLDER ?? "", 'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION)
      ),
    },
  });

  if (process.env.DEV) {
    mainWindow.loadURL(process.env.APP_URL ?? "").catch(console.error);
  } else {
    mainWindow.loadFile('index.html').catch(console.error);
  }

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

ipcMain.handle('get-tiff-files', async (_event, folder: string) => {
  try {
    const allFiles = await fs.readdir(folder);
    return allFiles.filter(file => file.toLowerCase().endsWith('.tif'));
  } catch (error) {
    console.error('Error reading folder:', error);
    return [];
  }
});

ipcMain.handle('get-tiff-data', async (_event, imagePath: string) => {
  try {
    const data = await fs.readFile(imagePath);
    return data.toString('base64');
  } catch (error) {
    console.error('Error reading image file:', error);
    return null;
  }
});

ipcMain.handle('get-png-data', async (_event: Electron.IpcMainInvokeEvent, imagePath: string): Promise<string | null> => {
  try {
    const data = await fs.readFile(imagePath);
    const pngBuffer = await sharp(data).png().toBuffer();
    return pngBuffer.toString('base64');
  } catch (error) {
    console.error('Error processing image file:', error);
    return null;
  }
});

ipcMain.handle('save-annotations-data', async (_event, filePath: string, jsonData: string) => {
  try {
    await fs.writeFile(filePath, jsonData, 'utf-8');
    return { success: true };
  } catch (error: any) {
    console.error('Error saving annotations:', error);
    return { success: false, error: error };
  }
});

ipcMain.handle('get-annotations-data', async (_event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading annotations file:', error);
    return null;
  }
});

app.whenReady().then(createWindow).catch(console.error);

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === undefined) {
    createWindow();
  }
});
