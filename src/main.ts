import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as Sentry from '@sentry/vue'

import App from './App.vue'
import router from './router'
import { humanizeApiError, isGloballyHandled } from './utils/errors'
import { devWarn } from './utils/devLog'
import { useUiStore } from './stores/ui'
import { App as CapApp } from '@capacitor/app'
import { sentryBeforeSend } from './utils/sentryRedact'
// Import env early so misconfigured production builds fail at boot,
// before any network call is made with a wrong endpoint.
import './utils/env'

const app = createApp(App)

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (typeof sentryDsn === 'string' && sentryDsn.trim().length > 0) {
  Sentry.init({
    app,
    dsn: sentryDsn.trim(),
    environment: import.meta.env.MODE,
    attachProps: false,
    // Never include raw request/response bodies in errors or breadcrumbs —
    // they may contain tokens, phone numbers, or chat content.
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration({ router })],
    beforeSend: sentryBeforeSend,
    beforeBreadcrumb(breadcrumb) {
      const data = breadcrumb.data as Record<string, unknown> | undefined
      if (data) {
        for (const k of ['url', 'to', 'from', 'href']) {
          const v = data[k]
          if (typeof v === 'string' && v.includes('?')) {
            // Inline redaction of query tokens in navigation/http breadcrumbs
            data[k] = v.replace(
              /([?&](?:token|access_token|refresh_token|ticket|code|otp)=)[^&\s"']+/gi,
              '$1[REDACTED]'
            )
          }
        }
      }
      return breadcrumb
    },
  })
}

app.use(createPinia())
app.use(router)

// Android hardware back button:
// - If router has history: go back
// - If not: go to /products
// - On /products: double-press to exit (prevents accidental exits)
try {
  let lastBackAt = 0
  let lastHintAt = 0
  CapApp.addListener('backButton', () => {
    try {
      const t = Date.now()
      // Debounce noisy multi-clicks
      if (t - lastBackAt < 250) return
      lastBackAt = t

      const state = router.options.history.state
      const canGoBack = Boolean(state.back)
      if (canGoBack) {
        router.back()
        return
      }
      const path = router.currentRoute.value.path
      if (path !== '/products') {
        router.replace('/products')
        return
      }

      // On home: require double press to exit
      const ui = useUiStore()
      if (t - lastHintAt < 1800) {
        CapApp.exitApp()
      } else {
        lastHintAt = t
        ui.toastOnce('exit-hint', 'Chiqish uchun yana bir marta bosing.', 'info', 1800, 1800)
      }
    } catch (e) {
      devWarn('backButton handler failed', e)
    }
  })
} catch {
  // Web: ignore
}

// Global runtime error handlers (production-friendly UX).
// Axios network/5xx errors are already toasted by the API interceptor;
// we suppress them here to avoid double-toasts.
window.addEventListener('unhandledrejection', (event) => {
  try {
    if (isGloballyHandled(event.reason)) return
    const ui = useUiStore()
    const msg = humanizeApiError(event.reason) ?? 'Kutilmagan xatolik. Qayta urinib ko‘ring.'
    ui.toastOnce('unhandledrejection', msg, 'error', 4200, 8000)
  } catch {
    // ignore (store not ready)
  }
  if (import.meta.env.DEV) console.error('[unhandledrejection]', event.reason)
})

window.addEventListener('error', (event) => {
  try {
    const err = (event as ErrorEvent).error
    if (isGloballyHandled(err)) return
    const ui = useUiStore()
    const msg = humanizeApiError(err) ?? 'Kutilmagan xatolik. Qayta urinib ko‘ring.'
    ui.toastOnce('window-error', msg, 'error', 4200, 8000)
  } catch {
    // ignore (store not ready)
  }
  if (import.meta.env.DEV) console.error('[window.error]', event)
})

app.mount('#app')
