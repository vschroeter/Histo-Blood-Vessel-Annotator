<template>
  <div class="q-pa-md">
    <!-- Quasar Folder Input bound to persistent store -->
    <q-input dense v-model="store.folderPath" filled placeholder="Enter folder path" class="q-mb-sm" />
    <q-btn dense label="Load Files" @click="loadFiles" class="q-mb-md" />
    <!-- Quasar Dense List for Files -->
    <q-list dense bordered class="bg-white">
      <q-item v-for="file in files" :key="file" clickable @click="selectFile(file)" class="q-pa-xs">
        <q-item-section>{{ file }}</q-item-section>
        <q-separator inset />
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useGlobalStore } from 'src/stores/globa-store';

const store = useGlobalStore();
const files = ref<string[]>([]);

function loadFiles() {
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

function selectFile(file: string) {
  store.currentImagePath = store.folderPath + '/' + file;
}
</script>

<style scoped>
/* Additional styling for improved look */
.bg-white {
  background-color: #ffffff;
}
</style>
