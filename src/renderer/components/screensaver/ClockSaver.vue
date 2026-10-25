<script setup lang="ts">
import { useClock } from '../../composables/useClock';
import { useNcm } from '../../composables/useNcm';
import { artistNames } from '../../utils/format';

defineProps<{ showTranslation: boolean }>();
const { track, lineIndex, currentLine } = useNcm();
const { time, seconds, date } = useClock();
</script>

<template>
  <div class="clock-saver">
    <!-- The whole block drifts slowly to avoid screen burn-in. -->
    <main class="drift">
      <div class="time">
        {{ time }}<span class="sec">{{ seconds }}</span>
      </div>
      <div class="date">{{ date }}</div>
      <div v-if="track" class="now">♪ {{ track.name }} — {{ artistNames(track.artists) }}</div>
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
.clock-saver {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 10%, #18202c 0%, #0b0d13 60%, #060709 100%);
}
.drift {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: drift 180s ease-in-out infinite alternate;
}
.time {
  font-size: clamp(72px, 24vmin, 320px);
  font-weight: 200;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.sec {
  margin-left: 0.15em;
  font-size: 0.28em;
  color: var(--fg-3);
}
.date {
  margin-top: 2vmin;
  font-size: clamp(16px, 3vmin, 40px);
  color: var(--fg-2);
  letter-spacing: 0.1em;
}
.now {
  margin-top: 7vmin;
  font-size: clamp(14px, 2.4vmin, 30px);
  color: var(--fg-2);
}
.lyric {
  min-height: 3.6em;
  margin-top: 1.6vmin;
}
.lyric p {
  font-size: clamp(16px, 3vmin, 38px);
  color: var(--fg);
}
.lyric .trans {
  margin-top: 0.6vmin;
  font-size: clamp(13px, 2vmin, 24px);
  color: var(--fg-3);
}
@keyframes drift {
  0% {
    transform: translate(-4vw, -3vh);
  }
  50% {
    transform: translate(3vw, 2vh);
  }
  100% {
    transform: translate(-2vw, 4vh);
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
