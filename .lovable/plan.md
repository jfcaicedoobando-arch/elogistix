# Conciliar embarque ELIMP00149 (legacy)

## Diagnóstico

Hay dos embarques con expediente `ELIMP00149`. El que muestra el problema es el `EIR`:

- `id`: `1b3e2fff-d201-4881-84ca-32de1943a576`
- 12 conceptos de venta, todos con `estado_facturacion = 'pendiente'` y `proforma_id = NULL`.
- 7 proformas creadas el 04-May-2026, todas marcadas `facturada` con `total_mxn = 0`.
- 1 factura real: `numero 874`, total `$18,420`, estado `Pagada` (04-May-2026 23:35).
- Sólo la proforma **PRO-2026-0034** (`75bf03d3-0c89-4187-b1ff-11333c583d5e`) tiene los 12 conceptos consolidados (6 × Flete Marítimo USD 2,925 + 6 × Cargos en Destino USD 125). Las otras 6 proformas están vacías (borradores duplicados de aquel día).

El bug legacy: al crear los conceptos no se les asignó `proforma_id`, por eso el trigger `trg_sync_conceptos_venta_facturado` (v13.213.47) nunca los marcó como facturados aunque la proforma sí quedó `facturada` y con factura Pagada.

## Cambios

### 1) Reconciliación de datos (insert tool, no migración)
En el embarque `1b3e2fff-...`:

- `UPDATE conceptos_venta SET proforma_id = '75bf03d3-...', estado_facturacion = 'facturado' WHERE embarque_id = '1b3e2fff-...' AND estado_facturacion = 'pendiente';`
- Verificación post-update: los 12 conceptos deben quedar `facturado` y ligados a PRO-2026-0034.

### 2) Limpieza opcional de proformas huérfanas
Las 6 proformas `PRO-2026-0028..0033` están en estado `facturada` con total 0 y sin conceptos. Propongo dejarlas tal cual (histórico) salvo que confirmes que quieres marcarlas como `cancelada` o soft-deletearlas — dime y lo agrego.

### 3) Versionado
- `APP_VERSION` → `13.214.8`.
- `CHANGELOG.md`: entrada `[13.214.8]` describiendo la conciliación puntual de ELIMP00149.

## Fuera de alcance
- El otro embarque con expediente ELIMP00149 (estado `Cerrado`, id `14081b92-...`) ya está correcto (10/10 conceptos facturados) — no se toca.
- No se modifica ningún trigger ni RPC; el fix estructural del trigger ya está en producción desde v13.213.47.
