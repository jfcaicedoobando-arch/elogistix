

## Fix `handleEliminar` in Embarques.tsx

Replace the current `handleEliminar` function (lines ~46-62) to capture values before the async call and move state reset from `finally` into both `try` and `catch` blocks.

### Change: `src/pages/Embarques.tsx`

Replace the existing `handleEliminar` with the user's provided version that:
1. Captures `id`, `expediente`, `cliente`, `modo` before the async operation
2. Moves `setEmbarqueAEliminar(null)` and `setPaso2(false)` into the `try`/`catch` blocks instead of `finally`

