import api from './index'

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ProductCategory {
  id: string
  title: string
  slug: string
}

export interface ProductSubcategory {
  id: string
  title: string
  slug: string
  category: string
}

export interface ProductSKU {
  id: string
  product: string
  price: number
  quantity: number
  unit: 'ml' | 'l' | 'g' | 'kg'
  is_small_package: boolean
}

export interface ProductImage {
  id: string
  product: string
  image: string
}

export interface Product {
  id: string
  product_id: number
  name: string
  description: string
  spic: string
  package_code: string
  category: string | ProductSubcategory
  image_thumbnail: string | null
  product_skus?: ProductSKU[]
  product_images?: ProductImage[]
}

// MOBILE_FRONTEND.md ga mos endpointlar
export async function getProductCategories(page: number = 1, page_size: number = 50) {
  const res = await api.get<PaginatedResponse<ProductCategory>>('/api/product-categories/', {
    params: { page, page_size },
  })
  return res.data
}

export async function getProductSubcategories(params?: {
  category?: string
  page?: number
  page_size?: number
}) {
  const res = await api.get<PaginatedResponse<ProductSubcategory>>('/api/product-subcategories/', {
    params: {
      category: params?.category,
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 100,
    },
  })
  return res.data
}

export async function getProducts(params?: {
  /** main category id */
  category?: string
  /** subcategory id */
  subcategory?: string
  /** filter by specific product ids (comma-separated on backend) */
  ids?: string[] | string
  /** qidiruv: ?name=dori */
  name?: string
  page?: number
  page_size?: number
  product_skus?: boolean
  product_images?: boolean
  /**
   * Optional: ask backend to expand nested category object.
   * (If backend supports it.)
   */
  expand_category?: boolean
}) {
  const qp: Record<string, string | number | undefined> = {
    // pagination
    page: params?.page ?? 1,
    page_size: params?.page_size ?? 20,
    // search
    name: params?.name,
    // includes
    product_skus: params?.product_skus ? 'true' : undefined,
    product_images: params?.product_images ? 'true' : undefined,
  }

  if (params?.category) qp.category = params.category
  if (params?.subcategory) (qp as Record<string, unknown>).subcategory = params.subcategory
  if (params?.ids) {
    const ids = Array.isArray(params.ids) ? params.ids : String(params.ids).split(',').map((s) => s.trim())
    const cleaned = ids.filter(Boolean).join(',')
    if (cleaned) (qp as Record<string, unknown>).ids = cleaned
  }
  if (params?.expand_category) (qp as Record<string, unknown>).expand_category = 'true'

  const res = await api.get<PaginatedResponse<Product>>('/api/products/', {
    params: qp,
  })
  return res.data
}

export async function getProduct(
  id: string,
  params?: { product_skus?: boolean; product_images?: boolean }
) {
  const res = await api.get<Product>(`/api/products/${id}/`)
  if (!params?.product_skus && !params?.product_images) return res.data

  const res2 = await api.get<Product>(`/api/products/${id}/`, {
    params: {
      product_skus: params?.product_skus ? 'true' : undefined,
      product_images: params?.product_images ? 'true' : undefined,
    },
  })
  return res2.data
}

export async function getProductSkus(productId: string, page: number = 1, page_size: number = 100) {
  const res = await api.get<PaginatedResponse<ProductSKU>>('/api/product-skus/', {
    params: { product: productId, page, page_size },
  })
  return res.data
}

