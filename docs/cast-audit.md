# Cast Audit — generado 2026-05-08

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **459**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 163     | 35.5% |
| LOW       | 1 | 7      | 1.5% |
| MEDIUM    | 2 | 274   | 59.7% |
| HIGH      | 3 | 15     | 3.3% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 15 (~3.3%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>`. No apagan el chequeo.
- **LOW** — `as Json` (wrapper Supabase), `as unknown` aislado. Aceptable con comentario.
- **MEDIUM** — `as Tables<X>` / `as TablesInsert<X>`. Aceptable **solo dentro de `lib/mappers/*`**.
- **HIGH** — `as unknown as X` (doble cast), `as X[]` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — `as any`, `JSON.parse(...) as X`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
| 1 | `src/services/embarque/queries.ts` | 13 | 24 | 1 | 0 | 12 | 0 | 0 |
| 2 | `src/services/cotizacion/crud.ts` | 11 | 18 | 2 | 0 | 9 | 0 | 0 |
| 3 | `src/services/auditoria/index.ts` | 7 | 14 | 0 | 0 | 7 | 0 | 0 |
| 4 | `src/components/admin/TabSeguridadGlobal.tsx` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 5 | `src/lib/mappers/embarqueToDb.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 6 | `src/lib/parsers/dashboard.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 7 | `src/services/__tests__/tracking.test.ts` | 4 | 12 | 0 | 0 | 0 | 4 | 0 |
| 8 | `src/components/admin/TabPlataforma.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 9 | `src/components/auditoria/HallazgosFiltros.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 10 | `src/components/cotizacion/conceptos/ConceptoRowUSD.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 11 | `src/hooks/embarque/useProformas.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 12 | `src/services/__tests__/csfService.test.ts` | 3 | 9 | 0 | 0 | 0 | 3 | 0 |
| 13 | `src/components/proveedor/EditarProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 14 | `src/components/proveedor/NuevoProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 15 | `src/hooks/cotizacion/mutations/useCotizacionMutations.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.edge.test.tsx:57`

```ts
mockUseAud.mockReturnValue({ data, isLoading } as unknown as ReturnType<typeof useAuditoria>);
```

### 2. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.edge.test.tsx:58`

```ts
mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 3. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.test.tsx:77`

```ts
} as unknown as ReturnType<typeof useAuditoria>);
```

### 4. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.test.tsx:80`

```ts
} as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 5. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaPageController.test.tsx:74`

```ts
} as unknown as ReturnType<typeof useAuditoria>);
```

### 6. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaPageController.test.tsx:77`

```ts
} as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 7. [HIGH] `src/hooks/auditoria/__tests__/useHallazgosTablaState.test.tsx:49`

```ts
mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 8. [HIGH] `src/hooks/auditoria/__tests__/useHallazgosTablaState.test.tsx:119`

```ts
mockUseRev.mockReturnValue({ data: map } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 9. [HIGH] `src/services/__tests__/csfService.test.ts:32`

```ts
}) as unknown as typeof fetch;
```

### 10. [HIGH] `src/services/__tests__/csfService.test.ts:53`

```ts
}) as unknown as typeof fetch;
```

### 11. [HIGH] `src/services/__tests__/csfService.test.ts:63`

```ts
}) as unknown as typeof fetch;
```

### 12. [HIGH] `src/services/__tests__/tracking.test.ts:30`

```ts
}) as unknown as typeof fetch;
```

### 13. [HIGH] `src/services/__tests__/tracking.test.ts:43`

```ts
}) as unknown as typeof fetch;
```

### 14. [HIGH] `src/services/__tests__/tracking.test.ts:55`

```ts
}) as unknown as typeof fetch;
```

### 15. [HIGH] `src/services/__tests__/tracking.test.ts:64`

```ts
}) as unknown as typeof fetch;
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
