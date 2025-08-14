import { useQuery } from '@tanstack/react-query'

interface ForexResponse {
  rate: number
  provider: string
  updatedAt: string
}

interface ArsResponse {
  tarjeta: number
  cripto: number
  blue?: number
  mep?: number
  ccl?: number
  provider: string
  updatedAt: string
}

export function useForexRate() {
  return useQuery<ForexResponse>({
    queryKey: ['forex', 'pen-usd'],
    queryFn: async () => {
      const response = await fetch('/api/forex')
      if (!response.ok) {
        throw new Error('Failed to fetch PEN to USD rate')
      }
      return response.json()
    },
    staleTime: 45 * 1000, // 45 segundos
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

export function useArsRates() {
  return useQuery<ArsResponse>({
    queryKey: ['ars', 'rates'],
    queryFn: async () => {
      const response = await fetch('/api/ars')
      if (!response.ok) {
        throw new Error('Failed to fetch ARS rates')
      }
      return response.json()
    },
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}