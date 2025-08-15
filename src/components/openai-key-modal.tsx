'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Key, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface OpenAIKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (key: string) => void;
}

export function OpenAIKeyModal({ isOpen, onClose, onKeySaved }: OpenAIKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Load existing key from localStorage
      const savedKey = localStorage.getItem('openai_key');
      if (savedKey) {
        setApiKey(savedKey);
      }
      setTestResult(null);
      setErrorMessage('');
    }
  }, [isOpen]);

  const testApiKey = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('Por favor ingresa una API key');
      return;
    }

    setIsLoading(true);
    setTestResult(null);
    setErrorMessage('');

    try {
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-openai-key': apiKey.trim(),
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test connection' }],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        setTestResult('success');
      } else {
        const error = await response.json();
        setTestResult('error');
        setErrorMessage(error.error?.message || 'Error al probar la API key');
      }
    } catch {
      setTestResult('error');
      setErrorMessage('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const saveApiKey = () => {
    if (!apiKey.trim()) {
      setErrorMessage('Por favor ingresa una API key');
      return;
    }

    localStorage.setItem('openai_key', apiKey.trim());
    onKeySaved(apiKey.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Configurar OpenAI API Key</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              API Key de OpenAI
            </label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          {testResult === 'success' && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>API key válida</span>
            </div>
          )}

          {testResult === 'error' && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
            <p className="font-medium mb-1">🔒 Privacidad</p>
            <p>
              Tu API key se guarda solo en tu navegador. No la enviamos a nuestros servidores.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={testApiKey}
              disabled={isLoading || !apiKey.trim()}
              variant="outline"
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Probar'
              )}
            </Button>
            <Button
              onClick={saveApiKey}
              disabled={!apiKey.trim()}
              className="flex-1"
            >
              Guardar
            </Button>
          </div>

          <div className="text-xs text-gray-500">
            <p>
              Obtén tu API key en{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                platform.openai.com/api-keys
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}