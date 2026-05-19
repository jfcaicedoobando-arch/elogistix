## Problema

Al hacer clic en eliminar un documento adjunto en el tab "Documentos" del detalle de embarque, además del archivo desaparece la fila completa del checklist, lo que impide volver a subir ese mismo tipo de documento desde el listado.

## Causa

`deleteDocumentoEmbarque` (en `src/services/embarque/documentos.ts`) ejecuta un soft-delete sobre `documentos_embarque` vía `soft_delete_record`. La RPC `get_embarque_full` filtra filas con `deleted_at`, por lo que la fila del checklist desaparece tras eliminar el archivo.

La intención al pulsar el ícono de basurero en `PortalEmbarqueDocumentos` / `EmbarqueDocumentosTab` es desadjuntar el archivo (regresar el slot a estado "Pendiente"), no eliminar el requisito documental.

## Cambio

Modificar `deleteDocumentoEmbarque(docId, archivoPath?)` en `src/services/embarque/documentos.ts` para que:

1. Haga `UPDATE documentos_embarque SET archivo = NULL, estado = 'Pendiente' WHERE id = docId` (con `.select('id')` para detectar 0 filas afectadas igual que el upload).
2. Si se recibe `archivoPath`, intente borrar el blob de storage (`deleteFile(archivoPath)`) y trague el error (log silencioso) para no bloquear la limpieza de la fila si el objeto ya no existe.
3. No invoque `soft_delete_record`: la fila del checklist debe permanecer visible para permitir un nuevo upload.

No se modifica la firma del servicio ni los hooks consumidores (`useEmbarqueDocumentosActions`, `useDeleteDocumentoEmbarque`); la invalidación de queries existente refrescará la lista mostrando el slot en estado "Pendiente".

## Verificación

- Subir un documento, eliminarlo y confirmar que la fila sigue en la tabla con estado "Pendiente" y botón "Adjuntar" disponible.
- Confirmar que el archivo previo deja de existir en storage (probar descargando — debe fallar) o queda huérfano si la limpieza falla, pero la UI sigue funcional.
- Verificar que la bitácora sigue registrando `eliminar_documento`.

## Changelog

Agregar entrada `8.227.0` (patch) en `src/content/changelog/v8/chunks/0.ts` con fecha 19/05/2026: "Fix: eliminar un documento adjunto del embarque ya no borra el renglón del checklist; el slot queda en Pendiente y permite volver a subir el archivo".