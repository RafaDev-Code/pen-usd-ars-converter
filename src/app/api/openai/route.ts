import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Pricing per 1M tokens (USD)
const PRICING = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.60 }, // Specific version
} as const;

// Tool function implementations
async function getForexRates(base: string, symbols: string[]) {
  try {
    const symbolsParam = symbols.join(',');
    // Use full URL for server-side fetch
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3001';
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${baseUrl}/api/forex?base=${base}&symbols=${symbolsParam}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      rates: data.rates,
      provider: data.provider,
      updatedAt: data.updatedAt
    };
  } catch (error) {
    console.error('Forex rates error:', error);
    return { error: 'Failed to fetch forex rates' };
  }
}

// Unified conversion function that enforces PEN->USD->ARS logic
async function convertCurrency(amount: number, fromCurrency: string) {
  try {
    // Step 1: Convert to USD if not already USD
    let usdAmount = amount;
    let forexData = null;
    
    if (fromCurrency !== 'USD') {
      const forexResult = await getForexRates(fromCurrency, ['USD']);
      if (forexResult.error) {
        throw new Error(forexResult.error);
      }
      forexData = forexResult;
      usdAmount = amount * forexResult.rates.USD;
    }
    
    // Step 2: Get ARS rates
    const arsResult = await getArsRates();
    if (arsResult.error) {
      throw new Error(arsResult.error);
    }
    
    // Step 3: Convert USD to ARS
    const result = {
      USD: usdAmount,
      ARS_tarjeta: usdAmount * arsResult.tarjeta,
      ARS_cripto: usdAmount * arsResult.cripto,
      providers: {
        forex: forexData?.provider || 'direct',
        ars: arsResult.provider,
        updatedAt: arsResult.updatedAt
      }
    };
    
    console.log(`Conversion: ${amount} ${fromCurrency} -> ${usdAmount} USD -> ARS_tarjeta: ${result.ARS_tarjeta}, ARS_cripto: ${result.ARS_cripto}`);
    return result;
  } catch (error) {
    console.error('Currency conversion error:', error);
    return { error: 'Failed to convert currency' };
  }
}

async function getArsRates() {
  try {
    // Use full URL for server-side fetch
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3001';
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${baseUrl}/api/ars`, {
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      tarjeta: data.tarjeta,
      cripto: data.cripto,
      blue: data.blue,
      mep: data.mep,
      ccl: data.ccl,
      provider: data.provider,
      updatedAt: data.updatedAt
    };
  } catch (error) {
    console.error('ARS rates error:', error);
    return { error: 'Failed to fetch ARS rates' };
  }
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(2)}`;
  }
}

// Calculate estimated cost based on usage
interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

function calculateCost(usage: Usage | null, model: string): number | null {
  if (!usage || !usage.prompt_tokens || !usage.completion_tokens) {
    return null;
  }
  
  const modelKey = model as keyof typeof PRICING;
  const pricing = PRICING[modelKey];
  
  if (!pricing) {
    console.warn(`No pricing found for model: ${model}`);
    return null;
  }
  
  const inputTokens = usage.prompt_tokens;
  const outputTokens = usage.completion_tokens;
  
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  return cost;
}

