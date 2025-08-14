'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowRightLeft, DollarSign, Banknote } from 'lucide-react'

const formSchema = z.object({
  amount: z.string().min(1, 'El monto es requerido').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Debe ser un número mayor a 0'
  ),
})

type FormData = z.infer<typeof formSchema>

interface ConversionResult {
  usd: number
  ars: number
}

export function CurrencyConverter() {
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      // Simulación de conversión - aquí se integraría con la API real
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const amount = Number(data.amount)
      // Tasas de ejemplo (en producción vendrían de la API)
      const penToUsd = 0.27 // 1 PEN = 0.27 USD aproximadamente
      const penToArs = 250   // 1 PEN = 250 ARS aproximadamente
      
      setResult({
        usd: amount * penToUsd,
        ars: amount * penToArs,
      })
    } catch (error) {
      console.error('Error en la conversión:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
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
                placeholder="Ingresa el monto en PEN"
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
              disabled={isLoading}
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                </motion.div>
              ) : (
                <ArrowRightLeft className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Convirtiendo...' : 'Convertir'}
            </Button>
          </form>

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"
            >
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">USD</span>
                    </div>
                    <span className="text-xl font-bold text-green-900">
                      ${result.usd.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-800">ARS</span>
                    </div>
                    <span className="text-xl font-bold text-blue-900">
                      ${result.ars.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}