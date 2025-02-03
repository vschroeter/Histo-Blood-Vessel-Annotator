<template>
  <div class="q-pa-md">
    <!-- Quasar Folder Input bound to persistent store -->
    <q-input dense v-model="store.folderPath" filled placeholder="Enter folder path" class="q-mb-sm" />
    <q-btn dense label="Load Files" @click="loadFiles" class="q-mb-md" />
    <!-- Quasar Dense List for Files -->
    <q-list dense bordered class="bg-white">
      <template v-for="file in files" :key="file">
        <q-item clickable @click="selectFile(file)" class="q-pa-xs" :active="isSelected(file)">
          <q-item-section>{{ file }}</q-item-section>
        </q-item>
        <!-- <q-separator v-if="index < files.length - 1" inset /> -->
      </template>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGlobalStore } from 'src/stores/globa-store';

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
/* Additional styling for improved look */
.bg-white {
  background-color: #ffffff;
}
</style>
