<template>
  <div class="login-container">
    <div class="login-card">
      <div class="account-icon" aria-hidden="true">
        <!-- user/account outline icon -->
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M4.5 20.25c1.7-3.1 4.3-4.75 7.5-4.75s5.8 1.65 7.5 4.75"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div class="brand">
        <div class="logo" aria-hidden="true">IF</div>
        <div class="brand-text">
          <h1>Ifoda</h1>
          <p class="subtitle">AGRO KIMYO HIMOYA</p>
        </div>
      </div>

      <p class="hint">
        Telegram orqali tez va xavfsiz kirish.
      </p>

      <button
        class="login-button"
        :disabled="isLoading"
        @click="handleLogin"
      >
        <span v-if="!isLoading">Telegram orqali kirish</span>
        <span v-else>Kutilmoqda...</span>
      </button>

      <p class="helper">
        Parol kerak emas. Odatda 10 soniyada kirib olasiz.
      </p>

      <p v-if="error" class="error-message">
        {{ error }}
      </p>

      <div v-if="isPolling" class="polling-status">
        <p>Telegram’da tasdiqlang... <span class="mono">{{ pollingSeconds }}s</span></p>
        <div class="spinner"></div>
      </div>
    </div>

    <button class="privacy-button" type="button" @click="isPrivacyOpen = true">
      Maxfiylik siyosati
    </button>

    <teleport to="body">
      <div v-if="isPrivacyOpen" class="modal-overlay" @click.self="isPrivacyOpen = false">
        <div class="modal">
          <div class="modal-header">
            <h2>Maxfiylik siyosati</h2>
            <button class="modal-close" type="button" @click="isPrivacyOpen = false" aria-label="Yopish">
              ✕
            </button>
          </div>

          <div class="modal-body">
            <p>
              Ushbu ilova Telegram orqali avtorizatsiya qiladi va chat xizmatini ko'rsatadi.
              Biz sizning login jarayonini yakunlash uchun vaqtinchalik tokenni qurilmangizda saqlashimiz mumkin.
            </p>
            <ul>
              <li>Saqlanadigan ma'lumotlar: access/refresh tokenlar (avtorizatsiya uchun).</li>
              <li>Chat xabarlari: server orqali uzatiladi.</li>
              <li>Kamera/galereya: rasm yuborish uchun ruxsat so'raladi (ixtiyoriy).</li>
            </ul>
            <p class="muted">
              To'liq siyosat matnini keyinroq backend yoki web sahifadan olib kelib shu dialogda ko'rsatish mumkin.
            </p>
          </div>

          <div class="modal-footer">
            <button class="modal-ok" type="button" @click="isPrivacyOpen = false">Tushunarli</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Preferences } from '@capacitor/preferences'
import { useAuthStore } from '../stores/auth'
import { openExternalUrl } from '../utils/openExternalUrl'
import { devLog } from '../utils/devLog'

const router = useRouter()
const auth = useAuthStore()

const isLoading = ref(false)
const isPolling = ref(false)
const error = ref('')
const pollingToken = ref('')
const isPrivacyOpen = ref(false)
const pollingSeconds = ref(0)
let isCheckingAuth = false // ← Mutex: bir vaqtda 1 ta so'rov
let pollingInterval: ReturnType<typeof setTimeout> | null = null

async function handleLogin() {
  try {
    isLoading.value = true
    error.value = ''

    // 1. Backend dan bot deep link init
    const { token, tg_url } = await auth.initTelegramLogin()
    pollingToken.value = token

    // Token + timestamp ni storage-ga saqlash (app restart-da resume qilish uchun)
    await Preferences.set({
      key: 'polling_token',
      value: JSON.stringify({
        token,
        timestamp: Date.now(),
      }),
    })
    devLog('[Login] Polling token saved:', token)

    // 2. Telegram ochish (native: in-app browser)
    await openExternalUrl(tg_url)

    // 3. Polling boshla
    await startPolling(token)
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Login boshlanmadi, qayta urinib ko\'ring'
    if (import.meta.env.DEV) console.error('Login error:', err)
  } finally {
    isLoading.value = false
  }
}

function clearPollingInterval() {
  if (pollingInterval) {
    clearTimeout(pollingInterval)
    pollingInterval = null
  }
}

// Polling schedule: stays at 3s while healthy, then backs off exponentially
// (3 → 6 → 12 → 24s, capped) after consecutive failures, so an outage doesn't
// hammer the backend. Total polling window stays ~5 minutes.
const POLL_BASE_MS = 3_000
const POLL_MAX_INTERVAL_MS = 24_000
const POLL_MAX_WINDOW_MS = 5 * 60 * 1000

