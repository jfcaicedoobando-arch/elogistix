

# Architecture Refinement Plan — v5.17.0

## Analysis Summary

After reviewing the key files, the user's audit is largely accurate. Here's my prioritized assessment of what's worth doing vs. over-engineering:

**Worth doing:**
- Extract `buildPaso1Data` mapper from `useCotizacionWizardForm.ts` — pure function, easily testable
- Replace multi-step client-side inserts in `useEmbarqueMutations.ts` with server-side RPCs for atomicity (create, update, duplicate, delete)
- Consolidate `Configuracion.tsx` 20+ `useState` calls into a single state object
- Fix remaining `PromiseLike<any>` in mutations (lines 31, 198)

**Not worth doing (over-engineering for this codebase):**
- Splitting the wizard hook into two hooks — it's 481 lines but already delegates to `useConceptosVentaCotizacion` and `useCotizacionPL`. The progressive-save pattern intentionally couples navigation with persistence.
- Reorganizing hooks into `/api/`, `/ui/`, `/features/` subfolders — the flat structure with clear naming conventions works fine at this scale (~30 hooks).
- Adding Zod validation — React Hook Form already handles validation; the manual checks are minimal.

---

## Implementation Steps

### Step 1: Create atomic RPCs for embarque operations (HIGH — data integrity)

Create 4 Postgres functions that wrap multi-step operations in transactions:

- `crear_embarque_completo(embarque, conceptos_venta, conceptos_costo, documentos)` — replaces 4+ client inserts
- `actualizar_embarque_completo(id, embarque, conceptos_venta, conceptos_costo)` — replaces delete+insert pattern
- `duplicar_embarque(embarque_origen_id, copias[])` — replaces sequential loop
- `eliminar_embarque_completo(embarque_id)` — replaces cascading deletes + cotización revert

Then simplify `useEmbarqueMutations.ts` to single RPC calls per mutation.

### Step 2: Extract `buildPaso1Data` to a mapper utility (MEDIUM)

Move `buildPaso1Data` from `useCotizacionWizardForm.ts` to `src/lib/mappers/cotizacionMappers.ts`. It's a pure function with no React dependencies — just form values in, DB payload out.

### Step 3: Consolidate Configuracion state (LOW)

Replace the 20 individual `useState` + `useEffect` calls in `Configuracion.tsx` with a single `configState` object and one `useEffect` to hydrate it.

### Step 4: Fix remaining `any` types in mutations (LOW)

Replace `PromiseLike<any>[]` on lines 31 and 198 of `useEmbarqueMutations.ts` with proper Supabase response types.

---

## Impact

- **Step 1** eliminates partial-write risk (orphan records on network failures) and reduces client-side mutation code by ~60%
- **Step 2** makes the 40-field payload mapper independently testable
- **Step 3** reduces Configuracion from 20 `useState` to 1 state object
- **Step 4** achieves zero `any` across the codebase

