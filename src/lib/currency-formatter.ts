export const formatters = {
  PEN: new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  USD: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  ARS: new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
}

export function formatCurrency(amount: number, currency: string): string {
  // Validate currency parameter
  if (!currency || typeof currency !== 'string') {
    return `${amount.toFixed(2)}`;
  }
  
  // Try to use existing formatters first
  const upperCurrency = currency.toUpperCase() as 'PEN' | 'USD' | 'ARS';
  if (formatters[upperCurrency]) {
    return formatters[upperCurrency].format(amount);
  }
  
  // Fallback for other currencies
  try {
    const currencyMap: Record<string, string> = {
      'EUR': 'EUR',
      'GBP': 'GBP',
      'BRL': 'BRL',
      'CLP': 'CLP',
      'COP': 'COP',
      'MXN': 'MXN'
    };

    const currencyCode = currencyMap[upperCurrency] || upperCurrency;
    
    // Use appropriate locale based on currency
    let locale = 'en-US';
    if (currencyCode === 'EUR') {
      locale = 'de-DE';
    } else if (currencyCode === 'BRL') {
      locale = 'pt-BR';
    } else if (currencyCode === 'CLP' || currencyCode === 'COP') {
      locale = 'es-CL';
    } else if (currencyCode === 'MXN') {
      locale = 'es-MX';
    }

    return new Intl.NumberFormat(locale, {
       style: 'currency',
       currency: currencyCode,
       minimumFractionDigits: 2,
       maximumFractionDigits: 2
     }).format(amount);
   } catch {
     // Final fallback formatting if currency is not supported
     const currencyDisplay = currency && typeof currency === 'string' ? currency.toUpperCase() : 'UNKNOWN';
     return `${currencyDisplay} ${amount.toFixed(2)}`;
   }
}

export function getTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s`
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m`
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h`
  }
  
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays}d`
}