import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';

export const useGlobalStore = defineStore('global', {
  state: () => ({
    currentImagePath: null as string | null,
    folderPath: useStorage('folderPath', ''), // persistent folder path
    currentTool: null as 'line' | 'polygon' | null,

  }),
  // ...existing code...
});
