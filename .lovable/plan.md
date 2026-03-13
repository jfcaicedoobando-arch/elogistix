

# Codebase Architecture Audit — Post v5.15.0

## Overall Assessment

The codebase is in good shape after the previous 10-step audit. The main patterns (hooks for data, pages as orchestrators, shared UI components) are consistent. The remaining issues are moderate-to-low severity.

---

## Findings & Recommendations (ordered by priority)

### 1. NuevoEmbarque / EditarEmbarque UI duplication (MEDIUM)

Same pattern as the cotizacion wizard that was already fixed: `NuevoEmbarque.tsx` (243 lines) and `EditarEmbarque.tsx` (209 lines) share nearly identical wizard layout — header, step indicator, step content, footer navigation. Only the header text, step count (4 vs 3), and save handler differ.

**Recommendation:** Extract an `EmbarqueWizardLayout` component (like `CotizacionWizardLayout`). Both pages become thin wrappers (~40 lines each).

---

### 2. `any` types in useCotizacionWizardForm Mutations interface (MEDIUM)

Lines 102-106 define `Mutations` with `mutateAsync: (d: any) => Promise<any>`. This defeats TypeScript's purpose across the entire wizard flow.

**Recommendation:** Replace with proper types: `CreateCotizacionInput`, `UpdateCotizacionInput`, etc. from existing hook return types using `UseMutationResult` generics.

---

### 3. `any` in catch blocks across 17 files (LOW-MEDIUM)

156 occurrences of `: any` — most are `catch (err: any)`. TypeScript recommends `unknown` with type narrowing.

**Recommendation:** Replace `catch (err: any)` with `catch (err: unknown)` and use a shared `getErrorMessage(err)` utility. Single pass across all files.

---

### 4. Inline `formatDateLocal` in Usuarios.tsx (LOW)

A date formatting function defined inline in `Usuarios.tsx` that duplicates `formatDate` from `@/lib/helpers.ts`.

**Recommendation:** Use the existing `formatDate` helper or extend it. Remove the local function.

---

### 5. `formatDatePdf` in cotizacionPdf.ts duplicates helpers (LOW)

Another local date formatter in `src/lib/cotizacionPdf.ts` that could use the centralized helper.

**Recommendation:** Consolidate into `formatters.ts` or `helpers.ts`.

---

### 6. ClienteDetalle still has manual 2-step delete for contactos (LOW)

`ClienteDetalle.tsx` manages `deleteStep` (0/1/2) state manually with `DeleteContactoDialogs` instead of using the shared `DoubleConfirmDeleteDialog`. This is the only remaining instance of the old pattern.

**Recommendation:** Replace with `DoubleConfirmDeleteDialog` for consistency.

---

### 7. useDashboardData scaling — document and plan (LOW)

`useDashboardData` fetches all embarques client-side. Already flagged in previous audit. No code change needed now, but the 1000-row Supabase limit means this will silently drop data beyond ~1000 embarques.

**Recommendation:** Add a code comment documenting the limitation. Plan for server-side aggregation when dataset grows.

---

### 8. EmbarqueDetalle.tsx is 269 lines with inline financial calculations (LOW)

Lines 130-148 compute `totalVenta`, `totalCosto`, `utilidad`, `margen` inline. These could move to a small `useEmbarqueFinancials` hook for reuse and testability.

**Recommendation:** Extract to a hook. Not urgent — the page is otherwise well-structured.

---

## Summary Priority Table

```text
Priority  Step  Description
────────  ────  ───────────────────────────────────────
MEDIUM    1     Extract shared EmbarqueWizardLayout component
MEDIUM    2     Type the Mutations interface properly (remove any)
LOW-MED   3     Replace catch(err: any) with unknown + getErrorMessage util
LOW       4     Remove inline formatDateLocal from Usuarios.tsx
LOW       5     Consolidate formatDatePdf into shared helpers
LOW       6     Replace manual delete dialogs in ClienteDetalle
LOW       7     Document dashboard scaling limitation in code
LOW       8     Extract useEmbarqueFinancials hook
```

