<template>
  <div class="q-pa-md explorer-container">
    <!-- Input and button section -->
    <div class="header-section">
      <q-input dense v-model="store.folderPath" filled placeholder="Enter folder path" class="q-mb-sm" />
      <q-btn dense label="Load Files" @click="loadFiles" class="q-mb-md" />
      <q-btn dense label="Export Annotations" @click="exportCSV" class="q-mb-md" />
    </div>
    <!-- Scrollable list section -->
    <div class="list-container">
      <q-list dense bordered class="bg-white">
        <template v-for="item in files" :key="item.name">
          <q-item clickable @click="selectFile(item.name)" class="q-pa-xs"
            :class="{ 'green-item': item.hasAnnotation, 'red-item': !item.hasAnnotation }">
            <q-item-section :class="{ 'selected-text': store.currentImagePath === store.folderPath + '/' + item.name }">
              {{ item.name }}
            </q-item-section>
          </q-item>
        </template>
      </q-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useGlobalStore } from 'src/stores/global-store';
import { ImageAnnotation } from 'src/model/annotations';

interface FileItem {
  name: string;
  hasAnnotation: boolean;
}

const store = useGlobalStore();
const files = ref<FileItem[]>([]);

async function loadFiles(): Promise<void> {
  if (store.folderPath) {
    try {
      const fileNames: string[] = await window.electronAPI.getTiffFiles(store.folderPath);
      const items: FileItem[] = await Promise.all(
        fileNames.map(async (file) => {
          const annFilePath = store.folderPath + '/annotations/' + file + '_annotations.json';
          const exists = await window.electronAPI.checkAnnotationExists(annFilePath);
          return { name: file, hasAnnotation: exists };
        })
      );
      files.value = items;
    } catch (error) {
      console.error(error);
      files.value = [];
    }
  } else {
    files.value = [];
  }
}

function selectFile(file: string): void {
  store.currentImagePath = store.folderPath + '/' + file;
}

async function exportCSV(): Promise<void> {
  if (!store.folderPath) return;

  const rows: string[] = [];
  const header = "filename,sample_id,microPerPixel,wallThicknessRatio,smallest_area,biggest_area,smallest_circumference,biggest_circumference,smallest_diameter,biggest_diameter".replace(',', ';');
  rows.push(header);

  for (const item of files.value) {
    if (item.hasAnnotation) {
      const annFilePath = store.folderPath + '/annotations/' + item.name + '_annotations.json';
      try {
        const annData: string = await window.electronAPI.loadAnnotationsData(annFilePath);
        if (annData) {
          const imageAnn = ImageAnnotation.fromJSON(annData);
          let sampleId = "";
          const match = item.name.match(/AA\s*(\d{4})_?/);
          if (match) sampleId = match[1]!;

          rows.push([
            item.name,
            sampleId,
            imageAnn.micrometerPerPixel.toFixed(3).replace('.', ','),
            imageAnn.wallThicknessRatio.toFixed(3).replace('.', ','),
            imageAnn.smallestPolygonAreaMicro.toFixed(1).replace('.', ','),
            imageAnn.biggestPolygonAreaMicro.toFixed(1).replace('.', ','),
            imageAnn.smallestPolygonCircumferenceMicro.toFixed(1).replace('.', ','),
            imageAnn.biggestPolygonCircumferenceMicro.toFixed(1).replace('.', ','),
            imageAnn.smallestPolygonDiameterMicro.toFixed(1).replace('.', ','),
            imageAnn.biggestPolygonDiameterMicro.toFixed(1).replace('.', ',')
          ].join(";")); // Replace decimal separator for CSV
        }
      } catch (error) {
        console.error(`Error processing ${item.name}:`, error);
      }
    }
  }

  const csvContent = rows.join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "annotations_export.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

onMounted(async () => {
  if (store.folderPath) {
    await loadFiles();
  }
});

// New watch to update highlighting when annotations change
watch(
  () => store.currentImageAnnotation,
  () => {
    if (store.folderPath) {
      loadFiles().catch((error) => {
        console.error('Error loading files:', error);
      });
    }
  }
);
</script>

<style scoped>
.explorer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header-section {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-container {
  flex: 1 1 auto;
  overflow-y: auto;
}

.bg-white {
  background-color: #ffffff;
}

/* Highlighting styles */
.green-item {
  background-color: #d0f0c0 !important;
}

.red-item {
  background-color: #f0d0d0 !important;
}

.selected-text {
  font-weight: bold;
}
</style>
