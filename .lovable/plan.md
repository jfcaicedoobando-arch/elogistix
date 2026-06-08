## Cambio
Eliminar la opción **Imprimir** del menú de acciones en el detalle de embarque.

## Archivos
- `src/features/embarques/components/EmbarqueDetalleHeader.tsx`
  - Quitar el `DropdownMenuItem` de Imprimir (líneas ~134-136).
  - Quitar `Printer` del import de `lucide-react`.
- `src/constants/appVersion.ts` — bump de versión.
- `CHANGELOG.md` — entrada nueva.

## Fuera de alcance
Sin cambios en lógica, datos, otras vistas ni en el portal de cliente.
