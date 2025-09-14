import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import { type ImageAnnotation } from 'src/model/annotations';
import { ref } from 'vue';

export const useGlobalStore = defineStore('global', {
  state: () => ({
    currentImagePath: null as string | null,
    folderPath: useStorage('folderPath', ''), // persistent folder path
    currentTool: 'polygon' as 'line' | 'polygon' | null,
    currentImageAnnotation: ref<ImageAnnotation | null>(null),

  }),
  // ...existing code...
});

export const globalStaticStore = {
  // currentImageAnnotation

}
