import { NextResponse } from 'next/server'

interface CriptoyaResponse {
  tarjeta?: { venta?: number; value?: number }
  cripto?: { venta?: number; value?: number }
  blue?: { venta?: number; value?: number }
  mep?: { venta?: number; value?: number }
  ccl?: { venta?: number; value?: number }
}

interface DolarApiItem {
  casa: string
  venta: number
  fechaActualizacion: string
}

interface NormalizedResponse {
  tarjeta: number
  cripto: number
  blue?: number
  mep?: number
  ccl?: number
  provider: 'criptoya' | 'dolarapi'
  updatedAt: string
}

// Cache simple en memoria
let cache: { data: NormalizedResponse; timestamp: number } | null = null
const CACHE_DURATION = 45 * 1000 // 45 segundos
const REQUEST_TIMEOUT = 5000 // 5 segundos

function extractValue(item: { venta?: number; value?: number } | undefined): number | undefined {
  if (!item) return undefined
  return item.venta ?? item.value
}

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

async function fetchFromCriptoya(): Promise<NormalizedResponse | null> {
  try {
    const response = await fetchWithTimeout('https://criptoya.com/api/dolar', REQUEST_TIMEOUT)
    
    if (!response.ok) {
      throw new Error(`Criptoya API error: ${response.status}`)
    }
    
    const data: CriptoyaResponse = await response.json()
    
    const tarjeta = extractValue(data.tarjeta)
    const cripto = extractValue(data.cripto)
    
    if (tarjeta === undefined || cripto === undefined) {
      throw new Error('Missing required fields from Criptoya')
    }
    
    const result: NormalizedResponse = {
      tarjeta,
      cripto,
      provider: 'criptoya',
      updatedAt: new Date().toISOString()
    }
    
    // Agregar campos opcionales si existen
    const blue = extractValue(data.blue)
    const mep = extractValue(data.mep)
    const ccl = extractValue(data.ccl)
    
    if (blue !== undefined) result.blue = blue
    if (mep !== undefined) result.mep = mep
    if (ccl !== undefined) result.ccl = ccl
    
    return result
  } catch (error) {
    console.error('Error fetching from Criptoya:', error)
    return null
  }
}

async function fetchFromDolarApi(): Promise<NormalizedResponse | null> {
  try {
    const response = await fetchWithTimeout('https://dolarapi.com/v1/dolares', REQUEST_TIMEOUT)
    
    if (!response.ok) {
      throw new Error(`DolarAPI error: ${response.status}`)
    }
    
    const data: DolarApiItem[] = await response.json()
    
    // Mapear los tipos según los requisitos
    const mapping: Record<string, keyof Omit<NormalizedResponse, 'provider' | 'updatedAt'>> = {
      'tarjeta': 'tarjeta',
      'cripto': 'cripto',
      'blue': 'blue',
      'bolsa': 'mep', // mep es MEP (Mercado Electrónico de Pagos)
      'contadoconliqui': 'ccl'
    }
    
    const result: Partial<NormalizedResponse> = {
      provider: 'dolarapi',
      updatedAt: new Date().toISOString()
    }
    
    for (const item of data) {
      const key = mapping[item.casa]
      if (key && item.venta) {
        ;(result as any)[key] = item.venta
      }
    }
    
    // Verificar que tenemos los campos requeridos
    if (!result.tarjeta || !result.cripto) {
      throw new Error('Missing required fields from DolarAPI')
    }
    
    return result as NormalizedResponse
  } catch (error) {
    console.error('Error fetching from DolarAPI:', error)
    return null
  }
}

export async function GET() {
  try {
    // Verificar cache
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(cache.data)
    }
    
    // Intentar con Criptoya primero
    let data = await fetchFromCriptoya()
    
    // Si falla, usar DolarAPI como fallback
    if (!data) {
      data = await fetchFromDolarApi()
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Unable to fetch exchange rates from any provider' },
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
    console.error('Unexpected error in /api/ars:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}