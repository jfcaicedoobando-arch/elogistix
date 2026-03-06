

## Plan: Botón Eliminar Embarque (solo Admin)

### Cambios

**1. `src/hooks/useEmbarques.ts`** — Agregar `useEliminarEmbarque`

Hook `useMutation` que:
1. Elimina registros relacionados en orden: `conceptos_venta`, `conceptos_costo`, `documentos_embarque`, `notas_embarque`, `facturas` (por `embarque_id`)
2. Elimina el embarque de la tabla `embarques`
3. `onSuccess`: `invalidateQueries(['embarques'])`

**2. `src/pages/EmbarqueDetalle.tsx`** — Botón + AlertDialog de eliminación

- Importar `Trash2` de lucide y `useEliminarEmbarque`
- Agregar botón rojo "Eliminar" visible solo si `isAdmin` (no `canEdit`, solo admin)
- AlertDialog con doble confirmación (siguiendo el patrón existente de seguridad del proyecto):
  - Primera alerta: "¿Estás seguro de eliminar este embarque?"
  - Segunda alerta: "Esta acción es irreversible. Se eliminarán todos los documentos, costos, conceptos de venta y notas asociados."
- `onSuccess`: registrar en bitácora, toast de confirmación, navegar a `/embarques`

**3. `src/pages/Changelog.tsx`** — Entrada v4.15.0

