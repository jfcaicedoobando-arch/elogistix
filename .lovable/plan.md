# Valor real de la oportunidad = valor de la cotización aceptada

## Qué pasa hoy
Cuando una cotización pasa a Aceptada, la oportunidad se mueve a "Ganada" y se le pone fecha de cierre, pero el **Valor real** no se llena: se queda en MXN 0 (como en tu captura). Sólo el "Valor estimado" se copia desde la cotización.

## Qué cambia
- Al quedar la oportunidad como Ganada por una cotización Aceptada (o En operación), el **Valor real** toma el importe de esa cotización (subtotal antes de IVA, igual que ya hace el Valor estimado) y su moneda.
- Si hay varias cotizaciones aceptadas en la misma oportunidad, se suman las que estén en la misma moneda de la oportunidad; si tienen monedas distintas, se usa la aceptada más reciente (no se mezclan pesos con dólares).
- Si la oportunidad vuelve a abierta (p. ej. la cotización se reabre), el Valor real se limpia, como ya ocurre hoy.
- Si alguien ya capturó manualmente un Valor real en una oportunidad ganada, no se pisa al volver a sincronizar sin cambio de etapa.

## Detalles técnicos
- Archivo: `src/features/crm/services/vincularCotizacion/sincronizarEtapa.ts`. Ampliar el `select` de cotizaciones a `estado, subtotal, moneda, updated_at` y, cuando `tipo === "ganada"` y hay transición real (no `yaCerradaEnMismoTipo`), poner `patch.valor_real` con una función pura nueva `calcularValorReal(cotizacionesAceptadas, monedaOportunidad)` en el mismo archivo o en `domain/`.
- Leer la `moneda` y `valor_real` actuales en `fetchCierreActual` para la regla de moneda y para no pisar captura manual.
- Sin migraciones ni cambios de permisos.
- Prueba unitaria en `__tests__/sincronizarEtapa.test.ts`: aceptada con subtotal 15,000 MXN → valor_real 15,000; dos aceptadas MXN → suma; volver a abierta → null.

## Pregunta abierta (opcional)
Las oportunidades que ya están ganadas con Valor real en 0 no se corrigen solas; si quieres, después puedo rellenarlas con el mismo criterio.
