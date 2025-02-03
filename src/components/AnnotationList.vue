<template>
  <div class="q-pa-md">
    <!-- Tool Selection Toolbar -->
    <div class="tool-selection">
      <q-btn icon="timeline" flat round tooltip="Line Annotation Tool" @click="selectTool('line')"
        :class="{ active: store.currentTool === 'line' }" />
      <q-btn icon="polymer" flat round tooltip="Polygon Annotation Tool - press Enter to finish"
        @click="selectTool('polygon')" :class="{ active: store.currentTool === 'polygon' }" />
    </div>
    <!-- Annotation list content -->
    <h4>Annotations</h4>
    <!-- ...existing or placeholder content... -->
    <p>No annotations yet.</p>
  </div>
</template>

<script setup lang="ts">
import { useGlobalStore } from 'src/stores/global-store';
import { ref } from 'vue';

const store = useGlobalStore();


function selectTool(tool: 'line' | 'polygon') {
  store.currentTool = tool;
  // In a larger app, you might propagate this tool selection via global store or an event bus.
}

// ...existing code...
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

/* ...existing code... */
</style>
