# Operador del embarque en el buzón de facturas

## Qué se ve hoy

Cada fila del buzón (`/compras/buzon`) muestra: antigüedad, proveedor, expediente, folio, fecha, archivo e importe. No dice quién es el operador dueño del embarque, así que contabilidad no sabe a quién preguntarle cuando falta un dato.

## Qué se agrega

- En la línea de datos secundarios de cada fila, después del expediente:
  `ELIMP00295 · Op. Valeria Zamora · Folio ... · Emitida ...`
- El nombre se deriva del correo del operador del embarque (`valeria.zamora@…` → "Valeria Zamora") con el formateador que ya usa el resto de la app; el correo completo queda en el tooltip.
- Si el embarque no tiene operador asignado, se muestra "Op. sin asignar" en gris.
- La búsqueda del buzón también encuentra por operador (nombre o correo), igual que hoy encuentra por proveedor o expediente.

No se cambia la lógica de captura, aprobación ni permisos: es sólo información visible.

## Detalles técnicos

- `SELECT_COLS_ENTRANTES` (`src/features/cxp/services/facturasEntrantes.types.ts`): el join pasa de `embarques:embarque_id(expediente)` a `embarques:embarque_id(expediente, operador)`; `FacturaEntranteRow.embarques` incorpora `operador: string | null`.
- `FilaBuzon` en `src/lib/domain/facturasEntrantesBuzon.ts` agrega el mismo campo y `coincideBusquedaEntrante` incluye `embarques.operador` (correo crudo y nombre derivado) en el texto buscable.
- `MetaEntrante` (`src/features/bandejas/components/FacturaEntranteRow.parts.tsx`) renderiza el chip de operador con `nombreDesdeEmail` de `@/lib/formatters/text` y `Tooltip` con el correo completo.
- Tests: caso de búsqueda por operador en `src/lib/domain/__tests__/facturasEntrantesBuzon.test.ts`.
- `CHANGELOG.md` + `APP_VERSION` → 13.619.0.
