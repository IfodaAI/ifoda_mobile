<template>
  <div class="wrap">
    <div v-if="isLoading" class="card">
      <h1 class="title">Buyurtmalar</h1>
      <p class="sub">Yuklanmoqda...</p>
    </div>

    <div v-else-if="error" class="card">
      <h1 class="title">Buyurtmalar</h1>
      <p class="sub">{{ error }}</p>
      <button class="btn" type="button" @click="load()">Qayta urinish</button>
    </div>

    <div v-else-if="orders.length === 0" class="card">
      <h1 class="title">Buyurtmalar</h1>
      <p class="sub">Hozircha buyurtma yo‘q.</p>
    </div>

    <div v-else class="list">
      <button v-for="o in orders" :key="o.id" class="order" type="button" @click="openStub(o.id)">
        <div class="row">
          <span class="id">#{{ shortId(o.id) }}</span>
          <span class="status" :style="{ background: statusBg(o.status), borderColor: statusBorder(o.status), color: statusText(o.status) }">
            {{ statusLabel(o.status) }}
          </span>
        </div>
        <div class="row2">
          <span class="muted">{{ formatDate(o.created_date) }}</span>
          <span class="amount">{{ formatPrice(o.amount) }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { humanizeApiError, isGloballyHandled } from '../utils/errors'
import { getOrders, type Order, type OrderStatus } from '../api/orders'

const ui = useUiStore()
const router = useRouter()

const orders = ref<Order[]>([])
const isLoading = ref(true)
const error = ref('')

function statusLabel(s: OrderStatus) {
  const m: Record<OrderStatus, string> = {
    PENDING: 'Kutilmoqda',
    PROCESSING: 'Jarayonda',
    IN_TRANSIT: "Yo‘lda",
    COMPLETED: 'Yetkazildi',
    REJECTED: 'Bekor qilindi',
  }
  return m[s] ?? s
}

function statusBorder(s: OrderStatus) {
  const m: Record<OrderStatus, string> = {
    PENDING: 'rgba(245, 158, 11, 0.28)',
    PROCESSING: 'rgba(59, 130, 246, 0.28)',
    IN_TRANSIT: 'rgba(99, 102, 241, 0.28)',
    COMPLETED: 'rgba(22, 163, 74, 0.28)',
    REJECTED: 'rgba(153, 27, 27, 0.22)',
  }
  return m[s] ?? 'rgba(15, 23, 42, 0.12)'
}

function statusBg(s: OrderStatus) {
  const m: Record<OrderStatus, string> = {
    PENDING: 'rgba(245, 158, 11, 0.10)',
    PROCESSING: 'rgba(59, 130, 246, 0.10)',
    IN_TRANSIT: 'rgba(99, 102, 241, 0.10)',
    COMPLETED: 'rgba(22, 163, 74, 0.10)',
    REJECTED: 'rgba(153, 27, 27, 0.08)',
  }
  return m[s] ?? 'rgba(15, 23, 42, 0.04)'
}

function statusText(s: OrderStatus) {
  const m: Record<OrderStatus, string> = {
    PENDING: '#b45309',
    PROCESSING: '#1d4ed8',
    IN_TRANSIT: '#4338ca',
    COMPLETED: '#15803d',
    REJECTED: '#991b1b',
  }
  return m[s] ?? 'var(--color-text)'
}

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatPrice(v: number) {
  try {
    return new Intl.NumberFormat('uz-UZ').format(v) + " so‘m"
  } catch {
    return `${v} so‘m`
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return ''
  }
}

async function load() {
  isLoading.value = true
  error.value = ''
  try {
    const data = await getOrders(1, 30)
    orders.value = data.results
  } catch (e) {
    const msg = humanizeApiError(e) ?? 'Buyurtmalarni yuklab bo‘lmadi.'
    error.value = msg
    if (!isGloballyHandled(e)) {
      ui.toast(msg, 'error', 4200)
    }
  } finally {
    isLoading.value = false
  }
}

function openStub(id: string) {
  router.push(`/orders/${id}`)
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  padding: 16px 16px 92px 16px;
  background: var(--color-bg);
}
.card {
  width: min(720px, 100%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 18px;
}
.title {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
  color: var(--color-primary);
}
.sub {
  margin: 8px 0 0 0;
  color: var(--color-text);
  line-height: 1.5;
  font-size: 14px;
}
.muted {
  margin: 10px 0 0 0;
  color: var(--color-muted);
  font-size: 13px;
}

.btn {
  margin-top: 12px;
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  font-weight: 900;
  color: var(--color-text);
}

.list {
  display: grid;
  gap: 10px;
}

.order {
  width: 100%;
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 14px;
  cursor: pointer;
}

.order:active {
  transform: translateY(1px);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.row2 {
  margin-top: 10px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.id {
  font-weight: 900;
  color: var(--color-text);
}

.status {
  font-size: 12px;
  font-weight: 900;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
}

.amount {
  font-weight: 900;
  color: var(--color-text);
}
</style>

