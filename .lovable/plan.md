

## Problem

The issue is event propagation. When you click "Eliminar" in the dropdown menu, the click bubbles up to the `<TableRow>` which has `onRowClick` set to `navigate(/cotizaciones/${c.id})`. The `e.stopPropagation()` is only on the `DropdownMenuTrigger` button, not on the individual `DropdownMenuItem` clicks.

When a dropdown item is selected, Radix closes the menu and the click propagates to the row, causing navigation.

## Fix

Add `e.stopPropagation()` to both `DropdownMenuItem` onClick handlers (Editar and Eliminar) in `src/pages/Cotizaciones.tsx`:

```tsx
<DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/cotizaciones/${c.id}/editar`); }}>
<DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCotizacionAEliminar(c.id); }}>
```

This is a one-line fix per menu item — same pattern likely needed in `Embarques.tsx` if it has the same issue.

## Files to change
- `src/pages/Cotizaciones.tsx` — add `e.stopPropagation()` to dropdown item handlers

