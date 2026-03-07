

## Plan: Query Key Factory centralizado

### Nuevo archivo: `src/lib/queryKeys.ts`

Exporta objetos tipados por dominio con métodos factory:

```typescript
export const queryKeys = {
  embarques: {
    all: ['embarques'] as const,
    detail: (id: string) => ['embarques', id] as const,
    conceptosVenta: (id: string) => ['conceptos_venta', id] as const,
    conceptosCosto: (id: string) => ['conceptos_costo', id] as const,
    documentos: (id: string) => ['documentos_embarque', id] as const,
    notas: (id: string) => ['notas_embarque', id] as const,
    facturas: (id: string) => ['facturas', 'embarque', id] as const,
  },
  cotizaciones: {
    all: ['cotizaciones'] as const,
    detail: (id: string) => ['cotizaciones', id] as const,
    costos: (id: string) => ['cotizacion_costos', id] as const,
  },
  clientes: {
    all: ['clientes'] as const,
    detail: (id: string) => ['clientes', id] as const,
    select: ['clientes', 'select'] as const,
    contactos: (id: string) => ['contactos_cliente', id] as const,
  },
  facturas: {
    all: ['facturas'] as const,
    gastosPendientes: ['gastos_pendientes'] as const,
  },
  proveedores: {
    all: ['proveedores'] as const,
    detail: (id: string) => ['proveedores', id] as const,
    select: ['proveedores', 'select'] as const,
  },
  configuracion: { all: ['configuracion'] as const },
  puertos: { activos: ['puertos', 'activos'] as const },
  exchangeRates: { all: ['exchange-rates'] as const },
  bitacora: {
    list: (filters: Record<string, unknown>) => ['bitacora', filters] as const,
  },
  dashboard: {
    ventasUSD: ['dashboard-ventas-usd'] as const,
    costosUSD: ['dashboard-costos-usd'] as const,
  },
} as const;
```

### Archivos refactorizados (importan `queryKeys` en lugar de strings)

| Archivo | Cambio |
|---|---|
| `useClientes.ts` | Todas las `queryKey` y `invalidateQueries` usan `queryKeys.clientes.*` |
| `useCotizaciones.ts` | Usa `queryKeys.cotizaciones.*`, `queryKeys.clientes.all`, `queryKeys.embarques.all` |
| `useEmbarqueQueries.ts` | Usa `queryKeys.embarques.*`, `queryKeys.proveedores.select` |
| `useEmbarqueMutations.ts` | Todas las invalidaciones usan `queryKeys.embarques.*` |
| `useCotizacionCostos.ts` | Usa `queryKeys.cotizaciones.costos(id)` |
| `useFacturas.ts` | Usa `queryKeys.facturas.*`, `queryKeys.embarques.conceptosCosto` |
| `useProveedores.ts` | Usa `queryKeys.proveedores.*` |
| `useConfiguracion.ts` | Usa `queryKeys.configuracion.all` |
| `usePuertos.ts` | Usa `queryKeys.puertos.activos` |
| `useExchangeRates.ts` | Usa `queryKeys.exchangeRates.all` |
| `useBitacora.ts` | Usa `queryKeys.bitacora.list(filtros)` |
| `useDashboardData.ts` | Usa `queryKeys.dashboard.*` |
| `Reportes.tsx` | Cualquier queryKey inline migrada al factory |

### Changelog

Entrada v4.25.0 en `src/pages/Changelog.tsx`.

