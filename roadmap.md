# Roadmap

## Cerrado — lote financiero D1–D6 (v13.823.382)
- [x] D1 — P&L: convertir notas de crédito a moneda de la factura antes de restar (cliente y proveedor) en `pnl_financiero_embarque`.
- [x] D2 — CxC: RPC atómica e idempotente para cobro individual (pago + movimiento espejo).
- [x] D3 — Traspasos: rechazar fecha nula o futura (fecha de negocio America/Mexico_City) en `registrar_traspaso_bancario`.
- [x] D4 — CxP pago individual: validar fecha (requerida, no futura, no anterior a emisión) en RPC y guard.
- [x] D5 — CxP edición: RPC transaccional de actualización de pago + reemplazo del movimiento sistema.
- [x] D6 — Proformas: hidratar facturas vinculadas (FK inversa + factura_id + secundaria) en detalle e historial.

## Pendiente
- [ ] UI/UX del modal "Traspaso entre cuentas propias": layout estable, tipo de cambio con 4 decimales, resumen legible del monto recibido.
- [x] Cotización: mostrar SAT 01 y Exento como tratamientos fiscales no editables en filas MXN/USD, con pruebas focalizadas.
- [x] Lote P1 de IVA: coherencia única `tipo_iva`/tasa en cotización, proforma→factura y emisión; bloqueo accionable en casos ambiguos; diagnóstico agregado de sólo lectura.
