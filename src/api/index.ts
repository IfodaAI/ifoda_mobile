import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import { humanizeApiError } from '../utils/errors'
import { API_URL } from '../utils/env'

const api = axios.create({
  baseURL: API_URL,
  // Default timeout (chat fetch uchun 10s ba'zan kam bo'ladi)
  timeout: 30000,
})

api.interceptors.request.use(
  (config) => {
    try {
      useUiStore().startLoading()
    } catch {
      // ignore
    }
    return config
  },
  (error) => {
    try {
      useUiStore().stopLoading()
    } catch {
      // ignore
    }
    return Promise.reject(error)
  }
)

/**
 * Token ni set qilish (auth store dari chaqiriladi)
 */
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

function enqueueRefresh(cb: (token: string | null) => void) {
  refreshQueue.push(cb)
}

function flushRefreshQueue(token: string | null) {
  const queue = refreshQueue
  refreshQueue = []
  queue.forEach((cb) => cb(token))
}

/**
 * Response interceptor — 401 bo'lsa token refresh
 */
api.interceptors.response.use(
  (res) => {
    try {
      useUiStore().stopLoading()
    } catch {
      // ignore
    }
    return res
  },
  async (error) => {
    try {
      useUiStore().stopLoading()
    } catch {
      // ignore
    }
    const axiosError = error as AxiosError
    const status = axiosError.response?.status
    const originalRequest = axiosError.config as RetriableRequestConfig | undefined

    if (!originalRequest) return Promise.reject(error)

    // Global UX: network/server errors (deduped)
    try {
      const ui = useUiStore()

      // Network/server errors (deduped)
      if (!axiosError.response) {
        // DEV-only: surface the *underlying* failure (DNS, TLS, ATS block,
        // wrong baseURL, CORS preflight, …) which Axios otherwise hides behind
        // a generic "Network Error" string. Helps a lot on iOS sim where the
        // UI just shows a localized fallback message.
        if (import.meta.env.DEV) {
          const url = `${originalRequest?.baseURL ?? ''}${originalRequest?.url ?? ''}`
           
          console.error(
            '[API] raw network error →',
            'url=', url,
            'code=', axiosError.code,
            'message=', axiosError.message,
            'name=', axiosError.name,
            'cause=', (axiosError as unknown as { cause?: unknown }).cause
          )
        }
        const msg =
          humanizeApiError(axiosError) ??
          'Internet bilan muammo. Tarmoqni tekshiring.'
        const key = String(axiosError.message || '').toLowerCase().includes('timeout')
          ? 'net-timeout'
          : 'net-offline'
        ui.toastOnce(key, msg, 'error', 4200)
      } else if (status && status >= 500) {
        ui.toastOnce('srv-5xx', 'Serverda xatolik. Keyinroq qayta urinib ko‘ring.', 'error', 4200)
      }
    } catch {
      // UI store not ready (very early init) — ignore
    }

    if (status !== 401) return Promise.reject(error)
    if (originalRequest._retry) return Promise.reject(error)

    originalRequest._retry = true

    const auth = useAuthStore()
    if (!auth.refreshToken) {
      await auth.logout()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return await new Promise((resolve, reject) => {
        enqueueRefresh((token) => {
          if (!token) {
            reject(error)
            return
          }
          originalRequest.headers = originalRequest.headers ?? {}
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(api(originalRequest))
        })
      })
    }

    isRefreshing = true

    try {
      const ok = await auth.refresh()
      const token = ok ? auth.accessToken : null
      flushRefreshQueue(token)

      if (!token) {
        await auth.logout()
        return Promise.reject(error)
      }

      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${token}`
      return await api(originalRequest)
    } catch (e) {
      flushRefreshQueue(null)
      await auth.logout()
      return Promise.reject(e)
    } finally {
      isRefreshing = false
    }
  }
)

export default api