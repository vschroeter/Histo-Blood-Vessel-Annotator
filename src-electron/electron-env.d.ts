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
  getPngData(imagePath: string): Promise<string | null>;
  saveAnnotationsData(imagePath: string, data: string): Promise<void>;
  loadAnnotationsData(imagePath: string): Promise<string>;
  checkAnnotationState(filePath: string): Promise<AnnotationState>;
}

declare global {
  type AnnotationState = 'complete' | 'incomplete' | 'missing';

  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
