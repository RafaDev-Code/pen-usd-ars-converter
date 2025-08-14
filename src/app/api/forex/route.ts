import { NextResponse } from 'next/server'

interface ExchangeRateResponse {
  PEN: number
}

interface NormalizedForexResponse {
  rate: number
  provider: 'open.er-api.com'
  updatedAt: string
}

// Cache simple en memoria
let cache: { data: NormalizedForexResponse; timestamp: number } | null = null
const CACHE_DURATION = 60 * 1000 // 60 segundos
const REQUEST_TIMEOUT = 5000 // 5 segundos

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PEN-USD-ARS-Converter/1.0'
      }
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

async function fetchPenToUsdRate(): Promise<NormalizedForexResponse | null> {
  try {
    // Usar API gratuita que devuelve USD como base y PEN como tasa
    const response = await fetchWithTimeout(
      'https://open.er-api.com/v6/latest/USD',
      REQUEST_TIMEOUT
    )
    
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`)
    }
    
    const data: any = await response.json()
    
    if (!data.rates?.PEN) {
      throw new Error('PEN rate not found in response')
    }
    
    // Convertir de USD->PEN a PEN->USD (inverso)
    const penToUsdRate = 1 / data.rates.PEN
    
    return {
      rate: penToUsdRate,
      provider: 'open.er-api.com',
      updatedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error fetching PEN to USD rate:', error)
    return null
  }
}

export async function GET() {
  try {
    // Verificar cache
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(cache.data)
    }
    
    const data = await fetchPenToUsdRate()
    
    if (!data) {
      return NextResponse.json(
        { error: 'Unable to fetch PEN to USD exchange rate' },
        { status: 503 }
      )
    }
    
    // Actualizar cache
    cache = {
      data,
      timestamp: Date.now()
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error in /api/forex:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}