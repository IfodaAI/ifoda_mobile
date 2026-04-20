import type { DistrictDto, RegionDto } from '../api/types'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/['ʼʻʼ]/g, "'")
    .replace(/viloyati|viloyat|tumani|tuman|shahri|shahar|region|district|область/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreStrings(a: string, b: string): number {
  const A = normalize(a)
  const B = normalize(b)
  if (!A || !B) return 0
  if (A === B) return 1
  if (A.includes(B) || B.includes(A)) return 0.92
  const ta = new Set(A.split(' ').filter((x) => x.length > 2))
  const tb = new Set(B.split(' ').filter((x) => x.length > 2))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const x of ta) {
    if (tb.has(x)) inter += 1
  }
  return inter / Math.max(ta.size, tb.size)
}

function bestAgainstHints<T extends { name: string }>(items: T[], hints: string[]): T | null {
  let best: T | null = null
  let bestScore = 0
  for (const it of items) {
    for (const h of hints) {
      const sc = scoreStrings(it.name, h)
      if (sc > bestScore) {
        bestScore = sc
        best = it
      }
    }
  }
  return bestScore >= 0.35 ? best : null
}

/** Nominatim `address` + `display_name` dan viloyat ID taxmin qilish */
export function guessRegion(
  regions: RegionDto[],
  address: Record<string, string>,
  displayName: string | null
): string | null {
  if (!regions.length) return null
  const hints = [
    address.state,
    address.region,
    address['ISO3166-2-lvl4'],
    address.province,
    displayName,
  ].filter(Boolean) as string[]
  const hit = bestAgainstHints(regions, hints)
  return hit?.id ?? null
}

/** Tanlangan viloyat tumanlari + Nominatim manzili bo'yicha tuman ID */
export function guessDistrict(
  districts: DistrictDto[],
  address: Record<string, string>,
  displayName: string | null
): string | null {
  if (!districts.length) return null
  const hints = [
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.county,
    address.hamlet,
    address.suburb,
    address.neighbourhood,
    address.quarter,
    displayName,
  ].filter(Boolean) as string[]
  const hit = bestAgainstHints(districts, hints)
  return hit?.id ?? null
}
