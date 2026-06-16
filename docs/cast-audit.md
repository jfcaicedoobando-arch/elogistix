# Cast Audit — generado 2026-06-16

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **1529**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 478     | 31.3% |
| LOW       | 1 | 23      | 1.5% |
| MEDIUM    | 2 | 1026   | 67.1% |
| HIGH      | 3 | 2     | 0.1% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 2 (~0.1%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>`. No apagan el chequeo.
- **LOW** — `as Json` (wrapper Supabase), `as unknown` aislado. Aceptable con comentario.
- **MEDIUM** — `as Tables<X>` / `as TablesInsert<X>`. Aceptable **solo dentro de `lib/mappers/*`**.
- **HIGH** — `as unknown as X` (doble cast), `as X[]` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — `as any`, `JSON.parse(...) as X`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
| 1 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 2 | `src/features/profit/services/estadoResultadosDevengado.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 3 | `src/services/pagos-factura/__tests__/pagosFactura.test.ts` | 11 | 20 | 1 | 0 | 10 | 0 | 0 |
| 4 | `src/test/setup.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 5 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 | 1 | 1 | 9 | 0 | 0 |
| 6 | `src/features/crm/services/__tests__/cotizacionDesdeOportunidad.test.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 7 | `src/features/facturas/services/huecoFacturacion/__tests__/buildFilas.test.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 8 | `src/features/profit/hooks/__tests__/useProfit.test.tsx` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 9 | `src/features/facturas/services/__tests__/facturasIndex.test.ts` | 7 | 14 | 0 | 0 | 7 | 0 | 0 |
| 10 | `src/lib/mappers/__tests__/embarqueToDb.test.ts` | 8 | 14 | 1 | 0 | 7 | 0 | 0 |
| 11 | `src/lib/sentry.ts` | 7 | 14 | 0 | 0 | 7 | 0 | 0 |
| 12 | `src/features/auditoria/utils/diffFields.ts` | 12 | 12 | 6 | 0 | 6 | 0 | 0 |
| 13 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifa.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 14 | `src/features/cotizacion/services/conversiones/__tests__/embarquesHelpers.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 15 | `src/features/crm/services/__tests__/notificaciones.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [HIGH] `src/features/cotizacion/services/queries.ts:49`

```ts
const flattened = (data as unknown as RawRow[] | null ?? []).map((r) => ({
```

### 2. [HIGH] `src/lib/mappers/embarqueFromDb.ts:151`

```ts
const row = e as unknown as Record<string, unknown>;
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
