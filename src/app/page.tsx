'use client';

import { useState } from 'react';
import { CurrencyConverter } from '@/components/currency-converter';
import { PhotoScanner } from '@/components/photo-scanner';
import { ScanHistory } from '@/components/scan-history';
import { Button } from '@/components/ui/button';
import { Calculator, Camera, History } from 'lucide-react';

type ActiveTab = 'converter' | 'scanner' | 'history';

interface ScanItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface ScanResult {
  currency: string;
  items: ScanItem[];
  total: number;
  converted: {
    USD: number | null;
    ARS_tarjeta: number | null;
    ARS_cripto: number | null;
    ARS_mep?: number | null;
  } | null;
  providers?: {
    forex: string;
    ars: string;
  };
  timestamp: string;
  imageThumb?: string;
  imageSrc?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('converter');

  const handleScanComplete = (result: ScanResult) => {
    // Optionally switch to results view or stay on scanner
    console.log('Scan completed:', result);
  };

  const handleSelectScan = (scan: ScanResult) => {
    setActiveTab('scanner'); // Show the scan in the scanner tab
    console.log('Selected scan:', scan);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Conversor de Monedas
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Convierte fácilmente tus Soles Peruanos a Dólares Americanos y Pesos Argentinos 
          con las tasas de cambio más actualizadas, o escanea tickets con IA.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-8">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <Button
            onClick={() => setActiveTab('converter')}
            variant={activeTab === 'converter' ? 'default' : 'ghost'}
            className="flex items-center gap-2"
          >
            <Calculator className="h-4 w-4" />
            Convertidor
          </Button>
          <Button
            onClick={() => setActiveTab('scanner')}
            variant={activeTab === 'scanner' ? 'default' : 'ghost'}
            className="flex items-center gap-2"
          >
            <Camera className="h-4 w-4" />
            Scanner IA
          </Button>
          <Button
            onClick={() => setActiveTab('history')}
            variant={activeTab === 'history' ? 'default' : 'ghost'}
            className="flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            Historial
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto">
        {activeTab === 'converter' && <CurrencyConverter />}
        
        {activeTab === 'scanner' && (
          <PhotoScanner 
            onScanComplete={handleScanComplete}
          />
        )}
        
        {activeTab === 'history' && (
          <ScanHistory onSelectScan={handleSelectScan} />
        )}
      </div>

      {/* Privacy Notice */}
      <div className="max-w-4xl mx-auto mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">🔒 Privacidad y Seguridad</p>
          <p>
            Las imágenes se envían a OpenAI solo para extraer precios y se procesan de forma temporal. 
            No guardamos tus imágenes ni tu API key en nuestros servidores. 
            Tu API key se almacena localmente en tu dispositivo.
          </p>
        </div>
      </div>
    </div>
  )
}
