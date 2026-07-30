# Reordenar: expediente documental antes que contenedores

En el checklist de cierre, el expediente documental debe verse antes de la operación de contenedores (descarga y devolución), porque los documentos del expediente se completan antes.

## Nuevo orden de fases

1. Expediente documental
2. Operación (peso/volumen, fechas de descarga y devolución)
3. Costos y facturas de proveedor
4. Facturación al cliente
5. Cobranza y pagos
6. Rentabilidad y comisiones
7. Otros (reglas nuevas sin clasificar)

Nada más cambia: mismos textos, badges de responsable, contadores `ok/total` por fase, enlaces de drilldown y modo informativo para embarques cerrados.

## Detalle técnico

- `src/features/embarques/utils/cierreCheckFases.ts`: intercambiar los `numero` y el orden del arreglo `FASES_CIERRE` para que `documentos` sea 1 y `operacion` 2.
- `src/features/embarques/utils/__tests__/cierreCheckOrden.test.ts`: actualizar la expectativa de orden de fases.
- `CHANGELOG.md` + bump de `APP_VERSION` a `13.361.1`.
