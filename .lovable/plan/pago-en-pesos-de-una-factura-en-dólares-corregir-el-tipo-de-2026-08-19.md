# Pago en pesos de una factura en dólares: corregir el tipo de cambio

## Qué está pasando (confirmado con los datos reales)

Factura **F1034** (USD, total 1,356.45) recibió un pago en MXN de **23,141.03**.
En la base de datos ese pago quedó guardado así:

- `tipo_cambio = 0.0586` (dólares por peso)
- `monto_aplicado_factura = 394,873.91` (¡USD!)

Analogía: la pantalla anotó el tipo de cambio "al revés" (0.0586 en vez de 17.06). La base de datos, que espera "pesos por dólar", en lugar de dividir 23,141 ÷ 17.06 = 1,356 USD, dividió entre 0.0586 y obtuvo 394,873 USD. Por eso el timbrado del REP avisa que "el pago es mayor al saldo pendiente": el aviso es correcto, el dato de entrada es el equivocado.

Dos causas, ambas verificadas:

1. **Convención distinta entre pantalla y base de datos.** El diálogo de "Registrar pago" calcula `tipo_cambio` como razón pago→factura (0.0586) y el `monto_aplicado_factura` correcto (1,356.45). El trigger `trg_pagos_factura_monto_convertido` **sobrescribe** ese monto usando `convertir_monto_pago_a_factura`, que interpreta el tipo de cambio como pesos por dólar.
2. **Orden de triggers.** El candado de sobrepago (`tg_pagos_factura_no_sobrepago`) se ejecuta *antes* que el trigger de conversión (por orden alfabético del nombre), así que validó el monto bueno y luego el otro trigger lo dañó. El candado nunca vio el 394,873.

Alcance del daño: **un solo pago** en toda la base tiene esta inconsistencia (consultado: pagos con moneda distinta a su factura = 1, sospechoso = 1).

## Qué se va a hacer

### 1. Una sola convención de tipo de cambio (pesos por divisa)
- El diálogo de registrar pago (individual) enviará `tipo_cambio` = **pesos por unidad de divisa** (p. ej. 17.0627), no la razón invertida.
- El monto aplicado seguirá mostrándose en pantalla, pero el valor oficial lo calcula la base de datos (como ya lo hace hoy), de modo que pantalla y base de datos coincidan.
- Se documenta la convención en el servicio de pagos y en los helpers financieros.

### 2. El candado de sobrepago debe correr después de la conversión
- Se renombra/reordena el trigger de conversión para que se ejecute antes del candado de sobrepago (o el candado revalida el monto ya convertido), de forma que un pago con tipo de cambio mal capturado se rechace en el momento del alta, no en el timbrado del REP.

### 3. Reparar el pago afectado
- Migración puntual que recalcula ese pago con el tipo de cambio correcto (pesos por dólar) y deja el `monto_aplicado_factura` en su valor real; luego el estado de la factura se recalcula solo.
- Después de eso, karol podrá timbrar el REP normalmente desde el historial de pagos.

### 4. Cruce EUR ↔ USD
Hoy la pantalla permite intentar un pago en EUR contra factura en USD, pero la base de datos lo rechaza (`LC_PAGO_CRUCE_NO_SOPORTADO`). Se bloqueará en la pantalla con un mensaje claro en vez de dejar que el insert falle con un error técnico.

### 5. Pruebas y guardarraíles
- Prueba de la conversión pago→factura con la convención nueva (MXN→USD y USD→MXN).
- Prueba SQL de orden de triggers: un alta con tipo de cambio invertido debe rechazarse por sobrepago.
- Prueba de la validación previa del REP con un pago cross-moneda válido.

## Detalles técnicos

- Cliente: `src/features/facturacion/components/registrarPagoDerivados.ts` (dejar `tipoCambio` = TC MXN/divisa desde `rates.usdMxn`/`rates.eurMxn`), `DialogRegistrarPago.tsx`, `src/features/facturacion/hooks/useRegistrarPagoSubmit.ts`, `src/features/facturacion/services/pagos/index.ts` (comentario de convención).
- Base de datos: nueva migración que (a) reordena el trigger de conversión respecto a `tg_pagos_factura_no_sobrepago`, (b) repara el pago `ab90d96b-…` de la factura `20bdd509-…`.
- Sin cambios en `convertir_monto_pago_a_factura` (su convención pesos-por-divisa es la canónica y ya está cubierta por `supabase/tests/convertir_monto_pago.sql`).
- Cobro en lote no está afectado: la RPC exige que la factura sea de la misma moneda del cobro.
- `CHANGELOG.md` + `APP_VERSION` (13.684.1) según el estándar del proyecto.
