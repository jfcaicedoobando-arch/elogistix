# Marcar como facturados los conceptos de venta del ELIMP00205

## Situación verificada

El expediente **ELIMP00205** (estado "Por liquidar") tiene 3 conceptos de venta, todos en "pendiente":

| Concepto | Importe |
|---|---|
| Cargos en Origen | 165 USD |
| Flete Marítimo | 3,610 USD |
| Cargos en Destino | 125 USD |

Total: 3,900 USD. En el sistema no hay ninguna factura al cliente ni proforma ligada a este expediente, y no hay comisiones generadas — consistente con que la factura se emitió en el sistema anterior.

## Qué se va a hacer

Cambiar el estado de facturación de esos 3 conceptos de "pendiente" a "facturado", nada más. Es un ajuste puntual de datos por identificadores explícitos, dentro de la misma empresa y en una sola operación.

## Qué NO cambia

- No se crea ninguna factura ni proforma en el sistema (la fiscal vive en el sistema anterior).
- No se toca importes, monedas, IVA, costos ni el estado del expediente.
- No se generan comisiones ni movimientos de cobranza.
- No hay cambios de esquema, código ni nuevas herramientas reutilizables.

## Efecto para el usuario

Los tres conceptos dejan de aparecer como pendientes de facturar, y la validación de cierre del expediente deja de bloquearse por "conceptos de venta sin facturar". El cierre seguirá exigiendo lo demás (costos de proveedor pagados, etc.).

## Nota importante

Como no existe factura del sistema para este expediente, en los reportes de cobranza no aparecerá cuenta por cobrar. Si tu equipo necesita que ese ingreso figure en cartera dentro de LibreCarga, habría que capturar la factura histórica; dime si lo quieres y lo planteo aparte.

## Detalle técnico

- `UPDATE public.conceptos_venta SET estado_facturacion = 'facturado'` acotado a los 3 `id` verificados, `embarque_id = 20890ffb-7045-4e08-b158-9e59360e1672`, `organization_id` de la empresa y `deleted_at IS NULL`, con `estado_facturacion = 'pendiente'` como guarda de idempotencia.
- Se ejecuta con la herramienta de datos (no migración): no hay cambio de estructura.
- Los triggers de bloqueo por cierre y de concepto proformado no aplican (expediente abierto, `proforma_id` nulo).
- Verificación posterior: recuento por `estado_facturacion` del expediente y la regla `venta_conceptos_facturados` de la validación de cierre.
- Cierre: bump de `APP_VERSION` + entrada en `CHANGELOG.md`. Sin CI/RLS/Vitest/E2E locales.
