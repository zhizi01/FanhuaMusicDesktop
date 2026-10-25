<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useNcm } from '../composables/useNcm';
import { useSettings } from '../composables/useSettings';
import { artistNames, coverUrl } from '../utils/format';
import Icon from './Icon.vue';

const { track, connection, playing } = useNcm();
const { settings } = useSettings();

const layout = computed(() => settings.value?.appearance.coverLayout ?? 'stacked');
/** Cover width in % of the window width (set in settings, per layout). */
const coverSize = computed(() => settings.value?.appearance.coverSize[layout.value] ?? (layout.value === 'side' ? 30 : 58));

const src = computed(() => coverUrl(track.value?.coverUrl, 500));
const failed = ref(false);
watch(src, () => (failed.value = false));
</script>

<template>
  <section class="now-playing" :class="layout" :style="{ '--cover-size': coverSize }">
    <div class="cover" :class="{ playing }">
      <img v-if="src && !failed" :src="src" alt="" @error="failed = true" />
      <Icon v-else name="music" :size="48" />
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
  min-width: 0;
}
.cover {
  flex: none;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--glass);
  color: var(--fg-3);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
  transform: scale(0.94);
  transition:
    transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1),
    width 0.25s ease;
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
  min-width: 0;
}
.title {
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist,
.album {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist {
  margin-top: 6px;
  font-size: 14px;
  color: var(--fg-2);
}
.album {
  margin-top: 2px;
  font-size: 12px;
  color: var(--fg-3);
}

/* Cover on top, text centered below. Height-capped so the lyrics keep some room. */
.stacked {
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.stacked .cover {
  width: min(calc(var(--cover-size) * 1vw), 46vh);
  border-radius: 18px;
}
.stacked .meta {
  width: 100%;
  text-align: center;
}
.stacked .title {
  font-size: 21px;
}

/* Cover on the left, text on the right. */
.side {
  flex-direction: row;
  align-items: center;
  gap: 16px;
}
.side .cover {
  width: calc(var(--cover-size) * 1vw);
  border-radius: 12px;
}
.side .meta {
  flex: 1;
}
.side .title {
  font-size: clamp(16px, 4.8vw, 26px);
  line-height: 1.3;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
