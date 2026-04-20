<template>
  <div class="chat-container">
    <!-- Header -->
    <div class="chat-header">
      <h1 class="brand-title" :class="wsStatus">
        <span v-if="wsStatus === 'connected'">IfodaAI</span>
        <span v-else-if="wsStatus === 'connecting' || wsStatus === 'idle'" class="ws-loading">
          Ulanmoqda<span class="dots" aria-hidden="true">
            <span class="d d1">.</span><span class="d d2">.</span><span class="d d3">.</span>
          </span>
        </span>
        <span v-else-if="wsStatus === 'disconnected'">Ulanish uzildi</span>
        <span v-else-if="wsStatus === 'error'">Ulanish xatosi</span>
        <span v-else class="ws-loading">
          Ulanmoqda<span class="dots" aria-hidden="true">
            <span class="d d1">.</span><span class="d d2">.</span><span class="d d3">.</span>
          </span>
        </span>
      </h1>
      <button class="back-button" @click="handleLogout">Chiqish</button>
    </div>

    <!-- Messages list -->
    <div ref="listEl" class="messages-list" @scroll="handleScroll">
      <div v-if="chat.isLoadingMessages" class="loading">
        Xabarlar yuklanmoqda...
      </div>
      <div v-else-if="chat.messages.length === 0" class="empty">
        <div class="empty-card">
          <p class="empty-title">Agro kimyo bo‘yicha tezkor maslahat</p>
          <p class="empty-sub">
            Savolingizni yozing yoki rasm yuboring — mutaxassis javob beradi.
          </p>
          <div class="chips" aria-label="Afzalliklar">
            <span class="chip">Tezkor javob</span>
            <span class="chip">Rasm yuborish</span>
            <span class="chip">Mutaxassis</span>
          </div>
          <p class="empty-hint">
            Pastdagi maydonga savol yozing va yuboring.
          </p>

          <p v-if="initError" class="init-error">
            {{ initError }}
          </p>
          <button v-if="initError" class="retry" type="button" @click="initChat">
            Qayta urinish
          </button>
        </div>
      </div>
      <div v-else>
        <MessageBubble
          v-for="msg in renderedMessages"
          :key="msg.id"
          :message="msg"
          @retry="handleRetry"
        />
      </div>
    </div>

    <!-- Input area -->
    <div ref="dockEl" class="input-dock">
      <div v-if="aiStatusMessage" class="ai-status-dock">
        {{ aiStatusMessage }}
      </div>
      <MessageInput
        :disabled="!chat.room?.id || chat.isLoadingMessages || chat.awaitingAi"
        :uploading="chat.isUploadingImage"
        :progress="chat.imageUploadProgress ?? undefined"
        @send-text="handleSendText"
        @send-image="handleSendImage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { useUiStore } from '../stores/ui'
import { useProductsStore } from '../stores/products'
import { useCartStore } from '../stores/cart'
import MessageBubble from '../components/MessageBubble.vue'
import MessageInput from '../components/MessageInput.vue'
import { useWebSocket, type WsStatus } from '../composables/useWebSocket'
import { resizeImageIfNeeded } from '../utils/image'
import { humanizeApiError, isGloballyHandled } from '../utils/errors'
import { onAuthLogout } from '../stores/auth'

// Windowing cap: keep chat render cost O(constant) regardless of history size.
// Older messages remain in store (for context and streaming state) but only
// the last N are rendered; scrolling up expands the window before paging.
const RENDER_WINDOW = 300
const RENDER_WINDOW_STEP = 100

const router = useRouter()
const auth = useAuthStore()
const chat = useChatStore()
const { aiStatus } = storeToRefs(chat)
const ui = useUiStore()
const productsStore = useProductsStore()
const cart = useCartStore()
const wsStatus = ref<WsStatus>('idle')
const initError = ref('')
const aiStatusMessage = computed(() => (aiStatus.value?.message ? String(aiStatus.value.message) : ''))
const ws = useWebSocket({
  onMessage: (m) => {
    // Echo muammosi uchun: odatda WS orqali faqat admin javoblarini qabul qilamiz.
    // Lekin backend ba'zida end-marker yuboradi: { stream:false, chunk:"" } (role/content_type yo'q).
    // Shuning uchun stream payloadlarni drop qilmaymiz — store unlock logikasi ishlaydi.
    const u = m as unknown as Record<string, unknown>
    const isStreamPayload = typeof u.stream === 'boolean' || typeof u.chunk === 'string'
    if (m.role !== 'ANSWER' && !isStreamPayload) return
    chat.addMessage(m)
  },
  onAiStatus: (s) => {
    chat.setAiStatus(s)
  },
  onStatusChange: (s) => {
    wsStatus.value = s
  },
})

