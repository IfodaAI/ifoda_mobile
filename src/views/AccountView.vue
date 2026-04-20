<template>
  <div class="wrap">
    <div class="header">
      <div class="headerTop">
        <div>
          <h1 class="title">Account</h1>
          <p class="sub">Savat va buyurtmalarni shu yerda boshqarasiz.</p>
        </div>

        <button class="logout" type="button" @click="handleLogout">Chiqish</button>
      </div>

      <div class="profile">
        <div class="avatar" aria-hidden="true">
          <span>IF</span>
        </div>
        <div class="profileText">
          <p class="name">{{ displayName }}</p>
          <p class="meta">
            <span v-if="auth.user?.phone_number">{{ auth.user?.phone_number }}</span>
            <span v-if="auth.user?.role" class="dot">·</span>
            <span v-if="auth.user?.role" class="role">{{ auth.user?.role }}</span>
          </p>
        </div>
      </div>
    </div>

    <div class="grid">
      <RouterLink class="card" to="/basket">
        <div class="cardTop">
          <span class="badge">Savat</span>
          <span class="arrow" aria-hidden="true">›</span>
        </div>
        <p class="cardTitle">Basket</p>
        <p class="cardSub">Tanlangan mahsulotlar: {{ cart.totalCount }}</p>
      </RouterLink>

      <RouterLink class="card" to="/orders">
        <div class="cardTop">
          <span class="badge">Buyurtmalar</span>
          <span class="arrow" aria-hidden="true">›</span>
        </div>
        <p class="cardTitle">Orderlar</p>
        <p class="cardSub">
          <template v-if="isLoadingOrdersCount">Yuklanmoqda...</template>
          <template v-else-if="ordersCount === null">Tarix va holat</template>
          <template v-else>Jami buyurtmalar: {{ ordersCount }}</template>
        </p>
      </RouterLink>
    </div>

    <p class="appVersion">Versiya {{ APP_VERSION }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { useUiStore } from '../stores/ui'
import { useProductsStore } from '../stores/products'
import { useCartStore } from '../stores/cart'
import { getOrders } from '../api/orders'
import { APP_VERSION } from '../version'

const router = useRouter()
const auth = useAuthStore()
const chat = useChatStore()
const ui = useUiStore()
const productsStore = useProductsStore()
const cart = useCartStore()

const ordersCount = ref<number | null>(null)
const isLoadingOrdersCount = ref(false)

const displayName = computed(() => {
  return auth.user?.full_name || auth.user?.first_name || 'Foydalanuvchi'
})

async function loadOrdersCount() {
  // `page_size=1` keeps payload tiny — we only need the paginated `count`
  // total, not the order rows themselves. Runs silently: any error just
  // leaves the placeholder subtitle visible, no toast (Account is idle UI).
  isLoadingOrdersCount.value = true
  try {
    const data = await getOrders(1, 1)
    ordersCount.value = data.count ?? 0
  } catch {
    ordersCount.value = null
  } finally {
    isLoadingOrdersCount.value = false
  }
}

onMounted(async () => {
  try {
    if (auth.accessToken && !auth.user) {
      await auth.fetchCurrentUser()
    }
    await cart.ensureLoaded()
  } catch {
    // ignore
  }
  // Fire-and-forget: count isn't blocking for the rest of the UI.
  if (auth.accessToken) void loadOrdersCount()
})

async function handleLogout() {
  const ok = await ui.confirm({
    title: 'Chiqish',
    message: 'Chiqishga ishonchisiz?',
    confirmText: 'Chiqish',
    cancelText: 'Bekor qilish',
  })
  if (!ok) return
  chat.reset()
  productsStore.reset()
  await cart.reset()
  await auth.logout()
  await router.push('/login')
}
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  padding: 16px 16px 86px 16px; /* bottom nav space */
  background: var(--color-bg);
}

.header {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 14px 14px;
}

.headerTop {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
  color: var(--color-primary);
}

.sub {
  margin: 6px 0 0 0;
  font-size: 13px;
  color: var(--color-muted);
  line-height: 1.45;
}

.logout {
  background: #fff;
  border: 1px solid rgba(153, 27, 27, 0.20);
  color: #991b1b;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  white-space: nowrap;
}

.logout:hover {
  background: #fef2f2;
}

.profile {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%);
  box-shadow: 0 10px 24px rgba(22, 163, 74, 0.22);
}

.profileText {
  min-width: 0;
}

.name {
  margin: 0;
  font-size: 14px;
  font-weight: 900;
  color: var(--color-text);
}

.meta {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--color-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dot {
  opacity: 0.6;
}

.role {
  font-weight: 800;
}

.grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.card {
  display: block;
  text-decoration: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 14px;
  color: var(--color-text);
}

.card:active {
  transform: translateY(1px);
}

.cardTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--color-primary-50);
  border: 1px solid rgba(22, 163, 74, 0.14);
  font-size: 12px;
  font-weight: 800;
}

.arrow {
  color: var(--color-muted);
  font-size: 22px;
  line-height: 1;
}

.cardTitle {
  margin: 10px 0 0 0;
  font-size: 15px;
  font-weight: 900;
}

.cardSub {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: var(--color-muted);
}

.appVersion {
  margin: 16px 0 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-muted);
}
</style>

