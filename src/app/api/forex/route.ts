import { NextResponse } from 'next/server';
import { fetchJson, getEnvConfig } from '@/lib/fetchJson';

interface ExchangeRateResponse {
  result: string;
  provider: string;
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  time_eol_unix: number;
  base_code: string;
  target_code: string;
  conversion_rate: number;
  rates?: Record<string, number>;
}

interface ForexResponse {
  rates: Record<string, number>;
  provider: string;
  updatedAt: string;
  base: string;
}

// Cache for 60 seconds with key-based storage
const cache = new Map<string, { data: ForexResponse; timestamp: number }>();
const CACHE_DURATION = 60 * 1000; // 60 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get('base') || 'PEN';
  const symbols = searchParams.get('symbols')?.split(',') || ['USD'];
  try {
    // Validate environment variables
    const config = getEnvConfig();
    
    // Create cache key
    const cacheKey = `${base}-${symbols.join(',')}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Fetch from configured API with the requested base
    const url = `${config.exchangeApiBase}/latest/${base}`;
    
    const response = await fetchJson<ExchangeRateResponse>(url, {
      headers: {
        'User-Agent': 'PEN-USD-ARS-Converter/1.0'
      }
    });

    if (response.error || !response.data) {
      throw new Error(`Exchange API error: ${response.error || 'No data received'}`);
    }

    const data = response.data;

    if (data.result !== 'success') {
      throw new Error('API returned unsuccessful result');
    }

    // Extract requested rates with strict validation
    const rates: Record<string, number> = {};
    for (const symbol of symbols) {
      if (symbol === base) {
        rates[symbol] = 1; // Base currency rate is always 1
      } else {
        const rate = data.rates?.[symbol];
        const numericRate = Number(rate);
        if (!Number.isFinite(numericRate) || numericRate <= 0) {
          throw new Error(`Invalid or missing rate for ${symbol}: ${rate}`);
        }
        rates[symbol] = numericRate;
      }
    }

    // Validación específica para USD - debe estar presente siempre
    if (symbols.includes('USD') && (!rates.USD || !Number.isFinite(rates.USD) || rates.USD <= 0)) {
      throw new Error('USD rate is required but missing or invalid');
    }

    const result: ForexResponse = {
      rates,
      base,
      provider: 'open.er-api.com',
      updatedAt: data.time_last_update_utc
    };

    // Update cache
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching forex rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 503 }
    );
  }
}