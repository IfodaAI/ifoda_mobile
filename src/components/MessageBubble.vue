<template>
  <div class="message" :class="messageClass">
    <div class="bubble">
      <div v-if="isProduct" class="prod">
        <div v-if="disease" class="prodHead">
          <span class="prodTitle">{{ disease.name }}</span>
          <p v-if="disease.description" class="prodDesc">{{ disease.description }}</p>
        </div>
        <button class="prodBtn" type="button" @click="handleAddProducts">
          Dorilar
          <span v-if="productsCount" class="prodCount">{{ productsCount }}</span>
        </button>
      </div>

      <p v-else-if="displayText" class="text">
        {{ displayText }}
        <span v-if="showCursor" class="cursor" aria-hidden="true">▍</span>
      </p>
      <button
        v-if="message.image"
        class="image-button"
        type="button"
        @click="isPreviewOpen = true"
        aria-label="Rasmni kattalashtirib ko‘rish"
      >
        <img :src="message.image" class="image" alt="Yuborilgan rasm" />
      </button>
      <p class="time">
        {{ formatTime(message.created_date) }}
        <span v-if="isSending" class="meta"> · Yuborilmoqda…</span>
        <button v-else-if="isFailed" class="retry" type="button" @click="emit('retry', message)">
          · Yuborilmadi (qayta)
        </button>
      </p>
    </div>
  </div>

  <teleport to="body">
    <div
      v-if="isPreviewOpen && message.image"
      class="preview-overlay"
      @click.self="isPreviewOpen = false"
    >
      <button class="preview-close" type="button" @click="isPreviewOpen = false" aria-label="Yopish">
        ✕
      </button>
      <img class="preview-image" :src="message.image" alt="Rasm preview" />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Message } from '../api/types'
import { useRouter } from 'vue-router'
import { useUiStore } from '../stores/ui'
 

const props = defineProps<{
  message: Message
}>()

const emit = defineEmits<{
  retry: [message: Message]
}>()

const isPreviewOpen = ref(false)
const router = useRouter()
const ui = useUiStore()

function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const messageClass = computed(() => {
  return props.message.role === 'QUESTION' ? 'question' : 'answer'
})

const isSending = computed(() => props.message.role === 'QUESTION' && props.message.client_status === 'sending')
const isFailed = computed(() => props.message.role === 'QUESTION' && props.message.client_status === 'failed')

const isProduct = computed(() => props.message.content_type === 'PRODUCT')
const disease = computed(() => props.message.diseases?.[0] ?? props.message.diseases_info?.[0] ?? null)
const productsCount = computed(() => (Array.isArray(props.message.products) ? props.message.products.length : 0))

const displayText = ref(props.message.text ?? '')
const showCursor = computed(() => Boolean(props.message.role === 'ANSWER' && props.message.is_streaming))

let typingTimer: ReturnType<typeof setInterval> | null = null

function stopTyping() {
  if (typingTimer) {
    clearInterval(typingTimer)
    typingTimer = null
  }
}

function startTypingTo(target: string) {
  stopTyping()
  // If target shrank or message isn't streaming: show immediately
  if (!props.message.is_streaming || target.length <= displayText.value.length) {
    displayText.value = target
    return
  }

  // Typewriter speed (chars/sec)
  const cps = 28
  const tickMs = 33
  const step = Math.max(1, Math.round((cps * tickMs) / 1000))

  typingTimer = setInterval(() => {
    const cur = displayText.value
    if (cur.length >= target.length) {
      stopTyping()
      return
    }
    displayText.value = target.slice(0, Math.min(target.length, cur.length + step))
  }, tickMs)
}

watch(
  () => props.message.text ?? '',
  (next) => {
    startTypingTo(next)
  },
  { immediate: true }
)

watch(
  () => Boolean(props.message.is_streaming),
  (streaming) => {
    if (!streaming) {
      // Ensure full text shown when stream ends
      stopTyping()
      displayText.value = props.message.text ?? ''
    }
  }
)

onUnmounted(() => {
  stopTyping()
})

async function handleAddProducts() {
  const ids = Array.isArray(props.message.products) ? props.message.products : []
  if (!ids.length) {
    ui.toast('Dorilar topilmadi.', 'info', 2200)
    return
  }

  try {
    const q = ids.join(',')
    await router.push(`/products?ids=${encodeURIComponent(q)}`)
  } catch (e) {
    console.error(e)
    ui.toast('Dorilar ro‘yxatini ochib bo‘lmadi.', 'error', 3200)
  }
}
</script>

<style scoped>
.message {
  display: flex;
  margin-bottom: 8px;
}

.message.question {
  justify-content: flex-end;
}

.message.answer {
  justify-content: flex-start;
}

.bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 16px;
  word-wrap: break-word;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.message.question .bubble {
  background: var(--color-primary);
  color: white;
  border-color: rgba(255, 255, 255, 0.18);
}

.message.answer .bubble {
  background: var(--color-surface);
  color: var(--color-text);
}

.text {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
}

.cursor {
  display: inline-block;
  margin-left: 2px;
  opacity: 0.85;
  animation: blink 1s steps(2, end) infinite;
}

@keyframes blink {
  50% {
    opacity: 0.12;
  }
}

.prod {
  display: grid;
  gap: 10px;
}

.prodHead {
  display: grid;
  gap: 6px;
}

.prodTitle {
  font-weight: 900;
  font-size: 15px;
  color: inherit;
}

.prodDesc {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  opacity: 0.9;
}

.prodBtn {
  width: 100%;
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.message.answer .prodBtn {
  background: var(--color-primary);
  color: #fff;
}

.message.question .prodBtn {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.20);
}

.prodBtn:active {
  transform: translateY(1px);
}

.prodCount {
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 900;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: inherit;
}

.image {
  max-width: 100%;
  border-radius: 8px;
  margin-bottom: 8px;
}

.image-button {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.image-button:active {
  transform: translateY(1px);
}

.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.80);
  display: grid;
  place-items: center;
  padding: 18px;
  z-index: 9999;
}

.preview-image {
  max-width: min(920px, 100%);
  max-height: 88vh;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
  background: #fff;
}

.preview-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
}

.preview-close:hover {
  background: rgba(255, 255, 255, 0.12);
}

.time {
  font-size: 12px;
  opacity: 0.7;
  margin: 4px 0 0 0;
}

.message.question .time {
  text-align: right;
}

.meta {
  font-size: 12px;
  opacity: 0.85;
}

.retry {
  font-size: 12px;
  opacity: 0.95;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}
</style>
