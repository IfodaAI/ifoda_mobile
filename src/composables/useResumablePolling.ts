import type { Router } from 'vue-router'
import { Preferences } from '@capacitor/preferences'
import { useAuthStore } from '../stores/auth'
import { devLog } from '../utils/devLog'

/**
 * NOTE: despite the `use*` name, this is a one-shot effect invoked from
 * `App.vue`'s `onMounted` callback (after `await`s). Vue composables that
 * rely on `inject()` (like `useRouter()`) must be called *synchronously* in
 * `setup()`; calling them post-await triggers
 *   "inject() can only be used inside setup() or functional components".
 * So we take the already-resolved `Router` instance as an argument instead
 * of calling `useRouter()` here.
 */
export async function useResumablePolling(router: Router) {
  const auth = useAuthStore()

  try {
    // Storage-dan polling token o'qish
    const { value: storedData } = await Preferences.get({ key: 'polling_token' })

    if (!storedData) {
      devLog('[Resumable Polling] No stored token')
      return
    }

    const { token, timestamp } = JSON.parse(storedData)
    const now = Date.now()
    const elapsed = now - timestamp
    const maxAge = 5 * 60 * 1000 // 5 minutes

    devLog('[Resumable Polling] Found token:', token)
    devLog('[Resumable Polling] Elapsed:', elapsed / 1000, 'seconds')

    // Token eskirgan bo'lsa tozalash
    if (elapsed > maxAge) {
      devLog('[Resumable Polling] Token expired, clearing...')
      await Preferences.remove({ key: 'polling_token' })
      return
    }

    // Muhim: eski Android qurilmalarda app fon'da o'chib ketishi mumkin.
    // App qayta ochilganda polling'ni UI bilan (LoginView) davom ettiramiz.
    if (!auth.accessToken) {
      await router.push('/login')
    }
  } catch (error) {
    if (import.meta.env.DEV) console.error('[Resumable Polling] Error:', error)
  }
}
