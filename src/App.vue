<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useAppLocationStore } from './stores/appLocation'
import { useDeepLink } from './composables/useDeepLink'
import { useResumablePolling } from './composables/useResumablePolling'
import { useAppLocationProfile } from './composables/useAppLocationProfile'
import ToastHost from './components/ToastHost.vue'
import OfflineBanner from './components/OfflineBanner.vue'
import { useOnlineStatus } from './composables/useOnlineStatus'
import ConfirmDialogHost from './components/ConfirmDialogHost.vue'
import LoadingIndicator from './components/LoadingIndicator.vue'
import BottomNav from './components/BottomNav.vue'
import TopBar from './components/TopBar.vue'
import BasketTopButton from './components/BasketTopButton.vue'
import RegionDistrictModal from './components/RegionDistrictModal.vue'

const auth = useAuthStore()
const appLocation = useAppLocationStore()
useDeepLink() // ← Deep link listener setup
useAppLocationProfile() // lokatsiya, ob-havo, check_user, viloyat modal
const { isOnline } = useOnlineStatus()
const route = useRoute()
// Grab the Router instance synchronously from setup() — composables that
// rely on inject() must not be called after an `await` in onMounted.
const router = useRouter()

const showNav = computed(() => Boolean(route.meta.showNav))
const showTopBar = computed(() => Boolean(route.meta.showTopBar))
const topBarTitle = computed(() => String(route.meta.topBarTitle || ''))
const showTopBarBasket = computed(() => Boolean(route.meta.showTopBarBasket))

/**
 * Top inset strategy:
 * - Always reserve iOS safe-area-top (notch / Dynamic Island) so page
 *   content never slides under the status bar.
 * - When a TopBar is shown, add its 56px height on top of the safe-area.
 *
 * We always emit `paddingTop` (even when it's just safe-area) so WebView
 * gets a concrete value to measure against.
 *
 * Use CSS vars so we can support both iOS safe-area syntaxes:
 * `env()` (modern) and `constant()` (older WebViews).
 */
const shellStyle = computed(() => ({
  paddingTop: showTopBar.value
    ? 'calc(var(--safe-top-padded, var(--safe-area-inset-top, 0px)) + 56px)'
    : 'var(--safe-top-padded, var(--safe-area-inset-top, 0px))',
}))

onMounted(async () => {
  // 1. App startup da storage dan tokens o'qish
  await auth.loadFromStorage()

  // 2. Agar polling token saqlangan bo'lsa, resume qilish
  await useResumablePolling(router)

  if (auth.accessToken && !auth.user) {
    try {
      await auth.fetchCurrentUser()
    } catch {
      // ignore
    }
  }
})
</script>

<template>
  <TopBar v-if="showTopBar" :title="topBarTitle">
    <template v-if="showTopBarBasket" #right>
      <BasketTopButton />
    </template>
  </TopBar>
  <RegionDistrictModal v-model="appLocation.showRegionModal" />

  <div
    class="app-shell"
    :class="{ 'with-nav': showNav, 'with-top': showTopBar }"
    :style="shellStyle"
  >
    <RouterView />
  </div>
  <BottomNav v-if="showNav" />
  <OfflineBanner :is-online="isOnline" />
  <LoadingIndicator />
  <ToastHost />
  <ConfirmDialogHost />
</template>

<style>
:root {
  /* Brand: IFODA AGRO KIMYO HIMOYA (green/white) */
  --color-primary: #16a34a;
  --color-primary-600: #15803d;
  --color-primary-50: #f0fdf4;

  --color-bg: #f6f7f8;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --color-muted: #64748b;
  --color-border: rgba(15, 23, 42, 0.10);

  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.08), 0 1px 1px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 10px 30px rgba(15, 23, 42, 0.10);
  --radius-lg: 16px;

  /* iOS safe-area (notch/Dynamic Island/home indicator) — default to env(). */
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);

  /* Legacy variables for backward compatibility if needed */
  --safe-top: var(--safe-area-inset-top);
  --safe-bottom: var(--safe-area-inset-bottom);

  /* Extra UI buffer for visual comfort on Dynamic Island devices.
     Standard safe-area is often too tight (44-59px); we add a bit more. */
  --safe-top-padded: calc(var(--safe-area-inset-top) + 2px);
}

/* Older iOS WebViews only support `constant()` for safe-area insets. */
@supports (padding-top: constant(safe-area-inset-top)) {
  :root {
    --safe-area-inset-top: constant(safe-area-inset-top);
    --safe-area-inset-bottom: constant(safe-area-inset-bottom);
    --safe-top-padded: calc(var(--safe-area-inset-top) + 2px);
  }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
}

#app {
  width: 100%;
  height: 100%;
}

.app-shell.with-nav {
  /* BottomNav sits 4px above the home-indicator safe area (see BottomNav.vue),
     so the shell must reserve: 64px (nav) + 4px (gap) + 18px (breathing) +
     safe-area-bottom = 86px + safe-area-bottom. */
  padding-bottom: calc(86px + var(--safe-bottom, 0px));
}

/* TopBar balandligi shellStyle orqali (paddingTop) */
</style>
