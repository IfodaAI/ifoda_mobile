<template>
  <div v-if="!isOnline" class="banner" role="status" aria-live="polite">
    <span class="dot" aria-hidden="true"></span>
    Internet yo‘q. Ulanishni tekshiring.
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isOnline: boolean
}>()
</script>

<style scoped>
.banner {
  position: fixed;
  left: 12px;
  right: 12px;
  top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #fff7ed;
  border: 1px solid rgba(234, 88, 12, 0.20);
  color: #9a3412;
  box-shadow: var(--shadow-sm);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #ea580c;
  box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.18);
}
</style>

