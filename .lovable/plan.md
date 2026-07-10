# Auditoría DRY — Estimación consolidada

Tres sub-agentes auditaron capas independientes. Total estimado: **~1,547 líneas eliminables** en 17 grupos de duplicación.

## Estimación agregada


| Capa                       | Grupos | Líneas eliminables |
| -------------------------- | ------ | ------------------ |
| Hooks & Services (datos)   | 4      | ~870               |
| Components & Pages (UI)    | 5      | ~484               |
| Lib / PDF / Edge Functions | 8      | ~193               |
| **TOTAL**                  | **17** | **~1,547**         |


> Analogía: es como reemplazar 17 recetas de cocina casi idénticas por 17 plantillas reutilizables — el sabor final no cambia, pero el recetario pesa menos y es más fácil de mantener.

## Hallazgos por lote

### Lote 8a — Hooks y Services (~870 líneas, mayor impacto)

1. **G1 · Mutaciones con toast+invalidate repetidos** (~350 líneas). >30 ocurrencias con el mismo `onSuccess`/`onError`. Abstracción: `useMutationWithFeedback` en `src/hooks/shared/`.
  - `useNavieras.ts`, `usePuertos.ts`, `useOportunidades.ts`, `useTesoreriaMovimientos.ts`, `useOrgMembersMutations.ts`, `useUsuarioMutations.ts`, entre otros.
2. **G3 · Boilerplate `if (error) throw error` en services** (~220 líneas). Helper `handleSupabaseResponse()` o `throwOnError()`.
3. **G2 · Catálogos simples con misma tríada `use / useAll / useAdmin**` (~180 líneas). Hook genérico `useSimpleCatalog(entityKey, services)`.
4. **G4 · Listados paginados manuales** (~120 líneas). Migrar a `useServerPagedList` existente (`useOportunidades`, `leads/queries`, `useAppLogs`, `useBitacora`).

### Lote 8b — Components y Pages (~484 líneas)

5. **KpiCard duplicado** en `operaciones/` y `embarques/pnl/` (~111 líneas). Fusionar en `src/components/shared/KpiCard.tsx` (incluir tipografía adaptativa).
6. **Filtros mobile del portal casi idénticos** (~150 líneas). Consolidar vía `MobileFiltersSheet` con `children`.
7. **Bloques fiscales RFC/CP/Régimen/Dirección** en cliente, proveedor y factura manual (~120 líneas). Crear `FiscalAddressFields` + `RegimenFiscalSelect` en `src/features/fiscal/components/`.
8. **Wrappers innecesarios sobre ConfirmActionDialog** y `AlertDialog` manual en `DialogEliminarEmbarque` (~58 líneas).
9. **Columnas Folio/Expediente/Cliente reconstruidas manualmente** (~45 líneas). Extender `columnBuilders.tsx`.

### Lote 8c — Lib, PDF y Edge Functions (~193 líneas)

10. **Edge functions con `corsHeaders`/`OPTIONS`/`new Response(JSON…)` inline** (~85 líneas). Migrar a `_shared/response.ts` + `_shared/cors.ts`.
11. **Headers de reportes PDF** (`Cartera`, `EERR`, `Ejecutivo`, `Tesorería`, `Presupuesto`) (~35 líneas). Crear `ReportHeader` en `src/pdf/components/`.
12. **Schemas CSV redefinen validación de cliente/proveedor** (~40 líneas). Reutilizar `clienteInsertSchema` / `proveedorInsertSchema`.
13. **Colores/fuentes hardcoded en `estadoCuentaPdf` y `ReporteEERRDocument**` (~18 líneas). Usar `tokens.ts`.
14. **Constantes literales dispersas** (`SYSTEM_USER_ID`, código RLS `42501`, `corsHeaders` local en `client-error-log`) (~15 líneas).

## Ejecución propuesta

Por lotes secuenciales para mantener estabilidad (Balanceado, mismo commit + tests):

```text
Lote 8a  → 8a.1 useMutationWithFeedback + migración de 6 hooks piloto
         → 8a.2 handleSupabaseResponse + barrido services
         → 8a.3 useSimpleCatalog + catálogos
         → 8a.4 migración a useServerPagedList
Lote 8b  → 8b.1 KpiCard unificado
         → 8b.2 MobileFiltersSheet
         → 8b.3 FiscalAddressFields + RegimenFiscalSelect
         → 8b.4 columnBuilders + limpieza de dialogs
Lote 8c  → 8c.1 Edge functions a _shared/*
         → 8c.2 ReportHeader PDF + tokens
         → 8c.3 CSV schemas + constantes
```

Cada sub-lote: cambio + tests unitarios cuando el patrón lo permita + `tsgo` + `bun run lint` + bump de `APP_VERSION` + entrada en `CHANGELOG.md`.

## Detalles técnicos

- **Nota:** las estimaciones son conservadoras (por instancia, no cuentan reducción de imports). El total real tras eliminar imports huérfanos suele ser 10-15% mayor.
- **Riesgos:** `useMutationWithFeedback` toca >30 hooks — hacerlo compatible con `onSuccess` personalizado (que reciba data/variables) para no romper flujos con navegación post-mutación.
- **Regla del proyecto:** todo archivo nuevo debe respetar Power of 10 (≤200 líneas).
- **Validación:** correr `bun run audit:arch` al cierre de cada lote para confirmar que ningún archivo nuevo supera el límite.

## ¿Qué quieres hacer?

1. Ejecutar los 3 lotes en orden (recomendado). Esto!
  &nbsp;
2. Solo Lote 8a (mayor ROI, ~870 líneas).
3. Ajustar prioridades/alcance antes de ejecutar.