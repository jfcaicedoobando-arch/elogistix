# Nueva nota de crédito: menos campos, menos errores

Hoy el modal pide teclear todo a mano: fecha, motivo interno, uso del CFDI entre 24 claves, forma de pago fija en "03 Transferencia", justificación y una lista de conceptos que llega precargada completa. El usuario tiene que calcular él mismo el importe para que cuadre con el saldo, y las reglas del SAT no se explican en pantalla.

La propuesta reduce la captura a lo que sólo el usuario puede saber: qué se acredita, por cuánto y por qué.

## Cómo quedará la pantalla

Tres bloques claros, de arriba hacia abajo:

1. **Qué se acredita.** Un atajo con tres modos:
   - *Por el saldo completo*: llena la nota exactamente por el saldo pendiente (IVA incluido).
   - *Conceptos de la factura*: casillas para marcar sólo los conceptos que se acreditan, en lugar de recibir todos precargados.
   - *Descuento por porcentaje*: se escribe 10% y se reparte sobre los conceptos marcados.
   Siempre queda la opción de ajustar los renglones a mano después.

2. **Por qué.** Motivo (Devolución, Descuento, Bonificación, Error) y la justificación en texto. El motivo se queda porque es información de negocio, no fiscal.

3. **Datos fiscales, ya resueltos.** Un bloque compacto y en su mayoría de sólo lectura:
   - Uso del CFDI fijo en **G02 – Devoluciones, descuentos o bonificaciones**, la única clave que el SAT acepta en notas de crédito. Deja de ser un desplegable.
   - Forma de pago propuesta sola: si la factura **no** está cobrada, **15 – Condonación**; si **ya** está cobrada, la misma forma con la que se cobró. Queda editable y con una línea que explica el porqué.
   - Fecha con los mismos límites de hoy (no antes de la factura, no futura).
   - Se muestra el CFDI relacionado (folio y UUID de la factura original) como confirmación de que la nota queda ligada.

4. **Totales visibles.** Un resumen fijo al pie con subtotal, IVA, total de la nota, saldo de la factura y el saldo que quedará después. El aviso de "excede el saldo" aparece ahí, no como sorpresa al guardar.

## Ajuste en el timbrado

Al timbrar el egreso se enviará el método de pago **PUE** de forma explícita (los comprobantes de egreso no admiten parcialidades). Hoy se depende de lo que asuma el proveedor de timbrado. El resto del envío ya es correcto: tipo E, relación 01 y UUID de la factura original.

## Detalles técnicos

- `NotaCreditoCamposFiscales.tsx`: se elimina el select de uso CFDI (queda G02 fijo, mostrado como dato); forma de pago recibe un valor sugerido y una nota explicativa; se añade la fila de CFDI relacionado.
- `useNotaCreditoDraft.ts`: `usoCfdi` pasa a constante `"G02"`; `formaPago` se inicializa desde una función pura nueva `sugerirFormaPagoNC({ facturaCobrada, formaPagoCobro })` (con pruebas propias). Se añaden helpers puros para los tres atajos de importe (`llenarPorSaldo`, `aplicarPorcentaje`, selección de conceptos), reutilizando `subtotalLinea`/`calcularTotalConIVA`/`sumarMontos` sin tocar el motor financiero.
- Se necesita saber si la factura tiene cobros vigentes y con qué forma de pago; se lee del detalle de factura que ya carga la pantalla (pagos con `estado_rep` distinto de cancelado), sin nuevas consultas ni RPCs.
- `NotaCreditoConceptosEditor.tsx`: modo selección con casillas cuando hay conceptos sugeridos, importes con formato de moneda y anchos fijos por columna; se extrae el resumen de totales a un componente aparte para respetar el límite de 200 líneas.
- `buildNcPayload` (`facturapi-emitir-nota-credito/helpers.ts`): agregar `payment_method: "PUE"`, con caso en `helpers_test.ts`.
- Sin cambios de base de datos, RLS, permisos, IVA, tipo de cambio, cálculo de saldo ni contratos de la RPC de creación.

## Validación local

Pruebas focalizadas de facturación y notas de crédito, pruebas de los helpers nuevos, typecheck, ESLint focalizado y build. Se actualizan `APP_VERSION`, `CHANGELOG.md` y el manifiesto. CI completo, RLS global y E2E quedan para GitHub Actions.
