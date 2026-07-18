## Objetivo

Re-vincular sólo las proformas del backfill de Fase C cuya factura viva en el mismo embarque sea **inequívoca (1:1)**. El resto (N:M, canceladas, sin factura) queda en `pendiente` para revisión humana vía "Embarques sin factura".

## Alcance — 10 candidatas

| Proforma | Embarque | Factura(s) en embarque | Clasificación |
|---|---|---|---|
| PRO-2026-0025 | ELIMP00097 | 900 Emitida | 1:1 candidato |
| PRO-2026-0082 | ELIMP00007 | 726 Pagada | N:1 (con 0084) → manual |
| PRO-2026-0084 | ELIMP00007 | 726 Pagada | N:1 (con 0082) → manual |
| PRO-2026-0085 | ELIMP00022 | 755 Pagada | 1:1 candidato |
| PRO-2026-0281 | ELIMP00232 | 849 Pagada | 1:1 candidato |
| PRO-2026-0288 | ELIMP00042 | 765 Pagada | 1:1 candidato |
| PRO-2026-0289 | ELIMP00190 | 825, 826 Pagadas | 1:N → manual |
| PRO-2026-0330 | ELIMP00162 | 847, 848, F953 | 1:N → manual |
| PRO-2026-0341 | ELIMP00263 | F971 **Cancelada** | Excluida (no hay viva) |
| PRO-2026-0956 | ELIMP00195 | 897 Pagada, F965 Emitida | 1:N → manual |

**Regla dura de seguridad**: sólo se re-vincula si en el embarque existe **exactamente 1 factura viva** (`estado IN ('Emitida','Pagada','Parcial')` y `cancellation_status IS NULL`) **y exactamente 1 proforma pendiente del backfill**. La regla se evalúa en la migración, no se codifica manualmente por proforma, así que aunque los conteos cambien en producción el algoritmo se mantiene correcto.

## Fase única — `v13.301.72` (migración transaccional)

1. CTE que identifica en tiempo de ejecución los pares `(proforma, factura)` que cumplen el criterio 1:1 sobre el conjunto de 42 backfilleadas (`updated_at > now() - '2 hours'` + `estado_proforma='pendiente'`).
2. Para cada par seleccionado:
   - `UPDATE public.facturas SET proforma_id = <proforma_id> WHERE id = <factura_id> AND proforma_id IS NULL`. Si `proforma_id` ya no es NULL, se salta y se reporta.
   - Fallback: si `facturas.proforma_id` ya tenía otra referencia, se anota en `conceptos_factura.proforma_id_origen` del primer concepto sin origen.
   - `UPDATE public.proformas SET estado_proforma='facturada' WHERE id = <proforma_id>`.
   - `INSERT INTO public.bitacora_actividad` con `accion='revincular_proforma_backfill'`, JSON con proforma+factura+embarque.
3. La migración regresa una tabla temporal con los pares aplicados y los descartados (motivo). Ese resultado se imprime para el aprobador.
4. Guardrail nuevo `src/lib/__tests__/revincular-backfill-solo-1a1.test.ts` que lee el SQL de la migración y verifica que:
   - filtra por `cancellation_status IS NULL`,
   - excluye estados `Cancelada` y `Sustituida`,
   - exige `count(factura)=1` y `count(proforma)=1` por embarque.

## Entregable de revisión humana

- `/mnt/documents/proformas-backfill-pendientes.csv` con las ~37 proformas que **no** se re-vinculan (32 sin factura + 5 N:M + PRO-0341 cancelada) incluyendo: número, cliente, embarque, montos, facturas vivas del embarque y motivo de exclusión. Se genera vía `psql COPY` sin tocar datos.

## Cierre

- `CHANGELOG.md`: nueva entrada `## [13.301.72] - 2026-07-18` describiendo la re-vinculación (N pares aplicados, N excluidos) y el CSV entregable.
- `APP_VERSION` → `13.301.72`.
- `bun run ci:fast` para validar guardrail nuevo + suite estable.

## Riesgos y mitigaciones

- **Riesgo**: que `facturas.proforma_id` ya apunte a otra proforma consolidada y el UPDATE reemplace un vínculo bueno. **Mitigación**: `WHERE proforma_id IS NULL` + fallback a `conceptos_factura`.
- **Riesgo**: que el usuario asuma que las 32 "también estaban facturadas" y las dé por cerradas. **Mitigación**: el CSV lista `facturas_vivas_en_embarque='∅'` explícito y la política actual las mantiene visibles en "Embarques sin factura".
- **Riesgo**: PRO-0341 tiene F971 Cancelada; re-vincular equivaldría a marcarla como facturada sin factura viva. **Mitigación**: filtro `cancellation_status IS NULL` la excluye automáticamente.
