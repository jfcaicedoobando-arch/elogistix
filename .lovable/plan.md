# Cerrar la venta más rápido (sin campo de pago en la cotización)

## Por qué no agregamos el campo de pago

Un pago no pertenece a la cotización. La cotización es la oferta; el dinero se registra contra la factura (o como anticipo del cliente) y ahí ya tiene su lugar, su moneda, su tipo de cambio y su tratamiento fiscal. Duplicarlo en la cotización crearía dos verdades sobre el mismo dinero y un dato editable que no debería serlo.

Además, cerrar la venta ya no depende del pago: **aceptar la cotización ya cierra la oportunidad como Ganada de forma automática**, con su fecha de cierre, su valor real y marcándola como la cotización ganadora. Eso ya funciona hoy.

## Lo que sí frena el cierre hoy

Al pulsar **Aceptar**, el sistema puede rechazar la operación cuando la cotización y la oportunidad están en monedas distintas (por ejemplo la cotización en USD y la oportunidad en MXN). El mensaje aparece como un error y el vendedor tiene que salir a CRM, cambiar la moneda de la oportunidad a mano y volver. Ese ida y vuelta es la fricción real.

También falta claridad: el botón "Aceptar" no dice en ningún lado que además va a cerrar la oportunidad como Ganada, así que la gente lo pospone o hace el cierre dos veces (una en cotizaciones y otra en CRM).

## Qué haremos

1. **Aviso antes de aceptar.** Al pulsar "Aceptar" se muestra una confirmación corta que dice qué va a pasar: la cotización queda aceptada y la oportunidad se cierra como Ganada con el monto de la cotización y la fecha de hoy.
2. **Desbloquear el choque de monedas.** Cuando la oportunidad esté en otra moneda que la cotización, en lugar de un error seco, la confirmación lo explica en español claro y ofrece un botón para alinear la moneda de la oportunidad a la de la cotización y continuar en el mismo paso.
3. **Confirmación de resultado.** Al terminar, el aviso de éxito indica que la oportunidad quedó Ganada, con un enlace directo a ella.

Nada de campos nuevos, tablas nuevas ni cambios en pagos, facturas o anticipos.

## Detalles técnicos

- UI: `CotizacionDetalleAccionesBotones.tsx` (el botón "Aceptar") pasa por un `AlertDialog` de confirmación; el flujo vive en `useCotizacionDetalleHandlers.ts`.
- La regla de cierre no se toca: sigue siendo el trigger `crm_cerrar_oportunidad_desde_cotizacion`, que ya fija `etapa` ganada, `fecha_cierre_real`, `valor_real` y `cotizacion_ganadora_id`.
- Alineación de moneda: se lee `crm_oportunidades.moneda` antes de aceptar; si difiere de `cotizaciones.moneda`, la acción opcional hace un `update` de la moneda de la oportunidad (respetando RLS y soft-delete) y luego reintenta el cambio de estado. Si el usuario no acepta alinear, no se cambia nada.
- El código `LC_MONEDA_INCOMPATIBLE` que devuelve la base se mantiene como red de seguridad y se sigue traduciendo a un mensaje amable en `lcCodeMessages.ts`; deja de reportarse a Sentry como bug al quedar clasificado como regla de negocio esperada.
- Sin migraciones ni RPCs nuevos.
- Pruebas focalizadas: confirmación mostrada, aceptación con misma moneda, aceptación con moneda distinta alineando, y cancelación sin efectos. CI/RLS completos quedan para GitHub Actions.
- Cierre: bump de `APP_VERSION` + entrada en `CHANGELOG.md`.
