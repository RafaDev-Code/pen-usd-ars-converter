'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, Trash2, Eye, Clock, Building2 } from 'lucide-react';
import { formatCurrency, getTimeAgo } from '@/lib/currency-formatter';

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
    USD: number;
    ARS_tarjeta: number;
    ARS_cripto: number;
  };
  providers?: {
    forex: string;
    ars: string;
  };
  timestamp: string;
  imageThumb?: string;
  imageSrc?: string;
}

interface ScanHistoryProps {
  onSelectScan?: (scan: ScanResult) => void;
}

export function ScanHistory({ onSelectScan }: ScanHistoryProps) {
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [expandedScan, setExpandedScan] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | undefined>();
  const [viewerTitle, setViewerTitle] = useState<string>('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const savedHistory = localStorage.getItem('scan_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Error loading scan history:', error);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem('scan_history');
    setHistory([]);
  };

  const deleteScan = (index: number) => {
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    localStorage.setItem('scan_history', JSON.stringify(newHistory));
  };

  const toggleExpanded = (index: number) => {
    setExpandedScan(expandedScan === index ? null : index);
  };

  const openViewer = (src: string | undefined, title: string) => {
    if (src) {
      setViewerSrc(src);
      setViewerTitle(title);
      setViewerOpen(true);
    }
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Scans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay scans guardados aún</p>
            <p className="text-sm mt-2">Los scans aparecerán aquí cuando tengas habilitado &quot;Guardar mis últimos 10 scans&quot;</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Scans ({history.length})
          </CardTitle>
          <Button
            onClick={clearHistory}
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((scan, index) => (
            <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {scan.imageThumb && (
                    <Image
                      src={scan.imageThumb}
                      alt="Thumbnail"
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded object-cover border"
                    />
                  )}
                  <div>
                    <div className="font-medium">
                      {formatCurrency(scan.total, scan.currency)}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getTimeAgo(scan.timestamp)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => toggleExpanded(index)}
                    variant="ghost"
                    size="sm"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      openViewer(
                        scan.imageSrc ?? scan.imageThumb,
                        `Scan - ${formatCurrency(scan.total, scan.currency)}`
                      );
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Ver
                  </Button>
                  <Button
                    onClick={() => onSelectScan?.(scan)}
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Abrir
                  </Button>
                  <Button
                    onClick={() => deleteScan(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Quick Summary */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-green-50 p-2 rounded text-center">
                  <div className="text-green-600 font-medium">USD</div>
                  <div className="text-green-900">{formatCurrency(scan.converted.USD, 'USD')}</div>
                </div>
                <div className="bg-purple-50 p-2 rounded text-center">
                  <div className="text-purple-600 font-medium">ARS Tarjeta</div>
                  <div className="text-purple-900">{formatCurrency(scan.converted.ARS_tarjeta, 'ARS')}</div>
                </div>
                <div className="bg-orange-50 p-2 rounded text-center">
                  <div className="text-orange-600 font-medium">ARS Cripto</div>
                  <div className="text-orange-900">{formatCurrency(scan.converted.ARS_cripto, 'ARS')}</div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedScan === index && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {/* Items */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Ítems ({scan.items.length})</h5>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {scan.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-gray-600">
                              {item.quantity} × {formatCurrency(item.unit_price, scan.currency)}
                            </div>
                          </div>
                          <div className="font-medium">
                            {formatCurrency(item.subtotal, scan.currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Providers */}
                  {scan.providers && (
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {scan.providers.forex && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span>Forex: {scan.providers.forex}</span>
                        </div>
                      )}
                      {scan.providers.ars && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span>ARS: {scan.providers.ars}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Image Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{viewerTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center max-h-[80vh] overflow-auto">
            {viewerSrc ? (
              <Image
                src={viewerSrc}
                alt={viewerTitle}
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <p className="text-gray-500">No se encontró la imagen guardada.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}