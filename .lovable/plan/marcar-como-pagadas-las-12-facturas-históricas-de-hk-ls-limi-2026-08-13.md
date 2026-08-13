# Marcar como pagadas las 12 facturas históricas de HK LS LIMITED

## Contexto

Son las 12 facturas que el ERP muestra con saldo pero que HK LS LIMITED ya no reclama en
su estado de cuenta del 11/08. Vienen de versiones anteriores del ERP: el pago existió,
pero nunca se registró. No hay REP (proveedor extranjero) ni movimiento bancario que
conciliar.

Verificado en la base de datos: las 12 están **Vigentes**, **aprobadas** y en **USD**, con
tipo de cambio de la factura ya cargado, así que aceptan el registro del pago sin tocar
permisos ni aprobaciones.

| Folio proveedor | Folio interno | Expediente | Fecha emisión = fecha de pago | USD |
|---|---|---|---|---|
| NQDEC260443157 | FP-000025 | ELIMP00193 | 2026-05-15 | 7,024.00 |
| DEBIT260554957 | FP-000060 | ELIMP00195 | 2026-05-16 | 22,589.00 |
| DEBIT260556054 | FP-000069 | ELIMP00219 | 2026-05-22 | 15,900.00 |
| DEBIT260557045 | FP-000065 | ELIMP00207 | 2026-05-25 | 3,253.00 |
| DEBIT260662119 | FP-000062 | ELIMP00205 | 2026-06-01 | 3,453.00 |
| DEBIT260665365 | FP-000095 | ELIMP00210 | 2026-06-03 | 4,303.00 |
| DEBIT260671808 | FP-000070 | ELIMP00252 | 2026-06-09 | 4,448.00 |
| DEBIT260671822 | FP-000079 | ELIMP00242 | 2026-06-09 | 7,011.00 |
| DEBIT260676140 | FP-000048 | ELIMP00235 | 2026-06-15 | 4,703.00 |
| DEBIT260678802 | FP-000077 | ELIMP00281 | 2026-06-17 | 5,598.00 |
| DEBIT260679308 | FP-000061 | ELIMP00256 | 2026-06-18 | 5,903.00 |
| DEBIT260704298 | FP-000082 | ELIMP00245 | 2026-07-16 | 18,639.60 |
| **Total** | | | | **102,824.60** |

## Qué haré

Registrar un pago por el saldo completo de cada una de las 12 facturas, con estas
características:

- **Fecha de pago** = fecha de emisión de la factura (columna de la tabla).
- **Moneda** = USD, mismo importe del total, para que el saldo quede exactamente en cero.
- **Método de pago**: "Ajuste histórico" marcado como ajuste, **sin cuenta bancaria**, por
  lo que no genera ni requiere movimiento bancario ni conciliación.
- **Motivo / notas**: "Regularización de saldo — pago realizado en versión anterior del
  ERP. Confirmado contra estado de cuenta HK LS LIMITED del 11/08/2026." Queda como
  rastro de auditoría de por qué existe el pago.
- Sin REP ni CFDI: es proveedor extranjero, el ERP no emite complemento aquí.

Efectos automáticos que ya tiene el sistema y conviene saber:

- Cada factura pasará sola a estado **Pagada** y su saldo a 0.
- Después de esto, el saldo del proveedor en el ERP quedará en **301,743.40 USD** (los
  335,089.60 actuales menos estos 102,824.60), que corresponde a las 19 facturas que sí
  coinciden con el estado de cuenta (232,265.00) más las que aún faltan por capturar.
- Varios expedientes están en estado "Por liquidar"; al quedar sin saldo el ERP puede
  cerrarlos automáticamente si su checklist de documentos está completo. Si algún
  checklist está incompleto, el pago se guarda igual y el embarque simplemente no cierra.

## Detalles técnicos

- Se aplica como carga de datos (`pagos_proveedor`), no como cambio de estructura: 12
  filas, una por factura, con `es_ajuste = true`, `cuenta_bancaria_id` nulo y
  `organization_id` de Elogistix.
- El disparador `guard_pago_proveedor` calcula el importe en moneda de la factura y valida
  que no exceda el saldo; `tg_recalcular_estado_factura_proveedor` actualiza el estado.
- No se crean movimientos en `bbva_movimientos` ni registros de conciliación.
- Verificación posterior: consultar los 12 folios y confirmar estado "Pagada" y saldo 0,
  y el nuevo saldo total del proveedor.
- Sin cambios de código de la app; sólo se registra la nota en `CHANGELOG.md` con el
  ajuste de `APP_VERSION`.
