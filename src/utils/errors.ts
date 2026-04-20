import type { AxiosError } from 'axios'

function isObjectLike(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function hasKey<K extends string>(obj: object, key: K): obj is Record<K, unknown> {
  return key in obj
}

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return null
}

function cleanOneLine(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

function firstFromArray(arr: unknown[]): string | null {
  for (const item of arr) {
    const s = asString(item)
    if (s) return s
    if (Array.isArray(item)) {
      const nested = firstFromArray(item)
      if (nested) return nested
    }
    if (isObjectLike(item)) {
      const nested = messageFromData(item)
      if (nested) return nested
    }
  }
  return null
}

function messageFromData(data: unknown): string | null {
  // DRF: string
  const direct = asString(data)
  if (direct) return cleanOneLine(direct)

  // DRF: list of strings / nested
  if (Array.isArray(data)) {
    const s = firstFromArray(data)
    return s ? cleanOneLine(s) : null
  }

  // DRF: dict (detail / field errors)
  if (isObjectLike(data)) {
    if (hasKey(data, 'detail')) {
      const d = messageFromData(data.detail)
      if (d) return d
    }

    // Field errors: { field: ["msg"] } or { non_field_errors: [...] }
    const entries = Object.entries(data)
    for (const [, value] of entries) {
      const s = messageFromData(value)
      if (s) return s
    }
  }

  return null
}

/**
 * Axios/DRF xatolarini UI uchun qisqa, tushunarli matnga aylantiradi.
 * - Timeout/offline
 * - DRF `detail`, field validation errors, string/list/dict formatlari
 */
export function humanizeApiError(error: unknown): string | null {
  // Network / timeout
  const msg =
    error instanceof Error
      ? cleanOneLine(error.message)
      : cleanOneLine(asString(error) ?? '')
  if (msg) {
    const lower = msg.toLowerCase()
    if (lower.includes('timeout')) {
      return 'So‘rov vaqti tugadi. Internetni tekshirib qayta urinib ko‘ring.'
    }
    if (
      lower.includes('network error') ||
      lower.includes('failed to fetch') ||
      lower.includes('load failed') ||
      lower.includes('err_network')
    ) {
      return 'Internet bilan muammo. Tarmoqni tekshiring.'
    }
  }

  // Axios error?
  const ae = error as AxiosError<unknown> | undefined

  // DRF response payload (most useful)
  const response = ae?.response
  if (response && isObjectLike(response) && hasKey(response, 'data')) {
    const fromData = messageFromData(response.data)
    if (fromData) return fromData
  }

  // Fallback: plain Error message
  if (msg) return msg
  return null
}

/**
 * Returns true when the Axios interceptor has already shown a global toast
 * for this error (network error / timeout / 5xx). Views should skip their
 * own toast in this case to avoid double-toasts.
 *
 * Views still own 4xx errors (validation / business rules) since those
 * typically need context-specific wording.
 */
export function isGloballyHandled(error: unknown): boolean {
  const ae = error as AxiosError | undefined
  const status = ae?.response?.status
  if (status == null) return true // no response → network / timeout
  if (status >= 500) return true
  return false
}


