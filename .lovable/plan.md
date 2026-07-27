# Fix: margen negativo fantasma en auditoría (ELIMP00315)

## Diagnóstico (verificado en BD, no supuesto)

**Analogía**: la auditoría sumó una factura que ya estaba en la papelera; el detalle del embarque la ignora porque está tachada. Por eso los números no cuadran.

Embarque `ELIMP00315` (`0e6b5a7f-…`) — datos reales consultados:

| Concepto costo | Monto USD | ¿Borrado? |
|---|---|---|
| LONGSAIL SUPPLY CHAIN | 12,411 | vivo |
| WAN HAI LINES MEXIC | 249 | vivo |
| Wan Hai Lines | 6,205.5 | **borrado** (soft-delete) |

- **Con conceptos vivos** (lo que muestra el detalle): venta 13,300 USD vs costo 12,660 USD → utilidad **+11,222 MXN** (positiva, no debería alertar).
- **Con el borrado incluido** (lo que hace la auditoría): venta 13,300 USD vs costo 18,865.5 USD → utilidad **−97,591 MXN** → dispara `margen_negativo · critico` falso.

## Causa raíz confirmada en el SQL

En `supabase/schema/auditoria/auditoria_embarques_org.sql`, los CTEs que leen conceptos **no filtran `deleted_at IS NULL`**, aunque el resto del archivo sí lo hace en otros lados (líneas 162, 169, 493, etc.):

- Línea 239 · `emb_sin_tc` — `JOIN conceptos_venta cv` sin filtro
- Línea 251 · (segundo CTE `tiene_eur_venta`) — igual
- Línea 264 · `emb_sin_tc_costo` — `JOIN conceptos_costo cc` sin filtro
- Línea 312 · `ventas_mxn` — `FROM conceptos_venta cv` sin filtro
- Línea 328 · `costos_mxn` — `FROM conceptos_costo cc` sin filtro

El Tab P&L del detalle sí filtra `deleted_at IS NULL` (RPC `pnl_financiero_embarque`, migración `20260722132715`), por eso los dos módulos discrepan.

## Cambios propuestos

**1 · Nueva migración** que reemplaza la función `auditoria_embarques_org` añadiendo `AND cv.deleted_at IS NULL` / `AND cc.deleted_at IS NULL` a los 5 CTEs listados. Sin cambios de firma ni de shape del JSON de salida.

**2 · Sync del schema canónico**: aplicar el mismo cambio en `supabase/schema/auditoria/auditoria_embarques_org.sql` para que `audit:migrations` quede verde.

**3 · Regression test** en `supabase/tests/rls/` o unit test de la RPC: seed 1 embarque con 1 concepto costo vivo (venta > costo) + 1 concepto costo borrado con monto grande; verificar que **no** aparece hallazgo `margen_negativo`. Previene reincidencia.

**4 · Refresh de la revisión abierta**: al aplicar la migración, correr `auditoria_capturar_snapshot` para la org afectada para que el usuario vea el hallazgo desaparecer sin esperar al siguiente ciclo.

**5 · CHANGELOG + bump** a `13.320.12` con la explicación en analogía.

## Fuera de alcance

- No se toca la fórmula del margen ni la severidad.
- No se cambia la RPC del detalle (`pnl_financiero_embarque`) — ya está correcta.
- No se migran otros CTEs no financieros (proformas, documentos) porque ya filtran `deleted_at` donde importa.

## Cómo verificar tras el fix

1. Volver a `/auditoria` en la misma org → embarque `ELIMP00315` ya no aparece en "Margen negativo".
2. Abrir el detalle → Tab P&L sigue mostrando el mismo margen positivo que hoy.
3. Los tests nuevos + `audit:migrations` pasan en CI.
