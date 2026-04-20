<template>
  <div class="wrap">
    <div v-if="isLoading" class="card">
      <h1 class="title">Savat</h1>
      <p class="sub">Yuklanmoqda...</p>
    </div>

    <div v-else-if="cart.items.length === 0" class="card">
      <h1 class="title">Savat</h1>
      <p class="sub">Savat bo‘sh. Mahsulot tanlab qo‘shing.</p>
      <button class="btn" type="button" @click="router.replace('/products')">Mahsulotlarga o‘tish</button>
    </div>

    <div v-else class="content">
      <div class="list">
        <div v-for="it in cart.items" :key="it.skuId" class="item">
          <div class="thumb" aria-hidden="true">
            <img v-if="it.image" :src="it.image" :alt="it.productName" loading="lazy" decoding="async" />
            <span v-else>IF</span>
          </div>

          <div class="info">
            <p class="name">{{ it.productName }}</p>
            <p class="meta">{{ it.quantity }} {{ it.unit }}</p>
            <p class="price">{{ formatPrice(it.price) }}</p>
          </div>

          <div class="controls">
            <button class="icon" type="button" @click="cart.dec(it.skuId)" aria-label="Kamaytirish">−</button>
            <span class="count">{{ it.count }}</span>
            <button class="icon" type="button" @click="cart.inc(it.skuId)" aria-label="Ko‘paytirish">+</button>
            <button class="remove" type="button" @click="cart.remove(it.skuId)" aria-label="O‘chirish">✕</button>
          </div>
        </div>
      </div>

      <div class="summary">
        <div class="row">
          <span class="k">Jami</span>
          <span class="v">{{ formatPrice(cart.totalAmount) }}</span>
        </div>
        <button class="btn primary btnOrder" type="button" @click="openCheckout">
          <ShoppingCartIcon :size="20" />
          <span>Buyurtma berish</span>
        </button>
      </div>
    </div>

    <teleport to="body">
      <div v-if="isCheckoutOpen" class="overlay" @click.self="isCheckoutOpen = false">
        <div class="modal">
          <div class="mHead">
            <h2 class="mTitle">Buyurtma</h2>
            <span v-if="cart.totalCount > 0" class="headBadge">{{ cart.totalCount }} ta</span>
            <button class="x" type="button" @click="isCheckoutOpen = false" aria-label="Yopish">✕</button>
          </div>

          <div class="mBody">
            <div class="sec">
              <p class="secTitle">Yetkazib berish</p>

              <div class="segRow" role="group" aria-label="Yetkazish turi">
                <button
                  class="segBtn"
                  :class="{ active: deliveryMethod === 'PICK_UP' }"
                  type="button"
                  @click="deliveryMethod = 'PICK_UP'"
                >
                  Filialdan
                </button>
                <button
                  class="segBtn"
                  :class="{ active: deliveryMethod === 'DELIVERY' }"
                  type="button"
                  @click="deliveryMethod = 'DELIVERY'"
                >
                  Manzilga
                </button>
              </div>

              <!-- Filialdan olib ketish -->
              <template v-if="deliveryMethod === 'PICK_UP'">
                <p v-if="pickupLocDenied" class="locWarn">
                  Lokatsiya o‘chiq (eng yaqin filialni tanlash cheklanishi mumkin).
                  <button type="button" class="linkBtn" @click="retryPickupLocation">Qayta so‘rash</button>
                </p>

                <p v-if="branchesLoading" class="hintMuted">Filiallar yuklanmoqda...</p>
                <p v-else-if="branchesLoadError" class="hintErr">{{ branchesLoadError }}</p>

                <template v-else-if="branches.length">
                  <div class="branchCard">
                    <div class="branchHead">
                      <span class="branchIcon" aria-hidden="true">📍</span>
                      <span class="branchTitle">Filial joylashuvi</span>
                    </div>
                    <p v-if="selectedBranch" class="branchLine">
                      {{ selectedBranch.name }}
                      <span v-if="branchDistanceLabel" class="dist">{{ branchDistanceLabel }}</span>
                    </p>
                    <a
                      v-if="selectedBranch?.phone_number"
                      class="branchPhone"
                      :href="'tel:' + selectedBranch.phone_number.replace(/\s/g, '')"
                    >
                      {{ selectedBranch.phone_number }}
                    </a>

                    <BranchMapPreview
                      v-if="selectedBranch"
                      class="branchMap"
                      :latitude="selectedBranch.latitude"
                      :longitude="selectedBranch.longitude"
                    />

                    <button type="button" class="branchPickBtn" @click="openBranchPicker">
                      <span>Boshqa filialni tanlash</span>
                      <span class="chev" aria-hidden="true">▼</span>
                    </button>
                  </div>
                </template>
              </template>

              <!-- Manzilga yetkazish -->
              <template v-if="deliveryMethod === 'DELIVERY'">
                <label class="lbl">
                  Manzil
                  <input v-model="address" class="inp" type="text" placeholder="Aniq manzil..." />
                </label>

                <div class="geo">
                  <LocationPicker :lat="lat" :lng="lng" @clear="clearLocation" @change="onLocationChange" />
                </div>
                <p class="help sm">
                  Xaritadan joy tanlang — manzil avtomatik to‘ldiriladi; kerak bo‘lsa qo‘lda ham yozishingiz
                  mumkin.
                </p>
              </template>
            </div>

            <div class="sec">
              <p class="secTitle rowTitle">
                <span>Buyurtma tafsilotlari</span>
                <span class="miniBadge">{{ cart.totalCount }} ta</span>
              </p>
              <ul class="orderLines">
                <li v-for="it in cart.items" :key="it.skuId" class="orderLine">
                  <span class="oname">{{ it.productName }}</span>
                  <span class="ometa">{{ it.quantity }}{{ it.unit }} · {{ it.count }} ta</span>
                  <span class="oprice">{{ formatPrice(it.price * it.count) }}</span>
                </li>
              </ul>
              <div class="orderTotal">
                <span>Jami</span>
                <span>{{ formatPrice(cart.totalAmount) }}</span>
              </div>
            </div>

            <div v-if="deliveryMethod === 'DELIVERY'" class="sec">
              <p class="secTitle">To‘lov</p>
              <div class="payRow" aria-label="To‘lov usuli">
                <button
                  class="payBtn"
                  :class="{ active: paymentMethod === 'payme' }"
                  type="button"
                  @click="paymentMethod = 'payme'"
                >
                  Payme
                </button>
                <button
                  class="payBtn"
                  :class="{ active: paymentMethod === 'click' }"
                  type="button"
                  @click="paymentMethod = 'click'"
                >
                  Click
                </button>
              </div>
              <p class="help">Yetkazib berish uchun to‘lov usuli tanlanadi.</p>
            </div>

            <div class="sec">
              <p class="secTitle">Aloqa</p>
              <label class="lbl">
                Telefon
                <input v-model="phone" class="inp" type="tel" placeholder="+998..." />
              </label>
            </div>
          </div>

          <div class="mFoot">
            <button class="btn" type="button" @click="isCheckoutOpen = false">Bekor</button>
            <button class="btn primary btnPlace" type="button" :disabled="isPlacing" @click="placeOrder">
              <ShoppingCartIcon v-if="!isPlacing" :size="20" />
              <span v-if="!isPlacing">Buyurtma berish</span>
              <span v-else>Yuborilmoqda...</span>
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div
        v-if="branchPickerOpen"
        class="branchOverlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bp-title"
        @click.self="cancelBranchPicker"
      >
        <div class="branchSheet" @click.stop>
          <div class="bpHead">
            <h3 id="bp-title" class="bpTitle">Filialni tanlang</h3>
            <button class="bpClose" type="button" aria-label="Yopish" @click="cancelBranchPicker">✕</button>
          </div>
          <div class="bpList" role="radiogroup" aria-label="Filiallar">
            <label
              v-for="b in sortedBranches"
              :key="b.id"
              class="bpRow"
              :class="{ checked: tempBranchId === b.id }"
            >
              <span class="bpText">{{ branchSelectLabel(b) }}</span>
              <input v-model="tempBranchId" class="bpRadio" type="radio" :value="b.id" name="pickup-branch" />
            </label>
          </div>
          <div class="bpFoot">
            <button type="button" class="bpBtn ghost" @click="cancelBranchPicker">Bekor qilish</button>
            <button type="button" class="bpBtn primary" @click="confirmBranchPicker">Tanlash</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Geolocation } from '@capacitor/geolocation'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { useCartStore } from '../stores/cart'
