## Diagnóstico

El toast verde no mintió: el pago **se guardó correctamente**. El problema es que la factura 862 está **duplicada en la base de datos**.

### Lo que encontré en Elogistix

Hay DOS registros distintos con `numero = '862'`, mismo expediente `ELIMP00113`, mismo embarque, mismo cliente, mismo total ($3,370 USD), pero originados por proformas diferentes:

| id (interno) | Creada | Proforma origen | Estado actual |
|---|---|---|---|
| `8970c16a…602e41` | 04/05/2026 | PRO-2026-0045 | **Pagada** ← aquí cayó el pago |
| `014bb9e4…d242fd` | 13/05/2026 | PRO-2026-0238 | Emitida (sin pago) ← lo que Karol ve |

El pago (`6ba92b56…`, $3,370 USD, transferencia, 06/07) se aplicó al registro del 04/05, así que quedó "Pagada"… pero la vista de facturas de Karol le muestra la del 13/05, que sigue "Emitida". Analogía: es como tener dos recibos con el mismo folio pegados uno atrás del otro — le abonaste al de abajo y el de arriba sigue "sin pagar".

Ninguna de las dos está timbrada (`facturapi_id` y `uuid_fiscal` vacíos en ambas) — son facturas legacy con folio externo capturado manualmente. Por eso el sistema nunca marcó el duplicado.

## Antes de arreglar necesito confirmación

No puedo decidir yo cuál conservar porque cada factura está ligada a una **proforma diferente**. Pregunto a Karol (o a ti):

1. **¿Cuál proforma es la "buena"?** PRO-2026-0045 (más vieja) o PRO-2026-0238 (más nueva). La factura de la proforma que se elimine se debe borrar (soft delete) y su proforma se regresará a `pendiente`.
2. **El pago de $3,370** de 06/07 se re-asignará a la factura que se conserve, quedando esa como **Pagada**.

## Plan de arreglo (una vez confirmada la proforma buena)

Migración SQL con transacción:

1. Marcar la factura duplicada como `deleted_at = now()`, `deleted_by = <user>` (soft delete respetando el patrón del proyecto).
2. Revertir su proforma a `estado_proforma = 'pendiente'`, limpiar `factura_id`, `fecha_facturacion` y `folio_factura_externa` (mismo patrón que ya usa `facturapi-cancelar`).
3. `UPDATE pagos_factura SET factura_id = <factura_conservada>` para el pago `6ba92b56…`.
4. Recalcular estado de la factura conservada: si `SUM(monto_aplicado_factura) >= total` → `estado = 'Pagada'`; si no → dejar como estaba.
5. Registrar en `bitacora_actividad` la reasignación con detalles del duplicado.

Bump `APP_VERSION` a `13.205.11` y entrada en `CHANGELOG.md` bajo "Datos · Elogistix" (fix puntual, no cambio de código).

## Fuera de alcance

- No se toca el flujo de registro de pagos ni la UI de facturación (la duplicación se generó al capturar dos veces el mismo folio externo desde dos proformas distintas; no es un bug reproducible del código actual).
- No se agrega restricción única `(organization_id, numero)` en `facturas` — se puede hacer aparte porque hay que auditar si existen más duplicados legítimos primero.

## Pregunta que necesito respondida

¿Cuál proforma es la real, **PRO-2026-0045** o **PRO-2026-0238**? (o si prefieres, dime "consérvame la que tiene el pago" y conservo `8970c16a` + su proforma `PRO-2026-0045`, y borro la del 13/05).
