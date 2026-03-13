

# Codebase Architecture Audit Report

## Current State Summary

The codebase has undergone significant modularization (v5.0–5.6) and is in solid shape overall. The hook layer is well-organized with barrel exports, centralized query keys, and clear separation between queries and mutations for embarques. Below are the remaining issues ranked by priority.

---

## Critical Issues

### 1. Pervasive `as any` casts (~188 occurrences in 17 files)

The single largest type-safety gap. Key categories:

- **Supabase enum casts** (`estado: 'Confirmado' as any`, `modo as any`): Found in `useCotizaciones.ts` (L218-254, L274, L307, L364, L396, L420-466), `useEmbarqueMutations.ts` (L152, L255, L285, L306, L396), `useEmbarqueQueries.ts` (L63). These should use the generated `TablesInsert<>` enum types instead.
- **Dynamic field access** (`(form as any)[field]` in `Clientes.tsx` L291, `(copia[index] as any)[campo]` in `useCotizacionWizardForm.ts` L280, `DialogDuplicarEmbarque.tsx` L53). These need proper typed accessors or `keyof` patterns.
- **Inline query result casts** (`(g.embarques as any)?.expediente` in `Facturacion.tsx` L83). Should type the join result.

**Action**: Create a utility type `EnumCast<T, K>` or simply use `TablesInsert<'embarques'>['estado']` for enum fields. Replace dynamic field access with typed helpers. This eliminates the largest class of potential runtime bugs.

### 2. Direct `supabase` imports in page components

Six page files import `supabase` directly, violating the data-access separation pattern established for embarques:

- `CotizacionDetalle.tsx` — inline `useQuery` for `embarquesVinculados` (L44-56)
- `Clientes.tsx` — direct `supabase.auth.getSession()` + `fetch()` for CSF parsing (L137-148)
- `ProveedorDetalle.tsx` — inline query for related embarques
- `NuevoEmbarque.tsx` — uses `supabase` through `embarqueServices.ts` (acceptable) but also has residual direct usage
- `Usuarios.tsx` — direct supabase calls for user management
- `Login.tsx` — direct auth call (acceptable for auth pages)

**Action**: Move inline queries to their respective hook files (e.g., `useCotizaciones.ts` for embarques vinculados). Extract CSF parsing to a dedicated service or hook.

### 3. `useCotizaciones.ts` — mixed queries and mutations (479 lines)

This file contains queries, mutations, folio generation, and complex business logic (prospecto conversion, cotizacion-to-embarques conversion). It mirrors the pre-refactor state of `useEmbarques.ts`.

**Action**: Split into:
- `useCotizacionQueries.ts` — queries + types
- `useCotizacionMutations.ts` — create/update/delete/estado mutations
- `useCotizacionConversions.ts` — `useConvertirProspectoACliente` + `useConvertirCotizacionAEmbarques`
- `useCotizaciones.ts` — barrel re-export (like `useEmbarques.ts`)

### 4. Duplicate `CotizacionRow` type vs Supabase-generated type

`useCotizaciones.ts` defines a manual 80-line `CotizacionRow` interface (L33-82) that mirrors the DB schema. This will drift from the actual schema over time.

**Action**: Replace with `Tables<'cotizaciones'>` and extend only where needed (e.g., the `conceptos_venta` JSON parsing).

---

## High Priority

### 5. Duplicated profit/venta/costo map logic

`useDashboardData.ts` and `useOperacionesData.ts` both independently:
- Query `conceptos_venta` and `conceptos_costo` filtered by USD
- Build identical `ventaMap`/`costoMap` Record objects
- Use the same query keys (`queryKeys.dashboard.ventasUSD`)

**Action**: Extract a shared `useProfitMaps()` hook that both consume.

### 6. `Clientes.tsx` — page-level form + dialog (334 lines)

The "Nuevo Cliente" dialog with CSF parsing, two-step wizard, and document checklist is embedded directly in the list page. This is the same anti-pattern previously fixed in `ClienteDetalle.tsx`.

**Action**: Extract `NuevoClienteDialog.tsx` component with its own state management.

### 7. `useCotizacionWizardForm.ts` — 530-line monolith

While it correctly centralizes wizard state, it contains:
- Payload building (buildPaso1Data)
- Concept management (actualizarConcepto, agregarConcepto, eliminarConcepto)
- P&L computation
- Multi-step navigation with validation
- File upload logic

**Action**: Extract concept management into a reusable `useConceptosVentaCotizacion` hook. Extract P&L computation to a pure function or separate hook.

---

## Medium Priority

### 8. Inconsistent toast usage

Some files use `import { useToast } from "@/hooks/use-toast"` (hook pattern), others use `import { toast } from "sonner"` directly (`Facturacion.tsx`). The `src/components/ui/use-toast.ts` re-export file adds confusion.

**Action**: Standardize on one pattern across the app. Remove the re-export wrapper.

### 9. `data/types.ts` partially redundant

This file re-exports Supabase types but some types like `Cliente` and `Proveedor` are also re-exported from hooks (`useClientes.ts`, `useProveedores.ts`). `TipoContenedor` is just `string`, adding no value.

**Action**: Audit imports — use hook-level types where available, keep `data/types.ts` only for types not owned by a hook.

### 10. Missing error boundaries

No React error boundaries exist. A crash in any component takes down the entire app.

**Action**: Add an `ErrorBoundary` wrapper at the route level inside `Layout`.

---

## Low Priority / Optional

### 11. `Operaciones.tsx` still 315 lines
Further decompose the operator ranking table and chart section into dedicated components.

### 12. Query key for `embarquesVinculados` not centralized
`CotizacionDetalle.tsx` L45 uses a hardcoded `['embarques', 'cotizacion', id]` key instead of `queryKeys`.

### 13. `useConvertirCotizacionAEmbarques` uses `(cotizacion as any).num_contenedores`
The `CotizacionRow` type already has `num_contenedores`, but the cast suggests the type narrowing isn't working correctly.

---

## Recommended Execution Order

| Step | Item | Effort |
|------|------|--------|
| 1 | Eliminate `as any` enum casts with proper Supabase types | Medium |
| 2 | Split `useCotizaciones.ts` into queries/mutations/barrel | Medium |
| 3 | Replace manual `CotizacionRow` with `Tables<'cotizaciones'>` | Small |
| 4 | Extract `NuevoClienteDialog` from `Clientes.tsx` | Medium |
| 5 | Move inline supabase queries from pages to hooks | Small |
| 6 | Extract shared `useProfitMaps()` hook | Small |
| 7 | Standardize toast imports | Small |
| 8 | Add route-level error boundary | Small |
| 9 | Break down `useCotizacionWizardForm` further | Medium |
| 10 | Cleanup `data/types.ts` redundancies | Small |

