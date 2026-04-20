/** Faqat `vite dev` / `import.meta.env.DEV` da chiqadi — production logcat/spam kamayadi */
export function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) console.log(...args)
}

export function devWarn(...args: unknown[]) {
  if (import.meta.env.DEV) console.warn(...args)
}
