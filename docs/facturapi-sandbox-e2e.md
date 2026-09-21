# Prueba Sandbox E2E — Factura PPD mixta (IVA 16% + No objeto) y REP

Guion **opt-in** que valida, contra el ambiente de pruebas de FacturAPI, el caso
fiscal completo: una factura PPD con un concepto gravado (IVA 16%, ObjetoImp 02)
y otro **No objeto de impuesto** (ObjetoImp 01), el registro del pago y el
timbrado del REP con el complemento de pagos estructurado (`taxability`).

- Archivos: `scripts/sandbox/facturapi-e2e-ppd-noobjeto.ts` (orquestador) y
  `scripts/sandbox/facturapi-e2e-validar.ts` (reglas sobre el XML).
- **No corre en CI**: no es un `*_test.ts`, exige variables explícitas y aborta
  si la llave no empieza con `sk_test`. No hay credenciales en el repositorio.

## Cómo ejecutarlo

```bash
FACTURAPI_SANDBOX_E2E=1 \
FACTURAPI_SANDBOX_KEY=sk_test_xxxxxxxx \
FACTURAPI_E2E_TAG=e2e-2026-09-19 \
deno run --allow-env --allow-net scripts/sandbox/facturapi-e2e-ppd-noobjeto.ts
```

Variables:

| Variable | Obligatoria | Para qué sirve |
| --- | --- | --- |
| `FACTURAPI_SANDBOX_E2E=1` | sí | Confirma que quieres emitir en sandbox. |
| `FACTURAPI_SANDBOX_KEY` | sí | Llave de pruebas (`sk_test_…`). Nunca una llave real. |
| `FACTURAPI_E2E_TAG` | no | Etiqueta del intento (`external_id`/`idempotency_key`). Repetir el mismo tag **reutiliza** los CFDI ya emitidos en vez de duplicarlos. |
| `FACTURAPI_E2E_LIMPIAR=1` | no | Cancela en sandbox la factura y el REP al terminar. |

## Cómo interpretar el resultado

El guion imprime dos bloques con una línea `PASA`/`FALLA` por regla y cierra con
`RESULTADO: TODO PASA` o `HAY FALLAS` (código de salida 0 o 1).

Factura:

- `factura.MetodoPago=PPD` — el método es del comprobante completo.
- `factura.FormaPago=99` — PPD sin pago recibido.
- `factura.concepto gravado ObjetoImp=02` y `factura.concepto no objeto ObjetoImp=01`.
- `factura.no objeto sin nodo de impuestos` — el concepto 01 no declara traslados
  ni retenciones (no se convierte a exento ni a tasa 0).

REP:

- `rep.complemento pago20:Pagos presente` y `rep.DoctoRelacionado presente`.
- `rep.MetodoDePagoDR=PPD`.
- `rep.ObjetoImpDR=02` en la factura mixta (sería `01` si **todos** los renglones
  fueran no objeto).
- `rep.traslados coherentes con el tratamiento`.

Antes del REP se imprime el `paymentSummary` del proveedor (parcialidad, saldo
anterior, importe y moneda de la factura), que es la autoridad del saldo.

## Salidas distintas de las reglas

- Código 2: faltan variables o la llave no es de sandbox; no se emitió nada.
- `status pending`: FacturAPI está recuperando el timbre. Vuelve a ejecutar con
  el **mismo** `FACTURAPI_E2E_TAG`; la idempotencia evita duplicados.

## Limitaciones reales de la API

- El `ObjetoImpDR` del REP se declara en `related_documents[].taxability` (SDK
  5.1.0). La vía de XML manual en `complements` fue retirada: el sandbox la
  rechaza con `400 El campo complements no es válido`.
- `payment-summary` sólo existe para facturas emitidas en FacturAPI y su
  `amount` va en la moneda de la **factura**, no del pago.
