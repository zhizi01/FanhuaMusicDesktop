<script setup lang="ts">
import { useNcm } from '../composables/useNcm';
import IconButton from './IconButton.vue';

const { canControl, playing, liked, busy, command, reconnect } = useNcm();
</script>

<template>
  <section class="controls">
    <IconButton
      icon="heart"
      size="lg"
      :filled="liked"
      :active="liked"
      :title="liked ? '取消喜欢' : '喜欢'"
      :disabled="!canControl"
      @click="command('toggleLike')"
    />
    <IconButton icon="prev" size="lg" filled title="上一首" :disabled="!canControl" @click="command('prev')" />
    <IconButton
      :icon="playing ? 'pause' : 'play'"
      size="xl"
      variant="solid"
      filled
      :title="playing ? '暂停' : '播放'"
      :disabled="!canControl"
      @click="command('toggle')"
    />
    <IconButton icon="next" size="lg" filled title="下一首" :disabled="!canControl" @click="command('next')" />
    <IconButton icon="refresh" size="lg" title="重新连接网易云" :spinning="busy" @click="reconnect" />
  </section>
</template>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}
</style>
