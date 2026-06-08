## Problema

En el detalle del embarque (`/embarques/:id`, pestaña Resumen) aparece la tarjeta **Contenedores** con su propio botón "Guardar cambios" (`SeccionContenedores`). Esto choca con la capacitación: cualquier modificación de un embarque debe hacerse desde el botón **Editar** que abre el wizard de 3 pasos. Hoy hay dos caminos para guardar contenedores y eso confunde.

## Objetivo

Un solo flujo de edición: el wizard. El detalle solo muestra información.

## Cambios

### 1. Detalle del embarque — solo lectura
- Reemplazar `SeccionContenedores` (editable) por una nueva `SeccionContenedoresReadonly` dentro de `TabResumen.tsx`.
- Muestra la misma tarjeta "Contenedores (N)" con la lista (número, tipo, sellos, peso, volumen, piezas) pero sin botones de guardar/agregar/eliminar ni inputs.
- Si no hay contenedores: estado vacío con CTA "Editar embarque" → navega a `/embarques/:id/editar?step=2`.
- Si hay contenedores: botón secundario "Editar contenedores" en el header de la tarjeta que abre el wizard en el paso correspondiente.
- Se mantiene visible solo para `modo === "Marítimo"` (igual que hoy).

### 2. Wizard Editar embarque — nueva sección de contenedores
- Agregar la lista editable de contenedores como sección dentro del **Paso 2 — Datos de Ruta** (`StepDatosRuta.tsx`), visible solo cuando `modo === "Marítimo"`.
- Reutiliza `ListaContenedoresEditable` (ya existe y ya está conectada al formulario vía `methods.setValue('contenedores', …)`).
- La hidratación inicial ya ocurre en `useEditarEmbarqueWizard` (efecto `hidratoContenedores`) y el guardado ya envía `contenedores` a `updateEmbarque.mutateAsync` — no se toca esa lógica.
- Validación al pasar de paso / al guardar: cada contenedor requiere `numero_contenedor` y `tipo_contenedor` no vacíos (misma regla que hoy aplica `SeccionContenedores`). Si falla, mostrar toast y bloquear avance.

### 3. Limpieza
- `SeccionContenedores.tsx` queda sin consumidores → eliminarlo junto con su lógica de mutación local (`reemplazarTodos` se sigue usando indirectamente desde el wizard a través de `useUpdateEmbarque`, por lo que no se borra el servicio).
- Sin cambios de BD, RLS, ni servicios.

### 4. Documentación y versión
- `CHANGELOG.md`: nueva entrada con bump de `APP_VERSION` (parche, siguiendo el formato `## [X.Y.Z] - YYYY-MM-DD`).
- Actualizar memoria `mem://features/editar-embarques` para registrar que la edición de contenedores vive exclusivamente en el Paso 2 del wizard.

## Archivos afectados

- `src/features/embarques/components/TabResumen.tsx` (usa el componente readonly)
- `src/features/embarques/components/contenedores/SeccionContenedoresReadonly.tsx` (nuevo)
- `src/features/embarques/components/contenedores/SeccionContenedores.tsx` (eliminar)
- `src/features/embarques/components/StepDatosRuta.tsx` (incluye sección editable de contenedores cuando aplica)
- `src/constants/appVersion.ts`, `CHANGELOG.md`
- `mem://features/editar-embarques`

## Fuera de alcance

- NuevoEmbarque (la creación de contenedores hijos sigue como está hoy).
- Cambios en `embarque_contenedores`, triggers DB, o tipos generados.
- Cambios en otras pestañas del detalle (Documentos, Tracking, Financiero).

## Criterio de aceptación

1. En `/embarques/:id` no aparece ningún botón "Guardar cambios" en la tarjeta de Contenedores.
2. La tarjeta muestra los contenedores existentes en modo lectura, con acceso directo al wizard.
3. En `/embarques/:id/editar` paso 2, se pueden agregar/editar/eliminar contenedores y al pulsar "Guardar Cambios" del wizard se persisten junto al resto del embarque.
4. Los tests existentes (`useEditarEmbarqueWizard.test.tsx` y demás) siguen en verde.
