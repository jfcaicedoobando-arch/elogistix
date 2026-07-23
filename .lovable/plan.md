## Contexto verificado en BD

Las 10 proformas del Excel son del cliente **INDIMEX TRADING** (org `00000000-0000-0000-0000-000000000001`), todas en `estado_proforma = 'pendiente'`, `factura_id = null`, en USD con IVA 16% (excepto 3 con IVA 0 marcadas `HISTORICO`).

### Bloque A — 8 proformas sin conflicto (crear stub y vincular)


| Proforma      | Expediente | Folio ext | Fecha fact | Total USD | IVA USD |
| ------------- | ---------- | --------- | ---------- | --------- | ------- |
| PRO-2026-0195 | ELGEN00206 | 889       | 2026-05-13 | 23,890.00 | 0       |
| PRO-2026-0278 | ELIMP00021 | 729       | 2026-02-18 | 1,300.00  | 0       |
| PRO-2026-0287 | ELIMP00024 | 721       | 2026-02-17 | 1,300.00  | 0       |
| PRO-2026-0297 | ELIMP00169 | 915       | 2026-06-03 | 2,910.00  | 20      |
| PRO-2026-0322 | ELIMP00264 | 930       | 2026-06-12 | 3,920.00  | 20      |
| PRO-2026-0337 | ELIMP00256 | 940       | 2026-06-19 | 6,320.00  | 20      |
| PRO-2026-0340 | ELIMP00239 | 944       | 2026-06-23 | 5,560.00  | 20      |
| PRO-2026-0948 | ELIMP00282 | 948       | 2026-06-26 | 6,278.50  | 0       |


**Acción atómica por proforma (una migración `supabase--insert`):**

1. `INSERT INTO facturas` con:
  - `numero = <folio del Excel>`
  - `origen = 'externa'`, `estado = 'Pagada'`
  - `moneda = 'USD'`, `subtotal/iva/total` copiados de la proforma
  - `embarque_id`, `cliente_id`, `cliente_nombre`, `expediente`, `organization_id`, `proforma_id` heredados
  - `fecha_emision = fecha_facturacion` del Excel, `fecha_vencimiento = fecha_emision`
  - `uuid_fiscal = NULL`, `ret_isr = 0`, `ret_iva = 0`, `uuid_verificado = false`
  - `notas = 'Factura emitida fuera de sistema — backfill legacy ERP'`
2. `UPDATE proformas` a `estado_proforma='facturada'`, setear `factura_id`, `folio_factura_externa`, `fecha_facturacion`, `origen='externa'`.
3. `INSERT INTO bitacora_actividad` con evento `PROFORMA_VINCULADA_FACTURA_EXTERNA`.

Todo dentro de `BEGIN; ... COMMIT;` para que si un renglón falla se revierte solo el suyo (una transacción por proforma).

### Bloque B — 2 conflictos (NO ejecutar, requieren decisión)

**PRO-2026-0084 → folio 726, embarque ELIMP00007**

El embarque ya tiene 4 proformas `facturada` con distintas variantes del folio 726:

- PRO-2026-0083 → factura `726` (USD 1,200) ← única "limpia"
- PRO-2026-0079 → factura `726-DUP-cabeceda` (USD 1,199.98)
- PRO-2026-0080 → factura `726-DUP-ce941c8a` (USD 1,200)
- PRO-2026-0081 → factura `726-DUP-1a539c8b` (USD 1,200)
- PRO-2026-0082 → pendiente (también del Excel legacy)
- **PRO-2026-0084** → pendiente (la del Excel)

**PRO-2026-0085 → folio 755, embarque ELIMP00022**

- PRO-2026-0077 → factura `755-DUP-fe48bee7` (USD 2,095)
- PRO-2026-0078 → factura `755` (USD 2,095) ← única "limpia"
- **PRO-2026-0085** → pendiente (la del Excel)

Diagnóstico: ELIMP00007 tiene **5 proformas** de USD 1,200 y ELIMP00022 tiene **3 proformas** de USD 2,095, todas apuntando al mismo folio real. Parecen duplicados de importación (ERP legacy → BD nueva). Ya se hizo un intento previo de dedupe renombrando facturas con sufijo `-DUP-`.

Necesito que decidas para cada uno de los 2 casos:

1. **Marcar la del Excel como duplicado descartado** (soft-delete PRO-2026-0084 y PRO-2026-0085 con motivo "duplicado de import legacy"). Es lo más limpio si confirmas que el embarque ya está bien facturado.
2. **Reasignar el vínculo**: mover la factura `726` (o `755`) de la proforma actual (PRO-2026-0083 / PRO-2026-0078) a la del Excel (PRO-2026-0084 / PRO-2026-0085) y soft-deletar la anterior. Sólo si la del Excel es la "buena".
3. **Crear stub con sufijo** `726-EXT` / `755-EXT` vinculada a la proforma del Excel. Deja 2 facturas con el mismo folio real conviviendo — no recomendado porque descuadra reportes.
4. **Nada por ahora**: dejar PRO-2026-0084 y PRO-2026-0085 pendientes hasta que revises manualmente los 2 embarques.

Para PRO-2026-0082 (que también aparece en el mismo embarque como pendiente y no está en el Excel), ¿la trato aparte o aplico la misma decisión?

### Entregables

- Una llamada a `supabase--insert` con las 8 transacciones del Bloque A.
- Query de verificación posterior (SELECT de las 8 proformas + facturas creadas).
- CHANGELOG entry `## [13.308.11]` describiendo backfill de 8 proformas externas.
- Bloque B queda en espera de tu respuesta a las 4 opciones arriba.

### Nota

Este es un backfill de datos, **no** un feature nuevo — no crea RPC ni UI. Si más adelante quieres flujo self-service para que ventas registre facturas externas desde el detalle de proforma, es otro plan (te lo propuse antes y podemos retomarlo).

Para los 2 casos vamos a **Reasignar el vínculo.**