# Auditoría R4-15 (Menores) — estado real en la base

Revisé cada sub-ítem contra las funciones y triggers vivos en la DB. **Los 5 siguen abiertos** en distintos grados. Analogía: son los "cabos sueltos" del cierre R4; ninguno tira la app, pero cada uno puede producir números o mensajes inconsistentes en producción.

## Estado por sub-ítem

### R4-15.1 · Proforma USD guarda MXN=0 — ABIERTO
`crear_proforma_atomica` calcula `v_sub_mxn` sumando **solo** conceptos con `moneda='MXN'`. Si todos los conceptos son USD, la proforma se inserta con `subtotal_mxn=0, iva_mxn=0, total_mxn=0`. Al pasar por `convertir_proformas_a_factura`, la factura hija arrastra `total_mxn=0` y choca contra el check `facturas_tipo_cambio_pos` / `facturas_total_mxn_pos`.
**Fix**: convertir la parte USD a MXN usando el TC del embarque (o el TC de la fecha) antes del `INSERT`.

### R4-15.2 · Triggers duplicados en `pagos_proveedor` — ABIERTO
La tabla tiene dos pares que hacen la misma validación con funciones distintas:
- `pagos_proveedor_requiere_aprobacion` → `tg_pagos_proveedor_requiere_aprobacion`
- `trg_pago_requiere_aprobacion` → `check_pago_proveedor_factura_aprobada`
- `tg_pagos_proveedor_no_sobrepago` → `tg_pago_proveedor_no_sobrepago`
- `trg_check_no_sobrepago` → `check_no_sobrepago_proveedor`

**Fix**: quedarse con **una** implementación por validación (la más nueva/canónica), borrar el trigger y la función legacy huérfana.

### R4-15.3 · Errcodes estables en proformas — ABIERTO
`convertir_proformas_a_factura` lanza `'LC_PROFORMA_SIN_PERMISO: …'` y `'LC_PROFORMA_YA_FACTURADA: …'` como **texto plano**, sin `USING ERRCODE`. El cliente hoy los distingue por substring del mensaje, frágil ante i18n.
**Fix**: añadir `USING ERRCODE='P0001'` (permiso) y `'P0002'` (estado) y mapearlos en el front por SQLSTATE, no por texto.

### R4-15.4 · Oráculo de existencia en `soft_delete_pago_*` — ABIERTO
Hoy `soft_delete_pago_factura` y `soft_delete_pago_proveedor` distinguen: pago inexistente → `P0002`, pago de otra org → `P0001`. Un atacante puede saber si un UUID ajeno existe.
**Fix**: unificar ambos casos a `LC_PAGO_NO_ENCONTRADO` con **el mismo ERRCODE** (`P0002`) para no filtrar existencia.

### R4-15.5 · Escala de monto en pagos — ABIERTO
`pagos_factura.monto` y `pagos_proveedor.monto` son `numeric` **sin escala** (aceptan 8+ decimales). Solo `pagos_proveedor.monto_en_moneda_factura` tiene `numeric(18,4)`.
**Fix**: `CHECK (scale(monto) <= 2)` en ambas tablas para pagos, y en `ret_iva`/`ret_isr` de `pagos_factura`.

## Plan de remediación (una migración consolidada)

1. `crear_proforma_atomica`: convertir bloque USD a MXN con `tipo_cambio_usd` del embarque (fallback `configuracion.tc_default`); si no hay TC, `RAISE 'LC_PROFORMA_TC_REQUERIDO' USING ERRCODE='P0001'`.
2. Drop de `trg_pago_requiere_aprobacion` + `check_pago_proveedor_factura_aprobada` y de `trg_check_no_sobrepago` + `check_no_sobrepago_proveedor` (dejar solo las variantes `tg_*` nuevas).
3. Reemplazar `RAISE EXCEPTION 'LC_PROFORMA_…'` por `RAISE … USING ERRCODE='P0001'/'P0002'` en `convertir_proformas_a_factura`.
4. Unificar `soft_delete_pago_factura` / `soft_delete_pago_proveedor` para no diferenciar "no existe" vs "otra org".
5. `ALTER TABLE pagos_factura ADD CONSTRAINT pagos_factura_monto_escala CHECK (scale(monto) <= 2 AND scale(coalesce(ret_iva,0)) <= 2 AND scale(coalesce(ret_isr,0)) <= 2)`; equivalente en `pagos_proveedor.monto`.
6. Frontend (`src/features/…/errors`): mapear los códigos por `error.code` (SQLSTATE `P0001/P0002`), no por `error.message`.
7. Bump `APP_VERSION` a `13.308.1` + entrada en `CHANGELOG.md`.

## Notas técnicas

- La migración es única (`supabase--migration`) y no toca datos; solo funciones/triggers/constraints.
- Riesgo de la constraint de escala: si hay filas históricas con >2 decimales, hay que redondear en la misma migración (`UPDATE … SET monto = round(monto,2)`) antes del `ADD CONSTRAINT`.
- Tras la migración se regeneran los tipos; ajustar solo los helpers de errores en TS.
