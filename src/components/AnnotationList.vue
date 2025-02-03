<template>
  <div class="q-pa-md">
    <!-- Tool Selection Toolbar -->
    <div class="tool-selection">
      <q-btn icon="timeline" flat round tooltip="Line Annotation Tool" @click="selectTool('line')"
        :class="{ active: store.currentTool === 'line' }" />
      <q-btn icon="polymer" flat round tooltip="Polygon Annotation Tool - press Enter to finish"
        @click="selectTool('polygon')" :class="{ active: store.currentTool === 'polygon' }" />
    </div>
    <!-- Annotation list table -->
    <h4>Polygon Annotations</h4>
    <table v-if="polygonAnnotations.length" class="annotation-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Color</th>
          <th>Area</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ann, index) in polygonAnnotations" :key="index">
          <td>{{ index + 1 }}</td>
          <td>
            <div @click="editingRow = index" class="color-box" :style="{ backgroundColor: ann.color }"></div>
            <q-color v-if="editingRow === index" v-model="ann.color" @blur="editingRow = null" />
          </td>
          <td>{{ ann.area.value.toFixed(2) }}</td>
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

const editingRow = ref<number | null>(null);

// Assume currentImageAnnotation holds the active ImageAnnotation.
// If not available, the table will be empty.
const polygonAnnotations = computed(() => {
  return store.currentImageAnnotations?.annotations.filter(ann => ann.constructor.name === "PolygonAnnotation") || [];
});
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
