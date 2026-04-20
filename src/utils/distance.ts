import type { Branch } from '../api/branches'

/** Yer yuzidagi ikki nuqta orasidagi masofa (km) */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function pickNearestBranch(
  branches: Branch[],
  lat: number,
  lng: number
): Branch | null {
  if (!branches.length) return null
  let best: Branch = branches[0]!
  let bestKm = Infinity
  for (const b of branches) {
    const d = haversineKm(lat, lng, b.latitude, b.longitude)
    if (d < bestKm) {
      bestKm = d
      best = b
    }
  }
  return best
}

export function sortBranchesByDistance(branches: Branch[], lat: number, lng: number): Branch[] {
  return [...branches].sort(
    (a, b) =>
      haversineKm(lat, lng, a.latitude, a.longitude) -
      haversineKm(lat, lng, b.latitude, b.longitude)
  )
}
