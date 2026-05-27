# Cast Audit — generado 2026-05-27

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **720**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 265     | 36.8% |
| LOW       | 1 | 7      | 1.0% |
| MEDIUM    | 2 | 411   | 57.1% |
| HIGH      | 3 | 37     | 5.1% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 37 (~5.1%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>`. No apagan el chequeo.
- **LOW** — `as Json` (wrapper Supabase), `as unknown` aislado. Aceptable con comentario.
- **MEDIUM** — `as Tables<X>` / `as TablesInsert<X>`. Aceptable **solo dentro de `lib/mappers/*`**.
- **HIGH** — `as unknown as X` (doble cast), `as X[]` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — `as any`, `JSON.parse(...) as X`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
| 1 | `src/services/embarque/queries/exportListado.ts` | 7 | 18 | 0 | 0 | 3 | 4 | 0 |
| 2 | `src/lib/parsers/dashboard.ts` | 7 | 14 | 0 | 0 | 7 | 0 | 0 |
| 3 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 13 | 0 | 0 | 2 | 3 | 0 |
| 4 | `src/components/admin/TabSeguridadGlobal.tsx` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 5 | `src/lib/audit/diffFields.ts` | 12 | 12 | 6 | 0 | 6 | 0 | 0 |
| 6 | `src/lib/mappers/embarqueToDb.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 7 | `src/services/__tests__/tracking.test.ts` | 4 | 12 | 0 | 0 | 0 | 4 | 0 |
| 8 | `src/services/embarque/documentos.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 9 | `src/components/crm/ImportarLeadsCsvDialog.tsx` | 5 | 11 | 0 | 0 | 4 | 1 | 0 |
| 10 | `src/components/auditoria/HallazgosFiltros.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 11 | `src/generators/__tests__/exportCsv.test.ts` | 4 | 10 | 0 | 0 | 2 | 2 | 0 |
| 12 | `src/hooks/embarque/useProformas.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 13 | `src/services/__tests__/csfService.test.ts` | 3 | 9 | 0 | 0 | 0 | 3 | 0 |
| 14 | `src/components/proveedor/EditarProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 15 | `src/components/proveedor/NuevoProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [HIGH] `src/components/crm/ImportarLeadsCsvDialog.tsx:97`

```ts
(r as unknown as Record<string, string>)[field] = val;
```

### 2. [HIGH] `src/components/shared/VirtualDataTable.tsx:78`

```ts
const src = props as unknown as Record<string, unknown>;
```

### 3. [HIGH] `src/components/shared/dataTable/__tests__/DataTable.perf.test.tsx:60`

```ts
const g = globalThis as unknown as { gc?: () => void };
```

### 4. [HIGH] `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx:315`

```ts
({ original: { v } } as unknown as import("@tanstack/react-table").Row<SR>);
```

### 5. [HIGH] `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx:317`

```ts
({ original: { n } } as unknown as import("@tanstack/react-table").Row<NR>);
```

### 6. [HIGH] `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx:319`

```ts
({ original: { d } } as unknown as import("@tanstack/react-table").Row<DR>);
```

### 7. [HIGH] `src/generators/__tests__/exportCsv.test.ts:13`

```ts
}) as unknown as typeof URL.createObjectURL;
```

### 8. [HIGH] `src/generators/__tests__/exportCsv.test.ts:25`

```ts
return a as unknown as HTMLElement;
```

### 9. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.edge.test.tsx:57`

```ts
mockUseAud.mockReturnValue({ data, isLoading } as unknown as ReturnType<typeof useAuditoria>);
```

### 10. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.edge.test.tsx:58`

```ts
mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 11. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.test.tsx:77`

```ts
} as unknown as ReturnType<typeof useAuditoria>);
```

### 12. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.test.tsx:80`

```ts
} as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 13. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaPageController.test.tsx:74`

```ts
} as unknown as ReturnType<typeof useAuditoria>);
```

### 14. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaPageController.test.tsx:77`

```ts
} as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 15. [HIGH] `src/hooks/auditoria/__tests__/useHallazgosTablaState.test.tsx:49`

```ts
mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 16. [HIGH] `src/hooks/auditoria/__tests__/useHallazgosTablaState.test.tsx:119`

```ts
mockUseRev.mockReturnValue({ data: map } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 17. [HIGH] `src/hooks/facturacion/useHuecoFacturacion.ts:43`

```ts
HUECO_CSV_HEADERS as unknown as { key: string; label: string }[],
```

### 18. [HIGH] `src/lib/crm/__tests__/forecast.test.ts:119`

```ts
row({ monto_estimado: "1500" as unknown as number, probabilidad: "40" as unknown as number }),
```

### 19. [HIGH] `src/lib/crm/__tests__/forecast.test.ts:119`

```ts
row({ monto_estimado: "1500" as unknown as number, probabilidad: "40" as unknown as number }),
```

### 20. [HIGH] `src/lib/domain/__tests__/auditoriaCsv.test.ts:23`

```ts
] as unknown as HallazgoAuditoria[];
```

### 21. [HIGH] `src/lib/domain/__tests__/auditoriaCsv.test.ts:51`

```ts
] as unknown as HallazgoAuditoria[]);
```

### 22. [HIGH] `src/lib/financial/__tests__/embarqueKpis.test.ts:42`

```ts
[{ total: "1000" as unknown as number, moneda: "MXN" }],
```

### 23. [HIGH] `src/lib/financial/__tests__/embarqueKpis.test.ts:43`

```ts
[{ monto: "200" as unknown as number, moneda: "MXN" }],
```

### 24. [HIGH] `src/lib/mappers/__tests__/embarqueRoundtrip.test.ts:98`

```ts
} as unknown as Parameters<typeof mapEmbarqueRowToFormValues>[0]);
```

### 25. [HIGH] `src/lib/queryPersistBootstrap.ts:28`

```ts
queryClient: client as unknown as Parameters<typeof persistQueryClient>[0]["queryClient"],
```

### 26. [HIGH] `src/services/__tests__/csfService.test.ts:32`

```ts
}) as unknown as typeof fetch;
```

### 27. [HIGH] `src/services/__tests__/csfService.test.ts:53`

```ts
}) as unknown as typeof fetch;
```

### 28. [HIGH] `src/services/__tests__/csfService.test.ts:63`

```ts
}) as unknown as typeof fetch;
```

### 29. [HIGH] `src/services/__tests__/tracking.test.ts:30`

```ts
}) as unknown as typeof fetch;
```

### 30. [HIGH] `src/services/__tests__/tracking.test.ts:43`

```ts
}) as unknown as typeof fetch;
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
