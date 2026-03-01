

## Plan: Editar embarques existentes — v3.4.0

### Enfoque

Crear una nueva pagina `EditarEmbarque` que reutilice los mismos componentes del wizard (`StepDatosGenerales`, `StepDatosRuta`, `StepCostosPrecios`) pero pre-cargados con los datos existentes del embarque. El boton "Editar" en `EmbarqueDetalle` navegara a `/embarques/:id/editar`.

### Cambios

**1. Hook `useEmbarques.ts` — agregar mutacion `useUpdateEmbarque`**
- Recibe el id del embarque y los campos a actualizar
- Actualiza la tabla `embarques` con `.update()`
- Tambien sincroniza `conceptos_venta` y `conceptos_costo`: elimina los existentes y re-inserta los nuevos (estrategia replace)
- Invalida queries al completar

**2. Nueva pagina `src/pages/EditarEmbarque.tsx`**
- Carga el embarque existente con `useEmbarque(id)`, conceptos venta/costo con los hooks existentes
- Pre-llena todo el state local con los valores del embarque (mismo patron que `NuevoEmbarque` pero con `useEffect` para inicializar)
- Reutiliza `StepDatosGenerales`, `StepDatosRuta`, `StepCostosPrecios` tal cual
- Wizard de 3 pasos (sin Documentos, ya que esos se gestionan en el detalle)
- Boton final dice "Guardar Cambios"
- Registra actividad en bitacora con accion `editar` y detalles de campos modificados

**3. Ruta en `App.tsx`**
- Agregar `<Route path="/embarques/:id/editar" element={<EditarEmbarque />} />`

**4. Boton Editar en `EmbarqueDetalle.tsx`**
- Conectar el boton existente para navegar a `/embarques/${id}/editar`

**5. Changelog**
- Nueva entrada v3.4.0

### Detalle tecnico de la sincronizacion de conceptos

En lugar de hacer diff fila por fila, la mutacion:
1. Hace `DELETE FROM conceptos_venta WHERE embarque_id = X`
2. Hace `DELETE FROM conceptos_costo WHERE embarque_id = X`
3. Re-inserta los conceptos actuales

Esto simplifica la logica y evita bugs de sincronizacion, ya que los conceptos no tienen relaciones secundarias.

### Archivos nuevos
- `src/pages/EditarEmbarque.tsx`

### Archivos modificados
- `src/hooks/useEmbarques.ts` — nueva mutacion `useUpdateEmbarque`
- `src/App.tsx` — nueva ruta
- `src/pages/EmbarqueDetalle.tsx` — conectar boton Editar
- `src/pages/Changelog.tsx` — entrada v3.4.0

