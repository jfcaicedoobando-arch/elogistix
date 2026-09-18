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
- [x] Lote P2 de IVA: etiqueta "Tasa 0%" separada de Exento, ayuda por tratamiento en el catálogo, 8% de frontera bajo configuración explícita, aviso "Tratamiento fiscal por definir", rechazo de tasas negativas y desglose fiscal por línea del CFDI de proveedor (sólo lectura).
- [x] Lote P1 de auditoría IVA: notas de crédito conservan tratamiento y tasa por renglón (16/8/0/exento/no objeto), reversan retenciones ISR/IVA, el atajo de saldo completo prorratea tratamientos mixtos y bloquea los indeterminados; el REP rechaza cualquier mezcla de tratamientos.

- [x] Auditoría IVA (P1 4 puntos + P2 4 puntos): NC con reglas de coherencia unificadas frontend/servidor (tasas canónicas, tipo ausente o tasa contradictoria bloquean), renglón manual de NC nace sin tratamiento y se elige explícitamente, REP sin inferencias (falla cerrado y sólo acepta respaldo de encabezado con tasa exacta), guard de IVA de CxP considera el IEPS en la base gravable, "IVA total" en factura manual, columna IVA de proformas con tratamiento real o "Por confirmar", detalle de factura lee la tasa exacta del snapshot ignorando retenciones y 8% de frontera oculto sin habilitación.
