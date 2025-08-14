import { CurrencyConverter } from '@/components/currency-converter'

export default function Home() {
  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Conversor de Monedas
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Convierte fácilmente tus Soles Peruanos a Dólares Americanos y Pesos Argentinos 
          con las tasas de cambio más actualizadas.
        </p>
      </div>
      <CurrencyConverter />
    </div>
  )
}
