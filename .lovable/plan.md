# Actualizar el subtotal al corregir conceptos detectados por IA

## Diagnóstico confirmado

En el modal **Capturar factura de proveedor**, los renglones detectados desde el PDF y el subtotal de la factura se guardan en estados separados. Al cambiar cantidad o importe, o al eliminar un renglón, se actualiza la tabla y su total visible, pero `values.subtotal` conserva el importe originalmente detectado por la IA. Por eso el encabezado y los pasos posteriores siguen mostrando el subtotal anterior.

## Corrección mínima

1. Cuando se edite o elimine un concepto proveniente de **PDF con IA**, recalcular el subtotal como `Σ importe unitario × cantidad` con el helper financiero ya existente.
2. Copiar ese resultado al campo Subtotal del formulario en el mismo cambio, para que el encabezado, el total, el cuadre, la vinculación y el guardado usen inmediatamente el mismo valor.
3. Mantener intactos los conceptos de XML CFDI, la captura manual, IVA/IEPS/retenciones, permisos y reglas de guardado. El usuario podrá seguir ajustando manualmente el subtotal después si lo necesita; sólo una nueva edición de conceptos volverá a sincronizarlo.
4. Agregar regresiones focalizadas para edición de importe/cantidad y eliminación de un renglón detectado por IA.
5. Actualizar patch, CHANGELOG y manifiesto de la versión. Ejecutar únicamente validaciones focalizadas; CI y RLS completos quedan para GitHub Actions.

## Alcance técnico

- Controlador del modal de nueva factura de proveedor.
- Pruebas focalizadas del flujo PDF con IA.
- Metadatos de versión.
- Sin SQL, migraciones, cambios de datos ni publicación.