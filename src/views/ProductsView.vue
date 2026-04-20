<template>
  <div class="wrap">
    <div class="sticky">
      <div class="header">
        <div class="headerRow">
          <div class="weatherMain">
            <WeatherIcon :wmo-code="weatherWmo" />
            <div class="weatherCol">
              <p class="weatherTitle">{{ weatherLine1 }}</p>
              <p v-if="weatherLine2" class="weatherPlace">{{ weatherLine2 }}</p>
            </div>
          </div>
          <BasketTopButton />
        </div>
        <p class="sub">Kerakli mahsulotni tez toping va buyurtma qiling.</p>
      </div>

      <div class="toolbar">
        <div class="search">
          <span class="sIcon" aria-hidden="true">⌕</span>
          <input v-model="q" class="sInput" type="text" placeholder="Qidirish..." />
        </div>
        <button class="filter" type="button" @click="reload(true)">
          <span aria-hidden="true">⟳</span>
          <span>Yangilash</span>
        </button>
      </div>

      <div class="chips" aria-label="Kategoriyalar">
        <button
          v-for="c in categoryChips"
          :key="c.id"
          class="chip"
          :class="{ active: selectedCategoryId === c.id }"
          type="button"
          @click="selectCategory(c.id)"
        >
          {{ c.title }}
        </button>
      </div>

      <div v-if="selectedCategoryId !== 'all'" class="chips subcats" aria-label="Subkategoriyalar">
        <button
          v-for="sc in subcategoryChips"
          :key="sc.id"
          class="chip"
          :class="{ active: selectedSubcategoryId === sc.id }"
          type="button"
          @click="selectSubcategory(sc.id)"
        >
          {{ sc.title }}
        </button>
      </div>
    </div>

    <div ref="listEl" class="list">
      <div v-if="isLoading" class="empty">
        <div class="emptyCard">
          <p class="emptyTitle">Yuklanmoqda...</p>
          <p class="emptySub">Mahsulotlar ro‘yxati olinmoqda.</p>
        </div>
      </div>

      <div v-else-if="filtered.length === 0" class="empty">
        <div class="emptyCard">
          <p class="emptyTitle">Hech narsa topilmadi</p>
          <p class="emptySub">Qidiruvni o‘zgartirib ko‘ring yoki boshqa kategoriyani tanlang.</p>
        </div>
      </div>

      <div v-else class="grid">
        <button
          v-for="p in filtered"
          :key="p.id"
          class="card"
          type="button"
          @click="openProduct(p.id)"
        >
          <div class="img" aria-hidden="true">
            <img
              v-if="p.image_thumbnail"
              class="thumb"
              :src="p.image_thumbnail"
              :alt="p.name"
              loading="lazy"
              decoding="async"
            />
            <span v-else class="imgText">{{ badgeFor(p) }}</span>
          </div>
          <div class="body">
            <p class="name">{{ p.name }}</p>
            <p class="desc">{{ previewFor(p) }}</p>
            <div class="row">
              <span class="price">{{ formatPrice(priceFor(p)) }}</span>
              <span v-if="p.product_skus?.length" class="tag">{{ p.product_skus.length }} SKU</span>
            </div>
          </div>
        </button>
      </div>

      <div v-if="!isLoading && filtered.length > 0" class="moreWrap">
        <div ref="moreSentinel" class="sentinel" aria-hidden="true"></div>

        <button
          v-if="hasMore"
          class="moreBtn"
          type="button"
          :disabled="isLoadingMore"
          @click="fetchMore"
        >
          <span v-if="!isLoadingMore">Yana yuklash</span>
          <span v-else>Yuklanmoqda...</span>
        </button>

        <p v-else class="moreEnd">Hammasi shu.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useUiStore } from '../stores/ui'
import { useAppLocationStore } from '../stores/appLocation'
import { useRoute, useRouter } from 'vue-router'
import type { Product, ProductCategory, ProductSubcategory } from '../api/products'
import { useProductsStore } from '../stores/products'
import { isGloballyHandled } from '../utils/errors'
import WeatherIcon from '../components/WeatherIcon.vue'
import BasketTopButton from '../components/BasketTopButton.vue'

