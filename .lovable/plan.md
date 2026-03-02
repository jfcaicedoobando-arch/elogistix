

## Plan: 4 mejoras operativas — v3.5.0

### 1. Cambio de estado del embarque desde EmbarqueDetalle

El flujo de estados en la base de datos es: **Cotización → Confirmado → En Tránsito → Llegada → En Proceso → Cerrado** (6 estados ya definidos en el enum `estado_embarque`). Se usará este flujo existente en lugar de los 5 estados mencionados, ya que cambiar el enum requeriría migración y rompería datos existentes.

**Cambios:**
- `src/hooks/useEmbarques.ts` — nueva mutación `useAvanzarEstadoEmbarque` que hace `.update({ estado })` en la tabla `embarques` e inserta una nota tipo `cambio_estado` en `notas_embarque`
- `src/pages/EmbarqueDetalle.tsx` — agregar botón "Avanzar a [siguiente estado]" visible solo si `canEdit` y el estado no es "Cerrado". Al hacer clic, muestra `AlertDialog` de confirmación. Al confirmar, ejecuta la mutación y registra en bitácora
- `src/data/embarqueConstants.ts` — ya tiene `ESTADO_TIMELINE`, se reutiliza directamente

### 2. Editar datos del cliente desde ClienteDetalle

**Cambios:**
- `src/hooks/useClientes.ts` — nueva mutación `useUpdateCliente` con `.update()` sobre tabla `clientes`
- `src/pages/ClienteDetalle.tsx` — agregar botón "Editar" al lado del nombre del cliente (visible si `canEdit`). Abre un `Dialog` con formulario pre-llenado con todos los campos (nombre, RFC, dirección, ciudad, estado, CP, contacto, email, teléfono). Al guardar, ejecuta mutación y registra en bitácora

### 3. Confirmación doble antes de eliminar contactos

**Cambios:**
- `src/pages/ClienteDetalle.tsx` — reemplazar el `handleDelete` directo por un flujo de dos pasos:
  1. Primer `AlertDialog`: "¿Estás seguro de eliminar este contacto?"
  2. Segundo `AlertDialog`: "Esta acción no se puede deshacer. ¿Confirmas la eliminación?"
  Solo si confirma ambos se ejecuta `deleteContacto.mutateAsync`

### 4. Agregar notas desde el detalle del embarque

**Cambios:**
- `src/hooks/useEmbarques.ts` — nueva mutación `useCreateNotaEmbarque` que inserta en `notas_embarque` con tipo `nota`, usuario del contexto auth y timestamp
- `src/components/embarque/TabNotas.tsx` — agregar un formulario con `Textarea` + botón "Agregar Nota" arriba de la lista de notas. Al enviar, ejecuta la mutación y registra en bitácora

### 5. Changelog

- Nueva entrada v3.5.0 en `src/pages/Changelog.tsx`

### Archivos modificados
- `src/hooks/useEmbarques.ts` — 2 mutaciones nuevas
- `src/hooks/useClientes.ts` — 1 mutación nueva
- `src/pages/EmbarqueDetalle.tsx` — botón avanzar estado con AlertDialog
- `src/pages/ClienteDetalle.tsx` — botón editar cliente + confirmación doble eliminar contacto
- `src/components/embarque/TabNotas.tsx` — formulario crear notas
- `src/pages/Changelog.tsx` — entrada v3.5.0

### Nota sobre estados
El usuario pidió "En Destino" y "Entregado" pero la base de datos tiene "Llegada", "En Proceso" y "Cerrado". Se usarán los estados existentes para no requerir migración de esquema ni romper datos. Si se desea cambiar los nombres, se haría en una migración separada.

