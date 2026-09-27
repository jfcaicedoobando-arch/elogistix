# Cast Audit — generado 2026-09-27

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

> Fecha de generación en UTC; 2026-09-26 en America/Mexico_City.
> Snapshot del código local revisado, no auditoría de producción.

## Resumen

Total de `as` casts detectados: **3933**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 1111     | 28.2% |
| LOW       | 1 | 176      | 4.5% |
| MEDIUM    | 2 | 2646   | 67.3% |
| HIGH      | 3 | 0     | 0.0% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 0 (~0.0%). La clasificación es heurística: no certifica que todo el resto sea seguro.

## Definición de categorías

- **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>`. No apagan el chequeo.
- **LOW** — `as Json` (wrapper Supabase), `as unknown` aislado. Aceptable con comentario.
- **MEDIUM** — `as Tables<X>` / `as TablesInsert<X>`. Revisar en boundaries/mappers del feature; no valida runtime por sí mismo.
- **HIGH** — `as unknown as X` (doble cast), `as X[]` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — `as any`, `JSON.parse(...) as X`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
| 1 | `src/features/embarques/services/cierre.ts` | 18 | 32 | 1 | 2 | 15 | 0 | 0 |
| 2 | `src/features/cotizacion/services/paginados.ts` | 17 | 29 | 2 | 1 | 14 | 0 | 0 |
| 3 | `src/features/cotizacion/hooks/__tests__/usePaso1SectionStatus.test.tsx` | 14 | 28 | 0 | 0 | 14 | 0 | 0 |
| 4 | `src/features/cxp/services/__tests__/proveedorFacturas.helpers.test.ts` | 14 | 28 | 0 | 0 | 14 | 0 | 0 |
| 5 | `src/features/embarques/domain/mappers/__tests__/embarqueToDb.test.ts` | 15 | 28 | 1 | 0 | 14 | 0 | 0 |
| 6 | `src/features/embarques/hooks/__tests__/useNuevoEmbarqueCotVinculada.test.tsx` | 14 | 28 | 0 | 0 | 14 | 0 | 0 |
| 7 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifa.test.ts` | 13 | 26 | 0 | 0 | 13 | 0 | 0 |
| 8 | `src/features/dashboard/direccion/services/loaders.ts` | 14 | 25 | 1 | 1 | 12 | 0 | 0 |
| 9 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifaLoteAuditoria.test.ts` | 11 | 22 | 0 | 0 | 11 | 0 | 0 |
| 10 | `src/generators/cotizacion/__tests__/datosGenerales.test.ts` | 11 | 22 | 0 | 0 | 11 | 0 | 0 |
| 11 | `src/features/configuracion/index.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 12 | `src/features/cotizacion/components/costosLocal/__tests__/FilaCostoLocalRow.captura.test.tsx` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 13 | `src/features/cotizacion/components/seccionRuta/__tests__/puertoIdentidadEtapa3.test.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 14 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 15 | `src/features/cotizacion/services/__tests__/wizard.test.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

_Ningún cast HIGH o CRITICAL detectado._

## Roadmap

Ver [política TypeScript](./strict-mode-roadmap.md); roadmap de activación cerrado, historia en Git.
