# Detalle de proveedor nivel QuickBooks / Odoo

## El hallazgo que reportas (confirmado con datos)

En el proveedor **HK LS LIMITED** hay:

- 142 conceptos de costo (lo presupuestado/cotizado)
- solo **67** de ellos están ligados a una factura del proveedor
- 35 facturas de proveedor capturadas y 6 pagos

La pestaña "Historial de operaciones" lee **únicamente** `conceptos_costo` (el presupuesto). No muestra folio de factura, ni si el concepto ya fue facturado, ni los pagos. Por eso ves gastos "que vienen de la cotización" sin conexión con las facturas reales. Es una vista de presupuesto disfrazada de historial.

Analogía: hoy la pantalla es la lista del súper (lo que planeabas gastar). Falta el ticket (factura) y el comprobante de la tarjeta (pago), y falta poder ponerlos uno al lado del otro.

## Idea central de la propuesta

Convertir el detalle de proveedor en un **expediente de cuenta** con tres capas siempre reconciliadas:

```text
Comprometido (conceptos_costo)  ->  Facturado (proveedor_facturas)  ->  Pagado (pagos_proveedor)
        142 partidas                      35 facturas                       6 pagos
              \__________ diferencia = "por facturar" __________/
                                    \____ diferencia = saldo ____/
```

## Lluvia de ideas priorizada

### Ola 1 — Cerrar el hueco que reportas (base)

1. **Nueva RPC `proveedor_estado_cuenta(p_proveedor_id, filtros)`** que devuelva por partida: expediente, concepto, moneda, monto comprometido, monto facturado, folio(s) de factura de proveedor, monto pagado, saldo y estado derivado (`Por facturar`, `Facturado parcial`, `Facturado`, `Pagado`).
2. **Historial de operaciones enriquecido**: columnas nuevas *Factura* (folio interno FP-XXXXXX, clickeable al detalle de la factura), *Facturado*, *Saldo* y chip de estado real. Filtro rápido "Solo por facturar".
3. **KPI de brecha**: tarjeta "Comprometido sin factura" con monto y conteo, y enlace directo al Buzón CxP / captura de factura precargada con ese proveedor y expediente.
4. **Detección de anomalías**: marcar partidas facturadas por encima del comprometido (>1%) y facturas del proveedor cuyas partidas no están ligadas a ningún concepto (huérfanas), reutilizando la lógica de conciliación que ya existe por embarque.

### Ola 2 — Estado de cuenta y antigüedad (lo que da QuickBooks)

5. **Pestaña "Estado de cuenta"**: movimientos cronológicos (factura, nota de crédito, anticipo, pago, traspaso) con saldo corrido por moneda, igual que el estado de cuenta de cliente.
6. **Aging del proveedor**: 5 cubetas (corriente, 1-30, 31-60, 61-90, 90+) reutilizando `cxp_aging_proveedores` filtrado a este proveedor.
7. **Saldos por moneda sin mezclar**: MXN / USD / EUR nativos + equivalente MXN con T/C del DOF y aviso cuando falta T/C (ya existe el patrón en el resumen actual).
8. **Exportación PDF/CSV** del estado de cuenta para conciliar con el proveedor por correo.

### Ola 3 — Operación diaria (lo que da Odoo)

9. **Pestaña "Facturas"** dentro del proveedor: listado propio con estado de aprobación, vencimiento, saldo y acciones (aprobar, programar pago, registrar pago) sin salir del expediente.
10. **Pestaña "Pagos"**: pagos y traspasos aplicados, con drill-down al movimiento bancario.
11. **Acciones rápidas en el encabezado**: Capturar factura, Registrar anticipo, Programar pago, Enviar estado de cuenta.
12. **Condiciones comerciales**: días de crédito, límite de crédito, moneda y forma de pago por defecto; alerta cuando el saldo excede el límite.
13. **Contactos múltiples** (cobranza, operaciones, fiscal) en lugar de un solo contacto.
14. **Documentos del proveedor**: CSF, contrato, tarifario, W-8/W-9 para extranjeros, con vigencia y alerta de vencimiento.
15. **Bitácora del proveedor**: quién lo creó/editó, cambios de datos bancarios (control anti-fraude), aprobaciones.

### Ola 4 — Inteligencia

16. **Scorecard ampliado**: puntualidad de facturación, desviación promedio presupuesto vs factura, ticket promedio, top conceptos y top rutas.
17. **Tendencia 12 meses** comprometido vs facturado vs pagado (hoy la gráfica solo trae facturado).
18. **Comparativo entre proveedores** del mismo tipo (naviera, transportista) por costo unitario del mismo concepto/ruta.
19. **Alertas proactivas**: proveedor con embarques cerrados sin factura, facturas por vencer, datos bancarios incompletos antes de pagar.

## Detalles técnicos

- Los datos ya existen: la relación es `conceptos_costo.id` -> `proveedor_facturas_conceptos.concepto_costo_id` -> `proveedor_facturas`. Nada nuevo que migrar para la Ola 1; solo una RPC de lectura `SECURITY DEFINER` con `REVOKE ALL ... FROM PUBLIC` + `GRANT` a `authenticated` (regla H6).
- Reutilizar `reconciliacionCostos.helpers` (ya clasifica comprometido vs facturado por embarque) elevándolo a nivel proveedor, en vez de duplicar matemática.
- Respetar Power of 10: nuevos componentes por pestaña (`ProveedorEstadoCuentaTab`, `ProveedorFacturasTab`, `ProveedorPagosTab`), cada uno <=200 líneas, sin `any`, paginación en servidor para el historial (hoy trae hasta 1000 filas de golpe).
- Formato mexicano, MXN base, DD/MM/YYYY; nada de IVA hardcodeado (usar `useTasaIVA` / `financialUtils`).
- Actualizar `CHANGELOG.md` y `APP_VERSION` al cerrar cada ola.

## Propuesta de arranque

Implementar la **Ola 1** completa (es la que corrige el bug que detectaste) y, si te convence el resultado, seguir con la Ola 2.
