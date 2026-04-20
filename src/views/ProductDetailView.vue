<template>
  <div class="wrap">
    <div v-if="isLoading" class="state">
      <div class="card">
        <p class="stateTitle">Yuklanmoqda...</p>
        <p class="stateSub">Mahsulot ma’lumotlari olinmoqda.</p>
      </div>
    </div>

    <div v-else-if="error" class="state">
      <div class="card">
        <p class="stateTitle">Xatolik</p>
        <p class="stateSub">{{ error }}</p>
        <button class="retry" type="button" @click="load(true)">Qayta urinish</button>
      </div>
    </div>

    <div v-else-if="product" class="content">
      <div class="hero">
        <div class="slider">
          <div class="slides">
            <img
              v-for="(src, i) in imageUrls"
              :key="src + i"
              class="slide"
              :src="src"
              :alt="product.name"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        <div class="info">
          <h2 class="name">{{ product.name }}</h2>
          <p class="meta">
            <span v-if="product.package_code" class="pill">{{ product.package_code }}</span>
            <span v-if="product.spic" class="pill ghost">{{ product.spic }}</span>
          </p>

          <div class="sku">
            <p class="skuTitle">Variant (SKU)</p>
            <div class="skuRow">
              <button
                v-for="s in product.product_skus || []"
                :key="s.id"
                class="skuBtn"
                :class="{ active: selectedSkuId === s.id }"
                type="button"
                @click="selectedSkuId = s.id"
              >
                <span class="skuMain">{{ s.quantity }} {{ s.unit }}</span>
                <span class="skuPrice">{{ formatPrice(s.price) }}</span>
              </button>
            </div>
          </div>

          <div class="priceRow">
            <p class="priceLabel">Narx</p>
            <p class="priceValue">{{ formatPrice(selectedPrice) }}</p>
          </div>

          <button
            class="add"
            type="button"
            :disabled="!selectedSku"
            @click="handleAddToCart"
          >
            Savatga qo‘shish
          </button>
        </div>
      </div>

      <div class="section">
        <h3 class="secTitle">Tavsif</h3>
        <div class="desc" v-html="safeDescription"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { humanizeApiError, isGloballyHandled } from '../utils/errors'
import type { Product } from '../api/products'
import { useProductsStore } from '../stores/products'
import { useCartStore } from '../stores/cart'
import { sanitizeRichHtml } from '../utils/sanitize'

const route = useRoute()
const ui = useUiStore()
const productsStore = useProductsStore()
const cart = useCartStore()

const product = ref<Product | null>(null)
const isLoading = ref(false)
const error = ref('')
const selectedSkuId = ref<string>('')

const productId = computed(() => String(route.params.id || ''))

const imageUrls = computed(() => {
  const urls: string[] = []
  if (product.value?.image_thumbnail) urls.push(product.value.image_thumbnail)
  for (const img of product.value?.product_images || []) {
    if (img?.image) urls.push(img.image)
  }
  // dedupe
  return Array.from(new Set(urls))
})

const selectedSku = computed(() => {
  const list = product.value?.product_skus || []
  return list.find((s) => s.id === selectedSkuId.value) || list[0] || null
})

const selectedPrice = computed(() => selectedSku.value?.price ?? 0)

function formatPrice(v: number) {
  try {
    return new Intl.NumberFormat('uz-UZ').format(v) + " so‘m"
  } catch {
    return `${v} so‘m`
  }
}

const safeDescription = computed(() => {
  const html = product.value?.description || ''
  const sanitized = sanitizeRichHtml(html)
  return sanitized || '<p class="descEmpty">—</p>'
})

async function load(force: boolean = false) {
  const id = productId.value
  if (!id) return
  isLoading.value = true
  error.value = ''
  try {
    const p = await productsStore.fetchProductDetail(id, {
      product_skus: true,
      product_images: true,
      force,
    })
    product.value = p
    selectedSkuId.value = p.product_skus?.[0]?.id ?? ''
  } catch (e) {
    console.error(e)
    const msg = humanizeApiError(e) ?? 'Mahsulot yuklanmadi.'
    error.value = msg
    if (!isGloballyHandled(e)) {
      ui.toast(msg, 'error', 4200)
    }
  } finally {
    isLoading.value = false
  }
}

async function handleAddToCart() {
  if (!product.value) return
  const sku = selectedSku.value
  if (!sku) return

  await cart.add(
    {
      skuId: sku.id,
      productId: product.value.id,
      productName: product.value.name,
      image: product.value.image_thumbnail,
      quantity: sku.quantity,
      unit: sku.unit,
      price: sku.price,
    },
    1
  )
  ui.toast('Savatga qo‘shildi.', 'success', 2200, { label: 'Savat', to: '/basket' })
}

onMounted(() => load(false))
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  padding: 12px 12px 92px 12px;
  background: var(--color-bg);
}

.state {
  display: grid;
  place-items: center;
  padding: 18px 0;
}

.card {
  width: min(720px, 100%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 16px;
}

.stateTitle {
  margin: 0;
  font-weight: 900;
  color: var(--color-text);
}

.stateSub {
  margin: 6px 0 0 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.45;
}

.retry {
  margin-top: 12px;
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.slider {
  width: 100%;
  background: #fff;
}

.slides {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

.slide {
  width: 100%;
  height: 220px;
  object-fit: cover;
  flex: 0 0 100%;
  scroll-snap-align: start;
}

.info {
  padding: 14px;
}

.name {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: var(--color-text);
}

.meta {
  margin: 8px 0 0 0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pill {
  font-size: 12px;
  font-weight: 900;
  color: var(--color-primary-600);
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(22, 163, 74, 0.10);
  border: 1px solid rgba(22, 163, 74, 0.18);
}

.pill.ghost {
  color: var(--color-text);
  background: rgba(15, 23, 42, 0.04);
  border-color: rgba(15, 23, 42, 0.10);
}

.sku {
  margin-top: 14px;
}

.skuTitle {
  margin: 0;
  font-size: 12px;
  font-weight: 900;
  color: var(--color-muted);
}

.skuRow {
  margin-top: 8px;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.skuBtn {
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 16px;
  padding: 10px 12px;
  cursor: pointer;
  display: grid;
  gap: 4px;
  min-width: 132px;
  text-align: left;
}

.skuBtn.active {
  border-color: rgba(22, 163, 74, 0.30);
  background: rgba(22, 163, 74, 0.08);
}

.skuMain {
  font-weight: 900;
  color: var(--color-text);
  font-size: 13px;
}

.skuPrice {
  font-weight: 900;
  color: var(--color-primary-600);
  font-size: 12px;
}

.priceRow {
  margin-top: 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.priceLabel {
  margin: 0;
  font-size: 12px;
  font-weight: 900;
  color: var(--color-muted);
}

.priceValue {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: var(--color-text);
}

.add {
  margin-top: 12px;
  width: 100%;
  border: none;
  border-radius: 16px;
  padding: 12px 14px;
  cursor: pointer;
  background: var(--color-primary);
  color: #fff;
  font-weight: 900;
}

.add:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 14px;
}

.secTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 900;
  color: var(--color-text);
}

.desc {
  margin-top: 10px;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.55;
}

.desc :deep(p) {
  margin: 0 0 10px 0;
}

.desc :deep(ul),
.desc :deep(ol) {
  margin: 0 0 10px 18px;
}

.desc :deep(h1),
.desc :deep(h2),
.desc :deep(h3) {
  margin: 12px 0 8px 0;
}

.desc :deep(.descEmpty) {
  margin: 0;
  color: var(--color-muted);
}
</style>