const ui = useUiStore()
const appLocation = useAppLocationStore()

const weatherWmo = computed(() => appLocation.weather?.wmoCode ?? -1)

const weatherLine1 = computed(() => {
  const w = appLocation.weather
  if (!w) {
    return appLocation.profileInitDone ? 'Ob-havo · —' : 'Ob-havo yuklanmoqda...'
  }
  return `${w.tempC}° · ${w.labelUz}`
})

const weatherLine2 = computed(() => appLocation.placeLabel || '')
const route = useRoute()
const router = useRouter()
const productsStore = useProductsStore()

const q = ref('')
const categories = ref<ProductCategory[]>([])
const selectedCategoryId = ref<string>('all')
const subcategories = ref<ProductSubcategory[]>([])
const selectedSubcategoryId = ref<string>('all')
const idsFilter = ref<string[]>([])
const items = ref<Product[]>([])
const isLoading = ref(false)
const isLoadingMore = ref(false)
const currentPage = ref(1)
const hasMore = ref(true)
const moreSentinel = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

const categoryChips = computed(() => {
  return [{ id: 'all', title: 'Barchasi', slug: 'all' } as ProductCategory, ...categories.value]
})

const subcategoryChips = computed(() => {
  return [
    { id: 'all', title: 'Barchasi', slug: 'all', category: selectedCategoryId.value } as ProductSubcategory,
    ...subcategories.value,
  ]
})

const filtered = computed(() => {
  // Server-side filter/search bo‘ladi; client-side faqat fallback
  const query = q.value.trim().toLowerCase()
  if (!query) return items.value
  return items.value.filter((p) => p.name.toLowerCase().includes(query))
})

function selectCategory(id: string) {
  selectedCategoryId.value = id
}

function selectSubcategory(id: string) {
  selectedSubcategoryId.value = id
}

function formatPrice(v: number) {
  try {
    return new Intl.NumberFormat('uz-UZ').format(v) + " so‘m"
  } catch {
    return `${v} so‘m`
  }
}

function openProduct(id: string) {
  router.push(`/products/${id}`)
}

function priceFor(p: Product) {
  const sku = p.product_skus?.[0]
  return typeof sku?.price === 'number' ? sku.price : 0
}

function badgeFor(p: Product) {
  // Don't surface internal codes (spic/package_code) in UI.
  // Keep a tiny stable badge for quick scanning.
  return p.product_id ? `#${p.product_id}` : p.name
}

// Regex-stripping description HTML is cheap per call, but Vue re-runs the
// expression on every render (search input, category change, scroll triggering
// layout). Cache by product id so we pay the cost at most once per product,
// even as the filtered list re-renders.
const descPreviewCache = new WeakMap<Product, string>()

function previewFor(p: Product): string {
  const cached = descPreviewCache.get(p)
  if (cached !== undefined) return cached
  const computed = computePreview(p.description || '')
  descPreviewCache.set(p, computed)
  return computed
}

function computePreview(html: string): string {
  const text = htmlToText(html)
  if (!text) return '—'
  return text.length > 110 ? text.slice(0, 110).trimEnd() + '…' : text
}

function htmlToText(html: string) {
  try {
    if (!html) return ''
    // Cheap, safe preview: strip tags + decode a few entities
    const stripped = html
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
    return stripped
  } catch {
    return ''
  }
}

async function loadCategories() {
  const data = await productsStore.fetchCategories()
  categories.value = data
}

async function loadSubcategories() {
  if (selectedCategoryId.value === 'all') {
    subcategories.value = []
    selectedSubcategoryId.value = 'all'
    return
  }
  const list = await productsStore.fetchSubcategories(selectedCategoryId.value)
  subcategories.value = list
  selectedSubcategoryId.value = 'all'
}

