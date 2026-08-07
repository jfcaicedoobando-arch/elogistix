# Arranque de tesorería: fecha de corte y cobros al banco

## El problema

Hoy el saldo de una cuenta se calcula como: saldo inicial + todos los abonos − todos los cargos, **sin importar la fecha**. Y no existe una fecha que diga "este saldo inicial es al día X".

Consecuencias al empezar a usar el módulo de dinero:

- Si registras un pago viejo a proveedor eligiendo cuenta bancaria, el saldo de hoy **baja**, aunque ese dinero ya estaba descontado en el saldo con el que arrancaste.
- Si marcas facturas de cliente viejas como cobradas, el saldo **no sube** (los cobros no generan movimiento bancario hoy).

Analogía: es como una chequera donde anotas el saldo de hoy en la primera línea, pero luego sigues anotando cheques del año pasado abajo — la cuenta ya no cuadra.

## Qué se va a construir

### 1. Fecha de corte por cuenta bancaria

- Nuevo campo "Saldo inicial al día" en cada cuenta bancaria (obligatorio para cuentas nuevas, se rellena con la fecha de creación para las existentes).
- El saldo actual y el estado de cuenta **ignoran los movimientos anteriores a esa fecha**: ya vienen contenidos en el saldo inicial.
- En pantalla se aclara: "Saldo inicial al 01/08/2026" y, si existen movimientos previos, un aviso: "N movimientos anteriores al corte — no afectan el saldo".
- El estado de cuenta arranca en la fecha de corte cuando el periodo elegido empieza antes.

### 2. Aviso al registrar pagos con fecha previa al corte

En los modales de pago a proveedor, pago en lote y anticipo: si la fecha del pago es anterior a la fecha de corte de la cuenta elegida, se muestra una advertencia clara ("este pago es anterior al arranque de la cuenta, no afectará el saldo") y el movimiento se registra igual, quedando fuera del cálculo por la regla de corte. Así la historia queda documentada sin descuadrar el banco.

### 3. Cobros de clientes que sí mueven el banco

- El modal de registrar cobro de factura de venta gana un selector de cuenta bancaria (opcional) y, cuando se elige, genera el **abono** correspondiente, ya conciliado y ligado al cobro — simétrico a lo que ya hace el pago a proveedor.
- Si el cobro se deja sin cuenta, todo sigue como hoy (solo entra al banco al importar/conciliar).
- Al eliminar un cobro, su movimiento se da de baja lógica.
- Guarda contra duplicados: si el movimiento ya existe por conciliación, no se crea otro.

## Detalles técnicos

- Migración: `cuentas_bancarias.fecha_saldo_inicial date not null default current_date` + backfill con `created_at::date`; agregar `cuenta_bancaria_id` (nullable, FK) a `pagos_factura`.
- Actualizar la vista `v_saldos_cuentas_bancarias` y la RPC `estado_cuenta_bancario` para filtrar `fecha >= cuentas_bancarias.fecha_saldo_inicial` (y respetar `deleted_at`). Mismo filtro en `conciliacion_resumen` y `resumen.ts`.
- Nuevo servicio `cobroFacturaMovimiento.ts` en el módulo de facturación/CXC, espejo de `cxp/services/pagoProveedorMovimiento.ts` (abono en moneda de la cuenta, `hash_dedupe = cobro-<pagoId>`, `pago_factura_id`, soft-delete en eliminación).
- Reutilizar `etiquetaCuenta`, `TcPagoField` y las validaciones de moneda existentes en el nuevo selector de cuenta del cobro.
- Tests: dominio del corte de fecha (movimientos previos excluidos), servicio de abono de cobro (creación, moneda de cuenta, soft-delete), y actualización de los tests de tesorería afectados.
- `CHANGELOG.md` + bump de `APP_VERSION`.
