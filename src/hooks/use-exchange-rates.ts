import { useQuery } from '@tanstack/react-query'

interface ForexResponse {
  rates: Record<string, number>
  provider: string
  updatedAt: string
  base: string
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

export function useForexRate(base: string = 'PEN', symbols: string[] = ['USD']) {
  return useQuery<ForexResponse>({
    queryKey: ['forex', base, symbols.join(',')],
    queryFn: async () => {
      const symbolsParam = symbols.join(',');
      const response = await fetch(`/api/forex?base=${base}&symbols=${symbolsParam}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${base} to ${symbols.join(',')} rates`)
      }
      return response.json()
    },
    staleTime: 60 * 1000, // 60 segundos
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
    staleTime: 60 * 1000, // 60 segundos
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}