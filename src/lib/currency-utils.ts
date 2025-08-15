// Tipos para conversión de moneda con contrato estable
export type ConvertOk = {
  ok: true;
  USD: number;
  ARS_tarjeta: number;
  ARS_cripto: number;
  providers: {
    forex: string;
    ars: string;
    updatedAt: string;
  };
};

export type ConvertErr = {
  ok: false;
  USD: null;
  ARS_tarjeta: null;
  ARS_cripto: null;
  providers: {
    forex: 'error' | string;
    ars: 'error' | string;
    updatedAt: string;
  };
  error: string;
};

export type ConvertResult = ConvertOk | ConvertErr;

// Helper para redondear a 2 decimales
function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

// Helper getRate que lanza error si la tasa no es válida
function getRate(rates: Record<string, number | string | undefined>, currency: string): number {
  const rate = Number(rates?.[currency]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid or missing exchange rate for ${currency}: ${rates?.[currency]}`);
  }
  return rate;
}

// Función para obtener tasas forex
async function getForexRates(base: string, symbols: string[]) {
  const symbolsParam = symbols.join(',');
  const response = await fetch(`/api/forex?base=${base}&symbols=${symbolsParam}`);
  
  if (!response.ok) {
    throw new Error(`Forex API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.rates || typeof data.rates !== 'object') {
    throw new Error('Invalid forex response: missing rates object');
  }
  
  return data;
}

// Función para obtener tasas ARS
async function getArsRates() {
  const response = await fetch('/api/ars');
  
  if (!response.ok) {
    throw new Error(`ARS API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (typeof data.tarjeta !== 'number' || data.tarjeta <= 0) {
    throw new Error(`Invalid ARS tarjeta rate: ${data.tarjeta}`);
  }
  
  if (typeof data.cripto !== 'number' || data.cripto <= 0) {
    throw new Error(`Invalid ARS cripto rate: ${data.cripto}`);
  }
  
  return data;
}

/**
 * Conversión robusta de moneda que SIEMPRE retorna un contrato estable
 * Nunca retorna { error } suelto - siempre { ok: true/false }
 */
export async function convertCurrencyRobust(
  amount: number,
  from: string
): Promise<ConvertResult> {
  try {
    console.log(`[convertCurrencyRobust] Converting ${amount} ${from}`);
    
    // Validación de entrada
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }
    
    const sanitizedCurrency = from?.toString().trim().toUpperCase();
    if (!sanitizedCurrency || !/^[A-Z]{3}$/.test(sanitizedCurrency)) {
      throw new Error(`Invalid currency code: ${from}`);
    }
    
    // Paso 1: Convertir a USD si no es USD
    let usdAmount = amount;
    let forexProvider = 'direct';
    
    if (sanitizedCurrency !== 'USD') {
      const forexResult = await getForexRates(sanitizedCurrency, ['USD']);
      const usdRate = getRate(forexResult.rates, 'USD'); // Usar helper con validación
      usdAmount = amount * usdRate;
      forexProvider = forexResult.provider || 'unknown';
    }
    
    // Paso 2: Obtener tasas ARS
    const arsResult = await getArsRates();
    
    // Paso 3: Calcular conversiones finales
    const result: ConvertOk = {
      ok: true,
      USD: round2(usdAmount),
      ARS_tarjeta: round2(usdAmount * arsResult.tarjeta),
      ARS_cripto: round2(usdAmount * arsResult.cripto),
      providers: {
        forex: forexProvider,
        ars: arsResult.provider,
        updatedAt: arsResult.updatedAt
      }
    };
    
    // Logging para debugging según especificaciones
    console.info('[conv]', { 
      amount, 
      from: sanitizedCurrency, 
      ok: true, 
      providers: result.providers 
    });
    
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
    
    const result: ConvertErr = {
      ok: false,
      USD: null,
      ARS_tarjeta: null,
      ARS_cripto: null,
      providers: {
        forex: 'error',
        ars: 'error',
        updatedAt: new Date().toISOString()
      },
      error: errorMessage
    };
    
    // Logging para debugging según especificaciones
    console.info('[conv]', { 
      amount, 
      from: from?.toString().trim().toUpperCase() || from, 
      ok: false, 
      providers: result.providers,
      error: errorMessage
    });
    
    return result;
  }
}