## Diagnóstico
El modal de editar proveedor (`EditarProveedorDialog.tsx`) no incluye la clase `scrollableDialog`, a diferencia del modal de nuevo proveedor (`NuevoProveedorDialog.tsx`). Esto hace que el contenido del formulario no tenga `max-h` ni scroll interno, por lo que en pantallas de laptop (ej. 1366×768) el modal se extiende más allá del viewport y se corta arriba/abajo.

## Cambio propuesto
En `EditarProveedorDialog.tsx`, cambiar:
```tsx
<DialogContent className={dialogSize.md}>
```
por:
```tsx
import { cn } from "@/lib/utils";
import { scrollableDialog } from "@/components/shared/utils/dialogTokens";
...
<DialogContent className={cn(dialogSize.md, scrollableDialog)}>
```

## Archivos a modificar
- `src/components/proveedor/EditarProveedorDialog.tsx` — agregar imports `cn` y `scrollableDialog`, y aplicar al `DialogContent`.

No se requieren cambios en RLS, backend, ni otros componentes.