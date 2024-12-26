<template>
  <div>
    <button @click="openFilePicker">打开文件框</button>
  </div>
</template>

<script setup lang="ts">
import { Demo } from '@/G_FrameWork/Demo';
import { onMounted, onUnmounted, ref } from 'vue';
const demo = ref<Demo>();

onMounted(() => {
  demo.value = new Demo();
  
});

onUnmounted(() => {
});

const openFilePicker = async () => {
  demo.value?.OnClick();
};
</script>

<style scoped>
/* 样式部分 */
</style>
