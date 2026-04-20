<template>
  <header class="bar" role="banner">
    <button class="back" type="button" @click="handleBack" aria-label="Orqaga">
      <span aria-hidden="true">‹</span>
    </button>
    <h1 class="title">{{ title }}</h1>
    <div class="right">
      <slot name="right" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  title: string
}>()

const router = useRouter()

function handleBack() {
  // If there is a history entry, go back; otherwise go to products (home).
  const state = router.options.history.state
  const canGoBack = Boolean(state.back)
  if (canGoBack) router.back()
  else router.replace('/products')
}
</script>

<style scoped>
.bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  /* Grow the bar to cover the status bar on notch devices, and push our
     own content (back button + title) below the notch via padding-top.
     `App.vue` already reserves `56px + env(safe-area-inset-top)` of page
     padding, so the numbers stay in sync. */
  height: calc(56px + var(--safe-top-padded, var(--safe-area-inset-top, 0px)));
  padding: var(--safe-top-padded, var(--safe-area-inset-top, 0px)) 12px 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(10px);
  z-index: 9500;
}

.back {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: #fff;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  display: grid;
  place-items: center;
}

.title {
  margin: 0;
  font-size: 15px;
  font-weight: 900;
  color: var(--color-primary);
}

.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

