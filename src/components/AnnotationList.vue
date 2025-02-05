<template>
  <div class="q-pa-md">
    <!-- Tool Selection Toolbar -->
    <div class="tool-selection">
      <q-btn icon="timeline" flat round tooltip="Line Annotation Tool" @click="selectTool('line')"
        :class="{ active: store.currentTool === 'line' }" />
      <q-btn icon="polymer" flat round tooltip="Polygon Annotation Tool - press Enter to finish"
        @click="selectTool('polygon')" :class="{ active: store.currentTool === 'polygon' }" />
    </div>
    <!-- Updated input for micrometerPerPixel -->
    <q-input v-if="store.currentImageAnnotation" v-model.number="store.currentImageAnnotation.micrometerPerPixel"
      type="number" label="Micrometer Per Pixel" dense />
    <!-- Annotation list displayed in a table -->
    <h4>Polygon Annotations</h4>
    <table v-if="polygonAnnotations.length">
      <thead>
        <tr>
          <th>#</th>
          <th>Area (pixel²)</th>
          <th>Area (µm²)</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ann, index) in polygonAnnotations" :key="index">
          <td>{{ index + 1 }}</td>
          <td>{{ ann.area.toFixed(1) }}</td>
          <!-- Now call areaInMicroSquared with no argument -->
          <td>{{ ann.areaInMicroSquared.toFixed(1) }}</td>
          <td>
            <q-btn icon="delete" flat round @click="deleteAnnotation(ann)" />
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>No polygon annotations yet.</p>
  </div>
</template>

<script setup lang="ts">
import { useGlobalStore } from 'src/stores/global-store';
import { ref, computed } from 'vue';

const store = useGlobalStore();

function selectTool(tool: 'line' | 'polygon') {
  store.currentTool = tool;
  // In a larger app, you might propagate this tool selection via global store or an event bus.
}

function deleteAnnotation(ann: any) {
  store.currentImageAnnotation?.removeAnnotation(ann);
}

const editingRow = ref<number | null>(null);
const polygonAnnotations = computed(() => store.currentImageAnnotation?.annotations ?? []);
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
</style>
