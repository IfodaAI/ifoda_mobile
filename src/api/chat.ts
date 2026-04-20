import api from './index'
import type { Room, Message } from './types'
import type { AxiosProgressEvent } from 'axios'

export interface MessageListResponse {
  count: number
  next: string | null
  previous: string | null
  results: Message[]
}

/**
 * User ning room ini olish (yo'q bo'lsa backend yaratadi)
 */
export async function getUserRoom() {
  const response = await api.get<Room>('/api/rooms/my/')
  return response.data
}

/**
 * Room xabarlarini olish (page-based pagination)
 */
export async function getRoomMessages(roomId: string, page: number = 1) {
  const response = await api.get<MessageListResponse>('/api/messages/', {
    timeout: 45000,
    params: {
      room: roomId,
      page,
      page_size: 30,
      // Backend: eng yangi xabarlar birinchi sahifada; keyingi sahifalar eskiroq
      ordering: '-created_date',
    },
  })
  return response.data
}

/**
 * Xabar yuborish (matn)
 */
export async function sendTextMessage(roomId: string, text: string) {
  const response = await api.post<Message>('/api/messages/', {
    room: roomId,
    content_type: 'TEXT',
    text,
  })
  return response.data
}

/**
 * Xabar yuborish (rasm)
 */
export async function sendImageMessage(
  roomId: string,
  image: File,
  onProgress?: (pct: number) => void
) {
  const formData = new FormData()
  formData.append('room', roomId)
  formData.append('content_type', 'IMAGE')
  formData.append('image', image)

  const response = await api.post<Message>('/api/messages/', formData, {
    // Upload uchun ko'proq timeout (4G pasayganda ham uzilib qolmasin)
    timeout: 120000,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (!onProgress) return
      const total = e.total ?? 0
      if (!total) return
      const pct = Math.max(0, Math.min(100, Math.round((e.loaded / total) * 100)))
      onProgress(pct)
    },
  })
  return response.data
}

/**
 * Xabarlarni o'qildi deb belgilash
 */
export async function markRoomAsRead(roomId: string) {
  const response = await api.post(`/api/rooms/${roomId}/mark-read/`)
  return response.data
}
