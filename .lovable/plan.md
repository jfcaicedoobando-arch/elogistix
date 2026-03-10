

## Fix: Add `shouldValidate` / `shouldDirty` to `setValue` calls in `handleVincularCotizacion` and `handleDesvincularCotizacion`

### Problem
`setValue` without options doesn't trigger re-renders on controlled components (Select, Combobox), so fields appear empty after linking a cotización.

### Changes — `src/pages/NuevoEmbarque.tsx`

**`handleVincularCotizacion` (lines 59-73)**: Add `{ shouldValidate: true, shouldDirty: true }` to every `setValue` call. Add `methods.trigger()` at the end before closing the callback.

**`handleDesvincularCotizacion` (lines 75-89)**: Same — add `{ shouldValidate: true, shouldDirty: true }` to every `setValue` call, and `methods.trigger()` at the end.

No other files affected.

