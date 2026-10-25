<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useNcm } from '../composables/useNcm';
import { artistNames, coverUrl } from '../utils/format';
import Icon from './Icon.vue';

const { track, connection, playing } = useNcm();
const src = computed(() => coverUrl(track.value?.coverUrl, 500));
const failed = ref(false);
watch(src, () => (failed.value = false));
</script>

<template>
  <section class="now-playing">
    <div class="cover" :class="{ playing }">
      <img v-if="src && !failed" :src="src" alt="" @error="failed = true" />
      <Icon v-else name="music" :size="56" />
    </div>
    <div class="meta">
      <h2 class="title" :title="track?.name">{{ track?.name ?? '未在播放' }}</h2>
      <p class="artist">{{ track ? artistNames(track.artists) || '未知歌手' : connection.message }}</p>
      <p v-if="track?.album.name" class="album">{{ track.album.name }}</p>
    </div>
  </section>
</template>

<style scoped>
.now-playing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  min-width: 0;
}
.cover {
  display: grid;
  place-items: center;
  width: min(62vw, 33vh);
  aspect-ratio: 1;
  border-radius: 18px;
  overflow: hidden;
  background: var(--glass);
  color: var(--fg-3);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
  transform: scale(0.94);
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.cover.playing {
  transform: scale(1);
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.meta {
  width: 100%;
  min-width: 0;
  text-align: center;
}
.title {
  font-size: 21px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist {
  margin-top: 6px;
  font-size: 14px;
  color: var(--fg-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.album {
  margin-top: 2px;
  font-size: 12px;
  color: var(--fg-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
