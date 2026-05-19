## Cambios en el listado de embarques

1. **`src/components/embarque/embarqueColumns.tsx`**
   - Eliminar la columna `proforma` (header "Proforma") y su import de `ProformaBadge`.
   - Eliminar la columna `acciones` (botón Editar/Eliminar) y los imports `EmbarqueRowActions`.
   - Quitar de `BuildColumnsParams` los campos `canEdit`, `onEditar` y `onEliminar`.

2. **`src/hooks/embarque/useEmbarquesPageController.ts`**
   - Eliminar el estado `embarqueAEliminar`, el handler `handleEliminar`, la mutación `useEliminarEmbarque` y la llamada a `registrarActividad` asociada al borrado.
   - Quitar `canEdit/onEditar/onEliminar` del `buildEmbarqueColumns`.
   - Dejar de exponer `embarqueAEliminar`, `setEmbarqueAEliminar`, `handleEliminar`, `eliminarEmbarquePending`.
   - Mantener `canEdit` solo si sigue siendo necesario para el botón "Nuevo embarque" del header y el FAB.

3. **`src/pages/embarques/Embarques.tsx`**
   - Quitar el `DoubleConfirmDeleteDialog` y su import.
   - Quitar las props relacionadas (`embarqueAEliminar`, `setEmbarqueAEliminar`, `handleEliminar`, `eliminarEmbarquePending`).

4. **Acceso a Editar**: La ruta `/embarques/:id/editar` se sigue alcanzando desde el **detalle** del embarque (no se toca). Solo se retira el acceso desde la tabla.

5. **Changelog** (`src/content/changelog/v8/chunks/0.ts`): nueva entrada patch `9.0.2` describiendo la simplificación del listado (sin acciones por fila y sin columna Proforma). Actualizar `APP_VERSION`.

## Fuera de alcance

- No se borra el componente `EmbarqueRowActions` ni `ProformaBadge` (siguen usándose en otras vistas si aplica; si quedan huérfanos se limpian en una pasada futura).
- No se cambia la lógica de permisos ni los endpoints de eliminación.