const listEl = ref<HTMLElement | null>(null)
const dockEl = ref<HTMLElement | null>(null)
const isPreservingScroll = ref(false)
const visibleCount = ref(RENDER_WINDOW)
const userScrolledUp = ref(false)

// Only render the tail of the history to avoid N-thousand DOM nodes for long
// chats. Window expands as the user scrolls up; store keeps everything.
const renderedMessages = computed(() => {
  const all = chat.messages
  if (all.length <= visibleCount.value) return all
  return all.slice(all.length - visibleCount.value)
})

async function scrollToBottom() {
  await nextTick()
  const el = listEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

function isNearBottom(el: HTMLElement, tolerancePx = 120): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= tolerancePx
}

watch(
  () => chat.messages.length,
  async () => {
    if (isPreservingScroll.value) return
    // Respect user intent: if they scrolled up to read history, don't yank
    // the viewport back to the bottom when new messages stream in.
    if (userScrolledUp.value) return
    await scrollToBottom()
  }
)

// Chat fills the viewport with a fixed layout; prevent the outer page from
// scrolling so the header and input-dock can never slide out of view (they
// used to be pushed off by the app-shell's reserved bottom padding + URL-bar
// collapse on mobile browsers).
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

// Measure the input-dock and expose its height as a CSS variable so the
// messages-list bottom padding always matches (dock grows when the textarea
// expands or when the `ai-status-dock` appears).
let dockResizeObserver: ResizeObserver | null = null

function applyDockHeight(h: number) {
  const el = listEl.value
  if (!el) return
  // Round up to avoid subpixel clipping of the last message bubble.
  el.style.setProperty('--dock-height', `${Math.ceil(h)}px`)
}

onMounted(async () => {
  await initChat()

  // ResizeObserver may be missing in ancient WebViews; fall back to a
  // one-shot measurement in that case.
  const dock = dockEl.value
  if (dock) {
    if (typeof ResizeObserver !== 'undefined') {
      dockResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // `getBoundingClientRect()` reflects padding (incl. env safe-area);
          // `contentRect` would miss it and under-reserve bottom padding.
          const rect = (entry.target as HTMLElement).getBoundingClientRect()
          applyDockHeight(rect.height)
        }
      })
      dockResizeObserver.observe(dock)
    }
    applyDockHeight(dock.getBoundingClientRect().height)
  }
})

onBeforeUnmount(() => {
  dockResizeObserver?.disconnect()
  dockResizeObserver = null
})

// React to token rotation (refresh flow): tell WS to reconnect with new token.
watch(
  () => auth.accessToken,
  (token) => {
    if (token) ws.updateToken(token)
    else ws.disconnect()
  }
)

// Centralized lifecycle: on logout (explicit or 401-forced), tear down WS and
// reset chat state so stale sockets/messages don't survive into next session.
const unregisterLogoutHook = onAuthLogout(() => {
  ws.disconnect()
  chat.reset()
})
onUnmounted(() => {
  unregisterLogoutHook()
})

async function initChat() {
  initError.value = ''
  try {
    // 1. Room olish
    const room = await chat.fetchRoom()
    if (!room) {
      initError.value = 'Room topilmadi.'
      return
    }

    // 2. Messages olish
    await chat.fetchMessages(room.id, 1)

    // 3. WebSocket ulanish — only if we actually have a token. Connecting with
    // an empty token burns exponential backoff and pollutes server logs.
    const token = auth.accessToken
    if (token) {
      ws.connect(room.id, token)
    } else {
      initError.value = 'Sessiya muddati tugagan. Qaytadan kiring.'
    }

    // 4. Mark as read
    await chat.markAsRead(room.id)
    await scrollToBottom()
  } catch (error) {
    console.error('Chat initialization error:', error)
    initError.value =
      humanizeApiError(error) ?? 'Chat yuklanmadi. Internetni tekshirib qayta urinib ko‘ring.'
    if (!isGloballyHandled(error)) {
      ui.toast(initError.value, 'error', 4200)
    }
  }
}

