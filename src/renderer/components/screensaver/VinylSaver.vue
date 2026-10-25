<script setup lang="ts">
import { computed } from 'vue';
import { useClock } from '../../composables/useClock';
import { useNcm } from '../../composables/useNcm';
import { artistNames, coverUrl } from '../../utils/format';
import BlurBackdrop from '../BlurBackdrop.vue';

defineProps<{ showTranslation: boolean }>();
const { track, playing, lineIndex, currentLine } = useNcm();
const { time } = useClock();
const cover = computed(() => coverUrl(track.value?.coverUrl, 600));
</script>

<template>
  <div class="vinyl-saver">
    <BlurBackdrop :src="cover" :dim="0.72" :blur="80" />
    <div class="clock">{{ time }}</div>

    <main class="stage">
      <div class="disc" :class="{ spinning: playing }">
        <img v-if="cover" :src="cover" class="label" alt="" />
        <span class="hole" />
      </div>
      <div class="info">
        <h2>{{ track?.name ?? '繁花GG' }}</h2>
        <p>{{ track ? artistNames(track.artists) : '等待播放' }}</p>
      </div>
      <Transition name="line" mode="out-in">
        <div :key="`${track?.id}|${lineIndex}`" class="lyric">
          <p>{{ currentLine?.text }}</p>
          <p v-if="showTranslation && currentLine?.translation" class="trans">{{ currentLine.translation }}</p>
        </div>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.vinyl-saver {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.clock {
  position: absolute;
  top: 5vh;
  right: 5vw;
  font-size: clamp(22px, 4vmin, 56px);
  font-weight: 200;
  font-variant-numeric: tabular-nums;
  color: var(--fg-2);
}
.stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3vmin;
  /* bottom space is reserved for the unlock / exit panel */
  padding: 4vh 6vw 18vh;
  text-align: center;
}
.disc {
  position: relative;
  display: grid;
  place-items: center;
  width: min(44vmin, 70vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle, transparent 0 33%, rgba(255, 255, 255, 0.07) 33.5%, transparent 34.5%),
    repeating-radial-gradient(circle, #121214 0 2px, #1c1c20 2.5px 4px),
    #111;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.6),
    inset 0 0 0 6px #0b0b0c;
  animation: spin 24s linear infinite;
  animation-play-state: paused;
}
.disc.spinning {
  animation-play-state: running;
}
.label {
  width: 62%;
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
}
.hole {
  position: absolute;
  width: 3.4%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #0b0b0c;
}
.info h2 {
  font-size: clamp(22px, 4.4vmin, 56px);
  font-weight: 700;
}
.info p {
  margin-top: 0.8vmin;
  font-size: clamp(14px, 2.4vmin, 28px);
  color: var(--fg-2);
}
.lyric {
  min-height: 4em;
}
.lyric p {
  font-size: clamp(16px, 3.2vmin, 40px);
  font-weight: 600;
}
.lyric .trans {
  margin-top: 0.8vmin;
  font-size: clamp(13px, 2.2vmin, 26px);
  font-weight: 400;
  color: var(--fg-2);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.line-enter-active,
.line-leave-active {
  transition: opacity 0.3s ease;
}
.line-enter-from,
.line-leave-to {
  opacity: 0;
}
</style>
