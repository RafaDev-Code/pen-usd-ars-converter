/**
 * Utility for making HTTP requests with timeout, headers, and safe JSON parsing
 */

interface FetchJsonOptions {
  timeout?: number
  headers?: Record<string, string>
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
}

interface FetchJsonResponse<T = unknown> {
  data: T | null
  error: string | null
  status: number
  ok: boolean
}

/**
 * Fetch with timeout support
 */
export async function fetchWithTimeout(
  url: string, 
  timeout: number = 5000
): Promise<Response> {
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
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`)
    }
    throw error
  }
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T = unknown>(text: string): { data: T | null; error: string | null } {
  try {
    const data = JSON.parse(text) as T
    return { data, error: null }
  } catch (error) {
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Invalid JSON format' 
    }
  }
}

/**
 * Complete fetch utility with JSON parsing, timeout, and error handling
 */
export async function fetchJson<T = unknown>(
  url: string, 
  options: FetchJsonOptions = {}
): Promise<FetchJsonResponse<T>> {
  const {
    timeout = 5000,
    headers = {},
    method = 'GET',
    body
  } = options

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'PEN-USD-ARS-Converter/1.0',
      'Accept': 'application/json',
      ...headers
    }

    if (body && method !== 'GET') {
      requestHeaders['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const responseText = await response.text()
    const { data, error: parseError } = safeJsonParse<T>(responseText)

    if (parseError) {
      return {
        data: null,
        error: `JSON parse error: ${parseError}`,
        status: response.status,
        ok: false
      }
    }

    return {
      data,
      error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
      ok: response.ok
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        data: null,
        error: `Request timeout after ${timeout}ms`,
        status: 0,
        ok: false
      }
    }

    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
      status: 0,
      ok: false
    }
  }
}

/**
 * Environment variable validation helper
 */
export function validateEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue
  
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  
  return value
}

/**
 * Get environment variables with validation
 */
export function getEnvConfig() {
  return {
    exchangeApiBase: validateEnvVar('EXCHANGE_API_BASE', 'https://open.er-api.com/v6'),
    arsProvider: validateEnvVar('ARS_PROVIDER', 'criptoya') as 'criptoya' | 'dolarapi',
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production'
  }
}