import type { Paginated } from './types'
import api from './index'

export interface Branch {
  id: string
  branch_id: number
  manager: string | null
  name: string
  latitude: number
  longitude: number
  phone_number: string
}

export async function fetchBranches() {
  const { data } = await api.get<Paginated<Branch>>('/api/branches/')
  return data.results ?? []
}
