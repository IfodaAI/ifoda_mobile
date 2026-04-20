<template>
  <div class="toast-host" aria-live="polite" aria-relevant="additions removals">
    <div
      v-for="t in ui.toasts"
      :key="t.id"
      class="toast"
      :class="t.kind"
      role="status"
    >
      <span class="msg">{{ t.message }}</span>
      <button
        v-if="t.action"
        class="act"
        type="button"
        @click="handleAction(t.id, t.action.to)"
      >
        {{ t.action.label }}
      </button>
      <button class="x" type="button" @click="ui.removeToast(t.id)" aria-label="Yopish">
        ✕
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '../stores/ui'
import { useRouter } from 'vue-router'

const ui = useUiStore()
const router = useRouter()

function handleAction(id: string, to: string) {
  ui.removeToast(id)
  router.push(to)
}
</script>

<style scoped>
.toast-host {
  position: fixed;
  left: 12px;
  right: 12px;
  top: 62px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 9999;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 12px;
  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.toast.success {
  border-color: rgba(22, 163, 74, 0.25);
}

.toast.error {
  border-color: rgba(153, 27, 27, 0.20);
  background: #fff;
}

.toast.info {
  border-color: rgba(15, 23, 42, 0.12);
}

.msg {
  flex: 1;
  font-size: 13px;
  line-height: 1.35;
  color: var(--color-text);
  /* Preserve `\n` in programmatic toast messages (e.g. DEV network-error
     diagnostics in `src/api/index.ts`). Also wrap long URLs/words so the
     debug toast doesn't overflow on narrow screens. */
  white-space: pre-line;
  word-break: break-word;
}

.act {
  border: 1px solid rgba(22, 163, 74, 0.25);
  background: rgba(22, 163, 74, 0.10);
  color: var(--color-primary-600);
  border-radius: 999px;
  padding: 6px 10px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
  height: 34px;
  align-self: flex-start;
}

.x {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: #fff;
  cursor: pointer;
}
</style>

