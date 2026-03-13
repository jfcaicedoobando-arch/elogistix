

# Codebase Architecture Audit Report — v5.14.0

## Overall Assessment

The codebase is well-structured after the prior 10 audit steps. Separation of concerns is generally solid: hooks handle data, pages orchestrate UI, and utilities are centralized. The remaining issues are lower-severity but still worth addressing.

---

## Findings & Recommendations (ordered by priority)

### 1. Inline Supabase queries in Usuarios.tsx and NuevoEmbarque.tsx (Misplaced Data Logic)

**Usuarios.tsx** has raw `supabase.from("user_roles")` calls and `supabase.functions.invoke("list-users")` directly in the page component with manual `useState`/`useEffect` instead of React Query hooks. This violates the established pattern used everywhere else.

**NuevoEmbarque.tsx** imports `supabase` directly to update `cotizaciones.estado` to `'Embarcada'` (line 139-143). This mutation belongs in a hook or service.

**Recommendation:** Create `useUsuarios.ts` hook (React Query + mutations) and move the cotización status update into `useCotizacionMutations` or `embarqueServices`.

---

### 2. Dual Toaster system (Sonner + shadcn Toaster)

`App.tsx` renders **both** `<Toaster />` (shadcn) and `<Sonner />`. All pages now use `useToast` from `@/hooks/use-toast`, making the Sonner toaster dead code. Two toast providers can cause visual conflicts.

**Recommendation:** Remove the `<Sonner />` import and component from `App.tsx`. Delete `src/components/ui/sonner.tsx` if unused elsewhere.

---

### 3. Inconsistent toast import style

Two patterns coexist:
- `const { toast } = useToast()` (hook pattern — most files)
- `import { toast } from "@/hooks/use-toast"` (direct import — `NuevoEmbarque.tsx`, `EditarEmbarque.tsx`, `useEmbarqueForm.ts`)

The direct `toast` import works but bypasses the hook lifecycle. Mixed usage creates confusion.

**Recommendation:** Standardize all files to the `useToast()` hook pattern. The 3 files using the direct import should be updated.

---

### 4. Massive UI duplication between NuevaCotizacion and EditarCotizacion

`EditarCotizacion.tsx` (242 lines) is a near-copy of `NuevaCotizacion.tsx` (212 lines). The wizard step rendering (Paso 1-4) is identical — only the header text, loading gate, and initial data differ.

**Recommendation:** Extract a shared `CotizacionWizardLayout` component that receives the wizard hook instance `w` and renders all 4 steps. Both pages would become thin wrappers (~30 lines each).

---

### 5. Delete confirmation dialogs duplicated across 4 pages

The two-step delete `AlertDialog` pattern is copy-pasted in: `Embarques.tsx`, `Cotizaciones.tsx`, `ProveedorDetalle.tsx`, and `ClienteDetalle.tsx`. Each has 40-60 lines of near-identical dialog JSX.

**Recommendation:** Create a reusable `DoubleConfirmDeleteDialog` component that accepts `open`, `entityName`, `onConfirm`, `isPending` props. Replace all 4 instances.

---

### 6. EditarCotizacionForm uses `any` types for props

`EditarCotizacion.tsx` line 76-81 types `cotizacion: any`, `costos: any[]`, `navigate: any`, `toast: any`. This undermines type safety.

**Recommendation:** Use proper types: `CotizacionRow`, `CostoCotizacion[]`, `NavigateFunction`, and the toast type from the hook.

---

### 7. AuthProvider not wrapped in App.tsx

`AuthProvider` is not visible in `App.tsx`. It's likely in `main.tsx` but this means `ProtectedRoute` must access auth context from outside the Router. Verify the provider tree order is correct.

**Recommendation:** Confirm `AuthProvider` wraps `BrowserRouter` in `main.tsx`. If it does, no action needed — just document the provider hierarchy.

---

### 8. useDashboardData fetches ALL embarques client-side

`useDashboardData` calls `useEmbarques()` which fetches **all** shipments, then filters/maps client-side. For growing datasets this becomes a performance bottleneck (also subject to the 1000-row Supabase limit).

**Recommendation:** For now, document this as a known scaling limitation. When the dataset grows past ~500 embarques, consider server-side aggregation via database views or RPC functions.

---

### 9. `use-toast.ts` re-exported from two locations

Both `src/hooks/use-toast.ts` and `src/components/ui/use-toast.ts` exist. The latter just re-exports from the former. This creates import path confusion.

**Recommendation:** Delete `src/components/ui/use-toast.ts` and update any imports pointing to it.

---

### 10. Minor: Unused imports and dead code

- `isAdmin` is destructured but unused in `Cotizaciones.tsx` (line 38)
- `Embarques.tsx` has an empty `resetFilters` function (line 159-161) never called
- `useExchangeRates` hook exists but verify if it's used anywhere

**Recommendation:** Clean up in a single pass. Low priority.

---

## Summary Priority Table

```text
Priority  Step  Description
────────  ────  ───────────────────────────────────────
HIGH      1     Move inline supabase calls from Usuarios/NuevoEmbarque to hooks
HIGH      2     Remove dual Sonner toaster from App.tsx
MEDIUM    3     Standardize toast imports (3 files)
MEDIUM    4     Extract shared CotizacionWizardLayout component
MEDIUM    5     Create reusable DoubleConfirmDeleteDialog
LOW       6     Fix 'any' types in EditarCotizacionForm
LOW       7     Verify AuthProvider placement
LOW       8     Document dashboard scaling limitation
LOW       9     Remove duplicate use-toast re-export
LOW       10    Clean unused imports/dead code
```

