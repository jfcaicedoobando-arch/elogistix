# Arreglar el borrado de borradores de embarque sin expediente

## Qué pasó

El embarque que intentaste borrar está en Borrador y todavía no tiene número de expediente asignado. El proceso de borrado, antes de hacer cualquier cosa, busca el número de expediente y, si no lo encuentra, responde "Embarque no encontrado" y se detiene.

Es como si el archivero se negara a tirar una carpeta porque todavía no le pusieron etiqueta: la carpeta existe, pero el candado la confunde con una carpeta inexistente.

Verificado en la base: este embarque existe, está en Borrador, sin facturas, sin cuentas por pagar, sin proformas y sin comisiones. Nada financiero lo bloquea; el único obstáculo es la etiqueta vacía.

## Qué se va a corregir

- El borrado dejará de usar el número de expediente para decidir si el embarque existe: usará el propio registro. Así cualquier borrador recién creado se puede eliminar.
- Cuando no haya expediente, los mensajes y la bitácora mostrarán una etiqueta legible (por ejemplo "Borrador" con los últimos dígitos del identificador) en lugar de quedar en blanco.
- Todo lo demás queda igual: siguen bloqueados los embarques cerrados, cancelados o con facturas, pagos, notas de crédito, proformas vivas o comisiones definitivas.

## Detalles técnicos

- Migración sobre `public.eliminar_embarque_completo(uuid)`:
  - Cambiar `SELECT ... INTO v_expediente ...; IF v_expediente IS NULL THEN RAISE 'Embarque no encontrado'` por detección con `IF NOT FOUND` (o `SELECT id INTO`), conservando el resto del cuerpo sin cambios.
  - Definir `v_label := COALESCE(NULLIF(v_expediente,''), 'Borrador ' || right(p_embarque_id::text, 6))` y usarlo en el `RAISE ... LC_EMBARQUE_BLOQUEADO`, en el JSON de motivos (`expediente`) y en `bitacora_actividad.entidad_nombre`.
  - Conservar el guard de rol/tenant y reafirmar privilegios H6 al final: `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE` exactamente a los roles actuales.
- Actualizar el espejo canónico en `supabase/schema/` de esa función 1:1 con la migración.
- Cobertura SQL enfocada en `supabase/tests/` (registrada en `_guards_manifest.txt`): un embarque Borrador sin expediente se elimina (queda `deleted_at`), y uno con factura viva sigue devolviendo `LC_EMBARQUE_BLOQUEADO`.
- Sin cambios de UI: el diálogo actual ya maneja bien el resultado. Bump de versión + entrada en `CHANGELOG.md` + `db:release-manifest:update`.
- Validación local focalizada: `audit:manifest`, `audit:replay-mirror` y la prueba SQL nueva. CI/RLS completos quedan a GitHub Actions.
