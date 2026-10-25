<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import AppHeader from './components/AppHeader.vue';
import AppToast from './components/AppToast.vue';
import BlurBackdrop from './components/BlurBackdrop.vue';
import LyricsView from './components/LyricsView.vue';
import NowPlaying from './components/NowPlaying.vue';
import PlayerControls from './components/PlayerControls.vue';
import ProgressBar from './components/ProgressBar.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import ScreenSaver from './components/screensaver/ScreenSaver.vue';
import { useNcm } from './composables/useNcm';
import { useScreensaver } from './composables/useScreensaver';
import { useSettings } from './composables/useSettings';
import { coverUrl } from './utils/format';

const ncm = useNcm();
const screensaver = useScreensaver();
const { settings } = useSettings();

const settingsOpen = ref(false);
const backdrop = computed(() => coverUrl(ncm.track.value?.coverUrl, 400));

// User-selected font applies to the whole UI (main view, settings, screensaver); falls back to the default stack.
watchEffect(() => {
  const family = settings.value?.appearance.fontFamily;
  document.documentElement.style.setProperty('--font', family ? `"${family}", var(--font-default)` : 'var(--font-default)');
});

function openScreensaver() {
  settingsOpen.value = false;
  screensaver.enter();
}

function onKeydown(e: KeyboardEvent) {
  if (e.code !== 'Space' || settingsOpen.value || screensaver.state.value.active) return;
  if (e.target instanceof HTMLInputElement || !ncm.canControl.value) return;
  e.preventDefault();
  ncm.command('toggle');
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="app">
    <BlurBackdrop :src="backdrop" :dim="0.52" />
    <AppHeader @screensaver="openScreensaver" @settings="settingsOpen = true" />

    <main class="content">
      <NowPlaying />
      <LyricsView
        :lines="ncm.lines.value"
        :index="ncm.lineIndex.value"
        :status="ncm.lyricStatus.value"
        :has-track="!!ncm.track.value"
        @seek="(t) => ncm.canControl.value && ncm.seek(t)"
      />
      <ProgressBar
        :position="ncm.position.value"
        :duration="ncm.duration.value"
        :disabled="!ncm.canControl.value"
        @seek="ncm.seek"
      />
      <PlayerControls />
    </main>

    <SettingsPanel v-model:open="settingsOpen" />
    <AppToast />
    <ScreenSaver v-if="screensaver.state.value.active" />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.content {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 10px 26px 26px;
}
</style>
