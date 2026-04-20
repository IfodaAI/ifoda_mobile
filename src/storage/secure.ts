import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

const PREFIX = 'ifodaai_'

let prefixReady = false

async function ensurePrefix() {
  if (prefixReady) return
  prefixReady = true
  try {
    // Prefix native platforms only (web uses localStorage in plugin)
    if (Capacitor.isNativePlatform()) {
      await SecureStorage.setKeyPrefix(PREFIX)
    }
  } catch {
    // ignore
  }
}

function prefKey(key: string) {
  return `${PREFIX}${key}`
}

export async function secureSet(key: string, value: string | null) {
  await ensurePrefix()
  if (Capacitor.isNativePlatform()) {
    if (value == null) {
      await SecureStorage.remove(key)
      return
    }
    await SecureStorage.set(key, value)
    return
  }

  // Web/dev fallback
  if (value == null) {
    await Preferences.remove({ key: prefKey(key) })
  } else {
    await Preferences.set({ key: prefKey(key), value })
  }
}

export async function secureGet(key: string): Promise<string | null> {
  await ensurePrefix()
  if (Capacitor.isNativePlatform()) {
    const v = await SecureStorage.get(key)
    return (v ?? null) as string | null
  }
  const { value } = await Preferences.get({ key: prefKey(key) })
  return value ?? null
}

export async function secureRemove(key: string) {
  await secureSet(key, null)
}

