## Objetivo

Permitir que en el modal de **Nueva tarifa** (módulo Costeo y Portal Agente) el usuario seleccione **varias rutas a la vez** y se generen N tarifas que comparten todos los demás datos (agente, naviera, tipo de contenedor, flete, recargos, vigencia, notas).

Aplica **solo en modo "crear"** (incluye "duplicar"). En modo "editar" la selección de ruta sigue siendo única — no tiene sentido cambiar 1 tarifa a N.

## UX propuesta

En el bloque `RutaTipoFields`, reemplazar el `Select` único de ruta por un **selector múltiple tipo combobox con checkboxes** (búsqueda por origen/destino, con chips de las rutas elegidas debajo):

- Placeholder: "Selecciona una o varias rutas CN → MX".
- Cada item: `Puerto Origen → Puerto Destino` (mismo texto que hoy).
- Acciones rápidas: "Seleccionar todas las visibles" / "Limpiar selección".
- Bajo el selector se muestran chips removibles con cada ruta elegida y un contador: `3 rutas seleccionadas`.
- Si solo hay 1 ruta seleccionada el flujo se ve idéntico al actual.

El resto del formulario (agente, naviera, tipo contenedor, números, vigencia, recargos, notas) **no cambia**: se captura una sola vez y aplica a todas las rutas.

El botón de guardar cambia su label dinámicamente:
- 1 ruta → "Guardar tarifa"
- N rutas → "Guardar N tarifas"

El "Total comparable" en el header se mantiene (es el mismo para todas).

## Comportamiento al guardar (modo crear)

1. Validar igual que hoy + exigir `rutas.length >= 1`.
2. Por cada `ruta_id` seleccionada, ejecutar `crear.mutateAsync({ ...form, ruta_id })` **en serie** (para no saturar y para poder reportar fallas individuales).
3. Toast final agregado:
   - Todas OK → "Se crearon N tarifas".
   - Parcial → "Se crearon X de N tarifas. Fallaron: <origen→destino>, …" (no se cierra el modal; las rutas que sí se crearon se quitan de la selección para no duplicar).
   - Todas fallan → se mantiene el modal abierto, no se cierra.
4. Si todas pasan, cerrar modal e invalidar queries (lo hace el hook actual).

En modo **editar**: el selector queda como Select único (no se permite multi) — sin cambios funcionales.

En modo **duplicar**: se hereda como crear (puede multi-seleccionar; la ruta original viene preseleccionada).

## Detalles técnicos

Archivos a tocar:

- `src/features/costeo/components/TarifaFormFields.tsx`
  - Cambiar `RutaTipoFields` para aceptar `multiple?: boolean`, `rutaIds: string[]`, `onRutaIdsChange`. Cuando `multiple`, renderizar un combobox múltiple (Popover + Command de shadcn + Checkbox) con chips. Cuando no, mantener el Select actual.

- `src/features/costeo/components/TarifaForm.tsx`
  - Agregar estado local `rutaIds: string[]` además de `form.ruta_id`. En modo crear/duplicar usar multi; en editar usar single (sincronizado con `form.ruta_id`).
  - Ajustar `calcularErrores` para validar `rutaIds.length > 0` en crear.
  - Nueva función `guardarMultiples` que itera `rutaIds`, llama `crear.mutateAsync` por cada uno, agrega resultados y muestra toast resumen. Reusar la mutación existente sin tocar el servicio.
  - Footer: label del botón dinámico según `rutaIds.length`.

- `src/features/portal-agente/components/AgenteTarifaForm.tsx`
  - Sin cambios de API: hereda el comportamiento porque solo envuelve `TarifaForm`.

- No se modifica `services/tarifas.ts` ni la BD: cada tarifa sigue siendo un INSERT individual con su `ruta_id`. El trigger del portal agente que fuerza `estado_aprobacion='borrador'` sigue aplicando por fila.

- Memoria: actualizar `mem://features/costeo-tarifas-maritimas` con la nota "Modal Nueva tarifa soporta multi-ruta (1 form → N inserts)".

## Versionado y changelog

- `src/constants/appVersion.ts` → `13.135.31`
- `CHANGELOG.md` → entrada `[13.135.31] - 2026-06-24`: "Modal Nueva tarifa permite seleccionar varias rutas y generar N tarifas en un solo guardado."

## Fuera de alcance

- Edición masiva de tarifas existentes.
- Importación CSV / bulk import.
- Cambios en el modelo de datos (no se crea concepto de "plantilla de tarifa").
