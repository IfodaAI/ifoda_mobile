import DOMPurify, { type Config } from 'dompurify'

// Rich-text safe config for product descriptions / CKEditor output.
// DOMPurify handles the dangerous cases by default (script, on* handlers,
// javascript:/data: URIs in href/src, SVG/MathML bypasses, etc).
// We explicitly forbid a few extras to be safe even with future config drift.
const RICH_TEXT_CONFIG: Config = {
  FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['style'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  RETURN_TRUSTED_TYPE: false,
}

// Open links in external browser and prevent reverse-tabnabbing.
// DOMPurify hook is global per module, so we register it once.
let hooksRegistered = false
function registerHooks() {
  if (hooksRegistered) return
  hooksRegistered = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof Element && node.tagName === 'A') {
      if (node.hasAttribute('href')) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    }
  })
}

/**
 * Sanitize rich-text HTML (e.g. CKEditor output) before rendering with v-html.
 * Safe against script injection, inline event handlers, and javascript:/data: URIs.
 */
export function sanitizeRichHtml(dirty: string): string {
  registerHooks()
  return DOMPurify.sanitize(dirty || '', RICH_TEXT_CONFIG)
}
