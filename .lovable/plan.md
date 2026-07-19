## Verificación de la Ronda 4

Revisé código y migraciones para confirmar/refutar cada hallazgo antes de proponer el fix.

### Bugs confirmados

**BUG 19 — Multi-moneda en CxP: REAL, Alto.**
- `pagos_proveedor` guarda `monto` en la moneda del pago sin persistir monto convertido a moneda de la factura (`src/features/cxp/services/pagosProveedor.ts:80-102`).
- `v_proveedor_facturas_saldo` suma `SUM(pp.monto)` en crudo (`supabase/migrations/20260602185003…sql:225`) y usa `GREATEST(…, 0)` — clampa a 0 y oculta el sub-pago.
- `check_no_sobrepago_proveedor` compara igual en crudo (`20260706185028…sql:43-59`).
- Consecuencia real: factura USD parcialmente pagada en MXN puede quedar 'Pagada' con saldo aún debido, o bloquearse por sobrepago falso.

**BUG 20 — `cerrar_factura_proveedor_sin_pago` sin gate de rol: REAL, Alto.**
- `20260706185028…sql:122-128` solo valida `v_org = current_user_org_id() OR super_admin`. No exige `admin/admin_org/contador/tesorero` (que sí exige `aprobar_factura_proveedor`). Cualquier miembro puede condonar deuda vía RPC directa.

**BUG 21 — NCs proveedor sin máquina de estados: REAL, Medio.**
- `proveedorNotasCredito.ts:41-61` hace UPDATE directo `{estado: 'Aplicada'|'Cancelada'}` desde el cliente, ignorando la RPC `aprobar_nota_credito_proveedor` que ya existe.
- No valida estado previo, monto vs. saldo, ni recalcula estado de la factura padre.

**BUG 22 — Estado CxP recalculado en cliente: REAL, Medio.**
- `recalcularEstadoFactura` en `pagosProveedor.ts:139-165`: 3 round-trips (vista → factura → UPDATE) no atómicos.
- NCs y ajustes no disparan recalc.

**BUG 23 — Aprobación de CxP no valida cuadre: REAL, Medio.**
- `aprobar_factura_proveedor` (`20260622163629…sql`) solo revisa rol y estado — no compara `total` con `SUM(proveedor_facturas_conceptos.*)` ni verifica que los conceptos ligados pertenezcan al embarque declarado.

### Bug refutado

**BUG 24 — Pagar factura no aprobada: FALSO (fix ya existe).**
- El trigger `tg_pagos_proveedor_requiere_aprobacion` (`20260622050138…sql`) bloquea inserts si `estado_aprobacion <> 'aprobada'`. La guarda de BD existe. **No requiere trabajo.**

### Observaciones confirmadas

- Carta garantía: evaluación snapshot en trigger, sin job de revalidación ni alerta "por vencer". Real.
- Anticipos a proveedor: no existen como entidad. Real.
- `proveedor_facturas_conceptos` sin monto de aplicación parcial. Real — puede haber sobre-matching.
- Post-Fase H (Ronda 3): FK `pfc.concepto_costo_id ON DELETE SET NULL` confirmado (`20260708154716…sql:129-133`). Si un recálculo de demoras logra eliminar un `concepto_costo` ya ligado a pfc (porque Fase H solo bloquea por proforma/factura, no por pfc), la línea de la factura de proveedor queda huérfana silenciosamente. **Fase H tiene un hueco.**

---

## Plan de remediación — Ronda 4

Cinco fases secuenciales. Cada una entrega migración + ajustes de servicio/UI + guardrail tests. Cierro con bump de versión.

### Fase L (v13.301.83) — Multi-moneda en CxP [BUG 19]

Objetivo: que todos los cálculos de saldo/sobrepago/estado usen una unidad común (moneda de la factura).

1. Migración:
   - `ALTER TABLE pagos_proveedor ADD COLUMN monto_en_moneda_factura numeric(18,4)` (NOT NULL default 0).
   - Backfill: para cada pago existente calcular el monto convertido usando `tipo_cambio_usd` y la moneda de la factura. Casos: mismo par → monto; par distinto → aplicar TC guardado (documentar supuesto para históricos donde falte TC).
   - Trigger BEFORE INSERT/UPDATE `tg_pagos_proveedor_monto_convertido`: rellena `monto_en_moneda_factura` a partir de `moneda`, `tipo_cambio_usd`, `pf.moneda` y `pf.tipo_cambio`. Rechaza combinaciones sin TC.
   - Reescribir `v_proveedor_facturas_saldo`: usar `SUM(monto_en_moneda_factura)` y **quitar `GREATEST(…,0)`** (permitir saldo negativo para exponer sobre-pagos que hoy se ocultan).
   - Reescribir `check_no_sobrepago_proveedor`: mismos totales convertidos.

2. Servicio: `registrarPagoProveedor` calcula y manda `monto_en_moneda_factura` explícito; UI (`DialogRegistrarPago` de CxP) muestra la equivalencia en moneda-factura antes de guardar.

3. Guardrail test: pago MXN parcial sobre factura USD deja saldo positivo correcto; pago total en cualquier moneda deja saldo = 0.

### Fase M (v13.301.84) — Gate de rol en cierre sin pago [BUG 20]

