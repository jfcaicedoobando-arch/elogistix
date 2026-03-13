

## Bug: AlertDialogAction auto-closes dialog, preventing step 2

### Root Cause

Radix's `AlertDialogAction` component **always closes the parent AlertDialog** when clicked. In `DoubleConfirmDeleteDialog.tsx` line 68:

```tsx
<AlertDialogAction onClick={() => setPaso2(true)}>Continuar</AlertDialogAction>
```

When clicked:
1. `setPaso2(true)` runs
2. Radix closes the dialog → triggers `onOpenChange(false)` → calls `close()` → resets `paso2 = false` and `cotizacionAEliminar = null`
3. Step 2 never appears

### Fix

**File: `src/components/DoubleConfirmDeleteDialog.tsx`**

Replace `AlertDialogAction` in step 1 with a regular `Button` that doesn't auto-close the dialog. Add `e.preventDefault()` to stop Radix's default close behavior:

```tsx
// Step 1: Change AlertDialogAction to prevent auto-close
<AlertDialogAction
  onClick={(e) => {
    e.preventDefault();  // Prevent Radix from closing the dialog
    setPaso2(true);
  }}
>
  Continuar
</AlertDialogAction>
```

Similarly, in step 2, the same issue could prevent `onConfirm` from completing if the dialog closes too early. Fix:

```tsx
// Step 2: Also prevent auto-close, let onConfirm finish first
<AlertDialogAction
  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
  onClick={async (e) => {
    e.preventDefault();
    await onConfirm();
    close();
  }}
  disabled={isPending || !canDelete}
>
```

This is a one-file fix affecting all modules that use `DoubleConfirmDeleteDialog` (cotizaciones, embarques, proveedores, contactos).

