
# Auditoría R5 — verificación y plan de fixes

Verifiqué cada hallazgo contra la BD antes de planear. **9 son bugs reales**, **1 tiene diagnóstico incorrecto**, **1 no es reproducible**.

## Resultado de la verificación

| # | Hallazgo | Estado | Nota |
|---|---|---|---|
| R5-01 | Regresión sobrepago + dif. cambiaria CxP | ⚠️ Parcial | Trigger sí existe (`tg_pago_proveedor_no_sobrepago`) y lanza `LC_PAGO_EXCEDE_SALDO`, pero **usa `subtotal` en vez de `total`** (excluye IVA) y **`diferencia_cambiaria_mxn` no la calcula ninguna función** (columna huérfana) |
| R5-02 | Margen absoluto vs pct | ✅ Real | `v_ok := (v_utilidad_mxn >= v_margen_min)` confirmado |
| R5-03 | Sobrecargas duplicadas | ❌ No reproducible | 1 sola firma para cada función. **Omitir.** |
| R5-04 | Backfill `folio_secuencias` | ✅ Real | 3 orgs sin fila `cotizacion`, 2 sin `factura` |
| R5-05 | Vista `embarque_estado_financiero` | ❌ No existe la vista | **Omitir**, pedir aclaración al cierre |
| R5-06 | `cxp_aging_proveedores` fail-open | ✅ Real | `v_org := p_org` confirmado |
| R5-07 | GUC `app.recalc_estado_factura` bypass | ✅ Real | Sin check de rol |
| R5-08 | EUR en `convertir_proformas_a_factura` | ✅ Real | Camino EUR no manejado |
| R5-09 | `monto_cobrado_mxn` en comisiones | ✅ Real | No usa fallback a TC del embarque cuando TC del pago=1 |
| R5-10 | `auth.role()='service_role'` sin COALESCE | ✅ Real | `validar_cierre_embarque` y `marcar_facturas_vencidas` |
| R5-11 | Menores | ✅ Real (2 de 6) | `proformas.factura_id` no se rellena; `bl_master` sin unique por org (existe `uq_embarques_bl_house_org`) |

## Alcance de la migración (única)

Archivo: `supabase/migrations/20260723XXXXXX_fix_r5.sql`

### BLOQUE A — P0 corregido

1. **R5-01a**: Rescribir `tg_pago_proveedor_no_sobrepago` para comparar contra `total` (subtotal + IVA − NC) en lugar de `subtotal`. Mantener el nombre del trigger existente para no duplicar.
2. **R5-01b**: Añadir cómputo de `diferencia_cambiaria_mxn` en `tg_pagos_proveedor_monto_convertido` cuando `NEW.moneda='MXN'` y factura `USD`:
   `NEW.diferencia_cambiaria_mxn = ROUND(NEW.monto_en_moneda_factura * (NEW.tipo_cambio_usd − v_fact_tc), 2)`.
3. **R5-01c**: Rechazar cruce MXN↔USD sin `tipo_cambio_usd` con `LC_PAGO_TC_REQUERIDO` (hoy silenciosamente permite fallback).

### BLOQUE B — P1

4. **R5-02**: `validar_cierre_embarque` — calcular `v_margen_pct := v_utilidad_mxn / v_venta_mxn * 100` y usarlo en el check. Añadir `margen_pct` y `minimo_pct` al detalle.
5. **R5-04**: Backfill de `folio_secuencias` para `cotizacion`, `factura`, `proforma`, `embarque` con `MAX()` por org y `ON CONFLICT (organization_id, tipo) DO UPDATE`.
6. **R5-06**: `cxp_aging_proveedores` — exigir membresía (`current_user_org_id()` o `has_role super_admin`), eliminar fallback a `p_org`.
7. **R5-07**: `guard_estado_factura` — aceptar GUC bypass sólo si `auth.role()='service_role'` o `current_user='postgres'`.
8. **R5-08**: `convertir_proformas_a_factura` — soportar EUR usando `embarques.tipo_cambio_eur` o `RAISE LC_MONEDA_NO_SOPORTADA`.
9. **R5-09**: `calcular_comision_pago` — cuando `pago.moneda IN ('USD','EUR')` y `tipo_cambio IN (0,1)`, usar TC del embarque.

### BLOQUE C — P2

10. **R5-10**: Envolver `auth.role() = 'service_role'` con `COALESCE(auth.role(),'')` en `validar_cierre_embarque` y `marcar_facturas_vencidas`.
11. **R5-11a**: En `convertir_proformas_a_factura` (y donde se enlace), setear `proformas.factura_id` para navegación bidireccional.
12. **R5-11b**: `CREATE UNIQUE INDEX uq_embarques_bl_master_org` con `WHERE bl_master IS NOT NULL AND deleted_at IS NULL` replicando el patrón de `bl_house`.

## Checks post-migración

- Sobrepago CxP → `LC_PAGO_EXCEDE_SALDO` con el nuevo denominador `total`.
- Pago MXN@20 sobre factura USD@19.5 → `diferencia_cambiaria_mxn = 500` por cada 1000 USD.
- Cierre embarque con margen 25% y mínimo 30% → `puede_cerrar=false`, `margen_pct=25`.
- `SELECT cxp_aging_proveedores(<otra_org>)` como usuario sin membresía → `LC_ORG_FORBIDDEN`.
- `SET app.recalc_estado_factura='1'; UPDATE facturas SET estado='Pagada'` como usuario normal → bloqueado.

## Fuera de alcance

- R5-03 (sobrecargas): no reproducible, no toco.
- R5-05 (vista `embarque_estado_financiero`): no existe en esta BD. Pregunto tras aplicar.
- R5-11 restantes (FK cross-tenant, expediente vacío, REVOKE `_cxp_anchor_fase_o`, exigir `tipo_cambio` en factura no MXN): postergado a otra ronda para no inflar esta migración.

## Después de la migración

- Regenerar tipos (automático).
- Bump `APP_VERSION` → `13.308.17`.
- Entrada en `CHANGELOG.md`.