async function startPolling(token: string) {
  isPolling.value = true
  pollingSeconds.value = 0
  clearPollingInterval()

  const startedAt = Date.now()
  let consecutiveFailures = 0

  const stop = (msg?: string) => {
    clearPollingInterval()
    isPolling.value = false
    if (msg) error.value = msg
    Preferences.remove({ key: 'polling_token' }).catch(() => {
      // ignore
    })
  }

  const tick = async () => {
    if (isCheckingAuth) {
      schedule(currentInterval())
      return
    }

    // Pause (but don't give up) while the device is offline. We'll resume
    // on the next tick; window.online event isn't strictly required here
    // because the schedule itself keeps polling on a slow cadence.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      consecutiveFailures = Math.min(consecutiveFailures + 1, 5)
      schedule(currentInterval())
      return
    }

    pollingSeconds.value = Math.floor((Date.now() - startedAt) / 1000)
    devLog(`[Polling +${pollingSeconds.value}s, failures=${consecutiveFailures}]`)

    try {
      isCheckingAuth = true
      const result = await auth.checkTelegramLogin(token)
      consecutiveFailures = 0
      devLog(`[Check result]`, result.status)

      if (result.status === 'success') {
        devLog('[Success] /products ga o\'tilmoqda...')
        stop()
        await router.push('/products')
        return
      }
      if (result.status === 'expired') {
        stop('Vaqt tugadi, qayta urinib ko\'ring')
        return
      }
    } catch (err) {
      consecutiveFailures += 1
      if (import.meta.env.DEV) console.error(`[Polling error, failures=${consecutiveFailures}]`, err)
    } finally {
      isCheckingAuth = false
    }

    if (Date.now() - startedAt >= POLL_MAX_WINDOW_MS) {
      stop('Vaqt tugadi, qayta urinib ko\'ring')
      return
    }

    schedule(currentInterval())
  }

  const currentInterval = () => {
    // Exponential backoff on failures with full jitter so parallel clients
    // (after a backend outage) don't all retry at the same instant.
    if (consecutiveFailures === 0) return POLL_BASE_MS
    const upper = Math.min(POLL_MAX_INTERVAL_MS, POLL_BASE_MS * Math.pow(2, consecutiveFailures))
    return Math.max(POLL_BASE_MS, Math.floor(upper / 2 + Math.random() * (upper / 2)))
  }

  const schedule = (ms: number) => {
    pollingInterval = setTimeout(tick, ms)
  }

  // First check runs immediately so the user sees fast feedback when Telegram
  // auth was already completed before this app regained foreground.
  void tick()
}

onMounted(async () => {
  try {
    // App restart bo'lganda (Android low-memory kill) polling_token saqlanib qoladi.
    // LoginView ochilishi bilan polling'ni avtomatik davom ettiramiz.
    const { value: storedData } = await Preferences.get({ key: 'polling_token' })
    if (!storedData) return

    const { token, timestamp } = JSON.parse(storedData) as {
      token: string
      timestamp: number
    }

    const elapsed = Date.now() - timestamp
    const maxAge = 5 * 60 * 1000 // 5 minutes
    if (elapsed > maxAge) {
      await Preferences.remove({ key: 'polling_token' })
      return
    }

    pollingToken.value = token
    error.value = ''
    await startPolling(token)
  } catch (e) {
    if (import.meta.env.DEV) console.error('[Login] Failed to resume polling:', e)
  }
})

onUnmounted(() => {
  clearPollingInterval()
})
</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background:
    radial-gradient(1200px 600px at 10% 10%, rgba(22, 163, 74, 0.18), transparent 60%),
    radial-gradient(900px 500px at 90% 30%, rgba(22, 163, 74, 0.12), transparent 55%),
    var(--color-bg);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: var(--shadow-md);
  position: relative;
}

.account-icon {
  width: 56px;
  height: 56px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  margin: -58px auto 12px auto;
  background: #fff;
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.brand {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 14px;
}

.logo {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%);
  box-shadow: 0 8px 18px rgba(22, 163, 74, 0.30);
}

.brand-text h1 {
  font-size: 22px;
  margin: 0;
  font-weight: 800;
  letter-spacing: 0.2px;
}

.subtitle {
  color: var(--color-muted);
  margin: 2px 0 0 0;
  font-size: 12px;
  letter-spacing: 0.9px;
  text-transform: uppercase;
}

.hint {
  margin: 8px 0 18px 0;
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.45;
}

.login-button {
  width: 100%;
  padding: 12px 14px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.05s ease, opacity 0.2s ease, filter 0.2s ease;
}

.login-button:hover:not(:disabled) {
  filter: brightness(0.98);
}

.login-button:active:not(:disabled) {
  transform: translateY(1px);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.helper {
  margin: 10px 0 0 0;
  font-size: 12px;
  color: var(--color-muted);
  text-align: center;
}

.error-message {
  color: #991b1b;
  margin-top: 14px;
  padding: 12px 12px;
  background: #fef2f2;
  border: 1px solid rgba(153, 27, 27, 0.12);
  border-radius: 12px;
  font-size: 14px;
}

.polling-status {
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  color: var(--color-muted);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f0f0f0;
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.privacy-button {
  margin-top: 14px;
  background: transparent;
  border: none;
  color: var(--color-muted);
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.privacy-button:hover {
  background: rgba(22, 163, 74, 0.08);
  color: var(--color-text);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.48);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 9999;
}

.modal {
  width: min(560px, 100%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}

.modal-close {
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 10px;
  width: 34px;
  height: 34px;
  cursor: pointer;
}

.modal-body {
  padding: 14px 16px;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.55;
}

.modal-body ul {
  margin: 10px 0 0 18px;
  color: var(--color-text);
}

.muted {
  color: var(--color-muted);
  font-size: 13px;
  margin-top: 12px;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
}

.modal-ok {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 10px 14px;
  cursor: pointer;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>