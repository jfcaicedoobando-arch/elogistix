

# DataTable Enhancements — v5.20.0

## Changes

### 1. Sticky first column (Expediente/Folio)

Add a `sticky` property to `DataTableColumn` interface. In `DataTable`, apply `sticky left-0 z-[5] bg-background` to both `<TableHead>` and `<TableCell>` for columns marked sticky. The header cell gets `z-20` (above both sticky header and sticky column). TableHeader already has `sticky top-0 z-10` — no change needed there.

### 2. Row actions dropdown menu

Add a new `stickyRight` property to column config. Replace the bare `<Trash2>` button in `Embarques.tsx` and `Cotizaciones.tsx` with a `<DropdownMenu>` triggered by a `<MoreHorizontal>` icon. Menu items:
- **Editar** — navigates to edit page
- **Duplicar** — opens duplicate dialog (Embarques only, already has `DialogDuplicarEmbarque`)
- Separator
- **Eliminar** — triggers existing delete dialog

The dropdown is rendered inside the action column's `render` function — no changes to DataTable core needed beyond the sticky-right support.

### 3. Consistent color-coded Badge for all statuses

The `getEstadoColor` helper already maps all statuses to colored classes. Verify all tables use `<Badge>` with these classes (they already do). Add a `border` variant to make badges more distinct: update `getEstadoColor` to include a subtle border color matching the text color, e.g. `bg-info/15 text-info border border-info/30`.

### 4. Files modified

| File | Change |
|------|--------|
| `src/components/DataTable.tsx` | Add `sticky` prop support to column interface + cell rendering |
| `src/components/ui/table.tsx` | No changes (sticky header already exists) |
| `src/lib/helpers.ts` | Update `getEstadoColor` to include border classes |
| `src/pages/Embarques.tsx` | Mark Expediente as sticky, replace delete button with DropdownMenu (Edit/Duplicate/Delete), add DialogDuplicarEmbarque |
| `src/pages/Cotizaciones.tsx` | Mark Folio as sticky, replace delete button with DropdownMenu (Edit/Delete) |
| `src/components/dashboard/EmbarquesActivosTable.tsx` | Mark Expediente as sticky, update estado Badge to use `getEstadoColor` instead of `ESTADO_CONFIG` for consistency |
| `src/pages/Facturacion.tsx` | Mark # Factura as sticky |
| `src/pages/Changelog.tsx` | Add v5.20.0 entry |

### 5. Implementation details

**DataTableColumn interface addition:**
```typescript
sticky?: boolean; // applies sticky left-0 to this column
```

**DropdownMenu pattern (Embarques):**
```tsx
render: (e) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild onClick={(ev) => ev.stopPropagation()}>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => navigate(`/embarques/${e.id}/editar`)}>
        <Pencil className="mr-2 h-4 w-4" /> Editar
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setEmbarqueADuplicar(e)}>
        <Copy className="mr-2 h-4 w-4" /> Duplicar
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive" onClick={() => setEmbarqueAEliminar(e)}>
        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)
```

**getEstadoColor update** — add border class to each entry:
```typescript
'Confirmado': 'bg-info/15 text-info border border-info/30',
```

