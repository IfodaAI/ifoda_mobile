import { onMounted, onUnmounted } from 'vue'
import { App } from '@capacitor/app'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { devLog } from '../utils/devLog'

export function useDeepLink() {
  const auth = useAuthStore()
  const router = useRouter()
  let removeListener: (() => void) | null = null

  onMounted(async () => {
    try {
      // Deep link listener
      const handle = await App.addListener(
        'appUrlOpen',
        async (event: { url: string }) => {
          const url = event.url
          devLog('[Deep Link] Received:', url)

          // ifoda://auth?token=xxx format
          if (url.includes('ifoda://auth')) {
            const urlObj = new URL(url)
            const token = urlObj.searchParams.get('token')

            if (token) {
              devLog('[Deep Link] Token found, checking auth...')
              try {
                const result = await auth.checkTelegramLogin(token)
                devLog('[Deep Link] Auth result:', result.status)

                if (result.status === 'success') {
                  devLog('[Deep Link] Success! Navigating to /chat')
                  await router.push('/chat')
                }
              } catch (error) {
                if (import.meta.env.DEV) console.error('[Deep Link] Auth failed:', error)
              }
            }
          }
        }
      )

      removeListener = () => handle.remove()
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to set up deep link listener:', error)
    }
  })

  onUnmounted(() => {
    try {
      removeListener?.()
    } catch (e) {
      if (import.meta.env.DEV) console.error('Failed to remove deep link listener:', e)
    } finally {
      removeListener = null
    }
  })
}
