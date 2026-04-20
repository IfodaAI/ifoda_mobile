<template>
  <span class="wic" aria-hidden="true">
    <!-- Quyosh (ochiq / asosan ochiq) -->
    <svg v-if="kind === 'sun'" viewBox="0 0 24 24" class="svg">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
    <!-- Qisman bulutli -->
    <svg v-else-if="kind === 'partly'" viewBox="0 0 24 24" class="svg">
      <path
        d="M8 18h8a4 4 0 0 0 0-8 5 5 0 0 0-9.6-1.7A4 4 0 0 0 8 18Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <circle cx="16" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.6" />
      <path
        d="M16 4v-1.5M19.2 5.8l1.1-1.1M20.5 9H22"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linecap="round"
      />
    </svg>
    <!-- Bulut -->
    <svg v-else-if="kind === 'cloud'" viewBox="0 0 24 24" class="svg">
      <path
        d="M8 19h9a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.5A4 4 0 0 0 8 19Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
    </svg>
    <!-- Tuman -->
    <svg v-else-if="kind === 'fog'" viewBox="0 0 24 24" class="svg">
      <path d="M4 14h16M4 17h12M6 11h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>
    <!-- Yomg'ir -->
    <svg v-else-if="kind === 'rain'" viewBox="0 0 24 24" class="svg">
      <path
        d="M8 17h9a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.5A4 4 0 0 0 8 17Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <path d="M10 20l-1 2M14 20l-1 2M12 19l-1 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    <!-- Qor -->
    <svg v-else-if="kind === 'snow'" viewBox="0 0 24 24" class="svg">
      <path
        d="M8 16h9a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.5A4 4 0 0 0 8 16Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <path d="M12 18v2M10.5 19h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
    <!-- Momaqaldiroq -->
    <svg v-else-if="kind === 'thunder'" viewBox="0 0 24 24" class="svg">
      <path
        d="M8 15h9a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.5A4 4 0 0 0 8 15Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <path d="M13 15l-2 4h3l-1 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
    <svg v-else viewBox="0 0 24 24" class="svg">
      <path
        d="M8 18h9a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.5A4 4 0 0 0 8 18Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Open-Meteo WMO kod; -1 yoki noaniq → bulut */
  wmoCode: number
}>()

const kind = computed(() => {
  const c = props.wmoCode
  if (c < 0) return 'unknown'
  if (c === 0 || c === 1) return 'sun'
  if (c === 2) return 'partly'
  if (c === 3) return 'cloud'
  if (c === 45 || c === 48) return 'fog'
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain'
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow'
  if (c >= 95 && c <= 99) return 'thunder'
  return 'cloud'
})
</script>

<style scoped>
.wic {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--color-primary);
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--color-primary-50);
  border: 1px solid rgba(22, 163, 74, 0.14);
}

.svg {
  width: 28px;
  height: 28px;
}
</style>