- Migración: agregar al principio de `cerrar_factura_proveedor_sin_pago` el mismo check de rol que `aprobar_factura_proveedor` (`admin`/`admin_org`/`super_admin`/`contador`/`tesorero`). `RAISE EXCEPTION` con `ERRCODE 42501` si falta.
- `REVOKE EXECUTE … FROM PUBLIC` (mantener grant a `authenticated`, el gate lo hace el body).
- Guardrail test: la migración contiene el check de rol y la revocación.

### Fase N (v13.301.85) — Máquina de estados NC proveedor [BUG 21] + recalc trigger [BUG 22]

1. Migración:
   - Nueva RPC `aplicar_nota_credito_proveedor(_nc_id, _monto?)`: solo desde `Aprobada`; valida `_monto` (o el declarado) ≤ saldo; UPDATE a `Aplicada` + bitácora.
   - Nueva RPC `cancelar_nota_credito_proveedor(_nc_id)`: prohíbe cancelar desde `Aplicada` sin motivo (o exige revertir aplicación primero).
   - Trigger `tg_proveedor_factura_recalc_estado` en `pagos_proveedor` (AFTER INSERT/UPDATE/DELETE) y en `proveedor_notas_credito` (AFTER UPDATE OF estado): recalcula `estado` (Vigente/Pagada) desde la vista, reemplazando la lógica cliente.

2. Servicio: `proveedorNotasCredito.ts` cambia UPDATE directo por `supabase.rpc(...)`. Eliminar `recalcularEstadoFactura` del cliente y `await` correspondientes.

3. Guardrail tests: NC en Borrador no puede aplicarse; NC que liquida el total mueve factura a Pagada sin round-trip cliente; eliminación de pago devuelve a Vigente.

### Fase O (v13.301.86) — Cuadre en aprobación de CxP [BUG 23] + hueco de Fase H [Obs 4]

1. Migración:
   - En `aprobar_factura_proveedor`, antes del UPDATE a 'aprobada', validar:
     - `pf.total ≈ SUM(pfc.monto_asignado)` (tolerancia 0.5).
     - Cada `pfc.concepto_costo_id NOT NULL` referencia un `conceptos_costo` cuyo `embarque_id = pf.embarque_id`.
     - Levantar `LC_CXP_CUADRE_INCONSISTENTE` con detalle.
   - Reforzar Fase H: en `calcular_demoras_embarque`, filtrar también los `conceptos_costo` con match en `proveedor_facturas_conceptos` (no solo proforma/factura). Bloquear si hay pfc vinculada; nunca DELETE.

2. UI: mapear `LC_CXP_CUADRE_INCONSISTENTE` a toast comprensible en el diálogo de aprobación.

3. Guardrail tests: aprobar sin cuadrar rechaza; recalcular demoras con pfc match rechaza; corregir cuadre permite aprobar.

### Fase P (v13.301.87) — Cartas garantía re-evaluables + anticipos + aplicación parcial pfc [Observaciones]

1. Cartas garantía:
   - Migración: añadir función `revalidar_cartas_garantia()` que, para cada `embarque_garantias_contenedor` en estado `liberado` cuya `carta_garantia_vigente_hasta < CURRENT_DATE` al momento actual, la mueva a `retenido` (o alerta configurable) y registre bitácora.
   - Cron (pg_cron) diario si está habilitado; si no, endpoint de mantenimiento invocable manualmente.
   - Vista `v_cartas_garantia_por_vencer` (≤ 30 días) para dashboard de alertas.

2. Anticipos a proveedor:
   - Migración: agregar columna `es_anticipo boolean default false` en `pagos_proveedor` y permitir `proveedor_factura_id NULL` cuando `es_anticipo = true`.
   - Nueva tabla `saldos_anticipo_proveedor` (vista) con `SUM(anticipos) - SUM(aplicaciones)` por proveedor.
   - RPC `aplicar_anticipo_a_factura` que consume anticipo y crea pago normal (misma unidad de la Fase L).
   - Nota: sin UI en esta fase — solo modelo y RPC. La UI queda como fase P.1 si se aprueba.

3. Aplicación parcial en pfc:
   - Migración: `ALTER TABLE proveedor_facturas_conceptos ADD COLUMN monto_asignado numeric(18,4)` (con backfill = `monto_original`) y constraint `SUM(monto_asignado) over concepto_costo_id ≤ conceptos_costo.total`.
   - Ajustar `aprobar_factura_proveedor` de Fase O para usar `monto_asignado`.

4. Guardrail tests correspondientes.

### Cierre

- Bump `APP_VERSION` a `13.301.87`.
- Entrada en `CHANGELOG.md` para cada fase.
- Actualizar `.lovable/memories/features/modulo-compras.md` con la nueva unidad monetaria persistida y la máquina de estados NC.

### Nota sobre BUG 24

No requiere trabajo — la guarda de BD ya existe. Lo dejaré documentado en el changelog como "verificado, sin cambios" para cerrar la traza de la auditoría.

---

## Cronograma sugerido

Fases L y M son las críticas (Alto). Propongo empezar por Fase L (más invasiva porque toca datos históricos con backfill y modifica la vista de saldo que consume medio ERP), correr CI, y avanzar sólo si queda verde. M-N-O-P después, secuenciales.

¿Arranco con Fase L en la siguiente iteración?
