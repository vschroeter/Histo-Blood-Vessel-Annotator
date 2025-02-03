<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>
          Quasar App
        </q-toolbar-title>

        <div>Quasar v{{ $q.version }}</div>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
      <!-- Render ImageExplorer in the left sidebar -->
      <ImageExplorer />
    </q-drawer>

    <q-page-container>
      <!-- Render ImageViewer in the central main page -->
      <ImageViewer />
      <!-- ...existing router-view or other content if needed... -->
      <!-- <router-view /> -->
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ImageExplorer from 'src/components/ImageExplorer.vue';
import ImageViewer from 'src/components/ImageViewer.vue';

const leftDrawerOpen = ref(false);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}
</script>
