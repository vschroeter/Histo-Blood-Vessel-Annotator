

declare namespace NodeJS {
  interface ProcessEnv {
    QUASAR_PUBLIC_FOLDER: string;
    QUASAR_ELECTRON_PRELOAD_FOLDER: string;
    QUASAR_ELECTRON_PRELOAD_EXTENSION: string;
    APP_URL: string;
  }
}

interface ElectronAPI {
  getTiffFiles(folder: string): Promise<string[]>;
  getTiffData(imagePath: string): Promise<string | null>;
  getPngData(imagePath: string): Promise<string | null>;
  saveAnnotationsData(imagePath: string, data: string): Promise<void>;
  loadAnnotationsData(imagePath: string): Promise<string>;
  checkAnnotationExists(filePath: string): Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export { };
