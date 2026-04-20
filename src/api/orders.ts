import api from './index'

export interface PaginatedResponse<T> {
  count: number
  next?: string | null
  previous?: string | null
  results: T[]
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'IN_TRANSIT' | 'COMPLETED' | 'REJECTED'
export type DeliveryMethod = 'DELIVERY' | 'PICK_UP'

/**
 * Minimal Product shape the order detail needs — nested two levels deep in
 * the response when `?product=true` is set:
 *   order_item.product (the SKU) .product (the actual Product).
 * We intentionally don't pull in `../api/products#Product` here to avoid
 * cross-module coupling; only label + thumbnail fields are read.
 */
export interface OrderItemProductInfo {
  id: string
  name?: string
  description?: string | null
  image_thumbnail?: string | null
  package_code?: string | null
  spic?: string | null
}

/**
 * A SKU row expanded by the backend when `?product=true` is passed to the
 * order detail endpoint. Matches the `product_skus` shape used elsewhere.
 */
export interface OrderItemSku {
  id: string
  is_small_package?: boolean
  quantity?: number
  price?: number
  unit?: string | null
  product?: OrderItemProductInfo
}

export interface OrderItem {
  id: string
  /** Optional back-reference — present on some backends, omitted on others. */
  order?: string
  /**
   * String id when the order *list* is fetched without expansion; the full
   * SKU object when the *detail* endpoint is fetched with `?product=true`.
   */
  product: string | OrderItemSku
  quantity: number
  price: number
}

export interface Order {
  id: string
  status: OrderStatus
  amount: number
  delivery_method: DeliveryMethod
  shipping_address: string | null
  delivery_price: number
  phone_number: string | null
  branch?: string | null
  branch_name?: string | null
  user?: string | null
  user_fullname?: string | null
  payment_gateway?: string | null
  order_items: OrderItem[]
  created_date: string
  updated_date?: string
  delivery_latitude?: string | null
  delivery_longitude?: string | null
}

export async function getOrders(page: number = 1, page_size: number = 20) {
  const res = await api.get<PaginatedResponse<Order>>('/api/orders/', {
    params: { page, page_size },
  })
  return res.data
}

export async function getOrder(id: string) {
  // `order_items=true` expands the nested items list; `product=true` expands
  // each item's product (name, image, etc.) so the detail view can render
  // rich rows without N extra product lookups.
  const res = await api.get<Order>(`/api/orders/${id}/`, {
    params: { order_items: true, product: true },
  })
  return res.data
}

export async function getPaymentLink(id: string, payment_method: 'payme' | 'click') {
  const res = await api.get<{ payment_url: string }>(`/api/orders/${id}/payment_link/`, {
    params: { payment_method },
  })
  return res.data
}

export async function createOrder(payload: {
  order: {
    delivery_method: DeliveryMethod
    /** Filialdan olib ketish (PICK_UP) */
    branch?: string
    shipping_address?: string
    delivery_latitude?: string
    delivery_longitude?: string
    phone_number?: string
    payment_method?: 'payme' | 'click'
  }
  items: Array<{ product: string; quantity: number }>
}) {
  const res = await api.post<{ order: Order; payment_link?: string | null }>('/api/orders/', payload)
  return res.data
}

