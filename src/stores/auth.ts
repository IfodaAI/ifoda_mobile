import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '../api/types'
import * as authApi from '../api/auth'
import { setAuthToken } from '../api/index'
import * as tokenStorage from '../storage/tokens'

type LogoutHook = () => void | Promise<void>

// Module-scoped registry so interceptor-triggered logouts also run the same
// cleanup (WS disconnect, chat reset, etc.) as explicit user logouts.
const logoutHooks = new Set<LogoutHook>()

async function runLogoutHooks() {
  // Snapshot to allow hooks to self-unregister without mutating during iteration.
  const snapshot = Array.from(logoutHooks)
  for (const hook of snapshot) {
    try {
      await hook()
    } catch (err) {
      if (import.meta.env.DEV) console.error('[auth] logout hook failed:', err)
    }
  }
}

/**
 * Register a hook that runs on every logout (explicit or forced by 401).
 * Returns an unregister function — typically called from a component's
 * `onUnmounted`.
 */
export function onAuthLogout(hook: LogoutHook): () => void {
  logoutHooks.add(hook)
  return () => logoutHooks.delete(hook)
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const user = ref<User | null>(null)
  const isLoading = ref(false)

  /**
   * Storage dan tokenlarni o'qish (app startup da)
   */
  async function loadFromStorage() {
    try {
      const [access, refresh] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getRefreshToken(),
      ])

      if (access) {
        accessToken.value = access
        setAuthToken(access) // ← Token ni Axios headeriga set qiling!
      }
      if (refresh) refreshToken.value = refresh
    } catch (error) {
      console.error('Failed to load tokens from storage:', error)
    }
  }

  /**
   * Tokenlarni storage ga saqlash
   */
  async function setTokens(access: string, refresh: string) {
    accessToken.value = access
    refreshToken.value = refresh
    setAuthToken(access) // Axios headeriga token qo'shish

    try {
      await tokenStorage.setTokens(access, refresh)
    } catch (error) {
      console.error('Failed to save tokens:', error)
    }
  }

  /**
   * Token yangilash
   */
  async function refresh(): Promise<boolean> {
    if (!refreshToken.value) return false

    try {
      const { access } = await authApi.refreshToken(refreshToken.value)
      accessToken.value = access
      setAuthToken(access)
      await tokenStorage.setTokens(access, refreshToken.value)
      return true
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  /**
   * Logout — runs registered cleanup hooks first (WS disconnect, chat reset,
   * cart reset, etc.), then clears tokens. Safe to call from anywhere
   * (user action, 401 interceptor, deep-link handler).
   */
  async function logout() {
    // Run cleanup BEFORE clearing tokens so hooks can still issue authenticated
    // disconnect frames or flush local caches that depend on user identity.
    await runLogoutHooks()

    accessToken.value = null
    refreshToken.value = null
    user.value = null
    setAuthToken(null)

    try {
      await tokenStorage.clearTokens()
    } catch (error) {
      console.error('Failed to clear tokens:', error)
    }
  }

  /**
   * Telegram login — init
   */
  async function initTelegramLogin() {
    try {
      isLoading.value = true
      const data = await authApi.initTelegramAuth()
      return data
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Telegram login — check
   */
  async function checkTelegramLogin(token: string) {
    try {
      const data = await authApi.checkTelegramAuth(token)

      if (data.status === 'success' && data.access_token && data.user) {
        await setTokens(data.access_token, data.refresh_token || '')
        user.value = data.user
      }

      return data
    } catch (error) {
      console.error('Telegram login check failed:', error)
      throw error
    }
  }

  /**
   * Current user ni API dan olish
   */
  async function fetchCurrentUser() {
    try {
      const userData = await authApi.getCurrentUser()
      user.value = userData
      return userData
    } catch (error) {
      console.error('Failed to fetch current user:', error)
      throw error
    }
  }

  return {
    // State
    accessToken,
    refreshToken,
    user,
    isLoading,
    // Methods
    loadFromStorage,
    setTokens,
    refresh,
    logout,
    initTelegramLogin,
    checkTelegramLogin,
    fetchCurrentUser,
  }
})