async function reload(force: boolean = false) {
  try {
    isLoading.value = true
    const { queryKey, page } = await productsStore.fetchProductsPage(
      {
        categoryId: selectedCategoryId.value !== 'all' ? selectedCategoryId.value : undefined,
        subcategoryId: selectedSubcategoryId.value !== 'all' ? selectedSubcategoryId.value : undefined,
        ids: idsFilter.value.length ? idsFilter.value : undefined,
        name: q.value.trim() || undefined,
        product_skus: true,
        product_images: true,
        page: 1,
        page_size: 30,
      },
      { force }
    )
    items.value = productsStore.mergeProductsPages(queryKey)
    currentPage.value = 1
    hasMore.value = Boolean(page.next)
  } catch (e) {
    if (!isGloballyHandled(e)) {
      ui.toast('Mahsulotlarni yuklab bo‘lmadi.', 'error', 3200)
    }
  } finally {
    isLoading.value = false
  }
}

async function fetchMore() {
  if (isLoading.value || isLoadingMore.value) return
  if (!hasMore.value) return
  isLoadingMore.value = true
  try {
    const nextPage = currentPage.value + 1
    const { queryKey, page } = await productsStore.fetchProductsPage(
      {
        categoryId: selectedCategoryId.value !== 'all' ? selectedCategoryId.value : undefined,
        subcategoryId: selectedSubcategoryId.value !== 'all' ? selectedSubcategoryId.value : undefined,
        ids: idsFilter.value.length ? idsFilter.value : undefined,
        name: q.value.trim() || undefined,
        product_skus: true,
        product_images: true,
        page: nextPage,
        page_size: 30,
      },
      { force: false }
    )
    items.value = productsStore.mergeProductsPages(queryKey)
    currentPage.value = nextPage
    hasMore.value = Boolean(page.next)
  } catch (e) {
    if (!isGloballyHandled(e)) {
      ui.toast('Yana yuklab bo‘lmadi. Internetni tekshiring.', 'error', 3200)
    }
  } finally {
    isLoadingMore.value = false
  }
}

// Lock body scroll so the ONLY scrollable area on this page is `.list`.
// Without this, the app-shell's `padding-bottom: 92px` (reserved for
// BottomNav) pushes `.wrap` below the viewport and the whole page becomes
// scrollable, making the sticky header slide and leaving a big empty band
// above BottomNav.
const prevBodyOverflow = typeof document !== 'undefined' ? document.body.style.overflow : ''
const prevHtmlOverflow = typeof document !== 'undefined' ? document.documentElement.style.overflow : ''
if (typeof document !== 'undefined') {
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
}
onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = prevBodyOverflow
  document.documentElement.style.overflow = prevHtmlOverflow
})

onMounted(async () => {
  // If route has ?ids=<id1,id2>, show only those products (recommendations)
  const idsStr = typeof route.query.ids === 'string' ? route.query.ids : ''
  idsFilter.value = idsStr ? idsStr.split(',').map((s) => s.trim()).filter(Boolean) : []
  try {
    await loadCategories()
  } catch {
    // ignore
  }
  await loadSubcategories()
  await reload(false)

  // Auto fetchMore when sentinel enters viewport
  io = new IntersectionObserver(
    (entries) => {
      const e = entries[0]
      if (!e?.isIntersecting) return
      fetchMore()
    },
    {
      root: listEl.value,
      rootMargin: '200px 0px',
      threshold: 0.01,
    }
  )
  if (moreSentinel.value) io.observe(moreSentinel.value)
})

watch(
  () => route.query.ids,
  (v) => {
    const s = typeof v === 'string' ? v : ''
    idsFilter.value = s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []
    reload(false)
  }
)

watch(q, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    reload(false)
  }, 350)
})

watch(selectedCategoryId, () => {
  loadSubcategories().finally(() => {
    reload(false)
  })
})

watch(selectedSubcategoryId, () => {
  reload(false)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (io) {
    try {
      if (moreSentinel.value) io.unobserve(moreSentinel.value)
      io.disconnect()
    } catch {
      // ignore
    }
  }
  io = null
})
</script>

<style scoped>
.wrap {
  /* Anchor to the viewport so the app-shell's reserved `padding-bottom: 92px`
     (for BottomNav on `showNav` routes) cannot push our layout off-screen or
     create a second page-level scroll. `.list` is the only scrollable child.
     `position: fixed` bypasses the app-shell's safe-area padding, so we add
     the notch inset directly here — otherwise the weather card on iPhone X+
     slides under the status bar / Dynamic Island. */
  position: fixed;
  inset: 0;
  height: 100dvh;
  padding: calc(16px + var(--safe-top, env(safe-area-inset-top, 0px))) 16px 0 16px;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  z-index: 1;
}

