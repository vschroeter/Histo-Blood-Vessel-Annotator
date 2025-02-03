<template>
  <q-page>
    <div class="viewer-container" ref="containerRef" style="min-height: inherit;">
    </div>
    <div
      style="position: absolute; bottom: 10px; right: 10px; background: rgba(255,255,255,0.7); padding: 4px 8px; border-radius: 4px; font-size: 14px;">
      {{ Math.round(konvaImageViewer?.currentPixel.value.x ?? 0) }}, {{
        Math.round(konvaImageViewer?.currentPixel.value.y ?? 0) }} ({{
        konvaImageViewer?.currentZoom.value.toFixed(2) }})
    </div>
    <q-inner-loading :showing="loading">
      <q-spinner v-if="loading" size="250px" color="primary" />
    </q-inner-loading>
  </q-page>>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import type Konva from 'konva';
import { useGlobalStore } from 'src/stores/global-store';
import { useThrottleFn } from '@vueuse/core';
import type { ImageAnnotation } from 'src/model/annotations';
import { LineAnnotation, PolygonAnnotation } from 'src/model/annotations';
import { KonvaImageViewer } from 'src/model/viewer';

const store = useGlobalStore();
const loading = ref(false);
const containerRef = ref<HTMLDivElement | null>(null);

let konvaImageViewer: KonvaImageViewer | null = null;

// const currentPixel = ref({ x: 0, y: 0 });
// const currentZoom = ref(1);

// For annotation drawing
// const currentAnnotationPoints = ref<Point[]>([]);

// Reactive annotation object for current image
const currentImageAnnotation = ref<ImageAnnotation | null>(null);

// const updateMousePosition = useThrottleFn((pos: { x: number, y: number }) => {
//   // console.log(`Stage pointer: (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
// }, 100);

////////////////////////////////////////////////////////////////////////////
// #region Mounting Stage
////////////////////////////////////////////////////////////////////////////

// Initialize the Konva stage on mounted
onMounted(() => {
  if (containerRef.value) {
    console.log('Initializing Konva stage');
    konvaImageViewer = new KonvaImageViewer(containerRef.value);
    console.log('Konva stage initialized');
  }
});

////////////////////////////////////////////////////////////////////////////
// #region Mounting Stage
////////////////////////////////////////////////////////////////////////////

// Helper: save current annotations as JSON file via electronAPI
async function saveAnnotations() {
  if (!currentImageAnnotation.value || !store.folderPath || !store.currentImagePath) return;
  const fileName = store.currentImagePath.split('/').pop() || store.currentImagePath;
  const annFilePath = store.folderPath + '/' + fileName + '_annotations.json';
  const jsonData = currentImageAnnotation.value.toJSON();
  try {
    await window.electronAPI.saveAnnotationsData(annFilePath, jsonData);
  } catch (error) {
    console.error('Error saving annotations:', error);
  }
}

// Load and display image using Konva when currentImagePath changes
watch(() => store.currentImagePath, (newPath) => {
  console.log('Loading image:', newPath);
  if (newPath) {
    loading.value = true;

    konvaImageViewer?.loadImage(newPath)
      .then(() => {
        loading.value = false;
      })
      .catch((error) => {
        console.error('Error loading image:', error);
        loading.value = false;
      });
  }
});
</script>

<style scoped>
.viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.spinner-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
}
</style>
