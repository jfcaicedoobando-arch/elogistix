

# Codebase Architecture Audit — Post v5.16.0

## Overall Assessment

The codebase is in strong shape. The two prior audit rounds addressed the biggest issues (wizard deduplication, hook centralization, error handling, toast unification). What remains are low-severity items.

---

## Findings & Recommendations

### 1. Remaining `any` types (8 files, ~12 occurrences) — LOW-MEDIUM

Despite the previous cleanup, `any` persists in:

| File | Location | Fix |
|------|----------|-----|
| `Configuracion.tsx` | `getVal<T>(data: any[])` + `(c: any)` | Type `data` as the config row type from Supabase |
| `ClienteDetalle.tsx` | `handleSaveContacto(data: any)` | Use a `ContactoFormData` interface |
| `useCotizacionWizardForm.ts` | `conceptos_venta: any` in `InitialData` | Use `ConceptoVentaCotizacion[]` |
| `useUsuarios.ts` | `(usuario: any)` and `(rolUsuario: any)` | Define inline types or use Supabase row types |
| `SeccionConceptosVentaCotizacion.tsx` | `valor: any` in props | Use `string \| number \| boolean` union |
| `SeccionCostosInternosPLUnificado.tsx` | `updateFila(..., value: any)` | Use `FilaCostoLocal[keyof FilaCostoLocal]` |
| `list-users/index.ts` (edge fn) | `catch (err: any)` | Use `unknown` + `getErrorMessage` |

**Recommendation:** Single pass replacing all remaining `any` with proper types. ~30 min effort.

---

### 2. `CotizacionDetalle.tsx` doesn't use `getErrorMessage` — LOW

Lines 81, 110, 321 still use inline `err instanceof Error ? err.message : "Error desconocido"` instead of the centralized `getErrorMessage` utility.

**Recommendation:** Replace 3 occurrences with the shared utility for consistency.

---

### 3. Configuracion.tsx manages 20+ `useState` fields individually — LOW

The page has 20 individual `useState` calls (lines 26-59) for config fields, each initialized from `getVal`. This is verbose but functional.

**Recommendation:** Consolidate into a single `useReducer` or a `useConfigForm` hook with a single state object. Not urgent — the page works fine.

---

### 4. `Proveedores.tsx` uses `useState` as `useRef` for search tracking — LOW

Lines 61-65 use `useState` to track previous search value for page reset. This is a non-standard pattern that should use `useRef` or `useEffect`.

**Recommendation:** Replace with a `useEffect` that resets page when `debouncedSearch` changes.

---

### 5. Edge function `list-users` still uses `catch (err: any)` — LOW

The edge function at `supabase/functions/list-users/index.ts` line 59 was missed in the previous error handling sweep.

**Recommendation:** Update to `catch (err: unknown)` with appropriate error extraction.

---

### 6. `Proveedores.tsx` casts `addProveedor` return — LOW

Line 105: `(proveedorCreado as { id?: string })?.id` — an unsafe cast suggesting the return type of `addProveedor` isn't properly typed.

**Recommendation:** Fix the return type of `addProveedor` in `useProveedores.ts` to include `id`.

---

## Summary Priority Table

```text
Priority   Step  Description
─────────  ────  ──────────────────────────────────────────────
LOW-MED    1     Replace remaining 'any' types across 8 files
LOW        2     Use getErrorMessage in CotizacionDetalle.tsx
LOW        3     Consolidate Configuracion.tsx state into single object
LOW        4     Fix useState-as-ref pattern in Proveedores.tsx
LOW        5     Update edge function error handling
LOW        6     Fix addProveedor return type
```

The codebase has reached a mature state. These are polish items — no architectural or structural issues remain.

