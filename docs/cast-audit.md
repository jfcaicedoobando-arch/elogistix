# Cast Audit — generado 2026-05-08

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **559**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 163     | 29.2% |
| LOW       | 1 | 7      | 1.3% |
| MEDIUM    | 2 | 316   | 56.5% |
| HIGH      | 3 | 64     | 11.4% |
| CRITICAL  | 4 | 9 | 1.6% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 73 (~13.1%). El resto es seguro o aceptable bajo política.

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
| 3 | `src/content/changelog/v8/chunks/0.ts` | 14 | 28 | 0 | 0 | 14 | 0 | 0 |
| 4 | `src/services/embarque/queries.ts` | 13 | 24 | 1 | 0 | 12 | 0 | 0 |
| 5 | `src/services/auditoria/index.ts` | 8 | 17 | 0 | 0 | 7 | 1 | 0 |
| 6 | `src/content/changelog/v5.ts` | 4 | 16 | 0 | 0 | 0 | 0 | 4 |
| 7 | `src/lib/parsers/dashboard.ts` | 7 | 15 | 0 | 0 | 6 | 1 | 0 |
| 8 | `src/content/changelog/v3.ts` | 6 | 14 | 0 | 0 | 5 | 0 | 1 |
| 9 | `src/components/admin/TabSeguridadGlobal.tsx` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 10 | `src/content/changelog/v8/chunks/4.ts` | 3 | 12 | 0 | 0 | 0 | 0 | 3 |
| 11 | `src/lib/mappers/embarqueToDb.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 12 | `src/services/__tests__/tracking.test.ts` | 4 | 12 | 0 | 0 | 0 | 4 | 0 |
| 13 | `src/services/configuracion/index.ts` | 5 | 11 | 0 | 2 | 0 | 3 | 0 |
| 14 | `src/components/admin/TabPlataforma.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 15 | `src/components/auditoria/HallazgosFiltros.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [CRITICAL] `src/content/changelog/v3.ts:72`

```ts
description: "Consolidación de utilidades duplicadas: getEstadoColor unificado para todos los estados (embarque, cotización, factura), resolverContacto centralizado, interfaces ConceptoVentaLocal/Conc
```

### 2. [CRITICAL] `src/content/changelog/v5.ts:156`

```ts
description: "Eliminados imports directos de supabase en CotizacionDetalle (useEmbarquesVinculados), ProveedorDetalle (useProveedorOperaciones) y NuevoClienteDialog (parseCsf service). Nuevas query ke
```

### 3. [CRITICAL] `src/content/changelog/v5.ts:163`

```ts
description: "El diálogo de alta de clientes (wizard 2 pasos, CSF upload, document checklist) fue extraído a src/components/cliente/NuevoClienteDialog.tsx con estado independiente. Clientes.tsx reduci
```

### 4. [CRITICAL] `src/content/changelog/v5.ts:176`

```ts
title: "Eliminación masiva de casts 'as any' — tipado estricto con Supabase",
```

### 5. [CRITICAL] `src/content/changelog/v5.ts:177`

```ts
description: "Reducción de ~188 a ~6 ocurrencias de 'as any' en 17 archivos. Reemplazados casts de enums por TablesInsert<T>['campo'], CotizacionRow ahora extiende Tables<'cotizaciones'> (eliminando 8
```

### 6. [CRITICAL] `src/content/changelog/v8/chunks/1.ts:107`

```ts
description: "Refactor interno (sin cambios funcionales para el usuario) que limpia la deuda técnica detectada en la auditoría del módulo de proformas. (1) Nueva capa de dominio (lib/domain/proforma.t
```

### 7. [CRITICAL] `src/content/changelog/v8/chunks/4.ts:100`

```ts
description: "1) NuevoClienteDialog migrado a getErrorMessage centralizado (2 catch blocks). 2) as any eliminado en usePermissions.test.tsx con tipado Partial<ReturnType>.",
```

### 8. [CRITICAL] `src/content/changelog/v8/chunks/4.ts:114`

```ts
description: "1) as any eliminado en CotizacionDetalle (comentario_cliente tipado). 2) Query keys centralizados: client_users, organizations-list, embarques-relacionados registrados en queryKeys.ts. 3
```

### 9. [CRITICAL] `src/content/changelog/v8/chunks/4.ts:128`

```ts
description: "1) Mapas estadoColor duplicados en 3 páginas del portal unificados con getEstadoColor de uiMappings.ts. 2) 17 consumidores migrados de helpers.ts a imports directos (formatters.ts/uiMapp
```

### 10. [HIGH] `src/contexts/AuthContext.tsx:54`

```ts
const w = window as unknown as {
```

### 11. [HIGH] `src/contexts/OrganizationContext.tsx:54`

```ts
const orgList = (orgs ?? []) as unknown as Organization[];
```

### 12. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.edge.test.tsx:57`

```ts
mockUseAud.mockReturnValue({ data, isLoading } as unknown as ReturnType<typeof useAuditoria>);
```

### 13. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.edge.test.tsx:58`

```ts
mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 14. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.test.tsx:77`

```ts
} as unknown as ReturnType<typeof useAuditoria>);
```

### 15. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaEjecutivo.test.tsx:80`

```ts
} as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 16. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaPageController.test.tsx:74`

```ts
} as unknown as ReturnType<typeof useAuditoria>);
```

### 17. [HIGH] `src/hooks/auditoria/__tests__/useAuditoriaPageController.test.tsx:77`

```ts
} as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 18. [HIGH] `src/hooks/auditoria/__tests__/useHallazgosTablaState.test.tsx:49`

```ts
mockUseRev.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 19. [HIGH] `src/hooks/auditoria/__tests__/useHallazgosTablaState.test.tsx:119`

```ts
mockUseRev.mockReturnValue({ data: map } as unknown as ReturnType<typeof useAuditoriaRevisiones>);
```

### 20. [HIGH] `src/hooks/cotizacion/usePortalCotizacionDetalle.ts:15`

```ts
? (cot!.conceptos_venta as unknown as ConceptoVentaCotizacion[])
```

### 21. [HIGH] `src/hooks/cotizacion/wizard/useCotizacionWizardSteps.ts:110`

```ts
conceptosVenta: [...conceptosUSDValidos, ...conceptosMXNValidos] as unknown as Record<string, unknown>[],
```

### 22. [HIGH] `src/hooks/embarque/mutations/useCreateEmbarque.ts:23`

```ts
return { id: result.id } as unknown as EmbarqueRow;
```

### 23. [HIGH] `src/lib/parsers/dashboard.ts:151`

```ts
...(r as unknown as EmbarqueMesSiguiente),
```

### 24. [HIGH] `src/services/__tests__/csfService.test.ts:32`

```ts
}) as unknown as typeof fetch;
```

### 25. [HIGH] `src/services/__tests__/csfService.test.ts:53`

```ts
}) as unknown as typeof fetch;
```

### 26. [HIGH] `src/services/__tests__/csfService.test.ts:63`

```ts
}) as unknown as typeof fetch;
```

### 27. [HIGH] `src/services/__tests__/tracking.test.ts:30`

```ts
}) as unknown as typeof fetch;
```

### 28. [HIGH] `src/services/__tests__/tracking.test.ts:43`

```ts
}) as unknown as typeof fetch;
```

### 29. [HIGH] `src/services/__tests__/tracking.test.ts:55`

```ts
}) as unknown as typeof fetch;
```

### 30. [HIGH] `src/services/__tests__/tracking.test.ts:64`

```ts
}) as unknown as typeof fetch;
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
