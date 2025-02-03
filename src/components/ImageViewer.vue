<template>
  <div>
    <q-spinner v-if="loading" size="50px" color="primary" />
    <img v-else-if="imageSrc" :src="imageSrc" alt="Converted PNG Image" />
    <div v-else>No image selected</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUpdated, onMounted } from 'vue';
import { useGlobalStore } from 'src/stores/globa-store';

const store = useGlobalStore();

const loading = ref(false);
const imageSrc = ref('');

watch(() => store.currentImagePath, async (newPath) => {
  if (newPath) {
    loading.value = true;
    try {
      const base64Data = await window.electronAPI.getPngData(newPath);
      imageSrc.value = base64Data ? `data:image/png;base64,${base64Data}` : '';
    } catch (error) {
      console.error(error);
      imageSrc.value = '';
    }
    loading.value = false;
  }
});

onMounted(() => {

})

onUpdated(() => {

})

</script>

<style scoped></style>
