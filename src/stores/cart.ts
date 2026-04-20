import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Preferences } from '@capacitor/preferences'

export type CartUnit = 'ml' | 'l' | 'g' | 'kg'

export type CartItem = {
  skuId: string
  productId: string
  productName: string
  image?: string | null
  quantity: number
  unit: CartUnit
  price: number
  count: number
  addedAt: number
}

const STORAGE_KEY = 'cart_v1'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const loaded = ref(false)

  const totalCount = computed(() => items.value.reduce((sum, it) => sum + it.count, 0))
  const totalAmount = computed(() => items.value.reduce((sum, it) => sum + it.price * it.count, 0))

  async function ensureLoaded() {
    if (loaded.value) return
    loaded.value = true
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY })
      if (!value) return
      const parsed = JSON.parse(value) as { items?: CartItem[] }
      if (Array.isArray(parsed.items)) {
        items.value = parsed.items.filter((x) => x && typeof x.skuId === 'string' && x.count > 0)
      }
    } catch {
      // ignore
    }
  }

  async function persist() {
    try {
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify({ items: items.value }) })
    } catch {
      // ignore
    }
  }

  async function add(input: Omit<CartItem, 'count' | 'addedAt'>, count: number = 1) {
    await ensureLoaded()
    const n = Math.max(1, Math.floor(count))
    const idx = items.value.findIndex((it) => it.skuId === input.skuId)
    if (idx >= 0) {
      const prev = items.value[idx]!
      items.value[idx] = { ...prev, count: prev.count + n }
    } else {
      items.value = [
        ...items.value,
        {
          ...input,
          count: n,
          addedAt: Date.now(),
        },
      ]
    }
    await persist()
  }

  async function setCount(skuId: string, count: number) {
    await ensureLoaded()
    const n = Math.floor(count)
    if (n <= 0) {
      items.value = items.value.filter((it) => it.skuId !== skuId)
      await persist()
      return
    }
    const idx = items.value.findIndex((it) => it.skuId === skuId)
    if (idx < 0) return
    const prev = items.value[idx]!
    items.value[idx] = { ...prev, count: n }
    await persist()
  }

  async function inc(skuId: string) {
    await ensureLoaded()
    const idx = items.value.findIndex((it) => it.skuId === skuId)
    if (idx < 0) return
    const prev = items.value[idx]!
    items.value[idx] = { ...prev, count: prev.count + 1 }
    await persist()
  }

  async function dec(skuId: string) {
    await ensureLoaded()
    const idx = items.value.findIndex((it) => it.skuId === skuId)
    if (idx < 0) return
    const prev = items.value[idx]!
    const next = prev.count - 1
    if (next <= 0) {
      items.value = items.value.filter((it) => it.skuId !== skuId)
    } else {
      items.value[idx] = { ...prev, count: next }
    }
    await persist()
  }

  async function remove(skuId: string) {
    await ensureLoaded()
    items.value = items.value.filter((it) => it.skuId !== skuId)
    await persist()
  }

  async function clear() {
    await ensureLoaded()
    items.value = []
    await persist()
  }

  async function reset() {
    loaded.value = false
    items.value = []
    try {
      await Preferences.remove({ key: STORAGE_KEY })
    } catch {
      // ignore
    }
  }

  return {
    items,
    totalCount,
    totalAmount,
    ensureLoaded,
    add,
    setCount,
    inc,
    dec,
    remove,
    clear,
    reset,
  }
})

