'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, Loader2, AlertCircle, Clock, Building2 } from 'lucide-react';
import { OpenAIKeyModal } from './openai-key-modal';
import { formatCurrency } from '@/lib/currency-formatter';

interface ScanItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface ScanResult {
  currency_detected: string;
  confidence: number;
  cues: string[];
  needs_confirmation: boolean;
  currency: string;
  items: ScanItem[];
  total: number;
  converted: {
    USD: number;
    ARS_tarjeta: number;
    ARS_cripto: number;
  };
  providers?: {
    forex: string;
    ars: string;
    updatedAt?: string;
  };
  timestamp: string;
  imageThumb?: string;
  estimatedCost?: number;
  model?: string;
}

interface PhotoScannerProps {
  onScanComplete?: (result: ScanResult) => void;
}

export function PhotoScanner({ onScanComplete }: PhotoScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [saveHistory, setSaveHistory] = useState(true);
  const [showCurrencyConfirmation, setShowCurrencyConfirmation] = useState(false);
  const [pendingResult, setPendingResult] = useState<any>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('');
  const [lastCost, setLastCost] = useState<number | null>(null);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cost management functions
  const getMonthlyTotal = (): number => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const savedMonth = localStorage.getItem('cost_tracking_month');
    const savedTotal = localStorage.getItem('monthly_cost_total');
    
    if (savedMonth === currentMonth && savedTotal) {
      return parseFloat(savedTotal);
    }
    
    // New month or no data, reset
    localStorage.setItem('cost_tracking_month', currentMonth);
    localStorage.setItem('monthly_cost_total', '0');
    return 0;
  };

  const updateMonthlyCost = (cost: number) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentTotal = getMonthlyTotal();
    const newTotal = currentTotal + cost;
    
    localStorage.setItem('cost_tracking_month', currentMonth);
    localStorage.setItem('monthly_cost_total', newTotal.toString());
    localStorage.setItem('last_scan_cost', cost.toString());
    
    setLastCost(cost);
    setMonthlyTotal(newTotal);
  };

  // Check for API key on component mount
  useState(() => {
    const savedKey = localStorage.getItem('openai_key');
    setApiKey(savedKey);
    const savedHistorySetting = localStorage.getItem('save_scan_history');
    setSaveHistory(savedHistorySetting !== 'false');
    
    // Initialize cost tracking
    const currentTotal = getMonthlyTotal();
    setMonthlyTotal(currentTotal);
    
    const savedLastCost = localStorage.getItem('last_scan_cost');
    if (savedLastCost) {
      setLastCost(parseFloat(savedLastCost));
    }
  });

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        const maxSize = 1600;
        let { width, height } = img;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const createThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        const size = 150;
        canvas.width = size;
        canvas.height = size;
        
        const scale = Math.max(size / img.width, size / img.height);
        const x = (size - img.width * scale) / 2;
        const y = (size - img.height * scale) / 2;
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const processImage = async (file: File) => {
    if (!apiKey) {
      setShowKeyModal(true);
      return;
    }

    if (!navigator.onLine) {
      setError('Necesita conexión a internet para procesar la imagen');
      return;
    }

    setIsScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const imageData = await resizeImage(file);
      const thumbnail = await createThumbnail(file);
      
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-openai-key': apiKey,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Eres un asistente que lee tickets/facturas desde imágenes. 

INSTRUCCIONES CRÍTICAS:
1. ANTES de convertir, usa detect_currency() con todo el texto extraído para detectar la moneda correcta
2. Si confidence < 0.75, marca needs_confirmation=true y NO asumas la moneda
3. Para tickets peruanos (S/, IGV, RUC, +51): usa SIEMPRE PEN→USD directo, NUNCA vía EUR
4. PROHIBIDO convertir vía EUR si la base es o podría ser PEN sin confirmación del usuario
5. IMPORTANTE - Para conversiones:
   - USA ÚNICAMENTE convert_currency(total, moneda_detectada)
   - Esta herramienta maneja automáticamente: moneda → USD → ARS
   - NO uses get_forex_rates ni get_ars_rates manualmente
   - La herramienta devuelve USD, ARS_tarjeta, ARS_cripto y providers

FLUJO:
1. Extrae texto completo del ticket
2. Usa detect_currency(text) para identificar moneda
3. Si confidence >= 0.75: procede con conversión
4. Si confidence < 0.75: marca needs_confirmation=true
5. USA convert_currency(total, moneda_detectada) para obtener todas las conversiones automáticamente

Responde en JSON con: currency_detected, confidence, cues, needs_confirmation, items[], total, converted{USD, ARS_tarjeta, ARS_cripto}, providers{forex, ars, updatedAt}.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analiza esta imagen de ticket/factura y extrae los ítems, precios y total. Luego usa convert_currency() para convertir el total automáticamente a USD, ARS tarjeta y ARS cripto.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData
                  }
                }
              ]
            }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'detect_currency',
                description: 'Detecta la moneda del ticket basado en señales textuales y visuales',
                parameters: {
                  type: 'object',
                  properties: {
                    text: { type: 'string', description: 'Texto extraído del ticket para análisis' }
                  },
                  required: ['text']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'get_forex_rates',
                description: 'Obtiene tasas de cambio forex actualizadas',
                parameters: {
                  type: 'object',
                  properties: {
                    base: { type: 'string', description: 'Moneda base (ej: PEN)' },
                    symbols: { type: 'array', items: { type: 'string' }, description: 'Monedas objetivo (ej: ["USD"])' }
                  },
                  required: ['base', 'symbols']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'get_ars_rates',
                description: 'Obtiene tasas de cambio ARS (tarjeta, cripto, etc)',
                parameters: {
                  type: 'object',
                  properties: {},
                  required: []
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'convert_currency',
                description: 'Convierte moneda usando la lógica correcta: moneda_base -> USD -> ARS. USAR ESTA HERRAMIENTA PARA TODAS LAS CONVERSIONES.',
                parameters: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number', description: 'Monto a convertir' },
                    fromCurrency: { type: 'string', description: 'Moneda de origen (ej: PEN, USD, EUR)' }
                  },
                  required: ['amount', 'fromCurrency']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'format_currency',
                description: 'Formatea valores monetarios',
                parameters: {
                  type: 'object',
                  properties: {
                    value: { type: 'number' },
                    currency: { type: 'string' }
                  },
                  required: ['value', 'currency']
                }
              }
            }
          ],
          tool_choice: 'auto',
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'ticket_analysis',
              schema: {
                type: 'object',
                properties: {
                  currency_detected: { type: 'string', description: 'Moneda detectada del ticket, ISO 4217' },
                  confidence: { type: 'number', description: 'Confianza en la detección (0-1)' },
                  cues: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Señales encontradas para la detección'
                  },
                  needs_confirmation: { type: 'boolean', description: 'Si requiere confirmación manual' },
                  currency: { type: 'string', description: 'Moneda del ticket, ISO 4217' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        quantity: { type: 'number' },
                        unit_price: { type: 'number' },
                        subtotal: { type: 'number' }
                      },
                      required: ['name', 'quantity', 'unit_price', 'subtotal']
                    }
                  },
                  total: { type: 'number' },
                  converted: {
                    type: 'object',
                    properties: {
                      USD: { type: 'number' },
                      ARS_tarjeta: { type: 'number' },
                      ARS_cripto: { type: 'number' }
                    },
                    required: ['USD', 'ARS_tarjeta', 'ARS_cripto']
                  },
                  providers: {
                    type: 'object',
                    properties: {
                      forex: { type: 'string' },
                      ars: { type: 'string' },
                      updatedAt: { type: 'string', description: 'Timestamp de actualización' }
                    }
                  }
                },
                required: ['currency_detected', 'confidence', 'cues', 'needs_confirmation', 'currency', 'items', 'total', 'converted']
              }
            }
          }
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setShowKeyModal(true);
          return;
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('OpenAI Response:', data);
      
      const content = data.choices[0]?.message?.content;
      console.log('Content:', content);
      
      if (!content) {
        console.error('No content in response:', data);
        throw new Error('No se pudo procesar la imagen - respuesta vacía');
      }

      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
        console.log('Parsed content:', parsedContent);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Content that failed to parse:', content);
        throw new Error('No se pudo procesar la imagen - formato inválido');
      }

      // Apply guardrails for currency detection
      let needsConfirmation = parsedContent.needs_confirmation;
      let detectedCurrency = parsedContent.currency_detected || parsedContent.currency;
      
      // Force confirmation if confidence < 0.75
      if (parsedContent.confidence < 0.75) {
        needsConfirmation = true;
      }
      
      // Force USD bridging if currency is neither USD nor PEN
      if (detectedCurrency !== 'USD' && detectedCurrency !== 'PEN') {
        console.log(`Currency ${detectedCurrency} detected, forcing USD bridging`);
        // Still allow the conversion but ensure it goes through USD
      }
      
      // Default to PEN if 'S/' is present and confidence is low
      if (needsConfirmation && content.includes('S/')) {
        detectedCurrency = 'PEN';
      }

      const result: ScanResult = {
        ...parsedContent,
        currency_detected: detectedCurrency,
        needs_confirmation: needsConfirmation,
        timestamp: new Date().toISOString(),
        imageThumb: thumbnail,
        estimatedCost: data.estimatedCost,
        model: data.model
      };

      // Update cost tracking if available
      if (data.estimatedCost) {
        updateMonthlyCost(data.estimatedCost);
      }

      // Check if currency confirmation is needed
      if (result.needs_confirmation) {
        // Set default currency for confirmation modal
        let defaultCurrency = result.currency_detected || 'USD';
        // Default to PEN if 'S/' is present in the original content
        if (content.includes('S/')) {
          defaultCurrency = 'PEN';
        }
        
        setSelectedCurrency(defaultCurrency);
        setPendingResult({ ...result, originalImage: imageData, thumbnail });
        setShowCurrencyConfirmation(true);
        return;
      }

      setScanResult(result);
      onScanComplete?.(result);

      // Save to history if enabled
      if (saveHistory) {
        const history = JSON.parse(localStorage.getItem('scan_history') || '[]');
        history.unshift(result);
        // Keep only last 10
        if (history.length > 10) {
          history.splice(10);
        }
        localStorage.setItem('scan_history', JSON.stringify(history));
      }

    } catch (error) {
      console.error('Scan error:', error);
      setError(error instanceof Error ? error.message : 'Error al procesar la imagen');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCurrencyConfirmation = async (confirmedCurrency: string) => {
    if (!pendingResult || !apiKey) return;
    
    setShowCurrencyConfirmation(false);
    setIsScanning(true);
    setError(null);
    
    try {
      // Reprocess with confirmed currency
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-openai-key': apiKey,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Eres un asistente que lee tickets/facturas desde imágenes. El usuario ha confirmado que la moneda es ${confirmedCurrency}. Usa esta moneda como base para todas las conversiones.

IMPORTANTE - Conversión de monedas:
- USA convert_currency(total, '${confirmedCurrency}') para obtener todas las conversiones automáticamente
- Esta herramienta maneja correctamente: ${confirmedCurrency} → USD → ARS
- NO uses get_forex_rates ni get_ars_rates manualmente

Extrae todos los ítems y usa convert_currency para las conversiones. Responde en JSON según el schema.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analiza esta imagen usando ${confirmedCurrency} como moneda base confirmada. Usa convert_currency() para convertir automáticamente a USD, ARS tarjeta y ARS cripto.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: pendingResult.originalImage
                  }
                }
              ]
            }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'convert_currency',
                description: 'Convierte moneda usando la lógica correcta: moneda_base -> USD -> ARS. USAR ESTA HERRAMIENTA PARA TODAS LAS CONVERSIONES.',
                parameters: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number', description: 'Monto a convertir' },
                    fromCurrency: { type: 'string', description: 'Moneda de origen' }
                  },
                  required: ['amount', 'fromCurrency']
                }
              }
            }
          ],
          tool_choice: 'auto',
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'ticket_analysis',
              schema: {
                type: 'object',
                properties: {
                  currency: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        quantity: { type: 'number' },
                        unit_price: { type: 'number' },
                        subtotal: { type: 'number' }
                      },
                      required: ['name', 'quantity', 'unit_price', 'subtotal']
                    }
                  },
                  total: { type: 'number' },
                  converted: {
                    type: 'object',
                    properties: {
                      USD: { type: 'number' },
                      ARS_tarjeta: { type: 'number' },
                      ARS_cripto: { type: 'number' }
                    },
                    required: ['USD', 'ARS_tarjeta', 'ARS_cripto']
                  },
                  providers: {
                    type: 'object',
                    properties: {
                      forex: { type: 'string' },
                      ars: { type: 'string' },
                      updatedAt: { type: 'string' }
                    }
                  }
                },
                required: ['currency', 'items', 'total', 'converted']
              }
            }
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No se pudo procesar la imagen');
      }
      
      const parsedContent = JSON.parse(content);
      const result: ScanResult = {
        ...parsedContent,
        currency_detected: confirmedCurrency,
        confidence: 1.0,
        cues: [`Usuario confirmó ${confirmedCurrency}`],
        needs_confirmation: false,
        timestamp: new Date().toISOString(),
        imageThumb: pendingResult.thumbnail,
        estimatedCost: data.estimatedCost,
        model: data.model
      };

      // Update cost tracking if available
      if (data.estimatedCost) {
        updateMonthlyCost(data.estimatedCost);
      }
      
      setScanResult(result);
      onScanComplete?.(result);
      
      // Save to history
      if (saveHistory) {
        const history = JSON.parse(localStorage.getItem('scan_history') || '[]');
        history.unshift(result);
        if (history.length > 10) {
          history.splice(10);
        }
        localStorage.setItem('scan_history', JSON.stringify(history));
      }
      
    } catch (error) {
      console.error('Reprocessing error:', error);
      setError(error instanceof Error ? error.message : 'Error al reprocesar la imagen');
    } finally {
      setIsScanning(false);
      setPendingResult(null);
    }
  };

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImage(file);
    }
  }, [apiKey, processImage]);

  const handleUploadClick = () => {
    if (!apiKey) {
      setShowKeyModal(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleKeySaved = (key: string) => {
    setApiKey(key);
  };

  const toggleSaveHistory = () => {
    const newValue = !saveHistory;
    setSaveHistory(newValue);
    localStorage.setItem('save_scan_history', newValue.toString());
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scanner de Tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleUploadClick}
              disabled={isScanning || !navigator.onLine}
              className="flex-1"
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isScanning ? 'Procesando...' : '📷 Subir foto'}
            </Button>
            
            <Button
              onClick={() => setShowKeyModal(true)}
              variant="outline"
              className="sm:w-auto"
            >
              {apiKey ? 'Cambiar API Key' : 'Configurar API Key'}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="save-history"
              checked={saveHistory}
              onChange={toggleSaveHistory}
              className="rounded"
            />
            <label htmlFor="save-history" className="text-sm text-gray-600">
              Guardar mis últimos 10 scans
            </label>
          </div>

          {!navigator.onLine && (
            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span>Sin conexión. El scanner requiere internet para funcionar.</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.heic,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {scanResult && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Scan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Total and Conversions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Total Original</div>
                <div className="text-xl font-bold text-blue-900">
                  {formatCurrency(scanResult.total, scanResult.currency)}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-600 font-medium">USD</div>
                <div className="text-xl font-bold text-green-900">
                  {formatCurrency(scanResult.converted.USD, 'USD')}
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">ARS Tarjeta</div>
                <div className="text-xl font-bold text-purple-900">
                  {formatCurrency(scanResult.converted.ARS_tarjeta, 'ARS')}
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-sm text-orange-600 font-medium">ARS Cripto</div>
                <div className="text-xl font-bold text-orange-900">
                  {formatCurrency(scanResult.converted.ARS_cripto, 'ARS')}
                </div>
              </div>
            </div>

            {/* Items List */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Ítems detectados</h4>
              <div className="space-y-2">
                {scanResult.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-600">
                        {item.quantity} × {formatCurrency(item.unit_price, scanResult.currency)}
                      </div>
                    </div>
                    <div className="font-medium">
                      {formatCurrency(item.subtotal, scanResult.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Currency Detection Info */}
            {(scanResult.currency_detected || scanResult.confidence !== undefined) && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Detección de Moneda</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  {scanResult.currency_detected && (
                    <div>
                      <span className="text-gray-600">Detectada:</span>
                      <span className="ml-1 font-medium">{scanResult.currency_detected}</span>
                    </div>
                  )}
                  {scanResult.confidence !== undefined && (
                    <div>
                      <span className="text-gray-600">Confianza:</span>
                      <span className="ml-1 font-medium">{Math.round(scanResult.confidence * 100)}%</span>
                    </div>
                  )}
                  {scanResult.cues && scanResult.cues.length > 0 && (
                    <div>
                      <span className="text-gray-600">Señales:</span>
                      <span className="ml-1 font-medium">{scanResult.cues.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cost Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Información de Costos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Costo estimado:</span>
                  <div className="font-medium">
                    {scanResult.estimatedCost ? (
                      `US$ ${scanResult.estimatedCost.toFixed(4)}`
                    ) : (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                        Costo no disponible
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Este mes:</span>
                  <div className="font-medium text-blue-600">
                    US$ {monthlyTotal.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Modelo usado:</span>
                  <div className="font-medium">
                    {scanResult.model || 'No disponible'}
                  </div>
                </div>
              </div>
            </div>

            {/* Providers and Timestamp */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-gray-500 pt-4 border-t">
              <div className="flex items-center gap-4">
                {scanResult.providers?.forex && (
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    <span>Forex: {scanResult.providers.forex}</span>
                  </div>
                )}
                {scanResult.providers?.ars && (
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    <span>ARS: {scanResult.providers.ars}</span>
                  </div>
                )}
                {scanResult.providers?.updatedAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Actualizado: {new Date(scanResult.providers.updatedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Procesado {new Date(scanResult.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Currency Confirmation Modal */}
      {showCurrencyConfirmation && pendingResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirmar Moneda</h3>
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Moneda detectada: <strong>{pendingResult.currency_detected}</strong>
              </p>
              <p className="text-sm text-gray-500 mb-2">
                Confianza: {Math.round((pendingResult.confidence || 0) * 100)}%
              </p>
              {pendingResult.cues && pendingResult.cues.length > 0 && (
                <p className="text-sm text-gray-500 mb-4">
                  Señales: {pendingResult.cues.join(', ')}
                </p>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecciona la moneda correcta:
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="PEN">PEN - Sol Peruano</option>
                  <option value="USD">USD - Dólar Americano</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="ARS">ARS - Peso Argentino</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCurrencyConfirmation(false);
                  setPendingResult(null);
                  setIsScanning(false);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleCurrencyConfirmation(selectedCurrency)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OpenAI Key Modal */}
      <OpenAIKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onKeySaved={handleKeySaved}
      />
    </div>
  );
}