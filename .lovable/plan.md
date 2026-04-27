## Diagnóstico

COT-2026-0007 sí tiene embarque vinculado:

```text
Cotización: COT-2026-0007
Estado actual: Aceptada
Embarque vinculado: ELGEN00054
embarque_id: 0808f1c7-1324-467d-9bd3-ae53c09e2888
```

Encontré dos puntos importantes:

1. Solo hay 1 cotización con `embarque_id` y estado `Aceptada`: COT-2026-0007.
2. La función que promueve `Aceptada → En operación` ya existe, pero el trigger `trg_sync_cotizacion_embarque_link` no está instalado actualmente en la tabla `embarques`. Por eso la automatización no corrió para este caso.

## Plan de corrección

1. **Backfill inmediato de datos**
   - Actualizar COT-2026-0007 de `Aceptada` a `En operación` porque ya tiene embarque vinculado.
   - Hacerlo de forma general para cualquier cotización que esté en `Aceptada` y ya tenga `embarque_id`, aunque hoy solo afecta a COT-2026-0007.

2. **Reinstalar el trigger de sincronización**
   - Crear nuevamente `trg_sync_cotizacion_embarque_link` sobre `public.embarques`.
   - Mantener la función existente `public.sync_cotizacion_embarque_link()` que ya contiene la lógica correcta:
     - sincroniza `cotizaciones.embarque_id`
     - cambia `estado` a `En operación` cuando la cotización estaba `Aceptada`

3. **Asegurar casos futuros**
   - El trigger quedará activo para `AFTER INSERT OR UPDATE OF cotizacion_id` en `embarques`.
   - Así, cuando se cree o vincule un embarque desde una cotización aceptada, el estado se actualizará automáticamente.

4. **Revisar el selector de cotizaciones aceptadas**
   - Validar el flujo de creación de embarques para que siga mostrando únicamente cotizaciones realmente pendientes de operar (`Aceptada` sin embarque), evitando que una cotización ya en operación se pueda elegir otra vez accidentalmente.

5. **Actualizar changelog**
   - Agregar entrada nueva al inicio de `src/content/changelog/v8/chunks/0.ts` documentando el parche de sincronización.

## Resultado esperado

Después del cambio:

```text
COT-2026-0007 → En operación
Portal / listado → mostrará el badge de En operación
Detalle de cotización → conservará el acceso al embarque ELGEN00054
Nuevas cotizaciones aceptadas → pasarán automáticamente a En operación al generar/vincular embarque
```