import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  kind: ToastKind
  message: string
  action?: { label: string; to: string }
  createdAt: number
  durationMs: number
}

export interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<ToastItem[]>([])
  const toastKeys = ref<Record<string, number>>({})
  const pendingRequests = ref(0)
  const confirmState = ref<ConfirmState>({
    open: false,
    title: '',
    message: '',
    confirmText: 'Ha',
    cancelText: 'Yo‘q',
  })
  let confirmResolver: ((v: boolean) => void) | null = null

  function toast(
    message: string,
    kind: ToastKind = 'info',
    durationMs: number = 2600,
    action?: { label: string; to: string }
  ) {
    const id = uid()
    const item: ToastItem = {
      id,
      kind,
      message,
      action,
      createdAt: Date.now(),
      durationMs,
    }
    toasts.value = [...toasts.value, item].slice(-4)

    window.setTimeout(() => {
      removeToast(id)
    }, durationMs)
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function toastOnce(
    key: string,
    message: string,
    kind: ToastKind = 'info',
    durationMs: number = 2600,
    cooldownMs: number = 6000
  ) {
    const now = Date.now()
    const last = toastKeys.value[key] ?? 0
    if (now - last < cooldownMs) return
    toastKeys.value = { ...toastKeys.value, [key]: now }
    toast(message, kind, durationMs)
  }

  function confirm(options: {
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
  }): Promise<boolean> {
    confirmResolver?.(false)
    confirmResolver = null

    confirmState.value = {
      open: true,
      title: options.title ?? 'Tasdiqlash',
      message: options.message,
      confirmText: options.confirmText ?? 'Ha',
      cancelText: options.cancelText ?? 'Yo‘q',
    }

    return new Promise<boolean>((resolve) => {
      confirmResolver = resolve
    })
  }

  function resolveConfirm(v: boolean) {
    confirmState.value = { ...confirmState.value, open: false }
    confirmResolver?.(v)
    confirmResolver = null
  }

  function startLoading() {
    pendingRequests.value += 1
  }

  function stopLoading() {
    pendingRequests.value = Math.max(0, pendingRequests.value - 1)
  }

  return {
    toasts,
    toast,
    toastOnce,
    removeToast,
    confirmState,
    confirm,
    resolveConfirm,
    pendingRequests,
    startLoading,
    stopLoading,
  }
})

