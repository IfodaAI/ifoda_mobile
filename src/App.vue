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

/** Faqat TopBar — ob-havo faqat Mahsulotlar sahifasidagi kartochkada */
const shellPadTop = computed(() => (showTopBar.value ? 56 : 0))

const shellStyle = computed(() => (shellPadTop.value > 0 ? { paddingTop: `${shellPadTop.value}px` } : undefined))

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
  padding-bottom: 92px; /* reserve space for BottomNav */
}

/* TopBar balandligi shellStyle orqali (paddingTop) */
</style>
