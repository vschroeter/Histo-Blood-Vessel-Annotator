<template>
  <div class="q-pa-md">
    <!-- Tool Selection Toolbar -->
    <div class="tool-selection">
      <!-- <q-btn icon="timeline" flat round tooltip="Line Annotation Tool" @click="selectTool('line')"
        :class="{ active: store.currentTool === 'line' }" /> -->
      <q-btn icon="polymer" flat round tooltip="Polygon Annotation Tool - press Enter to finish"
        @click="selectTool('polygon')" :class="{ active: store.currentTool === 'polygon' }" />
      <q-btn icon="arrow_outward" flat round tooltip="Line Annotation Tool - select two points"
        @click="selectTool('line')" :class="{ active: store.currentTool === 'line' }" />
    </div>
    <!-- Updated input for micrometerPerPixel -->
    <q-input v-if="store.currentImageAnnotation" v-model.number="store.currentImageAnnotation.micrometerPerPixel"
      type="number" label="Micrometer Per Pixel" dense />
    <!-- Annotation list displayed in a table -->
    <h4>Polygon Annotations</h4>
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
      <!-- <p>Outer Area (calculated): {{ store.currentImageAnnotation.outerCircleAreaCalculatedInMicroSquared.toFixed(3) }}</p>
      <p>Inner Area (calculated): {{ store.currentImageAnnotation.innerAreaCalculatedInMicroSquared.toFixed(3) }}</p> -->

      <p>Calculated Outer Diameter (µm): {{ store.currentImageAnnotation.outerCalculatedDiameterInMicro.toFixed(3) }}
      </p>
      <p>Calculated Inner Diameter (µm): {{ store.currentImageAnnotation.innerCalculatedDiameterInMicro.toFixed(3) }}
      </p>
      <p>Average Wall Thickness (µm): {{ store.currentImageAnnotation.averageWallThicknessInMicro.toFixed(3) }}</p>
      <p>Media Lumen Ratio: {{ store.currentImageAnnotation.mediaLumenRatio.toFixed(3) }}</p>
    </div>

    <h4>Line Annotations</h4>
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
      <p>Shortest Line Annotation (µm): {{ store.currentImageAnnotation.shortestLineAnnotationLength.toFixed(1)
      }}
      </p>
      <p>Longest Line Annotation (µm): {{ store.currentImageAnnotation.longestLineAnnotationLength.toFixed(1) }}
      </p>
      <p>Wall Thickness Variability: {{ store.currentImageAnnotation.wallThicknessVariability.toFixed(2) }}
      </p>
    </div>

  </div>

</template>

<script setup lang="ts">
import { type LineAnnotation, type PolygonAnnotation } from 'src/model/annotations';
import { useGlobalStore } from 'src/stores/global-store';
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const store = useGlobalStore();

function selectTool(tool: 'line' | 'polygon') {
  store.currentTool = tool;
}

watch(() => store.currentTool, (tool) => {
  if (tool !== "polygon" && tool !== "line") {
    store.currentTool = "polygon"
  }
});


function deleteAnnotation(ann: any) {
  store.currentImageAnnotation?.removeAnnotation(ann);
  updateAnnotations();
}


const polygonAnnotations = ref<PolygonAnnotation[]>([]);
const lineAnnotations = ref<LineAnnotation[]>([]);

// const annotations = computed(() => store.currentImageAnnotation?.annotations ?? []);

// const polygonAnnotations = computed(() => annotations.value.filter(ann => ann instanceof PolygonAnnotation));
// const lineAnnotations = computed(() => annotations.value.filter(ann => ann instanceof LineAnnotation));

// watch(() => store.currentImageAnnotation?.updateValue, () => {
//   console.log('annotations changed', store.currentImageAnnotation?.annotations);
//   polygonAnnotations.value = store.currentImageAnnotation?.polygonAnnotations ?? [];
//   lineAnnotations.value = store.currentImageAnnotation?.lineAnnotations ?? [];
// });

function updateAnnotations() {
  polygonAnnotations.value = store.currentImageAnnotation?.polygonAnnotations ?? [];
  lineAnnotations.value = store.currentImageAnnotation?.lineAnnotations ?? [];
}

onMounted(() => {


  let stopListening: (() => void) | null = null;

  const attachListener = () => {
    stopListener();
    const imgAnn = store.currentImageAnnotation;
    if (imgAnn) {
      stopListening = imgAnn.onUpdate(() => {
        updateAnnotations();
      });
      // initial fill
      updateAnnotations();
    }
  };

  const stopListener = () => {
    if (stopListening) {
      stopListening();
      stopListening = null;
    }
  };

  watch(() => store.currentImageAnnotation, () => {
    console.log('currentImageAnnotation changed', store.currentImageAnnotation);
    attachListener();
  }, { immediate: true });

  onBeforeUnmount(() => {
    stopListener();
  });
});


// const polygonAnnotations = computed(() => store.currentImageAnnotation?.polygonAnnotations ?? []);
// const lineAnnotations = computed(() => store.currentImageAnnotation?.lineAnnotations ?? []);

// Get micrometer per pixel from the current image annotation or default to 1
const mpp = computed(() => store.currentImageAnnotation?.micrometerPerPixel ?? 1);
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

.color-box {
  width: 24px;
  height: 24px;
  cursor: pointer;
  border: 1px solid #000;
  display: inline-block;
}

.ratio-info {
  margin-top: 12px;
  font-weight: bold;
}
</style>
