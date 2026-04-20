<template>
  <div v-if="ui.pendingRequests > 0" class="wrap" role="status" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div>
    <span class="txt">Yuklanmoqda...</span>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
</script>

<style scoped>
.wrap {
  position: fixed;
  top: 62px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  z-index: 9999;
  backdrop-filter: blur(6px);
}

.spinner {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(22, 163, 74, 0.25);
  border-top-color: var(--color-primary);
  animation: spin 0.8s linear infinite;
}

.txt {
  font-size: 12px;
  color: var(--color-muted);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

