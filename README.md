# PEN → USD / ARS Converter

Conversor de monedas en tiempo real que convierte Soles Peruanos (PEN) a Dólares Americanos (USD) y Pesos Argentinos (ARS) con múltiples tipos de cambio.

## 🚀 Características

- **Conversión PEN → USD**: Tasas en tiempo real desde APIs externas
- **Múltiples tasas ARS**: Tarjeta, Cripto, Blue, MEP, CCL
- **Validación de formularios**: Con Zod y React Hook Form
- **Estados de carga y error**: Manejo completo de estados
- **Cache inteligente**: 45-60 segundos para optimizar rendimiento
- **Interfaz moderna**: shadcn/ui + Tailwind CSS + Framer Motion
- **Responsive**: Diseño adaptable a móviles y desktop

## 🛠 Tecnologías

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Validación**: Zod + React Hook Form
- **Estado**: React Query (@tanstack/react-query)
- **Animaciones**: Framer Motion
- **Iconos**: Lucide React
- **TypeScript**: Tipado completo

## 📋 Requisitos Previos

- Node.js 18+ 
- pnpm (recomendado) o npm

## 🚀 Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd pen-usd-ars-converter
```

### 2. Instalar dependencias
```bash
pnpm install
# o
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus configuraciones:

```env
# API Configuration
EXCHANGE_API_BASE=https://open.er-api.com/v6

# ARS Provider (criptoya o dolarapi)
ARS_PROVIDER=criptoya

# Development settings
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Ejecutar en desarrollo
```bash
pnpm dev
# o
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 🌐 Variables de Entorno

| Variable | Descripción | Valor por Defecto | Requerida |
|----------|-------------|-------------------|----------|
| `EXCHANGE_API_BASE` | URL base para API de cambio PEN→USD | `https://open.er-api.com/v6` | No |
| `ARS_PROVIDER` | Proveedor principal para tasas ARS | `criptoya` | No |
| `NODE_ENV` | Entorno de ejecución | `development` | No |
| `NEXT_PUBLIC_APP_URL` | URL pública de la aplicación | `http://localhost:3000` | No |

## 🔌 APIs Utilizadas

### PEN → USD
- **Principal**: [open.er-api.com](https://open.er-api.com) (gratuita)
- **Endpoint**: `/api/forex`
- **Cache**: 60 segundos

### Tasas ARS
- **Principal**: [criptoya.com](https://criptoya.com/api/dolar)
- **Fallback**: [dolarapi.com](https://dolarapi.com/v1/dolares)
- **Endpoint**: `/api/ars`
- **Cache**: 45 segundos

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── ars/route.ts      # Endpoint tasas ARS
│   │   └── forex/route.ts    # Endpoint PEN→USD
│   ├── layout.tsx            # Layout principal
│   └── page.tsx              # Página principal
├── components/
│   ├── currency-converter.tsx # Componente principal
│   ├── providers/            # Providers de React Query
│   └── ui/                   # Componentes shadcn/ui
├── hooks/
│   └── use-exchange-rates.ts # Hooks de React Query
└── lib/
    ├── currency-formatter.ts # Utilidades de formato
    ├── fetchJson.ts         # Helper HTTP con timeout
    └── utils.ts             # Utilidades generales
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
pnpm dev

# Build para producción
pnpm build

# Ejecutar build de producción
pnpm start

# Linting
pnpm lint

# Agregar componentes shadcn/ui
npx shadcn@latest add [component-name]
```

## 🚀 Despliegue

### Vercel (Recomendado)
1. Conecta tu repositorio a [Vercel](https://vercel.com)
2. Configura las variables de entorno en el dashboard
3. Despliega automáticamente

### Otras plataformas
```bash
# Build para producción
pnpm build

# Los archivos estáticos estarán en .next/
```

## 🔒 Seguridad

- ✅ **No exposición de claves**: Todas las llamadas externas pasan por `/api/*`
- ✅ **Validación de entrada**: Zod para validar datos del formulario
- ✅ **Timeout de requests**: 5 segundos máximo por llamada
- ✅ **Headers de seguridad**: User-Agent personalizado
- ✅ **Manejo de errores**: Fallbacks y retry automático

## 🚀 Deploy en Vercel

### Configuración Automática

1. **Conectar repositorio**: Importa el proyecto desde GitHub/GitLab/Bitbucket
2. **Variables de entorno**: Configura en Project Settings → Environment Variables:
   ```
   EXCHANGE_API_BASE=https://open.er-api.com/v6
   ARS_PROVIDER=criptoya
   ```
3. **Configuración de ramas**:
   - `main` → Production deployment
   - `dev` → Preview deployment

### Pasos Manuales

1. **Fork/Clone** este repositorio
2. **Crear proyecto** en [Vercel Dashboard](https://vercel.com/dashboard)
3. **Importar repositorio** y configurar:
   - Framework Preset: `Next.js`
   - Root Directory: `./`
   - Build Command: `pnpm build` (automático)
   - Output Directory: `.next` (automático)
4. **Configurar variables de entorno** en Project Settings
5. **Deploy**: Automático en cada push a `main`

### Limitaciones

#### 🌐 **Fuentes de Datos**
- **USD/PEN**: [ExchangeRate-API](https://exchangerate-api.com) (gratuita, sin API key)
- **ARS**: [Criptoya](https://criptoya.com) (primaria) + [DolarAPI](https://dolarapi.com) (fallback)
- **Disponibilidad**: Dependiente de APIs externas (99%+ uptime típico)

#### ⚡ **Rendimiento**
- **Cache**: 30-45 segundos por endpoint
- **Latencia**: ~200-500ms (APIs externas + Vercel Edge)
- **Límites**: Sin límites de rate en APIs gratuitas usadas
- **Regiones**: Auto-scaling global (Vercel Edge Network)

#### 📊 **Precisión**
- **Forex**: Datos institucionales (ExchangeRate-API)
- **ARS**: Mercado informal argentino (puede variar vs. oficial)
- **Actualización**: Cada 30-60 segundos según disponibilidad de APIs

#### 🔧 **Técnicas**
- **Timeout**: 10 segundos máximo por función serverless
- **Fallbacks**: Sistema de respaldo automático para ARS
- **Error handling**: Retry automático + mensajes de usuario

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'feat: nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.
