<script setup lang="ts">
import { computed } from 'vue';
import { useClock } from '../../composables/useClock';
import { useNcm } from '../../composables/useNcm';
import { artistNames, coverUrl } from '../../utils/format';
import BlurBackdrop from '../BlurBackdrop.vue';

defineProps<{ showTranslation: boolean }>();
const { track, lineIndex, lineAt, currentLine } = useNcm();
const { time, date } = useClock();

const prevLine = computed(() => lineAt(-1));
const nextLine = computed(() => lineAt(1));
const cover = computed(() => coverUrl(track.value?.coverUrl, 800));
</script>

<template>
  <div class="lyrics-saver">
    <BlurBackdrop :src="cover" :dim="0.58" :blur="70" />
    <div class="clock">
      <div class="time">{{ time }}</div>
      <div class="date">{{ date }}</div>
    </div>

    <main class="stage">
      <Transition name="line" mode="out-in">
        <div :key="`${track?.id}|${lineIndex}`" class="lines">
          <p class="side">{{ prevLine?.text }}</p>
          <p class="current">{{ currentLine?.text || track?.name || '繁花GG' }}</p>
          <p v-if="showTranslation && currentLine?.translation" class="trans">{{ currentLine.translation }}</p>
          <p class="side">{{ nextLine?.text }}</p>
        </div>
      </Transition>
    </main>

    <footer v-if="track" class="song">
      <img v-if="cover" :src="coverUrl(track.coverUrl, 160)" alt="" />
      <div>
        <strong>{{ track.name }}</strong>
        <span>{{ artistNames(track.artists) }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.lyrics-saver {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.clock {
  position: absolute;
  top: 5vh;
  right: 5vw;
  text-align: right;
}
.time {
  font-size: clamp(36px, 7vmin, 96px);
  font-weight: 200;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.date {
  margin-top: 8px;
  font-size: clamp(13px, 1.8vmin, 22px);
  color: var(--fg-2);
}
.stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 0 8vw;
}
.lines {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.2vmin;
  text-align: center;
}
.current {
  font-size: clamp(28px, 6.4vmin, 88px);
  font-weight: 700;
  line-height: 1.3;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.45);
}
.trans {
  font-size: clamp(16px, 3vmin, 40px);
  color: var(--fg-2);
}
.side {
  min-height: 1.4em;
  font-size: clamp(15px, 2.8vmin, 36px);
  color: var(--fg-3);
}
.song {
  position: absolute;
  left: 5vw;
  bottom: 6vh;
  display: flex;
  align-items: center;
  gap: 16px;
}
.song img {
  width: clamp(48px, 8vmin, 96px);
  height: clamp(48px, 8vmin, 96px);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
.song div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.song strong {
  font-size: clamp(15px, 2.4vmin, 28px);
}
.song span {
  font-size: clamp(12px, 1.8vmin, 20px);
  color: var(--fg-2);
}
.line-enter-active,
.line-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.line-enter-from {
  opacity: 0;
  transform: translateY(24px);
}
.line-leave-to {
  opacity: 0;
  transform: translateY(-24px);
}
</style>