.sticky {
  /* Header stays pinned at the top of `.wrap` (no longer sliding with page
     scroll since page scroll is locked). Kept as a flex header so `.list`
     owns the remaining height. */
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 14px;
}

.headerRow {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.weatherMain {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.weatherCol {
  min-width: 0;
  flex: 1;
}

.weatherTitle {
  margin: 0;
  font-size: 17px;
  font-weight: 900;
  color: var(--color-text);
  line-height: 1.25;
}

.weatherPlace {
  margin: 4px 0 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub {
  margin: 10px 0 0 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.45;
}

.toolbar {
  margin-top: 0;
  display: flex;
  gap: 10px;
  align-items: center;
}

.search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--shadow-sm);
}

.sIcon {
  color: var(--color-muted);
  font-weight: 900;
}

.sInput {
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--color-text);
}

.filter {
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-sm);
  color: var(--color-text);
  font-weight: 800;
}

.filter:active {
  transform: translateY(1px);
}

.chips {
  margin-top: 2px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chips.subcats {
  margin-top: 0;
}

.chip {
  /* keep chips readable if many subcats */
  max-width: 100%;
}

.chip {
  border: 1px solid rgba(22, 163, 74, 0.14);
  background: var(--color-primary-50);
  color: var(--color-text);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.chip.active {
  border-color: rgba(22, 163, 74, 0.28);
  background: rgba(22, 163, 74, 0.12);
  color: var(--color-primary-600);
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  /* Reserve space at the bottom so the final card isn't hidden behind the
     fixed BottomNav (64px + 10px offset + breathing room + safe-area). */
  padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px));
}

.list::-webkit-scrollbar {
  width: 10px;
}

.list::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.12);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: content-box;
}

.card {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 12px;
  width: 100%;
  text-align: left;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 12px;
  cursor: pointer;
}

.card:active {
  transform: translateY(1px);
}

.img {
  height: 88px;
  border-radius: 16px;
  background:
    radial-gradient(120px 80px at 20% 20%, rgba(22, 163, 74, 0.26), transparent 55%),
    radial-gradient(120px 80px at 80% 60%, rgba(22, 163, 74, 0.16), transparent 55%),
    #fff;
  border: 1px solid rgba(22, 163, 74, 0.14);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.imgText {
  font-size: 12px;
  font-weight: 900;
  color: var(--color-primary-600);
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(22, 163, 74, 0.10);
  border: 1px solid rgba(22, 163, 74, 0.18);
}

.body {
  min-width: 0;
}

.name {
  margin: 0;
  font-size: 14px;
  font-weight: 900;
  color: var(--color-text);
}

.desc {
  margin: 4px 0 0 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.35;
}

.row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.price {
  font-size: 13px;
  font-weight: 900;
  color: var(--color-text);
}

.tag {
  font-size: 12px;
  font-weight: 900;
  color: var(--color-primary-600);
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(22, 163, 74, 0.10);
  border: 1px solid rgba(22, 163, 74, 0.18);
}

.empty {
  margin-top: 12px;
  display: grid;
  place-items: center;
}

.emptyCard {
  width: min(720px, 100%);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(22, 163, 74, 0.18);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  padding: 14px;
}

.emptyTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 900;
  color: var(--color-primary);
}

.emptySub {
  margin: 6px 0 0 0;
  font-size: 13px;
  color: var(--color-muted);
  line-height: 1.45;
}

@media (min-width: 520px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
  .card {
    grid-template-columns: 1fr;
  }
  .img {
    height: 120px;
  }
}

.moreWrap {
  margin-top: 12px;
  padding-bottom: 6px;
  display: grid;
  place-items: center;
  gap: 10px;
}

.sentinel {
  width: 1px;
  height: 1px;
}

.moreBtn {
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  font-weight: 900;
  color: var(--color-text);
}

.moreBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.moreEnd {
  margin: 0;
  font-size: 12px;
  color: var(--color-muted);
}
</style>

