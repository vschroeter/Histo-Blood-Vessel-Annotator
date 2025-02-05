<template>
  <q-layout view="hHh LpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />
        <q-toolbar-title class="text-center">
          {{ store.currentImagePath || 'Image Annotator' }}
        </q-toolbar-title>
        <q-btn flat dense round icon="settings" aria-label="Settings" @click="toggleRightDrawer" />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above behavior="desktop" bordered :width="leftDrawerWidth" side="left">
      <ImageExplorer />
      <div v-touch-pan.preserveCursor.prevent.mouse.horizontal="resizeLeftDrawer" class="q-drawer__resizerl"></div>
    </q-drawer>


    <!-- Drawer for the right side -->
    <q-drawer show-if-above v-model="rightDrawerOpen" side="right" behavior="desktop" bordered
      :width="rightDrawerWidth">
      <AnnotationList />

      <div v-touch-pan.preserveCursor.prevent.mouse.horizontal="resizeRightDrawer" class="q-drawer__resizerr"></div>

    </q-drawer>


    <q-page-container>

      <ImageViewer />

    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useStorage } from '@vueuse/core';
import ImageExplorer from 'src/components/ImageExplorer.vue';
import ImageViewer from 'src/components/ImageViewer.vue';
import AnnotationList from 'src/components/AnnotationList.vue';
import { useGlobalStore } from 'src/stores/global-store';

const store = useGlobalStore();

const rightDrawerWidth = useStorage("rightDrawerWidth", 400);
const rightDrawerOpen = useStorage("rightDrawerOpen", false);

const leftDrawerOpen = useStorage("leftDrawerOpen", true);
const leftDrawerWidth = useStorage("leftDrawerWidth", 400);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}
function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value;
}

let initRightDrawerWidth = 200;
function resizeRightDrawer(ev: any) {
  if (ev.isFirst === true) { initRightDrawerWidth = rightDrawerWidth.value; }
  rightDrawerWidth.value = initRightDrawerWidth - ev.offset.x;
}

let initLeftDrawerWidth = 200;
function resizeLeftDrawer(ev: any) {
  if (ev.isFirst === true) { initLeftDrawerWidth = leftDrawerWidth.value; }
  leftDrawerWidth.value = initLeftDrawerWidth + ev.offset.x;
}
</script>

<style>
.q-drawer__resizerl {
  position: absolute;
  top: 0;
  bottom: 0;
  right: -4px;
  width: 8px;
  background-color: transparent;
  cursor: ew-resize;
}

.q-drawer__resizerr {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  width: 8px;
  background-color: transparent;
  cursor: ew-resize;
}
</style>
