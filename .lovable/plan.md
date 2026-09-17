# Pulir tratamiento fiscal en filas de cotización

## Cambios
- Extraer una presentación fiscal pequeña y compartida para las filas MXN y USD.
- Mostrar `No objeto · SAT 01` cuando `tipo_iva` sea `no_objeto`, sin selector ni evento de cambio.
- Mostrar `Exento` cuando `tipo_iva` sea `exento`, también sin selector ni evento de cambio.
- Mantener el selector actual para gravado 16%, gravado 8%, tasa 0% y registros legacy.

## Pruebas focalizadas
- Cubrir MXN y USD para comprobar la etiqueta correcta y la ausencia del selector en tipos bloqueados.
- Verificar que ninguna interacción del indicador intente actualizar `tasa_iva_aplicada`.
- Ejecutar únicamente esas pruebas, además de revisión focalizada de tipos y estilo.

## Alcance
- No cambiar cálculos ni reglas fiscales.
- No aplicar migraciones, publicar ni modificar versión/changelog.
- Las suites completas y RLS quedan para GitHub Actions.
