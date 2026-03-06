

## Plan: Permitir eliminación de embarques para operadores

### Cambio único en `src/pages/EmbarqueDetalle.tsx`

Línea 340: cambiar `isAdmin` por `canEdit` en la condición que muestra el botón "Eliminar".

```tsx
// Antes
{isAdmin && (
// Después
{canEdit && (
```

La doble confirmación ya está implementada (dos AlertDialogs consecutivos). Solo se necesita cambiar la condición de visibilidad del botón.

### `src/pages/Changelog.tsx`

Agregar entrada v4.15.5: "Permiso de eliminación de embarques ampliado al equipo operativo con doble confirmación de seguridad."