import { createOrder } from '../api/orders'
import { fetchBranches, type Branch } from '../api/branches'
import { humanizeApiError, isGloballyHandled } from '../utils/errors'
import { nominatimReverseGeocode } from '../utils/nominatim'
import { openExternalUrl } from '../utils/openExternalUrl'
import { haversineKm, pickNearestBranch, sortBranchesByDistance } from '../utils/distance'
import ShoppingCartIcon from '../components/icons/ShoppingCartIcon.vue'

// Leaflet is ~150KB + ~14KB CSS; load it only when checkout actually needs
// a map (DELIVERY picker or PICK_UP preview). Splits it out of the main bundle.
const LocationPicker = defineAsyncComponent(() => import('../components/LocationPicker.vue'))
const BranchMapPreview = defineAsyncComponent(() => import('../components/BranchMapPreview.vue'))

const router = useRouter()
const ui = useUiStore()
const auth = useAuthStore()
const cart = useCartStore()
const isLoading = ref(true)
const isCheckoutOpen = ref(false)
const isPlacing = ref(false)
const deliveryMethod = ref<'DELIVERY' | 'PICK_UP'>('DELIVERY')
const address = ref('')
const phone = ref('')
const paymentMethod = ref<'payme' | 'click'>('payme')
const lat = ref('')
const lng = ref('')

