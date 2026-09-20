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
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useGlobalStore } from 'src/stores/global-store';
import type { ImageAnnotation } from 'src/model/annotations';
import { KonvaImageViewer } from 'src/model/viewer';

const store = useGlobalStore();
const loading = ref(false);
const containerRef = ref<HTMLDivElement | null>(null);

let konvaImageViewer: KonvaImageViewer | null = null;
const rightMouseDown = ref(false); // New flag for right button hold

// For annotation drawing
// const currentAnnotationPoints = ref<Point[]>([]);

// Reactive annotation object for current image
// const imageAnnotation = computed(() => konvaImageViewer?.imageAnnotation);
const imageAnnotation = ref<ImageAnnotation | null>(null);

watch(() => store.currentImageAnnotation, () => {
  imageAnnotation.value = store.currentImageAnnotation;
});

////////////////////////////////////////////////////////////////////////////
// #region Mounting Stage
////////////////////////////////////////////////////////////////////////////


// Initialize the Konva stage on mounted
onMounted(() => {
  if (containerRef.value) {
    console.log('Initializing Konva stage');
    konvaImageViewer = new KonvaImageViewer(containerRef.value);
    console.log('Konva stage initialized');

    // New: Detect right mouse button press/release
    konvaImageViewer.stage.on('mousedown', (e) => {
      if (e.evt.button === 2 && store.currentTool === 'polygon') {
        rightMouseDown.value = true;
      }
    });

    konvaImageViewer.stage.on('mouseup', (e) => {
      if (e.evt.button === 2 && store.currentTool === 'polygon') {
        rightMouseDown.value = false;
        imageAnnotation.value?.selectedAnnotation?.finalizePoints();
      }
    });

    konvaImageViewer.stage.on('mousemove', (e) => {
      const pos = konvaImageViewer?.updateMousePosition();
      if (!pos) {
        return;
      }
      imageAnnotation.value?.hoverPoint(pos);
      if (rightMouseDown.value && store.currentTool === 'polygon') {
        imageAnnotation.value?.clickPoint(pos);
      }
      konvaImageViewer?.redrawThrottled().catch((error) => {
        console.error('Error redrawing:', error);
      });

    });

    // Retain existing click behavior for left-click
    konvaImageViewer.stage.on('click', (e) => {
      const pos = konvaImageViewer?.updateMousePosition();
      if (!pos) {
        return;
      }

      console.log('click', pos, imageAnnotation.value?.selectedAnnotation);

      // Detect whether right click or left click
      if (e.evt.button === 2) {
        imageAnnotation.value?.rightClickPoint(pos);
      } else {
        imageAnnotation.value?.clickPoint(pos);
      }

      konvaImageViewer?.redrawThrottled().catch((error) => {
        console.error('Error redrawing:', error);
      });
    });

  }
});

////////////////////////////////////////////////////////////////////////////
// #region Mounting Stage
////////////////////////////////////////////////////////////////////////////


// Load and display image using Konva when currentImagePath changes
watch(() => store.currentImagePath, (newPath) => {
  console.log('Loading image:', newPath);
  if (newPath) {
    loading.value = true;

    konvaImageViewer?.loadImage(newPath)
      .then(() => {
        loading.value = false;
        console.log('Annotation', konvaImageViewer?.imageAnnotation);
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
