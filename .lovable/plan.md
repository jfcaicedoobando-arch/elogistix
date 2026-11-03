# COT-P-2026-0008: error «Error al actualizar estado»

## Qué pasó (confirmado en la base)
- Yvonne intentó marcar como Aceptada la cotización COT-P-2026-0008 (Maquilas SG). La cotización sigue en **Enviada**: no se aceptó.
- Su oportunidad ya está en la etapa **«Cerrado ganado»** y no tiene cotización ganadora registrada. El sistema sólo acepta cotizaciones de prospecto cuando la oportunidad sigue **abierta**, así que bloqueó la aceptación. La regla funcionó bien.
- El problema es el mensaje: dice «ya está aceptada… avisa a soporte», y eso es falso. La confunde y la manda a soporte sin necesidad.

Analogía: es como querer entregar un pedido cuando el ticket ya está marcado como «entregado». El cajero lo rechaza bien, pero en la pantalla sale «pedido entregado, llame al gerente».

## Cambios propuestos
1. **Corregir el mensaje** del código `LC_COTIZACION_ACEPTACION_INCONSISTENTE` (`src/lib/errors/lcCodeMessages.crm.ts`). Nuevo texto: «No se pudo aceptar: la oportunidad de esta cotización ya está cerrada o tiene otra cotización ganadora. Reabre la oportunidad en CRM y vuelve a intentar.»
2. No va a Sentry: es una regla de negocio y no una falla.
3. Actualizar o agregar una prueba que revise el mensaje del código y que no llegue a Sentry.

## Para destrabar a Yvonne hoy (lo hace el usuario, sin cambiar código)
- En CRM, mover la oportunidad de Maquilas SG de «Cerrado ganado» a una etapa abierta y luego aceptar la cotización. Así el sistema la cierra como ganada con su cotización ganadora.

## Fuera de alcance
- No se relaja la regla de aceptación, no se cambian datos ni se hacen migraciones. No se cambia la versión ni el changelog.
