# F1026: continuar la refacturación sin esperar la cancelación del REP

## Situación real (verificada en base de datos)

- F1026 (MXN 95,120.00, timbrada, estado "Pagada") tiene un pago de 95,120.00 MXN con REP timbrado `F4FC33D7-…` y solicitud de cancelación en estado `pending` ante el SAT.
- El caso de refacturación de F1026 está **abierto en el paso 2** y todavía **no tiene factura nueva** creada.
- (Aparte existe otro caso abierto en paso 4 para F1027 → F1034; no se toca en este plan.)

## Respuesta corta

Sí se puede adelantar **la factura** del cliente sustituto, pero **no su REP**.

- Emitir el CFDI de ingreso al nuevo receptor es un acto independiente de la cancelación del REP: se puede hacer hoy.
- El REP del nuevo receptor **no** puede timbrarse mientras el REP viejo siga vivo: sería el mismo depósito reportado dos veces al SAT (ingreso duplicado y riesgo de discrepancia en pagos). Ese paso sí debe esperar la aceptación (o el vencimiento de los 3 días hábiles, tras los cuales el SAT da la cancelación por aceptada si el receptor no responde).

## Cómo procede el contador ahora

1. Paso 3 del asistente: crear el borrador para el cliente sustituto y timbrarlo (queda como PPD, sin pago aplicado). El cliente ya tiene su factura.
2. Explicar al cliente sustituto que el REP se emite en cuanto el SAT libere la cancelación del REP anterior (misma semana, máximo 3 días hábiles).
3. Paso 4: cancelar el CFDI original F1026 (motivo 02, ruta ya elegida).
4. Cuando el REP viejo quede `accepted`: paso 5, reasignar el pago (capturando ordenante del depósito) y timbrar el nuevo REP.

## Cambio a implementar en el asistente

Hoy el bloqueo del REP vivo detiene el avance desde el paso 2, así que ni siquiera se puede llegar a crear la factura nueva. Se ajusta para que el candado sea proporcional al riesgo fiscal:

- `src/features/facturacion/domain/refacturacionPasos.ts`
  - Paso 2 con REP en `pending`/`verifying`: dejar de bloquear el avance; en su lugar devolver un **aviso** ("Cancelación del REP en verificación con el SAT — puedes emitir la factura del nuevo receptor; el REP se timbra al liberarse") mediante un nuevo campo `avisoPaso` separado de `bloqueoPaso`.
  - REP vivo **sin** solicitud de cancelación (`rep_cancellation_status` nulo): sigue bloqueando como hoy.
  - Paso 5 (reasignar pago): bloqueo duro reforzado mientras exista cualquier REP vivo no aceptado, con mensaje explícito de doble reporte al SAT.
- `src/features/facturacion/components/refacturacion/PasoCancelarRep.tsx`: mostrar el aviso en tono informativo (no error) y mantener el badge "Cancelación en verificación" con el botón de cancelar deshabilitado.
- Contenedor del asistente: pintar avisos con estilo informativo y bloqueos con estilo de error.
- Tests en `src/features/facturacion/domain/__tests__/refacturacionPasos.test.ts`: paso 2 avanzable con REP en verificación, paso 5 bloqueado en ese mismo escenario, paso 2 bloqueado si el REP vivo no tiene solicitud de cancelación.
- Sin cambios de base de datos: los candados `LC_REFACT_*` de la reasignación ya viven en la RPC y son la última línea de defensa.

## Notas técnicas

- No se altera `duplicar_factura_para_refacturacion`: el borrador ya nace sin `proforma_id` y con la trazabilidad en bitácora.
- Al cerrar: `CHANGELOG.md` + bump de `APP_VERSION`.
