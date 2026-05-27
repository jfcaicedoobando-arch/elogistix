# Cast Audit — generado 2026-05-27

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **750**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 297     | 39.6% |
| LOW       | 1 | 9      | 1.2% |
| MEDIUM    | 2 | 441   | 58.8% |
| HIGH      | 3 | 3     | 0.4% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 3 (~0.4%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>`. No apagan el chequeo.
- **LOW** — `as Json` (wrapper Supabase), `as unknown` aislado. Aceptable con comentario.
- **MEDIUM** — `as Tables<X>` / `as TablesInsert<X>`. Aceptable **solo dentro de `lib/mappers/*`**.
- **HIGH** — `as unknown as X` (doble cast), `as X[]` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — `as any`, `JSON.parse(...) as X`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
| 1 | `src/lib/parsers/dashboard.ts` | 7 | 14 | 0 | 0 | 7 | 0 | 0 |
| 2 | `src/services/embarque/queries/exportListado.ts` | 7 | 14 | 0 | 2 | 3 | 2 | 0 |
| 3 | `src/components/admin/TabSeguridadGlobal.tsx` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 4 | `src/lib/audit/diffFields.ts` | 12 | 12 | 6 | 0 | 6 | 0 | 0 |
| 5 | `src/lib/mappers/embarqueToDb.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 6 | `src/services/embarque/documentos.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 7 | `src/components/auditoria/HallazgosFiltros.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 8 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 9 | `src/hooks/embarque/useProformas.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 10 | `src/components/proveedor/EditarProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 11 | `src/components/proveedor/NuevoProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 12 | `src/generators/__tests__/exportCsv.test.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 13 | `src/hooks/cotizacion/mutations/useCotizacionMutations.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 14 | `src/lib/csv/leadsCsv.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 15 | `src/lib/embarque/__tests__/embarquesPageHelpers.test.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [HIGH] `src/lib/queryPersistBootstrap.ts:28`

```ts
queryClient: client as unknown as Parameters<typeof persistQueryClient>[0]["queryClient"],
```

### 2. [HIGH] `src/services/embarque/queries/exportListado.ts:56`

```ts
countQueryBase as unknown as QueryLike,
```

### 3. [HIGH] `src/services/embarque/queries/exportListado.ts:57`

```ts
) as unknown as typeof countQueryBase);
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
