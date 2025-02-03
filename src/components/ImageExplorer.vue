<template>
  <div class="q-pa-md explorer-container">
    <!-- Input and button section -->
    <div class="header-section">
      <q-input dense v-model="store.folderPath" filled placeholder="Enter folder path" class="q-mb-sm" />
      <q-btn dense label="Load Files" @click="loadFiles" class="q-mb-md" />
    </div>
    <!-- Scrollable list section -->
    <div class="list-container">
      <q-list dense bordered class="bg-white">
        <template v-for="file in files" :key="file">
          <q-item clickable @click="selectFile(file)" class="q-pa-xs" :active="isSelected(file)">
            <q-item-section>{{ file }}</q-item-section>
          </q-item>
        </template>
      </q-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGlobalStore } from 'src/stores/global-store';

const store = useGlobalStore();
const files = ref<string[]>([]);

function loadFiles(): void {
  if (store.folderPath) {
    window.electronAPI.getTiffFiles(store.folderPath)
      .then(f => { files.value = f; })
      .catch(error => {
        console.error(error);
        files.value = [];
      });
  } else {
    files.value = [];
  }
}

function selectFile(file: string): void {
  store.currentImagePath = store.folderPath + '/' + file;
}

const isSelected = (file: string): boolean => {
  return store.currentImagePath === store.folderPath + '/' + file;
};

onMounted(() => {
  if (store.folderPath) {
    loadFiles();
  }
});
</script>

<style scoped>
.explorer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header-section {
  flex: 0 0 auto;
}

.list-container {
  flex: 1 1 auto;
  overflow-y: auto;
}

.bg-white {
  background-color: #ffffff;
}
</style>