const branches = ref<Branch[]>([])
const branchesLoading = ref(false)
const branchesLoadError = ref('')
const selectedBranchId = ref('')
const pickupLocDenied = ref(false)
const checkoutUserLat = ref<number | null>(null)
const checkoutUserLng = ref<number | null>(null)

const branchPickerOpen = ref(false)
const tempBranchId = ref('')

const DEFAULT_LAT = '41.015443'
const DEFAULT_LNG = '71.629846'

const selectedBranch = computed(() => branches.value.find((b) => b.id === selectedBranchId.value) ?? null)

const sortedBranches = computed(() => {
  const list = branches.value
  const la = checkoutUserLat.value
  const lo = checkoutUserLng.value
  if (la != null && lo != null && Number.isFinite(la) && Number.isFinite(lo)) {
    return sortBranchesByDistance(list, la, lo)
  }
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'uz'))
})

const branchDistanceLabel = computed(() => {
  const b = selectedBranch.value
  const la = checkoutUserLat.value
  const lo = checkoutUserLng.value
  if (!b || la == null || lo == null) return ''
  const km = haversineKm(la, lo, b.latitude, b.longitude)
  return `≈ ${km < 1 ? (km * 1000).toFixed(0) + ' m' : km.toFixed(1) + ' km'}`
})

