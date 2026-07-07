# Limpieza: proformas Aceptadas antiguas → Facturadas (histórico)

## Contexto
En Elogistix hay **6 proformas** con estado cliente **Aceptada** pero todavía en `pendiente` de facturación, con fecha de emisión anterior al **25/06/2026**. Son de embarques viejos (previos al alta de facturación electrónica), así que las tratamos como aceptación histórica — igual que hicimos con PRO-2026-0278.

## Proformas afectadas (Elogistix)

| Número | Emisión | Cliente | Expediente | Total |
|---|---|---|---|---|
| PRO-2026-0195 | 13/05/2026 | INDIMEX TRADING | ELGEN00206 | 23,890 USD |
| PRO-2026-0284 | 27/05/2026 | INDIMEX TRADING | ELIMP00169 | 2,910 USD |
| PRO-2026-0286 | 29/05/2026 | INDIMEX TRADING | ELIMP00024 | 1,300 USD |
| PRO-2026-0287 | 29/05/2026 | INDIMEX TRADING | ELIMP00024 | 1,300 USD |
| PRO-2026-0298 | 03/06/2026 | IMPORTADORA GLOBAL | ELIMP00224 | 1,040 USD |
| PRO-2026-0341 | 23/06/2026 | INDIMEX TRADING | ELIMP00263 | 4,760 USD |

## Qué se va a cambiar (solo datos, no código)

- En `proformas` (filtrando org Elogistix + `estado_proforma='pendiente'` + `estado_cliente='aceptada'` + `fecha_emision < 2026-06-25`):
  - `estado_proforma` → `facturada`
  - `fecha_facturacion` ← `fecha_emision` (si estaba vacía)
  - `folio_factura_externa` ← `HISTORICO` (si estaba vacío)
- En `conceptos_venta` con `proforma_id` en esas 6 proformas:
  - `estado_facturacion` → `facturado`

## Fuera de alcance
- No se toca ninguna proforma ya `facturada` (ya están bien).
- No se emiten facturas reales, no se generan CFDI, no se crean pagos.
- No se modifica código de la app.

## Analogía rápida
Es como cerrar manualmente unos expedientes viejos poniéndoles el sello de "cobrado histórico" — sin generar recibo nuevo, solo marcando el estado como cerrado para que el sistema deje de pedirles factura.
