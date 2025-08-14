import { NextResponse } from 'next/server';
import { fetchJson, validateEnvVar, getEnvConfig } from '@/lib/fetchJson';

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
  rate: number;
  provider: string;
  updatedAt: string;
}

// Cache for 60 seconds
let cache: { data: ForexResponse; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 1000; // 60 seconds

export async function GET() {
  try {
    // Validate environment variables
    const config = getEnvConfig();
    
    // Check cache first
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(cache.data);
    }

    // Fetch from configured API (USD as base, PEN as target)
    const url = `${config.exchangeApiBase}/latest/USD`;
    
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

    // Get PEN rate from USD base (need to invert to get PEN to USD)
    const penRate = data.rates?.PEN;
    if (!penRate) {
      throw new Error('PEN rate not found in response');
    }

    // Convert PEN to USD (invert the rate)
    const usdRate = 1 / penRate;

    const result: ForexResponse = {
      rate: usdRate,
      provider: 'open.er-api.com',
      updatedAt: data.time_last_update_utc
    };

    // Update cache
    cache = {
      data: result,
      timestamp: Date.now()
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching forex rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 503 }
    );
  }
}