<template>
  <q-page>
    <div class="viewer-container" ref="containerRef" style="min-height: inherit;">
      <!-- <q-spinner v-if="loading" size="50px" color="primary" class="spinner-overlay" /> -->
    </div>
  </q-page>>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import Konva from 'konva';
import { useGlobalStore } from 'src/stores/globa-store';
import { useThrottleFn } from '@vueuse/core';

const store = useGlobalStore();
const loading = ref(false);
const imageSrc = ref('');

const containerRef = ref<HTMLDivElement | null>(null);
let stage: Konva.Stage;
let layer: Konva.Layer;
let konvaImage: Konva.Image | null = null;

// Throttled position update

const updateMousePosition = useThrottleFn((pos: { x: number, y: number }) => {
  console.log(`Stage pointer: (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
}, 100);


// Initialize the Konva stage on mounted
onMounted(() => {
  if (containerRef.value) {
    console.log('Initializing Konva stage');
    stage = new Konva.Stage({
      container: containerRef.value,
      width: containerRef.value.clientWidth,
      height: containerRef.value.clientHeight,
      draggable: true,
    });

    layer = new Konva.Layer();
    stage.add(layer);

    // Disable image smoothing on layer canvas context
    const context = layer.getCanvas().getContext();
    context.imageSmoothingEnabled = false;

    // Optionally, disable smoothing after each draw:
    layer.on('batchDraw', () => {
      const context = layer.getCanvas().getContext();
      context.imageSmoothingEnabled = false;
    });

    // Zoom on wheel
    stage.on('wheel', (e: any) => {
      e.evt.preventDefault();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scaleBy = 1.1;
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      stage.scale({ x: newScale, y: newScale });

      // Adjust position to keep pointer stationary
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
      stage.batchDraw();
    });

    // Display pointer position considering zoom & pan
    stage.on('mousemove', (e) => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Include stage position and scale to get the correct image pixel position
      pos.x -= stage.x();
      pos.y -= stage.y();

      pos.x /= stage.scaleX();
      pos.y /= stage.scaleY();

      updateMousePosition({ x: pos.x, y: pos.y }).catch(console.error);

      // // Convert stage coordinates to image pixel position
      // console.log(`Stage pointer: (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
    });

    // Add double-click to reset view
    stage.on('dblclick', () => {
      if (konvaImage) {
        const imgElement = konvaImage.image() as HTMLImageElement;
        const containerWidth = containerRef.value?.clientWidth || imgElement.width;
        const containerHeight = containerRef.value?.clientHeight || imgElement.height;
        const scaleFactor = Math.min(containerWidth / imgElement.width, containerHeight / imgElement.height);
        stage.position({ x: 0, y: 0 });
        stage.scale({ x: scaleFactor, y: scaleFactor });
        stage.batchDraw();
      }
    });

    // Update stage size on window resize
    window.addEventListener('resize', () => {
      console.log('Window resize event');
      if (containerRef.value) {
        stage.width(containerRef.value.clientWidth);
        stage.height(containerRef.value.clientHeight);
        stage.batchDraw();
      }
    });

    console.log('Konva stage initialized');

  }
});

// Load and display image using Konva when currentImagePath changes
watch(() => store.currentImagePath, async (newPath) => {
  console.log('Loading image:', newPath);
  if (newPath) {
    loading.value = true;
    try {
      const base64Data = await window.electronAPI.getPngData(newPath);
      imageSrc.value = base64Data ? `data:image/png;base64,${base64Data}` : '';


      if (imageSrc.value) {
        const img = new window.Image();
        img.onload = () => {
          // Remove previous image if any
          if (konvaImage) {
            konvaImage.destroy();
          }
          konvaImage = new Konva.Image({
            image: img,
            x: 0,
            y: 0,
            draggable: false,
          });
          // Compute scale factor to fit image completely in the container
          const containerWidth = containerRef.value?.clientWidth || img.width;
          const containerHeight = containerRef.value?.clientHeight || img.height;
          const scaleFactor = Math.min(containerWidth / img.width, containerHeight / img.height);
          // Reset stage transform: top left corner and computed scale
          stage.position({ x: 0, y: 0 });
          stage.scale({ x: scaleFactor, y: scaleFactor });
          layer.add(konvaImage);
          layer.batchDraw();
          loading.value = false;
        };
        img.src = imageSrc.value;
      } else {
        loading.value = false;
      }
    } catch (error) {
      console.error(error);
      loading.value = false;
    }
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
