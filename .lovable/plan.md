# Fusionar ELIMP00293 en ELIMP00319 y eliminar el duplicado

Un operador capturó dos veces el mismo embarque (mismo BL house NSZEC260687701, mismo contenedor WHSU6564318, mismo cliente INDIMEX TRADING). Hoy la información real está partida en dos:

| | ELIMP00293 (duplicado) | ELIMP00319 (se queda) |
|---|---|---|
| Factura al cliente | ninguna | F982 vigente por 6,120 USD (la F973 quedó cancelada y sustituida) |
| Proforma | ninguna | PRO-2026-0971, ya facturada |
| Venta capturada | 6,100 USD (duplicada, nunca facturada) | 6,100 USD (la que sí se facturó) |
| Facturas de proveedor | FP-000147 HK LS 5,453 USD **pagada**, FP-000148 Wan Hai 179.80 USD vigente | ninguna |
| Archivos de proveedor recibidos | 2 | 0 |
| Costos | 5,453 pagado + 191.80 + ajuste −36.80 (ligados a factura) | 5,453 + 191.80 capturados a mano, sin factura |

## Qué se va a hacer

Todo es un arreglo puntual de datos, sin cambios en la aplicación ni funciones nuevas.

1. Pasar al 319 las dos facturas de proveedor del 293 y sus dos archivos recibidos. El pago de 5,453 USD viaja solo, porque cuelga de la factura del proveedor, no del embarque.
2. Pasar al 319 los tres costos del 293 (5,453 pagado, 191.80 y el ajuste de −36.80).
3. Eliminar de forma lógica los dos costos capturados a mano del 319 (5,453 y 191.80), que quedarían duplicados. Así el costo del expediente queda respaldado por su factura y su pago.
4. Eliminar de forma lógica la venta duplicada del 293 (6,100 USD). La venta del 319 no se toca: es la que respalda la factura F982.
5. Eliminar de forma lógica el embarque 293 con sus documentos, notas y eventos. Desaparece de listados y reportes, pero queda el rastro para auditoría.
6. Recalcular los totales del 319 y verificar el resultado antes y después.

## Resultado esperado en el 319

- Venta: 6,100 USD, facturada con F982.
- Costo: 5,608 USD (5,453 + 191.80 − 36.80), con las facturas FP-000147 y FP-000148 y el pago ya registrado.
- Utilidad y "pagados/pendientes" cuadrando con los documentos reales.
- Un solo expediente visible para ese BL.

## Verificaciones

Antes de mover: confirmar que el 293 no tiene comisiones devengadas, proformas, facturas al cliente ni garantías (ya verificado: no tiene), y que el pago del proveedor está atado sólo a la factura FP-000147.

Después de mover: volver a contar costos, ventas, facturas de proveedor y archivos por embarque; comprobar que el 319 muestra costo 5,608 USD y venta 6,100 USD, que el 293 ya no aparece y que la sección de compras sigue mostrando FP-000147 como pagada y FP-000148 como pendiente.

## Detalle técnico

- Cambios de datos con la herramienta de datos (no migración): `update` de `embarque_id` en `proveedor_facturas` (2 filas), `embarque_facturas_entrantes` (2 filas) y `conceptos_costo` (3 filas) del embarque `3aef0b7a…` al `fc07a199…`; `deleted_at` en los 2 `conceptos_costo` manuales del 319 (`f7f8759e…`, `edd7f60b…`), en los 2 `conceptos_venta` del 293, y en `embarques` 293 más sus `documentos_embarque`, `notas_embarque` y `eventos_embarque`.
- Cada `update` se acota por `id` explícito y `organization_id` de Elogistix, en una sola transacción.
- Si algún trigger de periodo cerrado o de candado financiero bloquea un movimiento, se reporta el bloqueo en lugar de forzarlo o de tocar reglas.
- Los archivos en almacenamiento no se mueven; el `archivo_path` histórico del 293 sólo aplica a documentos que se eliminan lógicamente, y los archivos de las facturas de proveedor conservan su ruta actual (la validación de acceso es por proveedor/organización, no por embarque).
- No se toca la facturación al cliente, ni enums, ni RLS, ni el esquema. No se ejecutan Vitest, RLS ni E2E localmente: quedan para GitHub Actions.
- Al cierre: bump de `APP_VERSION` y entrada en `CHANGELOG.md` documentando la fusión puntual.
