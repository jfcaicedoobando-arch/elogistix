# Exigir proveedor para enviar al buzón

Hoy el botón "Enviar al buzón" del modal *Subir factura de proveedor al buzón* se habilita en cuanto hay un PDF (o XML) válido, incluso si nadie eligió proveedor: el proveedor viaja como opcional (`proveedorId: form.proveedor?.id ?? null`). Eso deja documentos en el buzón sin dueño, y contabilidad tiene que adivinar.

## Cambio propuesto

1. El botón "Enviar al buzón" queda deshabilitado mientras no haya proveedor seleccionado (además de las validaciones actuales de archivos).
2. La sección "Proveedor" se marca como obligatoria: el label lleva asterisco y, cuando no hay selección, se muestra una ayuda breve en gris ("Elige el proveedor para poder enviar el documento al buzón").
3. Si el XML del CFDI detecta al proveedor por RFC, se sigue prellenando automáticamente como hoy, así que el caso normal no pide un clic extra.
4. Al limpiar el formulario (cerrar el modal) el proveedor se sigue reseteando, por lo que el botón vuelve a quedar deshabilitado.

No se cambia la base de datos ni el servicio de subida: el proveedor ya se guarda cuando existe; sólo dejamos de permitir enviarlo vacío desde esta pantalla.

## Detalles técnicos

- `src/features/cxp/hooks/useSubirEntranteForm.ts`: agregar `proveedor` a la condición de `listo`.
- `src/features/embarques/components/entrantes/SeccionProveedorEntrante.tsx`: indicar obligatoriedad en el label y texto de ayuda cuando `seleccionado` es `null`.
- `src/features/embarques/components/SubirFacturaEntranteDialog.tsx`: sin cambios de lógica (ya usa `form.listo`); sólo se verifica el estado del botón.
- Tests: caso nuevo en los tests del hook (`listo === false` sin proveedor, `true` al seleccionarlo).
- `CHANGELOG.md` + bump de `APP_VERSION`.
