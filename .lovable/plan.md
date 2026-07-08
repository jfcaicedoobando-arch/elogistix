## Problema

Cuando Valeria actualizó el ETA del embarque `ELIMP00239`, aparecieron **3 toasts** en cascada:

1. `"ETA actualizada"` — disparado por `useActualizarEta` (hook mutation).
2. `"Evento agregado"` — disparado por `useCreateEventoEmbarque` (hook mutation).
3. `"ETA actualizada"` — disparado por `TrackingNuevoEventoForm` al terminar toda la secuencia.

El mismo patrón ocurre al marcar la llegada real (donde saldrían: "Fecha de llegada actualizada" + "Evento agregado" + "Llegada real registrada").

Es feedback ruidoso y confuso — el usuario ejecuta **una** acción de negocio y ve 3 notificaciones apiladas.

## Diseño

Cada mutation individual seguirá manejando su propio toast por defecto (para no romper otros consumidores como tests o llamadas directas), pero se le añadirá una opción `silent`/`suppressToast` que la orquestación de `TrackingNuevoEventoForm` usará para silenciar los toasts intermedios.

De esa forma queda **un solo toast por acción**:

- Actualizar ETA → `"ETA actualizada"`.
- Marcar llegada real → `"Llegada real registrada"`.

Los errores intermedios se seguirán propagando por `throw` (los `mutateAsync` rechazan la promesa), y el `try/catch` del formulario ya muestra un `notifyError` unificado.

## Cambios

### 1. `useActualizarEta` (`src/features/embarques/hooks/mutations/useActualizarEta.ts`)

- Aceptar un flag opcional `silent?: boolean` en el hook (parámetro del hook, no del `mutate`).
- Si `silent === true`, omitir el `notifySuccess` del `onSuccess` (invalidaciones de query siguen ejecutándose).
- El `onError` interno se elimina cuando `silent`, porque el formulario ya muestra su propio toast de error unificado y muestra dos toasts de error rojos también sería ruidoso. En el resto de casos (no-silent) se conserva.

### 2. `useActualizarFechaLlegadaReal` (`src/features/embarques/hooks/mutations/useActualizarFechaLlegadaReal.ts`)

- Misma señal `silent?: boolean` con el mismo comportamiento.

### 3. `useCreateEventoEmbarque` (`src/features/embarques/hooks/useEventosEmbarque.ts`)

- Misma señal `silent?: boolean`. Como este hook sí se usa desde tests y potencialmente desde otros lados, el default sigue siendo mostrar toast.

### 4. `TrackingNuevoEventoForm` (`src/features/embarques/components/tracking/TrackingNuevoEventoForm.tsx`)

- Instanciar los 3 hooks con `{ silent: true }`.
- Mantener el `notifySuccess` final del formulario (`"ETA actualizada"` / `"Llegada real registrada"`) — que ahora sí será el único toast visible.
- Mantener el `try/catch` con `notifyError` unificado.

### 5. Versión y changelog

- `APP_VERSION` → `13.214.1` (patch).
- Entrada en `CHANGELOG.md` describiendo el fix.

## Riesgos y verificación

- Otros consumidores actuales de `useCreateEventoEmbarque` no se ven afectados: no pasan opciones y el default sigue disparando toast.
- Tests existentes (`useEventosEmbarque.test.tsx`) no cambian su firma; siguen pasando.
- Verificación manual: entrar al tab Tracking de un embarque, "Actualizar ETA" → confirmar **un solo** toast; luego "Marcar Llegada real" → confirmar **un solo** toast.
- `bun run lint -- --max-warnings 0` y typecheck deben seguir en verde.
