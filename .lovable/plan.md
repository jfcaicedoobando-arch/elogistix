

## Add delete button per row in Embarques list

### Approach
Since `columns` is defined as a module-level constant and doesn't have access to hooks, the cleanest approach is to move the columns definition inside the component and add an "Acciones" column with a Trash2 icon (visible on hover) that triggers a two-step AlertDialog confirmation flow. This reuses the existing `useEliminarEmbarque` mutation and `useRegistrarActividad` hook.

### Changes

**File: `src/pages/Embarques.tsx`**

1. Move `columns` inside the component so it can access `canEdit` and a delete handler.
2. Add an "Acciones" column (only when `canEdit`) with a `Trash2` icon button, styled with `opacity-0 group-hover:opacity-100` transition.
3. Add `rowClassName` to DataTable rows: `"group"` so hover works on the row.
4. Add state: `embarqueAEliminar` (the selected embarque) and `paso2` (boolean for second dialog).
5. Add two `AlertDialog` components at the bottom (same pattern as `DialogEliminarEmbarque.tsx`):
   - Dialog 1: "¿Eliminar embarque?" / "El embarque {expediente} sera eliminado permanentemente." / Cancelar + Continuar
   - Dialog 2: "¿Estas seguro?" / full warning text / Cancelar + "Eliminar definitivamente" (destructive)
6. On confirm: call `eliminarEmbarque.mutateAsync(id)`, then `registrarActividad.mutate(...)`, toast success, reset state.
7. The Trash2 button's onClick must `e.stopPropagation()` to prevent row navigation.

**Imports to add**: `Trash2` from lucide-react, `AlertDialog` components, `useEliminarEmbarque`, `useRegistrarActividad`, `useToast`.

**No other files need changes** — the `useEliminarEmbarque` hook already exists and handles cascade deletion + cache invalidation. The `DataTable` already supports `rowClassName`.

