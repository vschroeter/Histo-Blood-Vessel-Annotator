<template>
  <div class="q-pa-md">
    <div class="tool-selection">
      <q-btn icon="polymer" flat round tooltip="Polygon annotation — press Enter to finish"
        @click="selectTool('polygon')" :class="{ active: store.currentTool === 'polygon' }" />
      <q-btn icon="arrow_outward" flat round tooltip="Line annotation — select two points"
        @click="selectTool('line')" :class="{ active: store.currentTool === 'line' }" />
    </div>
    <q-input v-if="store.currentImageAnnotation" v-model.number="store.currentImageAnnotation.micrometerPerPixel"
      type="number" label="Micrometre per pixel" dense />
    <h4>Polygon annotations</h4>
    <table v-if="polygonAnnotations.length" class="annotation-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Area (pixel²)</th>
          <th>Area (µm²)</th>
          <th>Circumference (µm)</th>
          <th>Diameter (µm)</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ann, index) in polygonAnnotations" :key="index">
          <td>{{ index + 1 }}</td>
          <td>{{ ann.areaPixel.toFixed(1) }}</td>
          <td>{{ ann.areaInMicroSquared.toFixed(1) }}</td>
          <td>{{ (ann.circumferenceBasedOnArea * mpp).toFixed(1) }}</td>
          <td>{{ (ann.diameterBasedOnArea * mpp).toFixed(1) }}</td>
          <td>
            <q-btn icon="delete" flat round @click="deleteAnnotation(ann)" />
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>No polygon annotations yet.</p>
    <div v-if="store.currentImageAnnotation" class="ratio-info">
      <p>Calculated outer diameter (µm): {{ store.currentImageAnnotation.outerCalculatedDiameterInMicro.toFixed(3) }}</p>
      <p>Calculated inner diameter (µm): {{ store.currentImageAnnotation.innerCalculatedDiameterInMicro.toFixed(3) }}</p>
      <p>Average wall thickness (µm): {{ store.currentImageAnnotation.averageWallThicknessInMicro.toFixed(3) }}</p>
      <p>Media–lumen ratio: {{ store.currentImageAnnotation.mediaLumenRatio.toFixed(3) }}</p>
    </div>

    <h4>Line annotations</h4>
    <table v-if="lineAnnotations.length" class="annotation-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Length (µm)</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ann, index) in lineAnnotations" :key="index">
          <td>{{ index + 1 }}</td>
          <td>{{ (ann.length * mpp).toFixed(1) }}</td>
          <td>
            <q-btn icon="delete" flat round @click="deleteAnnotation(ann)" />
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>No line annotations yet.</p>

    <div v-if="store.currentImageAnnotation" class="ratio-info">
      <p>Shortest line (µm): {{ store.currentImageAnnotation.shortestLineAnnotationLength.toFixed(1) }}</p>
      <p>Longest line (µm): {{ store.currentImageAnnotation.longestLineAnnotationLength.toFixed(1) }}</p>
      <p>Wall-thickness variability: {{ store.currentImageAnnotation.wallThicknessVariability.toFixed(2) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DEFAULT_MICROMETER_PER_PIXEL, type Annotation, type LineAnnotation, type PolygonAnnotation } from 'src/model/annotations';
import { useGlobalStore } from 'src/stores/global-store';
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const store = useGlobalStore();

function selectTool(tool: 'line' | 'polygon') {
  store.currentTool = tool;
}

watch(() => store.currentTool, (tool) => {
  if (tool !== 'polygon' && tool !== 'line') {
    store.currentTool = 'polygon';
  }
});

function deleteAnnotation(ann: Annotation) {
  store.currentImageAnnotation?.removeAnnotation(ann);
  updateAnnotations();
}

const polygonAnnotations = ref<PolygonAnnotation[]>([]);
const lineAnnotations = ref<LineAnnotation[]>([]);

function updateAnnotations() {
  polygonAnnotations.value = store.currentImageAnnotation?.polygonAnnotations ?? [];
  lineAnnotations.value = store.currentImageAnnotation?.lineAnnotations ?? [];
}

onMounted(() => {
  let stopListening: (() => void) | null = null;

  const stopListener = () => {
    if (stopListening) {
      stopListening();
      stopListening = null;
    }
  };

  const attachListener = () => {
    stopListener();
    const imgAnn = store.currentImageAnnotation;
    if (imgAnn) {
      stopListening = imgAnn.onUpdate(() => {
        updateAnnotations();
      });
      updateAnnotations();
    }
  };

  watch(() => store.currentImageAnnotation, () => {
    attachListener();
  }, { immediate: true });

  onBeforeUnmount(() => {
    stopListener();
  });
});

const mpp = computed(() => store.currentImageAnnotation?.micrometerPerPixel ?? DEFAULT_MICROMETER_PER_PIXEL);
</script>

<style scoped>
.tool-selection {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.q-btn.active {
  background-color: #e0e0e0;
}

.annotation-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.annotation-table th,
.annotation-table td {
  border: 1px solid #ccc;
  padding: 6px 8px;
  text-align: center;
}

.ratio-info {
  margin-top: 12px;
  font-weight: bold;
}
</style>