// Throttle scroll work: scroll events fire at ~60Hz on mobile; we only need
// a coarse decision ("is the user near top / near bottom?") per animation frame.
let scrollRafPending = false
let lastScrollTop = 0

function handleScroll() {
  const el = listEl.value
  if (!el) return
  lastScrollTop = el.scrollTop
  if (scrollRafPending) return
  scrollRafPending = true
  requestAnimationFrame(() => {
    scrollRafPending = false
    onScrollSettled()
  })
}

async function onScrollSettled() {
  const el = listEl.value
  if (!el) return
  if (!chat.room?.id) return

  // Track "scrolled up" intent so streaming/new messages don't force jumps.
  userScrolledUp.value = !isNearBottom(el)

  if (lastScrollTop > 80) return

  // Near top: expand render window first (cheap, no network), then page.
  if (chat.messages.length > visibleCount.value) {
    const prevHeight = el.scrollHeight
    visibleCount.value = Math.min(chat.messages.length, visibleCount.value + RENDER_WINDOW_STEP)
    await nextTick()
    el.scrollTop = el.scrollHeight - prevHeight
    return
  }

  if (!chat.hasMore || chat.isLoadingMore || chat.isLoadingMessages) return

  const prevHeight = el.scrollHeight
  isPreservingScroll.value = true
  try {
    await chat.fetchMoreMessages(chat.room.id)
    await nextTick()
    // Grow the window along with the store so the newly prepended page renders.
    visibleCount.value = Math.min(
      chat.messages.length,
      visibleCount.value + RENDER_WINDOW_STEP
    )
    await nextTick()
    const newHeight = el.scrollHeight
    el.scrollTop = newHeight - prevHeight
  } catch (e) {
    if (!isGloballyHandled(e)) {
      ui.toast(humanizeApiError(e) ?? 'Eski xabarlarni yuklab bo‘lmadi.', 'error', 4200)
    }
  } finally {
    window.setTimeout(() => {
      isPreservingScroll.value = false
    }, 0)
  }
}

async function handleSendText(text: string) {
  if (!chat.room?.id || !text.trim()) return
  // Sending new content means the user wants to follow the conversation again.
  userScrolledUp.value = false
  try {
    await chat.sendTextMessage(chat.room.id, text)
  } catch (error) {
    console.error('Failed to send message:', error)
    if (!isGloballyHandled(error)) {
      ui.toast(humanizeApiError(error) ?? 'Xabar yuborilmadi. Qayta urinib ko‘ring.', 'error', 4200)
    }
  }
}

async function handleRetry(message: import('../api/types').Message) {
  if (!chat.room?.id) return
  if (!message.text) return
  try {
    await chat.sendTextMessage(chat.room.id, String(message.text))
  } catch (e) {
    if (!isGloballyHandled(e)) {
      ui.toast(humanizeApiError(e) ?? 'Qayta yuborilmadi. Internetni tekshirib ko‘ring.', 'error', 4200)
    }
  }
}

async function handleSendImage(file: File) {
  if (!chat.room?.id) return
  userScrolledUp.value = false
  try {
    const optimized = await resizeImageIfNeeded(file, { maxDim: 1600, quality: 0.82 })
    await chat.sendImageMessage(chat.room.id, optimized)
  } catch (error) {
    console.error('Failed to send image:', error)
    if (!isGloballyHandled(error)) {
      ui.toast(humanizeApiError(error) ?? 'Rasm yuborishda xatolik. Qayta urinib ko‘ring.', 'error', 4200)
    }
  }
}

async function handleLogout() {
  const ok = await ui.confirm({
    title: 'Chiqish',
    message: 'Chiqishga ishonchisiz?',
    confirmText: 'Chiqish',
    cancelText: 'Bekor qilish',
  })
  if (!ok) return
  // auth.logout() runs registered hooks (WS disconnect + chat.reset) centrally.
  productsStore.reset()
  await cart.reset()
  await auth.logout()
  await router.push('/login')
}
</script>

