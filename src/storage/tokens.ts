import { secureGet, secureRemove, secureSet } from './secure'

const ACCESS = 'access_token'
const REFRESH = 'refresh_token'

export async function getAccessToken() {
  return await secureGet(ACCESS)
}

export async function getRefreshToken() {
  return await secureGet(REFRESH)
}

export async function setTokens(access: string | null, refresh: string | null) {
  await secureSet(ACCESS, access)
  await secureSet(REFRESH, refresh)
}

export async function clearTokens() {
  await secureRemove(ACCESS)
  await secureRemove(REFRESH)
}

