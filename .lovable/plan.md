# Conciliar embarque ELIMP00169 (legacy)

## Diagnóstico

- `id`: `eac3b411-354e-44f8-8716-5c0ddd30d495`, estado `EIR`.
- 2 conceptos de venta pendientes, sin `proforma_id`:
  - Flete Marítimo USD 2,765
  - Cargos en Destino USD 125
- 2 proformas marcadas `facturada` con total 0 y **sin** conceptos consolidados ni facturas vinculadas en BD:
  - `PRO-2026-0284` (27-May-2026) — duplicado antiguo
  - `PRO-2026-0297` (02-Jun-2026) — proforma buena
- La factura correspondiente se emitió fuera del sistema (confirmado por el usuario).

## Cambios (insert tool, sin migración)

1. Ligar los 2 conceptos a `PRO-2026-0297` y marcarlos como `facturado`:
   ```sql
   UPDATE conceptos_venta
   SET proforma_id = '9bab7927-558f-46f7-83f8-181044cc5385',
       estado_facturacion = 'facturado'
   WHERE embarque_id = 'eac3b411-354e-44f8-8716-5c0ddd30d495';
   ```
2. Marcar `PRO-2026-0284` como cancelada (duplicado):
   ```sql
   UPDATE proformas
   SET estado_proforma = 'cancelada'
   WHERE id = 'c7937bb9-e94d-492c-8656-c8c38e26725d';
   ```
3. Versionado: `APP_VERSION` → `13.214.9`; entrada `[13.214.9]` en `CHANGELOG.md` describiendo la conciliación puntual.

## Fuera de alcance
- No se crea factura interna (se emitió fuera del sistema).
- No se toca ningún trigger ni RPC.
