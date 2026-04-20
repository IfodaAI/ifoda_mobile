import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Room, Message, AiStatusEvent } from '../api/types'
import * as chatApi from '../api/chat'

export const useChatStore = defineStore('chat', () => {
  let activeAnswerStreamId: string | null = null
  const aiStatus = ref<AiStatusEvent | null>(null)
  const awaitingAi = ref(false)
  let awaitingFinalText = false
  let awaitingProduct = false
  let awaitingReleaseTimer: number | null = null
  let awaitingHardTimeout: number | null = null
  let aiStatusClearTimer: number | null = null

  // Fast id -> array-index lookup. Avoids O(n) scans inside addMessage() on
  // every streamed chunk (previously `findIndex` + reverse-scan fallback),
  // which becomes the dominant cost when chat history grows large.
  const idIndex = new Map<string, number>()

  function rebuildIdIndex() {
    idIndex.clear()
    const arr = messages.value
    for (let i = 0; i < arr.length; i++) {
      const id = arr[i]?.id
      if (id) idIndex.set(id, i)
    }
  }

  function updateIdIndex(id: string | undefined, newIndex: number) {
    if (!id) return
    idIndex.set(id, newIndex)
  }

  function clearAwaitingTimers() {
    if (awaitingReleaseTimer != null) {
      window.clearTimeout(awaitingReleaseTimer)
      awaitingReleaseTimer = null
    }
    if (awaitingHardTimeout != null) {
      window.clearTimeout(awaitingHardTimeout)
      awaitingHardTimeout = null
    }
  }

  function startAwaitingAi() {
    awaitingAi.value = true
    awaitingFinalText = false
    awaitingProduct = false
    clearAwaitingTimers()
    // Safety: never block forever (network glitches) — release after 2 minutes.
    awaitingHardTimeout = window.setTimeout(() => {
      awaitingAi.value = false
      awaitingHardTimeout = null
    }, 2 * 60 * 1000)
  }

  function finishAwaitingAiSoon() {
    // If we already got PRODUCT and final TEXT, release immediately.
    if (awaitingFinalText && awaitingProduct) {
      clearAwaitingTimers()
      awaitingAi.value = false
      return
    }
    // If final text arrived, allow short grace window for optional PRODUCT recommendation.
    if (awaitingFinalText) {
      if (awaitingReleaseTimer != null) return
      awaitingReleaseTimer = window.setTimeout(() => {
        awaitingAi.value = false
        awaitingReleaseTimer = null
      }, 900)
      return
    }
    // If product arrived without final text, don't block too long.
    if (awaitingProduct) {
      if (awaitingReleaseTimer != null) return
      awaitingReleaseTimer = window.setTimeout(() => {
        awaitingAi.value = false
        awaitingReleaseTimer = null
      }, 600)
    }
  }

  function clearAiStatusSoon() {
    if (aiStatusClearTimer != null) {
      window.clearTimeout(aiStatusClearTimer)
      aiStatusClearTimer = null
    }
    // Defer clear so UI can render status even if ANSWER arrives in same WS frame.
    aiStatusClearTimer = window.setTimeout(() => {
      aiStatus.value = null
      aiStatusClearTimer = null
    }, 0)
  }

  function productDedupeKey(m: Message): string {
    if (m.content_type !== 'PRODUCT') return ''
    const ids = [...(m.products ?? [])].filter(Boolean).sort().join(',')
    return ids
  }

  function normalizeMessage(m: Message): Message {
    // Backend may return diseases_info while WS may return diseases objects.
    if (!m.diseases && Array.isArray((m as unknown as { diseases_info?: unknown }).diseases_info)) {
      const di = (m as unknown as { diseases_info?: Array<{ name: string; description: string }> }).diseases_info
      if (di?.length) return { ...m, diseases: di }
    }
    return m
  }

  const room = ref<Room | null>(null)
  const messages = ref<Message[]>([])
  const isLoadingRoom = ref(false)
  const isLoadingMessages = ref(false)
  const currentPage = ref(1)
  const hasMore = ref(true)
  const isLoadingMore = ref(false)
  const isUploadingImage = ref(false)
  const imageUploadProgress = ref<number | null>(null)

  /**
   * User ning room ini olish
   */
  async function fetchRoom() {
    try {
      isLoadingRoom.value = true
      const data = await chatApi.getUserRoom()
      room.value = data
      return data
    } catch (error) {
      console.error('Failed to fetch room:', error)
      throw error
    } finally {
      isLoadingRoom.value = false
    }
  }

  /**
   * Room xabarlarini olish
   */
  async function fetchMessages(roomId: string, page: number = 1) {
    try {
      if (page === 1) {
        isLoadingMessages.value = true
      } else {
        isLoadingMore.value = true
      }
      const data = await chatApi.getRoomMessages(roomId, page)
      const normalizedResults = data.results.map((m) => normalizeMessage(m))

      // API: ordering=-created_date → har sahifada [yangiroq ... eskiroq].
      // UI: eski → yangi (scroll tepada eski, pastda yangi) uchun sahifani teskari aylantiramiz.
      const chronological = (rows: typeof normalizedResults) => [...rows].reverse()

      if (page === 1) {
        messages.value = chronological(normalizedResults)
      } else {
        const existing = messages.value
        const olderChunk = chronological(normalizedResults)
        const merged = [...olderChunk, ...existing]

        const seen = new Set<string>()
        messages.value = merged.filter((m) => {
          if (!m.id) return true
          if (seen.has(m.id)) return false
          seen.add(m.id)
          return true
        })
      }

      rebuildIdIndex()
      currentPage.value = page
      hasMore.value = Boolean(data.next)
      return data
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      throw error
    } finally {
      if (page === 1) {
        isLoadingMessages.value = false
      } else {
        isLoadingMore.value = false
      }
    }
  }

  async function fetchMoreMessages(roomId: string) {
    if (isLoadingMessages.value || isLoadingMore.value) return null
    if (!hasMore.value) return null

    const nextPage = currentPage.value + 1
    return await fetchMessages(roomId, nextPage)
  }

  /**
   * Matn xabar yuborish
   */
  async function sendTextMessage(roomId: string, text: string) {
    startAwaitingAi()
    const client_id = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const optimistic: Message = {
      id: client_id,
      client_id,
      client_status: 'sending',
      room: roomId,
      content_type: 'TEXT',
      role: 'QUESTION',
      status: 'NEW',
      text,
      image: null,
      sender: 'You',
      created_date: new Date().toISOString(),
    }
    messages.value.push(optimistic)
    updateIdIndex(client_id, messages.value.length - 1)

    try {
      const message = await chatApi.sendTextMessage(roomId, text)
      // Replace optimistic message. client_id is the only stable handle until
      // the backend id arrives; try id-index first (O(1)), fall back to scan.
      let idx = idIndex.get(client_id) ?? -1
      if (idx < 0 || messages.value[idx]?.client_id !== client_id) {
        idx = messages.value.findIndex((m) => m.client_id === client_id || m.id === client_id)
      }
      if (idx >= 0) {
        const replaced = { ...message, client_id, client_status: 'sent' as const }
        messages.value[idx] = replaced
        // Map the new backend id onto the same slot; keep client_id entry too
        // so retries based on client_id still resolve.
        if (replaced.id) idIndex.set(replaced.id, idx)
      } else {
        messages.value.push({ ...message, client_id, client_status: 'sent' })
        updateIdIndex(message.id, messages.value.length - 1)
        updateIdIndex(client_id, messages.value.length - 1)
      }
      return message
    } catch (error) {
      console.error('Failed to send text message:', error)
      awaitingAi.value = false
      clearAwaitingTimers()
      const idx = idIndex.get(client_id) ?? messages.value.findIndex((m) => m.client_id === client_id || m.id === client_id)
      if (idx >= 0) {
        const prev = messages.value[idx]
        if (prev) {
          messages.value[idx] = { ...prev, client_status: 'failed' }
        }
      }
      throw error
    }
  }

  /**
   * Rasm xabar yuborish
   */
  async function sendImageMessage(
    roomId: string,
    image: File,
    onProgress?: (pct: number) => void
  ) {
    try {
      startAwaitingAi()
      isUploadingImage.value = true
      imageUploadProgress.value = 0
      const message = await chatApi.sendImageMessage(roomId, image, (pct) => {
        imageUploadProgress.value = pct
        onProgress?.(pct)
      })
      messages.value.push(message)
      updateIdIndex(message.id, messages.value.length - 1)
      imageUploadProgress.value = 100
      return message
    } catch (error) {
      console.error('Failed to send image message:', error)
      awaitingAi.value = false
      clearAwaitingTimers()
      throw error
    } finally {
      isUploadingImage.value = false
      window.setTimeout(() => {
        imageUploadProgress.value = null
      }, 600)
    }
  }

  /**
   * Room o'qildi deb belgilash
   */
  async function markAsRead(roomId: string) {
    try {
      await chatApi.markRoomAsRead(roomId)
    } catch (error) {
      console.error('Failed to mark room as read:', error)
    }
  }

  /**
   * WebSocket orqali yangi xabar qabul qilish
   */
  function addMessage(message: Message) {
    message = normalizeMessage(message)
    // Any ANSWER content means status should disappear
    if (message.role === 'ANSWER') clearAiStatusSoon()

    // While awaiting AI: track completion signals
    if (awaitingAi.value && message.role === 'ANSWER') {
      if (message.content_type === 'PRODUCT') {
        awaitingProduct = true
        finishAwaitingAiSoon()
      } else if (message.content_type === 'TEXT') {
        // Any final text (non-chunk or last chunk stream=false)
        if (message.stream === false) {
          awaitingFinalText = true
          finishAwaitingAiSoon()
        }
      }
    }

    // AI streaming: { stream: true/false, chunk: "..." }
    const hasChunk = typeof message.chunk === 'string' && message.chunk.length > 0
    const streamFlag = typeof message.stream === 'boolean'
    const hasFullText = typeof message.text === 'string' && message.text.length > 0

    // Some backends may send a non-chunk final payload:
    // { stream: false, text: "..." } → treat as a normal message (not streaming chunk).
    if (!hasChunk && hasFullText) {
      if (message.stream === false) activeAnswerStreamId = null
      // continue with normal dedupe/append logic below
    } else if (hasChunk || streamFlag) {
      const chunkText = typeof message.chunk === 'string' ? message.chunk : ''
      const isStreamingNow = message.stream !== false

      // Prefer stable id from backend if provided
      const targetId = message.id || activeAnswerStreamId || `stream-${Date.now()}-${Math.random().toString(16).slice(2)}`
      // O(1) id lookup — previously an O(n) findIndex ran on every streaming
      // chunk, which quickly dominates CPU on long chats.
      const idxById = idIndex.get(targetId) ?? -1

      if (idxById >= 0 && messages.value[idxById]?.id === targetId) {
        const prev = messages.value[idxById]!
        const nextText = (prev.text ?? '') + chunkText
        messages.value[idxById] = { ...prev, text: nextText, is_streaming: isStreamingNow }
      } else {
        // Fallback: append to last streaming ANSWER TEXT. Only scan a short
        // tail since the active stream is virtually always recent.
        const arr = messages.value
        let lastIdx: number | undefined
        const scanStart = Math.max(0, arr.length - 25)
        for (let i = arr.length - 1; i >= scanStart; i--) {
          const m = arr[i]
          if (m && m.role === 'ANSWER' && m.content_type === 'TEXT' && m.is_streaming) {
            lastIdx = i
            break
          }
        }

        if (typeof lastIdx === 'number') {
          const prev = messages.value[lastIdx]!
          const nextText = (prev.text ?? '') + chunkText
          messages.value[lastIdx] = { ...prev, text: nextText, is_streaming: isStreamingNow }
          activeAnswerStreamId = prev.id
        } else {
          const nowIso = new Date().toISOString()
          const created_date = message.created_date || nowIso
          const base: Message = {
            id: targetId,
            room: message.room || room.value?.id || '',
            content_type: message.content_type || 'TEXT',
            role: message.role || 'ANSWER',
            status: message.status || 'NEW',
            text: chunkText,
            image: message.image ?? null,
            sender: message.sender || 'AI',
            created_date,
            is_streaming: isStreamingNow,
          }
          messages.value.push(base)
          updateIdIndex(targetId, messages.value.length - 1)
        }
      }

      // Track/close active stream
      if (isStreamingNow) {
        activeAnswerStreamId = targetId
      } else {
        activeAnswerStreamId = null
      }

      // Some backends send an end-marker without role/content_type:
      // { stream:false, chunk:"" } — treat as "final text done" for unlocking.
      if (awaitingAi.value && message.stream === false) {
        awaitingFinalText = true
        finishAwaitingAiSoon()
      }

      return
    }

    // Dedupe: backend ko'pincha yuborilgan xabarni WS orqali ham qaytaradi (echo).
    // Ba'zi backend'larda WS payload'ida id bo'lmasligi mumkin, shuning uchun fallback dedupe ham bor.
    // O(1) id check via index map (previously O(n) `some` on every WS frame).
    if (message.id && idIndex.has(message.id)) return

    const tail = messages.value.slice(-25)
    const sameContent = (m: Message) => {
      if (m.sender !== message.sender || m.role !== message.role || m.content_type !== message.content_type) {
        return false
      }
      if (message.content_type === 'PRODUCT') {
        const key = productDedupeKey(message)
        if (!key) return false
        return productDedupeKey(m) === key
      }
      return (m.text ?? '') === (message.text ?? '') && (m.image ?? '') === (message.image ?? '')
    }

    // 1) created_date bo'yicha (agar bo'lsa)
    const msgTs = Date.parse(message.created_date)
    if (Number.isFinite(msgTs)) {
      const dup = tail.find((m) => {
        if (!sameContent(m)) return false
        const ts = Date.parse(m.created_date)
        if (!Number.isFinite(ts)) return false
        return Math.abs(ts - msgTs) <= 15000 // 15s ichida bo'lsa duplicate deb olamiz
      })
      if (dup) return
    }

    // 2) Fallback: timestamp yomon/mos kelmasa ham, oxirgi xabarlar ichida aynan bir xil content bo'lsa skip
    // Bu ayniqsa "REST push + WS echo" bo'lganda kerak.
    if (tail.some((m) => sameContent(m))) return

    messages.value.push(message)
    updateIdIndex(message.id, messages.value.length - 1)
  }

  /**
   * Chatni reset qilish
   */
  function reset() {
    room.value = null
    messages.value = []
    idIndex.clear()
    activeAnswerStreamId = null
    aiStatus.value = null
    awaitingAi.value = false
    awaitingFinalText = false
    awaitingProduct = false
    clearAwaitingTimers()
    if (aiStatusClearTimer != null) {
      window.clearTimeout(aiStatusClearTimer)
      aiStatusClearTimer = null
    }
    currentPage.value = 1
    hasMore.value = true
    isLoadingMore.value = false
    isUploadingImage.value = false
    imageUploadProgress.value = null
  }

  return {
    // State
    room,
    messages,
    isLoadingRoom,
    isLoadingMessages,
    currentPage,
    hasMore,
    isLoadingMore,
    isUploadingImage,
    imageUploadProgress,
    // Methods
    fetchRoom,
    fetchMessages,
    fetchMoreMessages,
    sendTextMessage,
    sendImageMessage,
    markAsRead,
    addMessage,
    aiStatus,
    awaitingAi,
    setAiStatus: (s: AiStatusEvent | null) => {
      aiStatus.value = s
    },
    reset,
  }
})