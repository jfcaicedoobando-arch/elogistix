# Roadmap

## En curso — lote financiero D1–D6 (sobre v13.823.381)
- [ ] D1 — P&L: convertir notas de crédito a moneda de la factura antes de restar (cliente y proveedor) en `pnl_financiero_embarque`.
- [ ] D2 — CxC: RPC atómica e idempotente para cobro individual (pago + movimiento espejo).
- [ ] D3 — Traspasos: rechazar fecha nula o futura (fecha de negocio America/Mexico_City) en `registrar_traspaso_bancario`.
- [ ] D4 — CxP pago individual: validar fecha (requerida, no futura, no anterior a emisión) en RPC y guard.
- [ ] D5 — CxP edición: RPC transaccional de actualización de pago + reemplazo del movimiento sistema.
- [ ] D6 — Proformas: hidratar facturas vinculadas (FK inversa + factura_id + secundaria) en detalle e historial.

## Pendiente
- [ ] UI/UX del modal "Traspaso entre cuentas propias": layout estable, tipo de cambio con 4 decimales, resumen legible del monto recibido.
