import { NextResponse } from 'next/server';
import { fetchJson, getEnvConfig } from '@/lib/fetchJson';

// Interfaces para las respuestas de las APIs
interface CriptoyaResponse {
  tarjeta: {
    price: number;
    variation: number;
    timestamp: number;
  };
  blue: {
    ask: number;
    bid: number;
    variation: number;
    timestamp: number;
  };
  cripto: {
    ccb: {
      ask: number;
      bid: number;
      variation: number;
      timestamp: number;
    };
    usdt: {
      ask: number;
      bid: number;
      variation: number;
      timestamp: number;
    };
    usdc: {
      ask: number;
      bid: number;
      variation: number;
      timestamp: number;
    };
  };
  mep?: {
    al30?: {
      "24hs": { price: number; variation: number; timestamp: number };
      ci: { price: number; variation: number; timestamp: number };
    };
    gd30?: {
      "24hs": { price: number; variation: number; timestamp: number };
      ci: { price: number; variation: number; timestamp: number };
    };
  };
  ccl?: {
    al30?: {
      "24hs": { price: number; variation: number; timestamp: number };
      ci: { price: number; variation: number; timestamp: number };
    };
    gd30?: {
      "24hs": { price: number; variation: number; timestamp: number };
      ci: { price: number; variation: number; timestamp: number };
    };
  };
}

interface DolarApiResponse {
  compra: number;
  venta: number;
  casa: string;
  nombre: string;
  moneda: string;
  fechaActualizacion: string;
}

interface NormalizedArsResponse {
  tarjeta: number;
  cripto: number;
  blue?: number;
  mep?: number;
  ccl?: number;
  provider: string;
  updatedAt: string;
}

// Cache simple en memoria
let cache: { data: NormalizedArsResponse; timestamp: number } | null = null;
const CACHE_DURATION = 45 * 1000; // 45 segundos

async function fetchFromCriptoya(): Promise<NormalizedArsResponse | null> {
  try {
    const data = await fetchJson<CriptoyaResponse>(
      'https://criptoya.com/api/dolar',
      {
        headers: {
          'User-Agent': 'PEN-USD-ARS-Converter/1.0'
        }
      }
    );
    
    // Verificar que tenemos los campos requeridos
    if (!data.tarjeta?.price || !data.cripto?.usdt?.ask) {
      throw new Error('Missing required fields from Criptoya');
    }
    
    // Extraer MEP y CCL (usar al30 como referencia principal)
    const mepPrice = data.mep?.al30?.ci?.price || data.mep?.gd30?.ci?.price;
    const cclPrice = data.ccl?.al30?.ci?.price || data.ccl?.gd30?.ci?.price;
    
    return {
      tarjeta: data.tarjeta.price,
      cripto: data.cripto.usdt.ask, // Usar USDT como referencia para cripto
      blue: data.blue?.ask,
      mep: mepPrice,
      ccl: cclPrice,
      provider: 'criptoya',
      updatedAt: new Date(data.tarjeta.timestamp * 1000).toISOString()
    };
  } catch (error) {
    console.error('Error fetching from Criptoya:', error);
    return null;
  }
}

async function fetchFromDolarApi(): Promise<NormalizedArsResponse | null> {
  try {
    const data = await fetchJson<DolarApiResponse[]>(
      'https://dolarapi.com/v1/dolares',
      {
        headers: {
          'User-Agent': 'PEN-USD-ARS-Converter/1.0'
        }
      }
    );
    
    // Buscar las cotizaciones que necesitamos
    const tarjeta = data.find(d => d.casa === 'tarjeta');
    const blue = data.find(d => d.casa === 'blue');
    const mep = data.find(d => d.casa === 'mayorista'); // Aproximación
    
    if (!tarjeta) {
      throw new Error('Tarjeta rate not found in DolarAPI response');
    }
    
    return {
      tarjeta: tarjeta.venta,
      cripto: blue?.venta || tarjeta.venta, // Fallback a tarjeta si no hay blue
      blue: blue?.venta,
      mep: mep?.venta,
      ccl: undefined, // DolarAPI no tiene CCL
      provider: 'dolarapi',
      updatedAt: tarjeta.fechaActualizacion || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching from DolarAPI:', error);
    return null;
  }
}

export async function GET() {
  try {
    // Validar variables de entorno
    const config = getEnvConfig();
    
    // Verificar cache
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(cache.data)
    }
    
    let data: NormalizedArsResponse | null = null;
    
    // Usar el proveedor configurado primero
    if (config.ARS_PROVIDER === 'criptoya') {
      data = await fetchFromCriptoya();
      
      // Si falla, usar DolarAPI como fallback
      if (!data) {
        console.log('Criptoya failed, trying DolarAPI as fallback');
        data = await fetchFromDolarApi();
      }
    } else {
      // Si está configurado dolarapi o cualquier otro valor
      data = await fetchFromDolarApi();
      
      // Si falla, usar Criptoya como fallback
      if (!data) {
        console.log('DolarAPI failed, trying Criptoya as fallback');
        data = await fetchFromCriptoya();
      }
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Unable to fetch ARS exchange rates from any provider' },
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