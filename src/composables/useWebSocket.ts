import { ref, onUnmounted } from 'vue'
import type { Message, AiStatusEvent } from '../api/types'
import { devLog, devWarn } from '../utils/devLog'
import { WS_URL } from '../utils/env'
import { App as CapApp } from '@capacitor/app'

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

// Heartbeat: send a ping every HEARTBEAT_INTERVAL_MS, treat connection as
// stale if no inbound frame arrives for STALE_AFTER_MS. Disabled for now —
// backend does not yet handle application-level `{type:'ping'}` frames, and
// enabling stale-timer without a ping would cause false disconnects during
// idle periods (user not chatting). Flip HEARTBEAT_ENABLED when backend
// adds a matching handler.
const HEARTBEAT_ENABLED = false
const HEARTBEAT_INTERVAL_MS = 25_000
const STALE_AFTER_MS = 45_000

// Reconnect backoff: exponential with full jitter, capped. Jitter is critical
// after a backend outage so clients don't all reconnect at the same instant.
const BACKOFF_BASE_MS = 800
const BACKOFF_CAP_MS = 15_000

export function useWebSocket(options?: {
  onMessage?: (message: Message) => void
  onAiStatus?: (event: AiStatusEvent) => void
  onStatusChange?: (status: WsStatus) => void
}) {
  const messages = ref<Message[]>([])
  const status = ref<WsStatus>('idle')
  let ws: WebSocket | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0
  let lastRoomId: string | null = null
  let lastToken: string | null = null
  let shouldReconnect = true
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let staleTimer: ReturnType<typeof setTimeout> | null = null
  let appResumeListener: { remove: () => Promise<void> } | null = null

  function setStatus(s: WsStatus) {
    status.value = s
    options?.onStatusChange?.(s)
  }

  function clearTimers() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (staleTimer) {
      clearTimeout(staleTimer)
      staleTimer = null
    }
  }

  function armStaleTimer() {
    if (!HEARTBEAT_ENABLED) return
    if (staleTimer) clearTimeout(staleTimer)
    staleTimer = setTimeout(() => {
      // No activity for too long: force-close so onclose triggers reconnect.
      devWarn('WebSocket stale — forcing reconnect')
      try {
        ws?.close(4000, 'stale')
      } catch {
        // ignore
      }
    }, STALE_AFTER_MS)
  }

  function startHeartbeat() {
    if (!HEARTBEAT_ENABLED) return
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState !== WebSocket.OPEN) return
      try {
        // App-level ping: backend may echo or ignore. Either way, sending
        // data keeps NAT/idle timeouts happy on mobile networks.
        ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
      } catch {
        // ignore — stale timer will catch a dead socket
      }
    }, HEARTBEAT_INTERVAL_MS)
    armStaleTimer()
  }

  function scheduleReconnect() {
    if (!shouldReconnect) return
    if (!lastRoomId || !lastToken) return
    if (reconnectTimeout) clearTimeout(reconnectTimeout)

    // Pause reconnects while offline — browser emits 'online' event on resume,
    // which is already handled by a listener registered on first connect().
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      devLog('WebSocket reconnect paused — device offline')
      return
    }

    // Exponential backoff with full jitter: delay = random(0, min(cap, base*2^n))
    const upper = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * Math.pow(2, reconnectAttempt))
    const delay = Math.floor(Math.random() * upper)
    reconnectAttempt += 1

    reconnectTimeout = setTimeout(() => {
      connect(lastRoomId!, lastToken!)
    }, delay)
  }

  function closeSocketSilently() {
    if (!ws) return
    try {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      ws.close()
    } catch {
      // ignore
    }
    ws = null
  }

  function handleOnline() {
    if (!shouldReconnect) return
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return
    if (!lastRoomId || !lastToken) return
    devLog('Network back online — reconnecting WebSocket immediately')
    reconnectAttempt = 0
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    connect(lastRoomId, lastToken)
  }

  function handleOffline() {
    // Let the socket notice via onclose naturally, but cancel any pending
    // reconnect so we don't burn exponential backoff while airplane-mode is on.
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  let listenersRegistered = false
  function registerGlobalListeners() {
    if (listenersRegistered) return
    listenersRegistered = true
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }
    // Reconnect when the native app returns to foreground (mobile may kill
    // sockets while backgrounded).
    try {
      CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) handleOnline()
      }).then((l) => {
        appResumeListener = l
      })
    } catch {
      // Web: ignore
    }
  }

  function unregisterGlobalListeners() {
    if (!listenersRegistered) return
    listenersRegistered = false
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    try {
      appResumeListener?.remove()
    } catch {
      // ignore
    }
    appResumeListener = null
  }

  function connect(roomId: string, token: string) {
    // Empty-token guard: backend would reject and we'd burn reconnect attempts.
    // Caller is responsible for waiting until auth is ready.
    if (!roomId || !token) {
      devWarn('WebSocket connect skipped — missing roomId or token')
      return
    }

    lastRoomId = roomId
    lastToken = token
    shouldReconnect = true
    registerGlobalListeners()

    const url = `${WS_URL}/ws/chat/${roomId}/?token=${encodeURIComponent(token)}`

    try {
      setStatus('connecting')
      closeSocketSilently()
      ws = new WebSocket(url)

      ws.onopen = () => {
        devLog('WebSocket connected')
        setStatus('connected')
        reconnectAttempt = 0
        startHeartbeat()
      }

      ws.onmessage = (event) => {
        // Any inbound frame proves the connection is alive — reset stale timer.
        armStaleTimer()

        try {
          const handleParsed = (parsed: unknown) => {
            if (
              parsed &&
              typeof parsed === 'object' &&
              (parsed as { type?: unknown }).type === 'ai_status' &&
              typeof (parsed as { message?: unknown }).message === 'string'
            ) {
              options?.onAiStatus?.(parsed as AiStatusEvent)
              return
            }

            // Drop server pong frames from the visible message stream.
            if (
              parsed &&
              typeof parsed === 'object' &&
              (parsed as { type?: unknown }).type === 'pong'
            ) {
              return
            }

            const raw = parsed as Partial<Message> & {
              created_at?: string
              timestamp?: string
              chunk?: string
              stream?: boolean
            }

            const created_date =
              raw.created_date ?? raw.created_at ?? raw.timestamp ?? new Date().toISOString()

            const msg = {
              ...raw,
              created_date,
            } as Message

            // Normalize PRODUCT payload: backend may send diseases_info
            if (!msg.diseases && Array.isArray((msg as unknown as { diseases_info?: unknown }).diseases_info)) {
              const di = (msg as unknown as { diseases_info?: Array<{ name: string; description: string }> }).diseases_info
              if (di?.length) (msg as unknown as { diseases?: unknown }).diseases = di
            }

            messages.value.push(msg)
            options?.onMessage?.(msg)
          }

          const handleAny = (parsed: unknown) => {
            if (Array.isArray(parsed)) {
              for (const item of parsed) handleParsed(item)
              return
            }
            handleParsed(parsed)
          }

          // Some backends send NDJSON / JSON array / comma-separated JSON objects in one WS frame.
          // Try strict JSON first; if it fails, fallback to line-by-line JSON parse (with trailing comma cleanup).
          if (typeof event.data === 'string') {
            try {
              handleAny(JSON.parse(event.data))
              return
            } catch {
              const lines = event.data.split('\n').map((s) => s.trim()).filter(Boolean)
              for (let line of lines) {
                if (line === '[' || line === ']' || line === ',' || line === '[,' || line === '],') continue
                if (line.endsWith(',')) line = line.slice(0, -1).trim()
                try {
                  handleAny(JSON.parse(line))
                } catch {
                  // ignore individual bad lines
                }
              }
              return
            }
          }

          handleAny(JSON.parse(String(event.data)))
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        if (import.meta.env.DEV) console.error('WebSocket error:', error)
        setStatus('error')
        // Let onclose drive reconnect (some platforms call both)
      }

      ws.onclose = () => {
        devLog('WebSocket disconnected, reconnecting...')
        setStatus('disconnected')
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        if (staleTimer) {
          clearTimeout(staleTimer)
          staleTimer = null
        }
        scheduleReconnect()
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to connect WebSocket:', error)
      setStatus('error')
      scheduleReconnect()
    }
  }

  function send(text: string, contentType: string = 'TEXT') {
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ text, content_type: contentType }))
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to send WebSocket message:', error)
      }
    } else {
      devWarn('WebSocket not connected')
    }
  }

  /**
   * Update the auth token used for (re)connecting. If the socket is already
   * open, close it so the next reconnect uses the fresh token. Prevents the
   * reconnect loop from hammering the server with an expired token.
   */
  function updateToken(newToken: string) {
    if (!newToken || newToken === lastToken) return
    lastToken = newToken
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
      try {
        ws.close(4001, 'token-rotated')
      } catch {
        // ignore
      }
      // onclose will schedule reconnect using the new lastToken.
    } else if (shouldReconnect && lastRoomId) {
      // Was in a reconnect loop with stale token — retry now with fresh one.
      reconnectAttempt = 0
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
      connect(lastRoomId, newToken)
    }
  }

  function disconnect() {
    shouldReconnect = false
    clearTimers()
    unregisterGlobalListeners()
    closeSocketSilently()
    lastToken = null
    lastRoomId = null
    setStatus('disconnected')
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    messages,
    status,
    connect,
    send,
    disconnect,
    updateToken,
  }
}
