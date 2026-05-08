# Cast Audit — generado 2026-05-08

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **507**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 163     | 32.1% |
| LOW       | 1 | 7      | 1.4% |
| MEDIUM    | 2 | 273   | 53.8% |
| HIGH      | 3 | 64     | 12.6% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 64 (~12.6%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>`. No apagan el chequeo.
- **LOW** — `as Json` (wrapper Supabase), `as unknown` aislado. Aceptable con comentario.
- **MEDIUM** — `as Tables<X>` / `as TablesInsert<X>`. Aceptable **solo dentro de `lib/mappers/*`**.
- **HIGH** — `as unknown as X` (doble cast), `as X[]` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — `as any`, `JSON.parse(...) as X`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
| 1 | `src/services/cotizacion/crud.ts` | 22 | 51 | 2 | 0 | 9 | 11 | 0 |
| 2 | `src/services/embarque/mutations.ts` | 13 | 32 | 2 | 0 | 1 | 10 | 0 |
| 3 | `src/services/embarque/queries.ts` | 13 | 24 | 1 | 0 | 12 | 0 | 0 |
| 4 | `src/services/auditoria/index.ts` | 8 | 17 | 0 | 0 | 7 | 1 | 0 |
| 5 | `src/lib/parsers/dashboard.ts` | 7 | 15 | 0 | 0 | 6 | 1 | 0 |
| 6 | `src/components/admin/TabSeguridadGlobal.tsx` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 7 | `src/lib/mappers/embarqueToDb.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 8 | `src/services/__tests__/tracking.test.ts` | 4 | 12 | 0 | 0 | 0 | 4 | 0 |
| 9 | `src/services/configuracion/index.ts` | 5 | 11 | 0 | 2 | 0 | 3 | 0 |
| 10 | `src/components/admin/TabPlataforma.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 11 | `src/components/auditoria/HallazgosFiltros.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 12 | `src/components/cotizacion/conceptos/ConceptoRowUSD.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 13 | `src/hooks/embarque/useProformas.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 14 | `src/services/__tests__/csfService.test.ts` | 3 | 9 | 0 | 0 | 0 | 3 | 0 |
| 15 | `src/services/catalogos/index.ts` | 3 | 9 | 0 | 0 | 0 | 3 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [HIGH] `src/contexts/AuthContext.tsx:54`

```ts
const w = window as unknown as {
```

### 2. [HIGH] `src/contexts/OrganizationContext.tsx:54`

```ts
const orgList = (orgs ?? []) as unknown as Organization[];
```

### 3. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.edge.test.tsx:57`

```ts
mockUseAud.mockReturnValue({ data, isLoading } as unknown as ReturnType<typeof useAuditoria>);
```

### 4. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.edge.test.tsx:58`

```ts
mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 5. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.test.tsx:77`

```ts
} as unknown as ReturnType<typeof useAuditoria>);
```

### 6. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.test.tsx:80`

```ts
} as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 7. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaPageController.test.tsx:74`

```ts
} as unknown as ReturnType<typeof useAuditoria>);
```

### 8. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaPageController.test.tsx:77`

```ts
} as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 9. [HIGH] `src/hooks/auditoria/__tests__/useHallazgosTablaState.test.tsx:49`

```ts
mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 10. [HIGH] `src/hooks/auditoria/__tests__/useHallazgosTablaState.test.tsx:119`

```ts
mockUseRev.mockReturnValue({ data: map } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 11. [HIGH] `src/hooks/cotizacion/usePortalCotizacionDetalle.ts:15`

```ts
? (cot!.conceptos_venta as unknown as ConceptoVentaCotizacion[])
```

### 12. [HIGH] `src/hooks/cotizacion/wizard/useCotizacionWizardSteps.ts:110`

```ts
conceptosVenta: [...conceptosUSDValidos, ...conceptosMXNValidos] as unknown as Record<string, unknown>[],
```

### 13. [HIGH] `src/hooks/embarque/mutations/useCreateEmbarque.ts:23`

```ts
return { id: result.id } as unknown as EmbarqueRow;
```

### 14. [HIGH] `src/lib/parsers/dashboard.ts:151`

```ts
...(r as unknown as EmbarqueMesSiguiente),
```

### 15. [HIGH] `src/services/__tests__/csfService.test.ts:32`

```ts
}) as unknown as typeof fetch;
```

### 16. [HIGH] `src/services/__tests__/csfService.test.ts:53`

```ts
}) as unknown as typeof fetch;
```

### 17. [HIGH] `src/services/__tests__/csfService.test.ts:63`

```ts
}) as unknown as typeof fetch;
```

### 18. [HIGH] `src/services/__tests__/tracking.test.ts:30`

```ts
}) as unknown as typeof fetch;
```

### 19. [HIGH] `src/services/__tests__/tracking.test.ts:43`

```ts
}) as unknown as typeof fetch;
```

### 20. [HIGH] `src/services/__tests__/tracking.test.ts:55`

```ts
}) as unknown as typeof fetch;
```

### 21. [HIGH] `src/services/__tests__/tracking.test.ts:64`

```ts
}) as unknown as typeof fetch;
```

### 22. [HIGH] `src/services/admin/organizations.ts:21`

```ts
return data as unknown as OrgRow[];
```

### 23. [HIGH] `src/services/auditoria/index.ts:17`

```ts
return data as unknown as ReporteAuditoria;
```

### 24. [HIGH] `src/services/catalogos/index.ts:47`

```ts
return (data ?? []) as unknown as Naviera[];
```

### 25. [HIGH] `src/services/catalogos/index.ts:72`

```ts
return (data ?? []) as unknown as Puerto[];
```

### 26. [HIGH] `src/services/catalogos/index.ts:97`

```ts
return (data ?? []) as unknown as TipoContenedor[];
```

### 27. [HIGH] `src/services/configuracion/index.ts:26`

```ts
return (data ?? []) as unknown as ConfigItem[];
```

### 28. [HIGH] `src/services/configuracion/index.ts:49`

```ts
return (data ?? []) as unknown as ConfigItem[];
```

### 29. [HIGH] `src/services/configuracion/index.ts:84`

```ts
return (data ?? []) as unknown as ConfigGlobalItem[];
```

### 30. [HIGH] `src/services/cotizacion/conversiones/prospecto.ts:60`

```ts
detalles: { cliente_id: clienteCreado.id } as unknown as Json,
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
