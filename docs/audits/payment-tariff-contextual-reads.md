# Lecturas contextuales de pagos y tarifa de embarque

## Contrato

- `eliminarPagoFactura` limita el precheck REP a pagos con `deleted_at IS NULL`. Un tombstone con UUID fiscal retenido llega a `eliminar_pago_cliente`; sólo la RPC determina su resultado idempotente. Un pago vivo con REP vigente sigue bloqueado. Ausencia o error de lectura de PostgREST no producen un éxito local ni sustituyen el error autoritativo de la RPC.
- `obtenerEmbarqueTarifaInfo` comparte el contrato R221 del detalle: sólo un embarque vivo permite consultar los campos internos. Eliminado o ausente devuelve `null`.
- Los IDs de tarifa, decisión, fecha y JSON son históricos. No se consulta el catálogo vigente ni se reconstruye el snapshot. Se preservan cero, listas vacías y `null`; un interno no disponible sigue siendo `null`.
- Se conservan los guards de cambio de usuario/organización en ambas lecturas de tarifa. No cambia la RPC, los cálculos, los permisos ni los históricos fiscales.

## Pruebas

Las regresiones usan mocks que aplican los filtros y la proyección SELECT, sin base de datos real. Los tests de tarifa usan el guard real de ámbito de autenticación, con promesas controladas durante la consulta del padre y la interna.

```sh
bun run test -- src/features/facturacion/services/pagos/__tests__/eliminarPago.softDelete.test.ts src/features/embarques/services/__tests__/tarifaInfo.softDelete.test.ts src/features/facturacion/services/pagos/__tests__/pagos.test.ts src/features/facturacion/services/pagos/__tests__/pagosFactura.test.ts src/lib/auth/__tests__/authOperationScope.test.ts
bun run audit:soft-delete
```

La prueba de carrera simula `LC_PAGO_CON_REP_VIVO` devuelto por la RPC tras un precheck permitido; no certifica concurrencia PostgreSQL. La corrección no requiere migración ni ejecución SQL.

## Baseline

Se retiran exclusivamente estas dos claves, una vez verificada la regresión:

- `src/features/facturacion/services/pagos/eliminarPago.ts::pagos_factura`
- `src/features/embarques/services/tarifaInfo.ts::embarques`

Aplicar la reducción sobre el conjunto vigente al integrar; no reemplazar un baseline más reciente por una copia anterior ni reintroducir retiros de otros cambios.