export async function POST(request: NextRequest) {
  try {
    const userApiKey = request.headers.get('x-user-openai-key');
    
    if (!userApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Make initial request to OpenAI with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    let response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userApiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    let data = await response.json();
    console.log('Initial OpenAI response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    // Handle tool calls if present - may need multiple iterations
    let currentMessages = [...body.messages];
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops
    
    while (data.choices[0]?.message?.tool_calls && iterations < maxIterations) {
      iterations++;
      console.log(`Processing tool calls iteration ${iterations}`);
      
      // Check if we've reached max iterations before processing tools
      if (iterations >= maxIterations) {
        console.log('Max iterations reached, forcing final JSON response');
        
        // Force a final response without tools when max iterations reached
        const finalController = new AbortController();
        const finalTimeoutId = setTimeout(() => finalController.abort(), 15000); // 15 second timeout
        
        const finalResponse = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userApiKey}`,
          },
          body: JSON.stringify({
            model: body.model,
            messages: [
              ...currentMessages,
              {
                role: 'system',
                content: 'IMPORTANTE: Debes responder ÚNICAMENTE con el JSON final del análisis del ticket. NO uses más herramientas. Responde directamente con el JSON según el schema ticket_analysis.'
              }
            ],
            response_format: body.response_format,
            // Remove tools to force direct JSON response
            temperature: 0.1
          }),
          signal: finalController.signal
        });
        
        clearTimeout(finalTimeoutId);

        if (!finalResponse.ok) {
          throw new Error(`OpenAI API error: ${finalResponse.status} ${finalResponse.statusText}`);
        }

        data = await finalResponse.json();
        console.log('Final forced response:', JSON.stringify(data, null, 2));
        break; // Exit the loop
      }
      
      const message = data.choices[0].message;
      const toolResults = [];
      
      for (const toolCall of message.tool_calls) {
        const { name, arguments: args } = toolCall.function;
        let result;
        
        try {
          const parsedArgs = JSON.parse(args);
          
          switch (name) {
            case 'get_forex_rates':
              result = await getForexRates(parsedArgs.base, parsedArgs.symbols);
              break;
            case 'get_ars_rates':
              result = await getArsRates();
              break;
            case 'convert_currency':
              result = await convertCurrency(parsedArgs.amount, parsedArgs.fromCurrency);
              break;
            case 'detect_currency':
              const text = parsedArgs.text || '';
              let detectedCode = 'USD'; // default
              let confidence = 0.5; // default low confidence
              const cues = [];
              
              // Rule-based detection
              if (text.includes('S/') || text.includes('S/.')) {
                detectedCode = 'PEN';
                confidence = 0.9;
                cues.push('Símbolo S/ detectado');
              }
              
              if (text.includes('IGV') || text.includes('RUC')) {
                if (detectedCode === 'PEN') {
                  confidence = Math.min(confidence + 0.2, 1.0);
                } else {
                  detectedCode = 'PEN';
                  confidence = 0.7;
                }
                cues.push('Términos peruanos (IGV/RUC) detectados');
              }
              
              if (text.includes('+51')) {
                if (detectedCode === 'PEN') {
                  confidence = Math.min(confidence + 0.1, 1.0);
                } else {
                  detectedCode = 'PEN';
                  confidence = 0.6;
                }
                cues.push('Código telefónico peruano (+51) detectado');
              }
              
              if (text.includes('€')) {
                if (!cues.some(c => c.includes('S/'))) {
                  detectedCode = 'EUR';
                  confidence = 0.9;
                  cues.push('Símbolo € detectado');
                } else {
                  cues.push('Símbolo € detectado pero S/ tiene prioridad');
                }
              }
              
              result = {
                code: detectedCode,
                confidence: confidence,
                cues: cues
              };
              break;
              
            case 'format_currency':
              result = formatCurrency(parsedArgs.value, parsedArgs.currency);
              break;
            default:
              result = { error: `Unknown tool: ${name}` };
          }
        } catch (error) {
          result = { error: `Tool execution failed: ${error}` };
        }
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: name,
          content: JSON.stringify(result)
        });
      }
      
      // Update messages for next iteration
      currentMessages = [
        ...currentMessages,
        message,
        ...toolResults
      ];
      
      // Make follow-up request with tool results
      const followUpController = new AbortController();
      const followUpTimeoutId = setTimeout(() => followUpController.abort(), 15000); // 15 second timeout
      
      response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userApiKey}`,
        },
        body: JSON.stringify({
          ...body,
          messages: currentMessages
        }),
        signal: followUpController.signal
      });
      
      clearTimeout(followUpTimeoutId);
      
      data = await response.json();
      console.log(`Follow-up OpenAI response (iteration ${iterations}):`, JSON.stringify(data, null, 2));
      
      if (!response.ok) {
        console.error('Follow-up OpenAI API error:', data);
        return NextResponse.json(data, { status: response.status });
      }
    }

    // Calculate estimated cost
    const estimatedCost = calculateCost(data.usage, body.model);
    
    // Add cost information to response
    const responseWithCost = {
      ...data,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost.toFixed(4)) : null,
      model: body.model
    };
    
    console.log('Final response being sent:', JSON.stringify(responseWithCost, null, 2));
    return NextResponse.json(responseWithCost);
  } catch (error) {
    console.error('OpenAI proxy error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'La solicitud tardó demasiado tiempo. Por favor, intente con una imagen más pequeña o simple.' },
          { status: 504 }
        );
      }
      
      if (error.message.includes('fetch')) {
        return NextResponse.json(
          { error: 'Error de conexión. Verifique su conexión a internet e intente nuevamente.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor. Por favor, intente nuevamente.' },
      { status: 500 }
    );
  }
}