# Prueba Sandbox E2E — Factura PPD con No objeto y REP

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
| `FACTURAPI_E2E_ESCENARIO` | no | `B` (default) factura mixta gravado 16% + no objeto ⇒ `ObjetoImpDR=02`; `A` factura 100% no objeto ⇒ `ObjetoImpDR=01` sin `ImpuestosDR`. |

## Cómo interpretar el resultado

El guion imprime dos bloques con una línea `PASA`/`FALLA` por regla y cierra con
`RESULTADO: TODO PASA` o `HAY FALLAS` (código de salida 0 o 1).

Factura:

- `factura.MetodoPago=PPD` — el método es del comprobante completo.
- `factura.FormaPago=99` — PPD sin pago recibido.
- `factura.concepto gravado ObjetoImp=02` (escenario B) o
  `factura.sin conceptos gravados` (escenario A), y siempre
  `factura.concepto no objeto ObjetoImp=01`.
- `factura.no objeto sin nodo de impuestos` — el concepto 01 no declara traslados
  ni retenciones (no se convierte a exento ni a tasa 0).

REP:

- `rep.complemento pago20:Pagos presente` y `rep.DoctoRelacionado presente`.
- `rep.DoctoRelacionado sin MetodoDePagoDR (Pagos 2.0)` — el complemento vigente
  ya no lleva ese atributo; sólo el comprobante declara el método.
- `rep.IdDocumento (UUID de la factura) presente`.
- `rep.ObjetoImpDR=02` en la factura mixta y `01` cuando **todos** los renglones
  son no objeto.
- `rep.traslados coherentes con el tratamiento` — un `TrasladoDR` de IVA 16%
  sobre base gravada prorrateada en `02`; ninguno en `01`.

### Última corrida real (sandbox, 2026-09-21)

| Escenario | Factura (id / UUID) | REP (id / UUID) | Resultado |
| --- | --- | --- | --- |
| B mixta | `6ab15593b08b700609e35882` / `D5599682-…-0F1EBE149997` | `6ab15596b08b700609e35a9e` / `FE1D0604-…-43296A9F2952` | TODO PASA (`ObjetoImpDR=02`, 1 `TrasladoDR`) |
| A 100% no objeto | `6ab15602b08b700609e38ee1` / `2075BDB9-…-54E994839DC7` | `6ab15605b08b700609e391fb` / `C860FE18-…-8697D4DDCCE5` | TODO PASA (`ObjetoImpDR=01`, 0 `TrasladoDR`) |

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
