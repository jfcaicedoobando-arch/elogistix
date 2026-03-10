

## Simplificar eliminación en DocumentChecklist

### Cambio único en `src/components/DocumentChecklist.tsx`

- Eliminar `confirmStep` state y `handleFirstConfirm`
- Eliminar el segundo `AlertDialog`
- El único `AlertDialog` restante ejecuta directamente `onFileChange(pendingDelete, undefined)` al confirmar
- Botón "Eliminar" con clase destructive

Flujo resultante: Click Trash → Dialog → Eliminar → `onFileChange` → cierra.

