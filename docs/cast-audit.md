# Cast Audit — generado 2026-07-29

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **2570**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 776     | 30.2% |
| LOW       | 1 | 124      | 4.8% |
| MEDIUM    | 2 | 1669   | 64.9% |
| HIGH      | 3 | 1     | 0.0% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 1 (~0.0%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>`. No apagan el chequeo.
- **LOW** — `as Json` (wrapper Supabase), `as unknown` aislado. Aceptable con comentario.
- **MEDIUM** — `as Tables<X>` / `as TablesInsert<X>`. Aceptable **solo dentro de `lib/mappers/*`**.
- **HIGH** — `as unknown as X` (doble cast), `as X[]` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — `as any`, `JSON.parse(...) as X`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
| 1 | `src/features/embarques/services/cierre.ts` | 17 | 30 | 1 | 2 | 14 | 0 | 0 |
| 2 | `src/features/cxp/services/__tests__/proveedorFacturas.helpers.test.ts` | 14 | 28 | 0 | 0 | 14 | 0 | 0 |
| 3 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifa.test.ts` | 13 | 26 | 0 | 0 | 13 | 0 | 0 |
| 4 | `src/features/embarques/domain/mappers/__tests__/embarqueToDb.test.ts` | 14 | 26 | 1 | 0 | 13 | 0 | 0 |
| 5 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 6 | `src/features/facturacion/services/pagos/__tests__/pagosFactura.test.ts` | 11 | 20 | 1 | 0 | 10 | 0 | 0 |
| 7 | `src/features/portal/services/__tests__/queries.test.ts` | 11 | 20 | 1 | 0 | 10 | 0 | 0 |
| 8 | `src/test/setup.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 9 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 | 1 | 1 | 9 | 0 | 0 |
| 10 | `src/features/cotizacion/hooks/wizard/__tests__/useCotizacionWizardSteps.test.tsx` | 9 | 18 | 0 | 0 | 9 | 0 | 0 |
| 11 | `src/features/embarques/domain/mappers/__tests__/embarqueCotizacionDesvincular.test.ts` | 9 | 18 | 0 | 0 | 9 | 0 | 0 |
| 12 | `src/features/dashboard/direccion/services/loaders.ts` | 9 | 17 | 0 | 1 | 8 | 0 | 0 |
| 13 | `src/features/costeo/services/navieraCondiciones.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 14 | `src/features/cotizacion/services/conversiones/__tests__/embarquesHelpers.integration.test.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 15 | `src/features/cotizacion/services/revalidacion/index.ts` | 10 | 16 | 0 | 4 | 6 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [HIGH] `src/lib/domain/cotizacionDetalle.ts:47`

```ts
return { ...c, cantidad, precio_unitario: precio } as unknown as ConceptoVentaCotizacion;
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
