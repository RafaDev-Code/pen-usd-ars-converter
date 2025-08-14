'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowRightLeft, DollarSign, Banknote, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useForexRate, useArsRates } from '@/hooks/use-exchange-rates'
import { formatCurrency, getTimeAgo } from '@/lib/currency-formatter'

const formSchema = z.object({
  amount: z.string()
    .min(1, 'El monto es requerido')
    .refine(
      (val) => {
        const num = Number(val)
        return !isNaN(num) && num >= 0
      },
      'Debe ser un número mayor o igual a 0'
    )
    .refine(
      (val) => {
        const decimals = val.split('.')[1]
        return !decimals || decimals.length <= 2
      },
      'Máximo 2 decimales permitidos'
    ),
})

type FormData = z.infer<typeof formSchema>

interface ConversionResult {
  penAmount: number
  usd: number
  arsTarjeta: number
  arsCripto: number
  arsBlue?: number
  arsMep?: number
  arsCcl?: number
  forexProvider: string
  arsProvider: string
  forexUpdatedAt: string
  arsUpdatedAt: string
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-8 bg-gray-200 rounded w-1/2"></div>
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="bg-red-50 border-red-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Error</span>
        </div>
        <p className="text-red-600 text-sm mb-3">{message}</p>
        <Button 
          onClick={onRetry} 
          size="sm" 
          variant="outline" 
          className="text-red-700 border-red-300 hover:bg-red-100"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reintentar
        </Button>
      </CardContent>
    </Card>
  )
}

export function CurrencyConverter() {
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  
  const forexQuery = useForexRate()
  const arsQuery = useArsRates()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: FormData) => {
    if (!forexQuery.data || !arsQuery.data) return
    
    setIsCalculating(true)
    
    try {
      // Simular un pequeño delay para mejor UX
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const penAmount = Number(data.amount)
      const usdAmount = penAmount * forexQuery.data.rate
      
      const conversionResult: ConversionResult = {
        penAmount,
        usd: usdAmount,
        arsTarjeta: usdAmount * arsQuery.data.tarjeta,
        arsCripto: usdAmount * arsQuery.data.cripto,
        forexProvider: forexQuery.data.provider,
        arsProvider: arsQuery.data.provider,
        forexUpdatedAt: forexQuery.data.updatedAt,
        arsUpdatedAt: arsQuery.data.updatedAt,
      }
      
      // Agregar campos opcionales si existen
      if (arsQuery.data.blue) {
        conversionResult.arsBlue = usdAmount * arsQuery.data.blue
      }
      if (arsQuery.data.mep) {
        conversionResult.arsMep = usdAmount * arsQuery.data.mep
      }
      if (arsQuery.data.ccl) {
        conversionResult.arsCcl = usdAmount * arsQuery.data.ccl
      }
      
      setResult(conversionResult)
    } finally {
      setIsCalculating(false)
    }
  }

  const hasOptionalRates = result && (result.arsBlue || result.arsMep || result.arsCcl)
  const isLoading = forexQuery.isLoading || arsQuery.isLoading
  const hasError = forexQuery.error || arsQuery.error
  const canSubmit = forexQuery.data && arsQuery.data && !isCalculating

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Banknote className="h-6 w-6 text-orange-600" />
            Conversor de Monedas
          </CardTitle>
          <CardDescription className="text-gray-600">
            Convierte Soles Peruanos (PEN) a Dólares Americanos (USD) y Pesos Argentinos (ARS)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Monto en Soles Peruanos (PEN)
              </label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('amount')}
                className="text-lg"
              />
              {errors.amount && (
                <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!canSubmit}
            >
              {isCalculating ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                </motion.div>
              ) : (
                <ArrowRightLeft className="h-4 w-4 mr-2" />
              )}
              {isCalculating ? 'Calculando...' : 'Convertir'}
            </Button>
          </form>

          {/* Estados de carga y error */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4">
                  <LoadingSkeleton />
                </Card>
              ))}
            </div>
          )}

          {hasError && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forexQuery.error && (
                <ErrorCard 
                  message="Error al obtener tasa PEN→USD" 
                  onRetry={() => forexQuery.refetch()}
                />
              )}
              {arsQuery.error && (
                <ErrorCard 
                  message="Error al obtener tasas ARS" 
                  onRetry={() => arsQuery.refetch()}
                />
              )}
            </div>
          )}

          {/* Resultados */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                {/* Cards principales */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* USD */}
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-green-800">USD</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-green-900 mb-1">
                        {formatCurrency(result.usd, 'USD')}
                      </div>
                      <div className="text-xs text-green-600">
                        {result.forexProvider} • Actualizado hace {getTimeAgo(result.forexUpdatedAt)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* ARS Tarjeta */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Banknote className="h-5 w-5 text-blue-600" />
                          <span className="font-medium text-blue-800">ARS Tarjeta</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-blue-900 mb-1">
                        {formatCurrency(result.arsTarjeta, 'ARS')}
                      </div>
                      <div className="text-xs text-blue-600">
                        {result.arsProvider} • Actualizado hace {getTimeAgo(result.arsUpdatedAt)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* ARS Cripto */}
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Banknote className="h-5 w-5 text-purple-600" />
                          <span className="font-medium text-purple-800">ARS Cripto</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-purple-900 mb-1">
                        {formatCurrency(result.arsCripto, 'ARS')}
                      </div>
                      <div className="text-xs text-purple-600">
                        {result.arsProvider} • Actualizado hace {getTimeAgo(result.arsUpdatedAt)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Botón Ver más */}
                {hasOptionalRates && (
                  <div className="text-center">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowMore(!showMore)}
                      className="gap-2"
                    >
                      {showMore ? 'Ver menos' : 'Ver más opciones'}
                      {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                )}

                {/* Cards adicionales */}
                <AnimatePresence>
                  {showMore && hasOptionalRates && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                      {result.arsBlue && (
                        <Card className="bg-cyan-50 border-cyan-200">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Banknote className="h-5 w-5 text-cyan-600" />
                              <span className="font-medium text-cyan-800">ARS Blue</span>
                            </div>
                            <div className="text-xl font-bold text-cyan-900">
                              {formatCurrency(result.arsBlue, 'ARS')}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {result.arsMep && (
                        <Card className="bg-orange-50 border-orange-200">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Banknote className="h-5 w-5 text-orange-600" />
                              <span className="font-medium text-orange-800">ARS MEP</span>
                            </div>
                            <div className="text-xl font-bold text-orange-900">
                              {formatCurrency(result.arsMep, 'ARS')}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {result.arsCcl && (
                        <Card className="bg-pink-50 border-pink-200">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Banknote className="h-5 w-5 text-pink-600" />
                              <span className="font-medium text-pink-800">ARS CCL</span>
                            </div>
                            <div className="text-xl font-bold text-pink-900">
                              {formatCurrency(result.arsCcl, 'ARS')}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}