<style scoped>
.chat-container {
  /* Anchor to the viewport so the app-shell's `padding-bottom: 92px`
     (reserved for BottomNav on `showNav` routes) cannot push our layout
     off-screen. `100dvh` tracks the URL-bar collapse on mobile browsers. */
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--color-bg);
  z-index: 1;
}

.chat-header {
  /* Sticky is defensive: even if any future parent gains overflow, the header
     stays pinned to the top of the scroll container.
     `.chat-container` uses `position: fixed; inset: 0` (bypasses app-shell
     safe-area padding), so we add the notch inset directly to the header's
     top padding — otherwise the title/logout row sits under the iPhone X+
     Dynamic Island / notch. */
  position: sticky;
  top: 0;
  z-index: 9;
  flex-shrink: 0;
  background: var(--color-surface);
  color: var(--color-text);
  padding: calc(14px + var(--safe-top-padded, var(--safe-area-inset-top, 0px))) 16px 14px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 8px 16px rgba(22, 163, 74, 0.10);
  border-bottom: 1px solid var(--color-border);
}

.back-button {
  background: #fff;
  border: none;
  color: var(--color-text);
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease, color 0.2s ease, opacity 0.3s ease;
  margin-left: auto;
}

.back-button:hover {
  opacity: 1;
  background: #fef2f2;
  color: #991b1b;
}

.brand-title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--color-primary);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.brand-title.disconnected,
.brand-title.error {
  color: #991b1b;
}

.ws-loading {
  color: var(--color-primary);
}

.brand-title.disconnected .ws-loading,
.brand-title.error .ws-loading {
  color: #991b1b;
}

.dots {
  display: inline-flex;
  gap: 2px;
}

.d {
  display: inline-block;
  opacity: 0.2;
  animation: dotPulse 1.1s infinite;
}

.d2 {
  animation-delay: 0.15s;
}

.d3 {
  animation-delay: 0.30s;
}

@keyframes dotPulse {
  0%, 20% { opacity: 0.2; }
  50% { opacity: 1; }
  100% { opacity: 0.2; }
}

.messages-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* `contain` keeps rubber-band/bounce scrolling from leaking to the body —
     this is the main reason the top bar or input used to momentarily vanish. */
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  /* Reserve room for: fixed input-dock height (set at runtime via
     `--dock-height`, already includes safe-area padding) + its 84px offset
     above BottomNav + a small breathing gap so the final bubble never
     touches the dock. */
  padding: 14px 12px
    calc(var(--dock-height, 88px) + 84px + 12px)
    12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-dock {
  position: fixed;
  left: 0;
  right: 0;
  /* Sits above BottomNav (which itself is `10px + safe-area-bottom` above
     the viewport edge, 64px tall). `84px + safe-area-bottom` puts a ~10px
     gap between the dock and the nav pill on every device. */
  bottom: calc(84px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)));
  z-index: 8500;
}

.messages-list::-webkit-scrollbar {
  width: 10px;
}

.messages-list::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.12);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: content-box;
}

.ai-status-dock {
  margin: 0 12px 10px 12px;
  align-self: center;
  max-width: min(520px, 100%);
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  color: var(--color-muted);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.loading,
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-muted);
  font-size: 14px;
}

.empty-card {
  width: min(520px, 100%);
  background: var(--color-surface);
  border: 1px solid rgba(22, 163, 74, 0.28);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  text-align: left;
}

.empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-primary);
}

.empty-sub {
  margin: 6px 0 12px 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-muted);
}

.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.chip {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--color-primary-50);
  border: 1px solid rgba(22, 163, 74, 0.14);
  color: var(--color-text);
}

.empty-hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}

.init-error {
  margin: 12px 0 0 0;
  font-size: 13px;
  color: #991b1b;
}

.retry {
  margin-top: 10px;
  background: #fff;
  border: 1px solid rgba(153, 27, 27, 0.20);
  color: #991b1b;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
}

.retry:hover {
  background: #fef2f2;
}
</style>