function branchSelectLabel(b: Branch): string {
  const la = checkoutUserLat.value
  const lo = checkoutUserLng.value
  if (la != null && lo != null) {
    const km = haversineKm(la, lo, b.latitude, b.longitude)
    const d = km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`
    return `${b.name} (${d})`
  }
  return b.name
}

function clearLocation() {
  lat.value = ''
  lng.value = ''
}

function onLocationChange(v: { lat: string; lng: string; address?: string }) {
  lat.value = v.lat
  lng.value = v.lng
  if (v.address && deliveryMethod.value === 'DELIVERY' && !address.value.trim()) {
    address.value = v.address
  }
}

async function loadBranchesForPickup() {
  branchesLoadError.value = ''
  branchesLoading.value = true
  pickupLocDenied.value = false
  checkoutUserLat.value = null
  checkoutUserLng.value = null
  try {
    branches.value = await fetchBranches()
    if (!branches.value.length) {
      branchesLoadError.value = 'Filial topilmadi.'
      return
    }

    try {
      await Geolocation.requestPermissions()
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 22000,
        maximumAge: 8000,
      })
      checkoutUserLat.value = pos.coords.latitude
      checkoutUserLng.value = pos.coords.longitude
      const nearest = pickNearestBranch(branches.value, pos.coords.latitude, pos.coords.longitude)
      if (nearest) selectedBranchId.value = nearest.id
    } catch {
      pickupLocDenied.value = true
      if (!selectedBranchId.value || !branches.value.some((b) => b.id === selectedBranchId.value)) {
        selectedBranchId.value = branches.value[0]!.id
      }
    }

    if (!selectedBranchId.value) selectedBranchId.value = branches.value[0]!.id
  } catch (e) {
    branchesLoadError.value = humanizeApiError(e) ?? 'Filiallar yuklanmadi.'
  } finally {
    branchesLoading.value = false
  }
}

async function retryPickupLocation() {
  await loadBranchesForPickup()
}

function openBranchPicker() {
  tempBranchId.value = selectedBranchId.value
  branchPickerOpen.value = true
}

function cancelBranchPicker() {
  branchPickerOpen.value = false
}

function confirmBranchPicker() {
  if (tempBranchId.value) selectedBranchId.value = tempBranchId.value
  branchPickerOpen.value = false
}

function openCheckout() {
  isCheckoutOpen.value = true
}

onMounted(async () => {
  await cart.ensureLoaded()
  isLoading.value = false
})

watch(isCheckoutOpen, (open) => {
  if (!open) {
    branchPickerOpen.value = false
    return
  }
  deliveryMethod.value = 'DELIVERY'
  if (!phone.value.trim() && auth.user?.phone_number) {
    phone.value = auth.user.phone_number
  }
  if (!lat.value) lat.value = DEFAULT_LAT
  if (!lng.value) lng.value = DEFAULT_LNG

  if (!address.value.trim() && lat.value && lng.value) {
    const curLat = lat.value
    const curLng = lng.value
    const la = Number(curLat)
    const lo = Number(curLng)
    if (Number.isFinite(la) && Number.isFinite(lo)) {
      nominatimReverseGeocode(la, lo).then((a) => {
        if (!isCheckoutOpen.value) return
        if (address.value.trim()) return
        if (lat.value !== curLat || lng.value !== curLng) return
        if (a) address.value = a
      })
    }
  }
})

watch(deliveryMethod, (m) => {
  if (!isCheckoutOpen.value) return
  if (m === 'PICK_UP') void loadBranchesForPickup()
})

function formatPrice(v: number) {
  try {
    return new Intl.NumberFormat('uz-UZ').format(v) + " so‘m"
  } catch {
    return `${v} so‘m`
  }
}

async function placeOrder() {
  if (cart.items.length === 0) return
  if (deliveryMethod.value === 'DELIVERY' && !address.value.trim()) {
    ui.toast('Manzilni kiriting.', 'error', 2600)
    return
  }
  if (deliveryMethod.value === 'PICK_UP' && !selectedBranchId.value) {
    ui.toast('Filialni tanlang.', 'error', 2600)
    return
  }
  isPlacing.value = true
  try {
    const res = await createOrder({
      order: {
        delivery_method: deliveryMethod.value,
        branch: deliveryMethod.value === 'PICK_UP' ? selectedBranchId.value : undefined,
        shipping_address: deliveryMethod.value === 'DELIVERY' ? address.value.trim() : undefined,
        delivery_latitude: deliveryMethod.value === 'DELIVERY' ? (lat.value.trim() || undefined) : undefined,
        delivery_longitude: deliveryMethod.value === 'DELIVERY' ? (lng.value.trim() || undefined) : undefined,
        phone_number: phone.value.trim() || undefined,
        payment_method: deliveryMethod.value === 'DELIVERY' ? paymentMethod.value : undefined,
      },
      items: cart.items.map((it) => ({
        product: it.skuId,
        quantity: it.count,
      })),
    })
    await cart.clear()
    isCheckoutOpen.value = false
    ui.toast('Buyurtma yaratildi.', 'success', 2200)
    if (res.payment_link) {
      try {
        await openExternalUrl(res.payment_link)
      } catch {
        // ignore
      }
    }
    await router.push(`/orders/${res.order.id}`)
  } catch (e) {
    if (!isGloballyHandled(e)) {
      ui.toast(humanizeApiError(e) ?? 'Buyurtma yaratilmadi.', 'error', 4200)
    }
  } finally {
    isPlacing.value = false
  }
}
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  padding: 16px 16px 86px 16px;
  background: var(--color-bg);
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
}

.btnOrder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.content {
  display: grid;
  gap: 12px;
}

.list {
  display: grid;
  gap: 10px;
}

.item {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 10px;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 12px;
}

.thumb {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  border: 1px solid rgba(22, 163, 74, 0.14);
  background: #fff;
  overflow: hidden;
  display: grid;
  place-items: center;
  color: var(--color-primary-600);
  font-weight: 900;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.info {
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
}

.price {
  margin: 6px 0 0 0;
  font-size: 13px;
  font-weight: 900;
  color: var(--color-text);
}

.controls {
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: 8px;
}

.icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: #fff;
  cursor: pointer;
  font-size: 18px;
}

.count {
  min-width: 22px;
  text-align: center;
  font-weight: 900;
  color: var(--color-text);
}

.remove {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(153, 27, 27, 0.2);
  background: #fff;
  color: #991b1b;
  cursor: pointer;
}

.summary {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 14px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.k {
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 900;
}

.v {
  color: var(--color-text);
  font-size: 15px;
  font-weight: 900;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.48);
  display: grid;
  place-items: end center;
  padding: 12px;
  z-index: 10000;
}

.modal {
  width: min(560px, 100%);
  max-height: 88vh;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}

.mTitle {
  margin: 0;
  font-size: 15px;
  font-weight: 900;
  flex: 1;
}

.headBadge {
  font-size: 12px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-primary-50);
  border: 1px solid rgba(22, 163, 74, 0.2);
  color: var(--color-primary-600);
}

.x {
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 10px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  flex-shrink: 0;
}

.mBody {
  padding: 14px 16px;
  display: grid;
  gap: 12px;
  overflow: auto;
}

.lbl {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  color: var(--color-muted);
}

.lbl.sm {
  margin-top: 10px;
}

.inp,
.sel {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--color-text);
  background: #fff;
}

.mFoot {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: rgba(255, 255, 255, 0.92);
}

.btnPlace {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sec {
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.85);
}

.secTitle {
  margin: 0 0 10px 0;
  font-size: 12px;
  font-weight: 900;
  color: var(--color-text);
}

.rowTitle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.miniBadge {
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: var(--color-muted);
}

.orderLines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.orderLine {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  font-size: 13px;
  align-items: baseline;
}

.oname {
  grid-column: 1 / -1;
  font-weight: 800;
  color: var(--color-text);
}

.ometa {
  color: var(--color-muted);
  font-size: 12px;
}

.oprice {
  font-weight: 900;
  color: var(--color-text);
  text-align: right;
}

.orderTotal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--color-border);
  font-weight: 900;
  font-size: 15px;
}

.help {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: var(--color-muted);
}

.help.sm {
  margin-top: 8px;
}

.segRow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.segBtn {
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
  color: var(--color-text);
}

.segBtn.active {
  border-color: rgba(22, 163, 74, 0.3);
  background: rgba(22, 163, 74, 0.1);
  color: var(--color-primary-600);
}

.payRow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.payBtn {
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
  color: var(--color-text);
}

.payBtn.active {
  border-color: rgba(22, 163, 74, 0.3);
  background: rgba(22, 163, 74, 0.1);
  color: var(--color-primary-600);
}

.geo {
  display: grid;
  gap: 8px;
  padding-top: 10px;
}

.locWarn {
  margin: 0 0 12px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.35);
  font-size: 12px;
  line-height: 1.45;
  color: var(--color-text);
}

.linkBtn {
  display: inline;
  margin-left: 6px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary-600);
  font-weight: 900;
  cursor: pointer;
  text-decoration: underline;
}

.hintMuted {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--color-muted);
}

.hintErr {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #991b1b;
}

.branchCard {
  display: grid;
  gap: 8px;
}

.branchHead {
  display: flex;
  align-items: center;
  gap: 8px;
}

.branchIcon {
  font-size: 18px;
}

.branchTitle {
  font-size: 13px;
  font-weight: 900;
  color: var(--color-primary);
}

.branchLine {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text);
}

.dist {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-muted);
}

.branchPhone {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary-600);
  text-decoration: none;
}

.branchPhone:active {
  opacity: 0.85;
}

.branchMap {
  margin-top: 4px;
}

.branchPickBtn {
  margin-top: 4px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: #fff;
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text);
  cursor: pointer;
}

.branchPickBtn:active {
  background: rgba(15, 23, 42, 0.04);
}

.chev {
  font-size: 10px;
  color: var(--color-muted);
}

.branchOverlay {
  position: fixed;
  inset: 0;
  z-index: 11000;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

.branchSheet {
  width: min(480px, 100%);
  max-height: min(72vh, 560px);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bpHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}

.bpTitle {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: var(--color-text);
}

.bpClose {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: #fff;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.bpList {
  overflow: auto;
  padding: 8px 0;
  flex: 1;
  min-height: 0;
}

.bpRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.bpRow:active {
  background: rgba(15, 23, 42, 0.04);
}

.bpRow.checked {
  background: rgba(22, 163, 74, 0.08);
}

.bpText {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.35;
  flex: 1;
  min-width: 0;
}

.bpRadio {
  width: 20px;
  height: 20px;
  accent-color: var(--color-primary);
  flex-shrink: 0;
}

.bpFoot {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.96);
}

.bpBtn {
  flex: 1;
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: #fff;
  color: var(--color-text);
}

.bpBtn.primary {
  border: none;
  background: var(--color-primary);
  color: #fff;
}

.bpBtn.ghost {
  background: #fff;
}
</style>
