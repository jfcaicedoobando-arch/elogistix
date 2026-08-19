# REP de factura en USD pagada en pesos: tipo de cambio del documento relacionado

## Qué está pasando (confirmado)

El SAT rechazó el REP del pago de la factura F1034. El motivo real que devolvió el PAC (guardado en el pago `ab90d96b-…`, campo `rep_error`, y en la bitácora `facturapi_rep_emitir_failed` del 19/08 17:21) es:

> "El tipo de cambio debe ser menor o igual a 1 cuando el pago está en MXN y el documento relacionado en USD."
> `code: exchange_rate_too_large`, `path: complements.0.data.0.related_documents.0.exchange`

Datos del pago: monto 23,141.03 MXN, `tipo_cambio` 17.06, aplicado a la factura 1,356.45 USD.

Causa: en el complemento de pago, el tipo de cambio del **documento relacionado** (`TipoCambioDR`) debe expresar cuántas unidades de la moneda del documento equivale **una** unidad de la moneda del pago. Aquí: 1 peso = 0.058617 USD (es decir 1/17.06). El código envía directamente el tipo de cambio de la factura (17.06, pesos por dólar), que es la convención inversa, y el PAC lo rechaza.

Analogía: el SAT pregunta "¿cuántos dólares vale un peso?" y le estamos contestando "17.06" (que es cuántos pesos vale un dólar). La respuesta es correcta en magnitud, pero al revés.

Nota: el tipo de cambio del **pago** (`TipoCambioP`, `complements.0.data.0.exchange`) sí va en pesos por divisa y hoy está bien; sólo se envía cuando el pago no es en MXN, que no es este caso.

## Cambios propuestos

1. **Calcular el tipo de cambio del documento relacionado como factor de conversión pago → documento** en `supabase/functions/facturapi-emitir-rep/helpers.ts`:
   - factor = (pesos por unidad de la moneda del pago) / (pesos por unidad de la moneda del documento).
   - Pago MXN y factura USD → 1 / 17.06 = 0.0586170 (≤ 1, lo que exige el PAC).
   - Pago USD y factura MXN → 17.06.
   - Se redondea a 10 decimales (máximo que acepta el SAT) y se omite si no hay dato válido.
2. **Validación previa clara**: si la factura está en divisa y el pago en otra moneda sin tipo de cambio válido (> 0), el pre-flight devuelve un mensaje en español pidiendo capturar el tipo de cambio, en vez de dejar que el PAC responda un error técnico.
3. **Pruebas** en `helpers_test.ts`: pago MXN + factura USD produce `exchange` menor a 1 y coherente (monto × exchange ≈ importe pagado); pago USD + factura MXN mantiene 17.06; misma moneda sigue sin enviar `exchange`.
4. **Reintento del pago afectado**: tras desplegar, timbrar de nuevo el REP de F1034 desde la pantalla del pago. El estado `Error` se limpia solo al reintentar; no hace falta migración ni tocar datos.
5. Registro en `CHANGELOG.md` y `APP_VERSION` a **13.684.1**.

## Detalles técnicos

- Sólo cambia la construcción del payload (`buildRepPayload` / validaciones) de la edge function `facturapi-emitir-rep`; nada de esquema, RLS ni migraciones.
- El contexto (`index.ts`) sigue entregando `documento_relacionado.n` con la convención canónica pesos-por-divisa acordada en 13.684.0; la inversión se hace sólo al armar el CFDI, que es donde la exige el SAT.
- La misma revisión se aplica al cálculo de `last_balance` / `amount`, que ya vienen en la moneda del documento y no cambian.

## Alcance

No se toca el flujo de facturas normales ni la cancelación de REP; el ajuste es exclusivo del campo de tipo de cambio del documento relacionado en el complemento de pago.
