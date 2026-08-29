# Plan: Remediación de bugs restantes v3 (ronda selectiva)

De los 18 hallazgos, atacamos los que valen la pena por impacto/esfuerzo. Quedan fuera los de baja prioridad o que requieren diseño nuevo (ver "Fuera de alcance").

## Qué se corrige

### Bloque A — Anticipos proveedor (F1 + F2, política: solo devolución total)
1. **F1** — `devolver_anticipo_proveedor` siempre falla con 23502 porque el `INSERT INTO bbva_movimientos` no envía `hash_dedupe` (NOT NULL, confirmado: la migración `20260828210627` no lo menciona). Fix: `hash_dedupe = 'devolucion-' || v_row.id::text`.
2. **F2** — la RPC acepta montos parciales pero siempre pone `saldo_disponible = 0` y `estado='devuelto'`, borrando el remanente. Decisión tomada: **solo devolución total**.
   - RPC: exigir `p_monto >= saldo_disponible - 0.01`, rechazar parcial con código `LC_DEVOLUCION_PARCIAL_NO_PERMITIDA`.
   - `DevolverAnticipoDialog.tsx`: monto fijo = saldo, campo de solo lectura; traducir el código de error en `lcCodeMessages`.
   - Test SQL (guard) que ejercite la RPC end-to-end: devolución total OK + parcial rechazada. Añadir a `_guards_manifest.txt`.

### Bloque B — Multi-moneda NCs (F4 + F3 + F5 + F7)
3. **F4** — `guard_pago_proveedor` y `guard_proveedor_factura_total` suman NCs en crudo (sin conversión) desde Ola 17: admiten sobrepagos reales. Fix: reemplazar `SUM(monto)` por la misma expresión de la vista (`monto_pago_en_moneda_factura(...)`). Guard SQL de regresión: factura MXN + NC USD debe bloquear pago excedente.
4. **F3** — anticipos EUR y cruce MXN→USD rotos: la RPC `aplicar_anticipo_a_factura` calcula la conversión pero el trigger `guard_pago_proveedor` la rechaza (`LC_PAGO_CRUCE_NO_SOPORTADO` / `LC_PAGO_TC_REQUERIDO`). Fix: el INSERT a `pagos_proveedor` prepuebla `monto_en_moneda_factura` y `tipo_cambio_usd` con el TC DOF de aplicación, y el guard respeta valores prepoblados (extender a EUR vía conversión compuesta DOF).
5. **F5** — NC de proveedor sin tope de saldo: crear `assert_nc_prov_no_excede_saldo` (equivalente al de cliente) con conversión canónica, en aprobación/trigger; bloquear captura sin TC resoluble en `DialogNotaCreditoProveedor`.
6. **F7** — TC capturado a mano en NC proveedor sin validación: cota de desviación ±10% vs paridad DOF en `_nc_prov_tc_moneda_convertible`.

### Bloque C — Candados y consistencia (N18 + N22 + M3-res + L4-res)
7. **N18** — `duplicar_factura_para_refacturacion`: `SELECT ... FOR UPDATE` de la factura origen para cerrar la carrera de doble clic.
8. **N22** — CHECK de cargo/abono: `= 1` en vez de `<= 1`, tras verificar que no existan inserts legítimos de placeholders (cargo=0 AND abono=0).
9. **M3-res** — índice único `clientes(organization_id, lower(btrim(email))) WHERE email IS NOT NULL AND deleted_at IS NULL` (limpiando duplicados históricos si aparecen).
10. **L4-res** — eliminar el cálculo muerto de subtotal/IVA agregado en `convertir_proformas_a_factura` (el trigger por-línea manda).

### Bloque D — C9: roles que ven costos (decisión: gerencia + finanzas + ventas)
11. Alinear `puede_ver_costos_cotizacion` (SQL) con `COST_VIEWERS` (`permissionMatrix.ts`): la lista canónica incluye gerencia (admin, admin_org, super_admin, gerente_operaciones, gerente_comercial, gerente_visor), finanzas (contador, tesorero, auxiliar_contable, ejecutivo_cobranza) y ventas (vendedor — solo propias, como ya está). Reconciliar ambas fuentes y el comentario de "deben cambiarse juntas".

### Cierre
- Actualizar `docs/auditoria/backlog-v5-estado.md` (contradicción N14 mencionada en F3).
- Bump `APP_VERSION` + `CHANGELOG.md`.
- Tests: guard SQL por fix de BD; vitest donde toque front (diálogo, permissionMatrix).
- Verificación: correr guards relevantes + `bunx vitest run` de los afectados.

## Fuera de alcance (se documentan como backlog)
- **N9** (gastos EUR en vs-real, E3), **F6** (REP exento+tasa0, baja frecuencia), **N-F2** (aborta edición de embarque, E2-E3), **M6** (consolidar cascada NC, E4 — ola propia), **N-F4** (squash de migración rota, E4), **N13-res** (saldo a favor de cliente = feature nueva E5), **M7-res** (tope de montos = decisión de negocio).

## Detalles técnicos
- Migraciones nuevas via herramienta de migración; los guards SQL van en `supabase/tests/` + manifiesto.
- `monto_pago_en_moneda_factura` ya existe (usado por las vistas); reutilizarla en guards.
- Verificar en baseline la firma actual de cada función antes de el CREATE OR REPLACE.
