import { useQuery } from '@tanstack/react-query'
import type { MaxiInfo, MaxiReceipt } from '@/lib/maxi'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path} returned ${res.status}`)
  return (await res.json()) as T
}

/** Maxi's public service facts from the backend (seller address, price, network). */
export function useMaxiInfo() {
  return useQuery({ queryKey: ['maxi-info'], queryFn: () => getJson<MaxiInfo>('/api/info'), retry: 1 })
}

/** Payments Maxi has settled since the backend started. */
export function useReceipts() {
  return useQuery({
    queryKey: ['maxi-receipts'],
    queryFn: () => getJson<MaxiReceipt[]>('/api/receipts'),
    refetchInterval: 8000,
  })
}

/** The 402 challenge Maxi returns to an unpaid request, decoded from the PAYMENT-REQUIRED header. */
export interface Challenge {
  status: number
  amount: string
  asset: string
  network: string
  payTo: string
}

export function useChallenge() {
  return useQuery({
    queryKey: ['maxi-challenge'],
    queryFn: async (): Promise<Challenge> => {
      const res = await fetch('/api/brief')
      const header = res.headers.get('PAYMENT-REQUIRED')
      if (res.status !== 402 || !header) throw new Error(`Expected a 402, got ${res.status}`)
      const decoded = JSON.parse(atob(header)) as {
        accepts: { amount: string; asset: string; network: string; payTo: string }[]
      }
      const first = decoded.accepts[0]
      return { status: res.status, amount: first.amount, asset: first.asset, network: first.network, payTo: first.payTo }
    },
    retry: 1,
  })
}
