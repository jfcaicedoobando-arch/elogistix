# Arreglar la vista previa del Buzón de facturas ("This page has been blocked by Chrome")

## Qué está pasando

La vista previa lateral descarga el archivo del almacenamiento y lo muestra en un `<iframe>` con una URL local `blob:`. Chrome bloquea el visor de PDF embebido cuando el blob no llega marcado explícitamente como `application/pdf` (el almacenamiento suele entregarlo como `application/octet-stream`): entonces Chrome lo trata como descarga dentro de un marco y muestra "This page has been blocked by Chrome" — exactamente lo del screenshot. El bloqueo es de renderizado, no de permisos: el archivo sí se descargó.

Analogía: es como meter un sobre sin remitente a la oficina de correos; el cartero no sabe qué es y lo devuelve sin abrirlo. Basta etiquetarlo bien.

## Cambios

1. **Etiquetar el PDF**: al generar la URL de vista previa, reconstruir el blob con `type: "application/pdf"` antes de `createObjectURL` (mismo criterio en la acción "Ver" que abre pestaña nueva).
2. **Visor más tolerante**: usar `<object type="application/pdf">` con contenido de respaldo dentro (mensaje + botones "Abrir en pestaña nueva" y "Descargar") para el caso en que la política del navegador/empresa siga bloqueando el visor incrustado.
3. **Detección de PDF por extensión real**: hoy cualquier archivo que no termine en `.xml` se asume PDF; validar `.pdf` y, si no lo es, mostrar el mensaje de descarga en lugar de intentar incrustarlo.
4. **Mensaje de error accionable**: cuando falle la descarga, mostrar el motivo breve y los botones de descarga en vez del texto genérico actual.
5. Aplicar el mismo etiquetado y respaldo en los otros visores incrustados (`DocumentPreviewDialog`, `DialogPreviewCfdiPdf`) para que el problema no reaparezca en Facturación.
6. Tests unitarios del generador de URL (tipo MIME correcto) y del visor (respaldo visible cuando no es PDF / hay error).
7. Registrar en `CHANGELOG.md` y subir `APP_VERSION`.

## Sobre los logs del navegador

No hacen falta para este arreglo: el mensaje del screenshot ya identifica el bloqueo. Si después del cambio algún usuario sigue sin ver la vista previa, sí serviría la consola de Chrome (pestaña Console y Network al abrir la vista previa) para distinguir entre política de empresa, extensión bloqueadora o error de descarga.

## Notas técnicas

- Archivos: `src/features/cxp/services/facturasEntrantes.ts` (`urlPreviaFacturaEntrante`, `abrirFacturaEntrante`), `src/features/bandejas/components/PreviaFacturaEntranteSheet.parts.tsx` (`PreviaVisor`), `PreviaFacturaEntranteSheet.tsx` (paso de callbacks de descarga).
- Sin cambios de base de datos, RLS ni de esquema.
