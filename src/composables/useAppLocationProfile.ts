import { watch } from 'vue'
import { Geolocation } from '@capacitor/geolocation'
import { useAuthStore } from '../stores/auth'
import { useAppLocationStore } from '../stores/appLocation'
import { fetchCheckUser } from '../api/telegramUsers'
import { fetchOpenMeteoCurrent } from '../api/weather'
import { nominatimReverseStructured } from '../utils/nominatim'
import { devLog, devWarn } from '../utils/devLog'
import type { TelegramUserCheck } from '../api/types'
import type { NominatimStructured } from '../utils/nominatim'

/**
 * Approximate region-center coordinates. Used as a *last-resort* fallback so
 * the header can still show some weather when the device denies Geolocation
 * or we're running in a browser DevTools session where GPS is unavailable.
 * Values are regional capitals — accurate enough for "is it raining here?"
 * not for precision agriculture.
 */
const REGION_CENTER_COORDS: Record<string, { lat: number; lng: number }> = {
  'Toshkent': { lat: 41.3111, lng: 69.2797 },
  'Toshkent viloyati': { lat: 41.26, lng: 69.22 },
  'Andijon': { lat: 40.7821, lng: 72.3442 },
  'Buxoro': { lat: 39.7681, lng: 64.4556 },
  "Farg'ona": { lat: 40.3894, lng: 71.7839 },
  'Jizzax': { lat: 40.1158, lng: 67.842 },
  'Namangan': { lat: 40.9983, lng: 71.6726 },
  'Navoiy': { lat: 40.0844, lng: 65.379 },
  'Qashqadaryo': { lat: 38.8606, lng: 65.789 },
  'Samarqand': { lat: 39.6547, lng: 66.9597 },
  'Sirdaryo': { lat: 40.8378, lng: 68.6611 },
  'Surxondaryo': { lat: 37.2364, lng: 67.2875 },
  'Xorazm': { lat: 41.55, lng: 60.6317 },
  "Qoraqalpog'iston": { lat: 42.4611, lng: 59.6167 },
}

function fallbackCoordsFromCheck(p: TelegramUserCheck | null): { lat: number; lng: number } | null {
  const regionName = p?.region?.name?.trim()
  if (!regionName) return null
  const exact = REGION_CENTER_COORDS[regionName]
  if (exact) return exact
  // Loose prefix match (e.g. "Toshkent viloyati" vs "Toshkent vil.")
  for (const [k, v] of Object.entries(REGION_CENTER_COORDS)) {
    if (regionName.startsWith(k) || k.startsWith(regionName)) return v
  }
  return null
}

function shortPlaceLabel(n: NominatimStructured | null): string | null {
  if (!n) return null
  const a = n.address
  const head =
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.county ||
    a.state ||
    a.region
  if (head) return head
  if (n.display_name) return n.display_name.split(',').slice(0, 2).join(' · ')
  return null
}

function needsRegionDistrict(p: TelegramUserCheck | null): boolean {
  if (!p) return false
  return !p.region?.id || !p.district?.id
}

let inflight: Promise<void> | null = null
let lastTelegramId: number | null = null

async function runBootstrap(telegramId: number) {
  const store = useAppLocationStore()

  try {
    let lat: number | null = null
    let lng: number | null = null
    store.locationDenied = false

    try {
      await Geolocation.requestPermissions()
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 22000,
        maximumAge: 8000,
      })
      lat = pos.coords.latitude
      lng = pos.coords.longitude
      store.coords = { lat, lng }
      devLog('[AppLocation] GPS acquired:', lat, lng)
    } catch (err) {
      store.locationDenied = true
      store.coords = null
      devWarn('[AppLocation] Geolocation failed — falling back to region center:', err)
    }

    // 1. Always fetch the profile (region/district info) first-ish — we may
    //    need its region as a fallback for weather below.
    const check = await fetchCheckUser(telegramId).catch((e) => {
      devWarn('[AppLocation] fetchCheckUser failed:', e)
      return null
    })
    if (check) store.setTelegramCheck(check)

    // 2. If GPS was denied/failed, try to still show weather based on the
    //    user's known region — zero UX cost, better than "—".
    if ((lat == null || lng == null) && check) {
      const fb = fallbackCoordsFromCheck(check)
      if (fb) {
        lat = fb.lat
        lng = fb.lng
        devLog('[AppLocation] Using region fallback coords:', check.region?.name, fb)
      }
    }

    // 3. Weather + reverse geocoding — run in parallel, but `placeLabel` only
    //    comes from nominatim when we have *real* GPS, not region fallback.
    const tasks: Promise<unknown>[] = []
    if (lat != null && lng != null) {
      tasks.push(
        fetchOpenMeteoCurrent(lat, lng).then((w) => {
          store.weather = w
          devLog('[AppLocation] Weather:', w)
        })
      )
    } else {
      devWarn('[AppLocation] No coords available — skipping weather fetch')
    }
    if (!store.locationDenied && store.coords) {
      tasks.push(
        nominatimReverseStructured(store.coords.lat, store.coords.lng).then((n) => {
          store.nominatim = n
          store.placeLabel = shortPlaceLabel(n)
        })
      )
    } else if (check?.region?.name) {
      // Nominatim would reveal no real street; show the known region instead.
      store.placeLabel = check.region.name
    }
    await Promise.all(tasks)

    if (needsRegionDistrict(store.telegramCheck)) {
      store.showRegionModal = true
    }
  } finally {
    store.profileInitDone = true
  }
}

export function useAppLocationProfile() {
  const auth = useAuthStore()
  const store = useAppLocationStore()

  async function init() {
    const tid = auth.user?.telegram_id
    if (!auth.accessToken || tid == null) return
    if (inflight) {
      await inflight
      return
    }
    if (store.profileInitDone && lastTelegramId === tid) return

    inflight = (async () => {
      try {
        await runBootstrap(tid)
      } catch {
        // API xatolari axios interceptor orqali
      } finally {
        lastTelegramId = tid
        inflight = null
      }
    })()
    await inflight
  }

  function resetSession() {
    lastTelegramId = null
    store.reset()
  }

  watch(
    () => [auth.accessToken, auth.user?.telegram_id] as const,
    async ([token, telegramId]) => {
      if (!token) {
        resetSession()
        return
      }
      if (telegramId == null) return
      await init()
    },
    { immediate: true }
  )

  return { init, resetSession }
}
