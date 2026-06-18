## Cambios

Para los roles sin `canCrearEmbarqueLibre` (todos excepto `super_admin`, `admin_org`, `admin`, `gerente_operaciones`), el botón "Nuevo Embarque" desaparece del listado, ya que la única vía válida para ellos es **Cotización Aceptada → "Generar embarque"** (botón en el detalle de cotización, que sí queda visible).

### 1. Ocultar el botón en tres puntos
- `EmbarquesHeaderActions.tsx` — recibir nueva prop `canCrearLibre` y mostrar el botón "Nuevo Embarque" sólo si `canEdit && canCrearLibre`.
- `EmbarquesEmptyState.tsx` — misma prop; el CTA de empty state también se condiciona.
- `Embarques.tsx` (FAB flotante) — mismo gate.

`Embarques.tsx` lee `canCrearEmbarqueLibre` desde `usePermissions()` y lo propaga.

### 2. Guard de ruta `/embarques/nuevo`
En `NuevoEmbarque.tsx`, si el usuario no tiene `canCrearEmbarqueLibre` **y** no llega con `state.cotizacionPrevinculadaId` (es decir, no viene del flujo Cotización → Embarque), redirigir a `/embarques` con `toast` informativo. Esto evita que peguen la URL directa.

### 3. Changelog + `APP_VERSION` 13.66.20

## Fuera de alcance

- No se toca el botón "Generar embarque" en el detalle de cotización — sigue disponible para todos los roles, porque ese flujo siempre arranca con `cotizacion_id` y el trigger de DB lo permite.
- No se modifica la lista de roles autorizados.

## Verificación

- Login como Valeria (`coordinador_logistico`): la página `/embarques` no muestra botón Nuevo ni FAB; entrar manualmente a `/embarques/nuevo` redirige a `/embarques`.
- Login como admin: comportamiento sin cambios.
- Flujo Cotización → Generar embarque sigue funcionando para todos.
