

## Agregar botón eliminar archivo con doble confirmación en DocumentChecklist (v4.32.1)

### Cambio

Cuando un documento tiene archivo adjuntado (`doc.adjuntado === true`), mostrar un botón de eliminar (ícono Trash2) junto al botón "Cambiar". Al hacer clic:

1. **Primer diálogo**: "¿Deseas eliminar el archivo {nombre}?"  → Cancelar / Continuar
2. **Segundo diálogo**: "Esta acción no se puede deshacer. ¿Confirmar eliminación?" → Cancelar / Eliminar

Si confirma ambos, llamar `onFileChange(docNombre, undefined)` para limpiar el archivo del estado local.

### Archivos a modificar (2)

1. **`src/components/DocumentChecklist.tsx`**
   - Agregar estado local para manejar los dos pasos del diálogo (`pendingDelete`, `confirmStep`)
   - Importar `AlertDialog` de radix
   - Agregar botón `Trash2` (variant destructive/ghost) visible solo cuando `doc.adjuntado`
   - Dos AlertDialogs encadenados: primer confirm abre el segundo, segundo ejecuta `onFileChange(nombre, undefined)`

2. **`src/pages/Changelog.tsx`** — entrada v4.32.1

