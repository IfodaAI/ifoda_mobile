import type { ErrorEvent, EventHint } from '@sentry/vue'

/**
 * Sensitive URL query params and JSON keys that must never leave the device.
 * Matching is case-insensitive on keys.
 */
const SENSITIVE_QUERY_PARAMS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'access',
  'refresh',
  'ticket',
  'code',
  'password',
  'pwd',
  'otp',
  'pin',
  'phone',
  'phone_number',
  'email',
])

const SENSITIVE_BODY_KEYS = /^(authorization|token|access_token|refresh_token|password|pwd|otp|pin|phone(_number)?|email)$/i

const REDACTED = '[REDACTED]'

/**
 * Strip sensitive params from a query string. Keeps key names so error
 * reports still hint at the request shape.
 */
function redactQueryString(qs: string): string {
  if (!qs) return qs
  try {
    const params = new URLSearchParams(qs)
    let changed = false
    for (const key of Array.from(params.keys())) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        params.set(key, REDACTED)
        changed = true
      }
    }
    return changed ? params.toString() : qs
  } catch {
    return qs
  }
}

/**
 * Redact a full URL (string). Safe for http/https/ws/wss/custom schemes
 * like ifoda://auth?token=... — treats everything after '?' as a query.
 */
export function redactUrl(url: unknown): string {
  if (typeof url !== 'string' || !url) return typeof url === 'string' ? url : ''
  const qIdx = url.indexOf('?')
  if (qIdx === -1) return url
  const head = url.slice(0, qIdx)
  const qs = url.slice(qIdx + 1)
  const cleaned = redactQueryString(qs)
  return cleaned ? `${head}?${cleaned}` : head
}

/**
 * Recursively walk a JSON-like value and redact sensitive keys.
 * Depth-limited to avoid pathological payloads.
 */
function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_BODY_KEYS.test(k)) {
        out[k] = REDACTED
      } else if (typeof v === 'string' && /^[a-z]+:\/\//i.test(v)) {
        out[k] = redactUrl(v)
      } else {
        out[k] = redactDeep(v, depth + 1)
      }
    }
    return out
  }
  return value
}

/**
 * Build a Sentry `beforeSend` hook that strips tokens/PII from:
 *   - event.request.url and query_string
 *   - event.request.data (body)
 *   - event.request.headers (Authorization, Cookie)
 *   - event.breadcrumbs[].data.url / .to / .from
 *   - event.extra / event.tags / event.contexts
 * Also drops Axios error responses' `request.url` inside hint.originalException
 * when it embeds a sensitive query.
 */
export function sentryBeforeSend(
  event: ErrorEvent,
  _hint: EventHint
): ErrorEvent | null {
  try {
    if (event.request) {
      const req = event.request as Record<string, unknown>
      if (typeof req.url === 'string') req.url = redactUrl(req.url)
      if (typeof req.query_string === 'string') {
        req.query_string = redactQueryString(req.query_string)
      }
      if (req.headers && typeof req.headers === 'object') {
        const h = req.headers as Record<string, unknown>
        for (const key of Object.keys(h)) {
          if (/^(authorization|cookie|x-auth-token)$/i.test(key)) {
            h[key] = REDACTED
          }
        }
      }
      if (req.data !== undefined) {
        req.data = redactDeep(req.data)
      }
    }

    if (Array.isArray(event.breadcrumbs)) {
      for (const bc of event.breadcrumbs) {
        const data = (bc as { data?: Record<string, unknown> }).data
        if (!data) continue
        for (const k of ['url', 'to', 'from', 'href']) {
          const v = data[k]
          if (typeof v === 'string') data[k] = redactUrl(v)
        }
      }
    }

    if (event.extra) event.extra = redactDeep(event.extra) as typeof event.extra
    if (event.contexts) event.contexts = redactDeep(event.contexts) as typeof event.contexts

    if (typeof event.message === 'string') {
      event.message = event.message.replace(
        /([?&](?:token|access_token|refresh_token|ticket|code|otp)=)[^&\s"']+/gi,
        `$1${REDACTED}`
      )
    }

    return event
  } catch {
    // Never let redaction failures block error reporting.
    return event
  }
}
