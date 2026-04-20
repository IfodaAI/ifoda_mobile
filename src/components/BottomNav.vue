<template>
  <nav class="nav" role="navigation" aria-label="Pastki menyu">
    <RouterLink class="item" :class="{ active: isActive('/chat') }" to="/chat" aria-label="Chat">
      <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path
          d="M6.5 17.5 4 20V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H8.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="label">Chat</span>
    </RouterLink>

    <RouterLink
      class="item"
      :class="{ active: isActive('/products') }"
      to="/products"
      aria-label="Mahsulotlar"
    >
      <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path
          d="M7 10V7.5A2.5 2.5 0 0 1 9.5 5h5A2.5 2.5 0 0 1 17 7.5V10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M6 10h12l-1 10H7L6 10Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        <path
          d="M10 13v4M14 13v4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
      <span class="label">Mahsulotlar</span>
    </RouterLink>

    <RouterLink
      class="item"
      :class="{ active: isActive('/account') }"
      to="/account"
      aria-label="Account"
    >
      <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path
          d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M4.5 20.25c1.7-3.1 4.3-4.75 7.5-4.75s5.8 1.65 7.5 4.75"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="label">Account</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<style scoped>
.nav {
  position: fixed;
  left: 10px;
  right: 10px;
  /* Float above the iOS home-indicator: 10px breathing room + the device
     safe-area (34px on notch iPhones, 0 on older devices). Without this
     the pill overlaps the indicator on iPhone X and later. */
  bottom: calc(10px + var(--safe-area-inset-bottom, 0px));
  height: 64px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  padding: 8px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(10px);
  z-index: 9000;
}

.item {
  display: grid;
  place-items: center;
  text-decoration: none;
  color: var(--color-muted);
  border-radius: 14px;
  transition: background 0.2s ease, color 0.2s ease;
}

.item:active {
  transform: translateY(1px);
}

.item.active {
  background: rgba(22, 163, 74, 0.10);
  color: var(--color-primary);
}

.icon {
  width: 22px;
  height: 22px;
}

.label {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
</style>

