# Tipo de cambio del traspaso: capturarlo "pesos por dólar"

Tienes razón. En el modal **Traspaso entre cuentas propias** el tipo de cambio se pide como un multiplicador de la cuenta origen a la cuenta destino: si traspasas de MXN a USD, hoy hay que capturar `0.0543` en lugar de `18.42`. En el resto de la app (facturas de proveedor, anticipos, pagos) el campo ya se llama "Tipo de cambio a MXN" y sí se captura a la mexicana, así que este modal es el único fuera de norma.

La propuesta es cambiar solo la forma de capturarlo y mostrarlo; el cálculo y lo que se guarda en la base no cambian.

## Cómo quedaría

- El campo se etiqueta según el par de cuentas, siempre con la divisa fuerte como base:
  - MXN ↔ USD: "Tipo de cambio (MXN por 1 USD)", ejemplo `18.4200`
  - MXN ↔ EUR: "Tipo de cambio (MXN por 1 EUR)"
  - USD ↔ EUR: "Tipo de cambio (USD por 1 EUR)"
- La dirección del traspaso (de MXN a USD o de USD a MXN) ya no cambia la cifra que se captura: siempre se teclea el número grande, como lo dice el banco.
- La sugerencia automática del TC DOF se presenta en esa misma convención.
- El texto de ayuda pasa a explicar la conversión real, por ejemplo: "1 USD = 18.4200 MXN. Traspasas 10,000.00 MXN y se abonan 542.86 USD". Se elimina la nota de "si tu referencia viene al revés, divídela".
- Validaciones iguales: obligatorio cuando las monedas difieren, debe ser mayor a cero, y el importe estimado de destino sigue mostrándose antes de guardar.

## Detalles técnicos

- `useTraspasoForm.ts`: el estado guarda la cotización en convención "quote por 1 base" (`tcQuote`). Se agrega un ranking de divisas (EUR > USD > MXN) para elegir base/quote del par y una función que deriva el multiplicador origen→destino: si origen es la base, multiplicador = `tcQuote`; si no, `1 / tcQuote`. `montoDestino` usa ese multiplicador derivado, con el mismo `roundMoney` para seguir coincidiendo centavo a centavo con la RPC.
- `sugerirTc` se ajusta para devolver la cotización en la convención base→quote (en lugar de origen→destino).
- `DialogTraspasoCuentas.tsx`: etiqueta dinámica, `placeholder` acorde al par, y textos de ayuda reescritos. `tipoCambioFinal` que se envía a `registrarTraspaso` sigue siendo el multiplicador origen→destino, por lo que la RPC y `bbva_movimientos` no cambian.
- Tests: se agrega cobertura de `useTraspasoForm` para los dos sentidos (MXN→USD y USD→MXN) verificando que la misma cifra capturada produce importes de destino correctos, más la inversión del sugerido DOF.
- Sin migración de base de datos. Se registra en `CHANGELOG.md` y se sube `APP_VERSION`.
