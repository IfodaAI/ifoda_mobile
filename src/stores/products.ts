import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  PaginatedResponse,
  Product,
  ProductCategory,
  ProductSubcategory,
} from '../api/products'
import * as productsApi from '../api/products'

type CacheEntry<T> = {
  at: number
  data: T
}

function now() {
  return Date.now()
}

function isFresh(entry: CacheEntry<unknown> | undefined, ttlMs: number) {
  if (!entry) return false
  return now() - entry.at <= ttlMs
}

function keyOf(obj: Record<string, unknown>) {
  // stable key for cache map
  return JSON.stringify(obj, Object.keys(obj).sort())
}

export const useProductsStore = defineStore('products', () => {
  // TTLs (memory cache)
  const TTL_CATEGORIES = 10 * 60 * 1000
  const TTL_SUBCATEGORIES = 10 * 60 * 1000
  const TTL_PRODUCTS_PAGE = 2 * 60 * 1000
  const TTL_PRODUCT_DETAIL = 10 * 60 * 1000

  const categories = ref<ProductCategory[]>([])
  const categoriesAt = ref<number | null>(null)

  // key: categoryId -> subcategories
  const subcategoriesByCategory = ref<Record<string, CacheEntry<ProductSubcategory[]>>>({})

  // key: queryKey -> { pages: Record<page, PaginatedResponse<Product>>, mergedIds: string[] }
  const productsPages = ref<Record<string, CacheEntry<Record<number, PaginatedResponse<Product>>>>>({})

  // key: productId -> Product detail
  const productById = ref<Record<string, CacheEntry<Product>>>({})

  async function fetchCategories(options?: { force?: boolean }) {
    const force = Boolean(options?.force)
    const entry: CacheEntry<ProductCategory[]> | undefined =
      categoriesAt.value != null ? { at: categoriesAt.value, data: categories.value } : undefined

    if (!force && isFresh(entry, TTL_CATEGORIES) && categories.value.length) {
      return categories.value
    }

    const data = await productsApi.getProductCategories(1, 200)
    categories.value = data.results
    categoriesAt.value = now()
    return categories.value
  }

  async function fetchSubcategories(categoryId: string, options?: { force?: boolean }) {
    const force = Boolean(options?.force)
    const existing = subcategoriesByCategory.value[categoryId]
    if (!force && isFresh(existing, TTL_SUBCATEGORIES)) {
      return existing!.data
    }

    const data = await productsApi.getProductSubcategories({
      category: categoryId,
      page: 1,
      page_size: 200,
    })
    subcategoriesByCategory.value = {
      ...subcategoriesByCategory.value,
      [categoryId]: { at: now(), data: data.results },
    }
    return data.results
  }

  function buildProductsQuery(params: {
    categoryId?: string
    subcategoryId?: string
    ids?: string[]
    name?: string
    page_size?: number
    product_skus?: boolean
    product_images?: boolean
  }) {
    // Page not included in key (pages cached separately)
    const queryKey = keyOf({
      categoryId: params.categoryId ?? null,
      subcategoryId: params.subcategoryId ?? null,
      ids: params.ids?.slice().sort() ?? null,
      name: params.name?.trim() || null,
      page_size: params.page_size ?? 30,
      product_skus: Boolean(params.product_skus),
      product_images: Boolean(params.product_images),
    })
    return queryKey
  }

  async function fetchProductsPage(
    params: {
      categoryId?: string
      subcategoryId?: string
      ids?: string[]
      name?: string
      page: number
      page_size?: number
      product_skus?: boolean
      product_images?: boolean
    },
    options?: { force?: boolean }
  ) {
    const force = Boolean(options?.force)
    const queryKey = buildProductsQuery(params)
    const entry = productsPages.value[queryKey]

    const cachedPage = entry?.data?.[params.page]
    if (!force && isFresh(entry, TTL_PRODUCTS_PAGE) && cachedPage) {
      return { queryKey, page: cachedPage }
    }

    const pageData = await productsApi.getProducts({
      category: params.categoryId,
      subcategory: params.subcategoryId,
      ids: params.ids,
      name: params.name?.trim() || undefined,
      page: params.page,
      page_size: params.page_size ?? 30,
      product_skus: params.product_skus,
      product_images: params.product_images,
    })

    const nextPages = {
      ...entry?.data,
      [params.page]: pageData,
    }
    productsPages.value = {
      ...productsPages.value,
      [queryKey]: { at: now(), data: nextPages },
    }

    return { queryKey, page: pageData }
  }

  function mergeProductsPages(queryKey: string) {
    const entry = productsPages.value[queryKey]
    if (!entry) return []
    const pages = entry.data
    const pageNums = Object.keys(pages)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)

    const merged: Product[] = []
    const seen = new Set<string>()
    for (const p of pageNums) {
      const res = pages[p]
      for (const item of res?.results ?? []) {
        if (!item?.id) continue
        if (seen.has(item.id)) continue
        seen.add(item.id)
        merged.push(item)
      }
    }
    return merged
  }

  async function fetchProductDetail(
    id: string,
    options?: { force?: boolean; product_skus?: boolean; product_images?: boolean }
  ) {
    const force = Boolean(options?.force)
    const existing = productById.value[id]
    if (!force && isFresh(existing, TTL_PRODUCT_DETAIL)) {
      return existing!.data
    }

    const data = await productsApi.getProduct(id, {
      product_skus: options?.product_skus ?? true,
      product_images: options?.product_images ?? true,
    })
    productById.value = { ...productById.value, [id]: { at: now(), data } }
    return data
  }

  function reset() {
    categories.value = []
    categoriesAt.value = null
    subcategoriesByCategory.value = {}
    productsPages.value = {}
    productById.value = {}
  }

  return {
    // state
    categories,
    subcategoriesByCategory,
    productsPages,
    productById,
    // actions
    fetchCategories,
    fetchSubcategories,
    fetchProductsPage,
    mergeProductsPages,
    fetchProductDetail,
    buildProductsQuery,
    reset,
  }
})

