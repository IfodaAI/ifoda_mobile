export interface User {
  id: string
  telegram_id: number
  phone_number: string
  first_name: string
  last_name: string
  full_name: string
  role: 'USER' | 'ADMIN' | 'MANAGER'
  photo_url?: string
}

export interface RegionDto {
  id: string
  name: string
  small_package: boolean
}

export interface DistrictDto {
  id: string
  name: string
  region: string
  small_package: boolean
}

/** GET /api/telegram-users/check_user/?telegram_id= */
export interface TelegramUserCheck {
  id: string
  telegram_id: number
  user: string
  username?: string
  first_name?: string
  last_name?: string
  photo_url?: string
  language_code?: string
  phone_number?: string
  created_date?: string
  region: RegionDto | null
  district: DistrictDto | null
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Room {
  id: string
  name: string
  unread_count: number
  last_message: string | null
  last_message_time: string | null
}

export interface Message {
  id: string
  room: string
  content_type: 'TEXT' | 'IMAGE' | 'PRODUCT'
  role: 'QUESTION' | 'ANSWER'
  status: 'UNREAD' | 'NEW' | 'UNREPLIED' | 'REPLIED'
  text: string | null
  image: string | null
  sender: string
  created_date: string

  // PRODUCT recommendation payload (optional)
  diseases?: Array<{ name: string; description: string }>
  diseases_info?: Array<{ name: string; description: string }>
  products?: string[]

  /**
   * AI streaming (WS) payload fields.
   * Backend may send: { stream: true, chunk: "..." } for partial tokens,
   * and last chunk with stream=false.
   */
  stream?: boolean
  chunk?: string
  /** Client-only helper: message is still streaming */ 
  is_streaming?: boolean

  /**
   * Client-only fields (backend may not provide).
   * Used for optimistic UI and delivery UX.
   */
  client_id?: string
  client_status?: 'sending' | 'sent' | 'failed'
}

export interface AiStatusEvent {
  type: 'ai_status'
  status: 'thinking' | 'vision_analyzing' | string
  message: string
}