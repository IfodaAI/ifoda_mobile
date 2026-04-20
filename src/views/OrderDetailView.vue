<template>
  <div class="wrap">
    <div v-if="isLoading" class="card">
      <h1 class="title">Buyurtma</h1>
      <p class="sub">Yuklanmoqda...</p>
    </div>

    <div v-else-if="error" class="card">
      <h1 class="title">Buyurtma</h1>
      <p class="sub">{{ error }}</p>
      <button class="btn" type="button" @click="load()">Qayta urinish</button>
    </div>

    <div v-else-if="order" class="content">
      <div class="card">
        <div class="row">
          <span class="id">#{{ shortId(order.id) }}</span>
          <span class="status" :style="{ background: statusBg(order.status), borderColor: statusBorder(order.status), color: statusText(order.status) }">
            {{ statusLabel(order.status) }}
          </span>
        </div>
        <div class="row2">
          <span class="muted">{{ formatDate(order.created_date) }}</span>
          <span class="amount">{{ formatPrice(order.amount) }}</span>
        </div>

        <div class="meta">
          <p class="m"><span class="k">Yetkazish:</span> {{ order.delivery_method }}</p>
          <p class="m" v-if="order.shipping_address"><span class="k">Manzil:</span> {{ order.shipping_address }}</p>
          <p class="m" v-if="order.phone_number"><span class="k">Tel:</span> {{ order.phone_number }}</p>
        </div>
      </div>

      <div class="card">
        <h2 class="h2">Mahsulotlar</h2>
        <div class="items">
          <div v-for="it in order.order_items" :key="it.id" class="item">
            <div class="thumbBox" aria-hidden="true">
              <img
                v-if="itemThumb(it)"
                class="thumb"
                :src="itemThumb(it) ?? ''"
                :alt="itemLabel(it)"
                loading="lazy"
                decoding="async"
              />
              <span v-else class="thumbFallback">{{ itemLabel(it).slice(0, 2).toUpperCase() }}</span>
            </div>
            <div class="left">
              <p class="pid">{{ itemLabel(it) }}</p>
              <p class="qty">
                {{ it.quantity }} × {{ itemUnitLabel(it) }}
              </p>
            </div>
            <p class="price">{{ formatPrice(it.price) }}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="h2">To‘lov</h2>
        <div class="pay">
          <button class="btn primary" type="button" :disabled="isPaying" @click="pay('payme')">
            Payme
          </button>
          <button class="btn primary" type="button" :disabled="isPaying" @click="pay('click')">
            Click
          </button>
        </div>
        <p class="hint">To‘lov linki tashqi brauzerda ochiladi.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { humanizeApiError, isGloballyHandled } from '../utils/errors'
import { openExternalUrl } from '../utils/openExternalUrl'
import { getOrder, getPaymentLink, type Order, type OrderItem, type OrderStatus } from '../api/orders'

const route = useRoute()
const ui = useUiStore()

const order = ref<Order | null>(null)
const isLoading = ref(true)
const isPaying = ref(false)
const error = ref('')

const id = computed(() => String(route.params.id || ''))

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

function shortId(v: string) {
  return v.slice(0, 8)
}

/**
 * With `?product=true` the backend nests: order_item.product (SKU) .product
 * (Product). This helper walks both levels and gracefully falls back to a
 * short id if the response is unexpanded (older cache, list endpoint).
 */
function itemLabel(it: OrderItem): string {
  const p = it.product
  if (typeof p === 'string') return shortId(p)
  const inner = p.product
  if (inner) return inner.name || inner.package_code || inner.spic || shortId(inner.id)
  return shortId(p.id)
}

function itemThumb(it: OrderItem): string | null {
  const p = it.product
  if (typeof p === 'string') return null
  return p.product?.image_thumbnail || null
}

/**
 * SKU-level "how much per pack" label, e.g. "100 ml" or "5 kg". Shown next
 * to the ordered quantity so the user knows each line's package size.
 */
function itemUnitLabel(it: OrderItem): string {
  const p = it.product
  if (typeof p === 'string') return 'dona'
  const q = p.quantity
  const u = p.unit || ''
  if (typeof q === 'number' && q > 0) {
    return u ? `${q} ${u}` : `${q} dona`
  }
  return u || 'dona'
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
    order.value = await getOrder(id.value)
  } catch (e) {
    const msg = humanizeApiError(e) ?? 'Buyurtma yuklanmadi.'
    error.value = msg
    if (!isGloballyHandled(e)) {
      ui.toast(msg, 'error', 4200)
    }
  } finally {
    isLoading.value = false
  }
}

async function pay(method: 'payme' | 'click') {
  if (!order.value) return
  isPaying.value = true
  try {
    const { payment_url } = await getPaymentLink(order.value.id, method)
    await openExternalUrl(payment_url)
  } catch (e) {
    if (!isGloballyHandled(e)) {
      ui.toast(humanizeApiError(e) ?? 'Payment link olinmadi.', 'error', 4200)
    }
  } finally {
    isPaying.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  padding: 16px 16px 86px 16px;
  background: var(--color-bg);
}

.content {
  display: grid;
  gap: 12px;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 16px;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
  color: var(--color-primary);
}

.sub {
  margin: 8px 0 0 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.5;
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

.btn.primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
  margin-top: 0;
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

.muted {
  color: var(--color-muted);
  font-size: 13px;
}

.meta {
  margin-top: 12px;
  border-top: 1px solid var(--color-border);
  padding-top: 12px;
  display: grid;
  gap: 6px;
}

.m {
  margin: 0;
  font-size: 13px;
  color: var(--color-text);
}

.k {
  color: var(--color-muted);
  font-weight: 900;
}

.h2 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 900;
  color: var(--color-text);
}

.items {
  display: grid;
  gap: 10px;
}

.item {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.9);
}

.thumbBox {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background:
    radial-gradient(80px 60px at 20% 20%, rgba(22, 163, 74, 0.22), transparent 55%),
    radial-gradient(80px 60px at 80% 60%, rgba(22, 163, 74, 0.14), transparent 55%),
    #fff;
  border: 1px solid rgba(22, 163, 74, 0.14);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumbFallback {
  font-size: 12px;
  font-weight: 900;
  color: var(--color-primary-600);
}

.left {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.pid {
  margin: 0;
  font-size: 13px;
  font-weight: 900;
  color: var(--color-text);
  /* Long product names shouldn't blow up the grid width. */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qty {
  margin: 0;
  font-size: 12px;
  color: var(--color-muted);
}

.price {
  margin: 0;
  font-size: 13px;
  font-weight: 900;
  color: var(--color-text);
}

.pay {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.hint {
  margin: 10px 0 0 0;
  color: var(--color-muted);
  font-size: 12px;
}
</style>

