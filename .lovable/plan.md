## Diagnóstico

Este error **no es un bug de código** — es una respuesta del SAT vía FacturAPI. El texto viene tal cual de ellos:

> "Esta factura está marcada como no cancelable por el SAT. Es posible que tengas que cancelar las facturas relacionadas antes."

**Analogía:** Es como querer romper un contrato que ya tiene addendas firmadas encima. El SAT no te deja cancelar la factura vieja mientras existan otros documentos fiscales colgados de ella.

## Posibles causas (en orden de probabilidad)

1. **Complementos de pago (REP) vinculados a la factura vieja.** Si la vieja tenía método `PPD` y alguien ya timbró un complemento de pago contra ella, primero hay que cancelar el complemento.
2. **Notas de crédito timbradas** que referencian la vieja. Cancelarlas primero.
3. **La factura nueva sustitutiva aún no está registrada en el SAT** (rezago de minutos/horas). A veces el SAT tarda en propagar la relación `04` y rechaza la cancelación temporalmente.
4. **Aceptación del receptor pendiente.** Si el total > $1,000 MXN y el receptor tiene RFC, el SAT requiere que el cliente **acepte** la cancelación desde su Buzón Tributario. Mientras no acepte, sale como "no cancelable".

## Qué necesito verificar antes de proponer código

Voy a leer en la base:

1. `facturas` relacionadas a `dc1e0162-ae7a-474b-abed-3b6301a86add`: si tiene pagos_factura con complemento timbrado, o notas de crédito.
2. `factura_notas_credito` y `pagos_factura` (con `complemento_facturapi_id`) que apunten a esa factura.
3. Estado actual de la factura vieja y de la nueva sustitutiva.

## Acción propuesta

**Paso 1 — Investigación (sin cambios de código):** Consultar la BD para confirmar cuál de las 4 causas está bloqueando la cancelación.

**Paso 2 — Según hallazgo:**

- Si hay complementos/notas → guiarte para cancelarlos primero desde la UI.
- Si es aceptación pendiente → toca esperar a que el cliente acepte en su Buzón. Podemos mejorar el mensaje en `facturapi.ts` para explicarlo claramente (hoy solo repite el texto crudo del SAT).
- Si es rezago SAT → reintentar en 30 min. También podemos mejorar el mensaje.

**Paso 3 (opcional, si aplica):** Enriquecer el manejador de error en `supabase/functions/facturapi-cancelar/` para detectar el patrón "no cancelable" y sugerir en el toast qué revisar (complementos, notas de crédito, aceptación del receptor).

## Pregunta para ti

¿La factura vieja ya tenía complementos de pago timbrados o notas de crédito antes de que intentaras sustituirla? Si sabes la respuesta, me ahorras el paso 1. Si no, en cuanto apruebes este plan hago la consulta a la BD. No tenia ni REP ni NC