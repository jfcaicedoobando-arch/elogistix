# Cast Audit — generado 2026-06-17

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **1580**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 480     | 30.4% |
| LOW       | 1 | 27      | 1.7% |
| MEDIUM    | 2 | 1064   | 67.3% |
| HIGH      | 3 | 0     | 0.0% |
| CRITICAL  | 4 | 9 | 0.6% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 9 (~0.6%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>`. No apagan el chequeo.
- **LOW** — `as Json` (wrapper Supabase), `as unknown` aislado. Aceptable con comentario.
- **MEDIUM** — `as Tables<X>` / `as TablesInsert<X>`. Aceptable **solo dentro de `lib/mappers/*`**.
- **HIGH** — `as unknown as X` (doble cast), `as X[]` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — `as any`, `JSON.parse(...) as X`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
| 1 | `src/features/embarques/components/EmbarqueDetalleTabs.tsx` | 9 | 36 | 0 | 0 | 0 | 0 | 9 |
| 2 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifa.test.ts` | 13 | 26 | 0 | 0 | 13 | 0 | 0 |
| 3 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 4 | `src/services/pagos-factura/__tests__/pagosFactura.test.ts` | 11 | 20 | 1 | 0 | 10 | 0 | 0 |
| 5 | `src/test/setup.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 6 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 | 1 | 1 | 9 | 0 | 0 |
| 7 | `src/lib/mappers/__tests__/embarqueCotizacionDesvincular.test.ts` | 9 | 18 | 0 | 0 | 9 | 0 | 0 |
| 8 | `src/features/crm/services/__tests__/cotizacionDesdeOportunidad.test.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 9 | `src/features/facturas/services/huecoFacturacion/__tests__/buildFilas.test.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 10 | `src/features/profit/hooks/__tests__/useProfit.test.tsx` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 11 | `src/features/facturas/services/__tests__/facturasIndex.test.ts` | 7 | 14 | 0 | 0 | 7 | 0 | 0 |
| 12 | `src/lib/mappers/__tests__/embarqueToDb.test.ts` | 8 | 14 | 1 | 0 | 7 | 0 | 0 |
| 13 | `src/lib/sentry.ts` | 7 | 14 | 0 | 0 | 7 | 0 | 0 |
| 14 | `src/features/auditoria/utils/diffFields.ts` | 12 | 12 | 6 | 0 | 6 | 0 | 0 |
| 15 | `src/features/cotizacion/services/conversiones/__tests__/embarquesHelpers.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [CRITICAL] `src/features/embarques/components/EmbarqueDetalleTabs.tsx:79`

```ts
<TabResumen embarque={embarque as any} />
```

### 2. [CRITICAL] `src/features/embarques/components/EmbarqueDetalleTabs.tsx:87`

```ts
documentos={documentos as any}
```

### 3. [CRITICAL] `src/features/embarques/components/EmbarqueDetalleTabs.tsx:103`

```ts
conceptosVenta={conceptosVenta as any}
```

### 4. [CRITICAL] `src/features/embarques/components/EmbarqueDetalleTabs.tsx:105`

```ts
conceptosCosto={conceptosCosto as any}
```

### 5. [CRITICAL] `src/features/embarques/components/EmbarqueDetalleTabs.tsx:121`

```ts
<TabFacturacion facturas={facturas as any} canEdit={canEdit} embarque={embarque as any} />
```

### 6. [CRITICAL] `src/features/embarques/components/EmbarqueDetalleTabs.tsx:121`

```ts
<TabFacturacion facturas={facturas as any} canEdit={canEdit} embarque={embarque as any} />
```

### 7. [CRITICAL] `src/features/embarques/components/EmbarqueDetalleTabs.tsx:130`

```ts
<TabTracking embarqueId={embarqueId} embarque={embarque as any} notas={notas as any} />
```

### 8. [CRITICAL] `src/features/embarques/components/EmbarqueDetalleTabs.tsx:130`

```ts
<TabTracking embarqueId={embarqueId} embarque={embarque as any} notas={notas as any} />
```

### 9. [CRITICAL] `src/features/embarques/components/EmbarqueDetalleTabs.tsx:136`

```ts
notas={notas as any}
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
