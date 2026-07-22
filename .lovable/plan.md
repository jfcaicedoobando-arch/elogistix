## Verificación contra la BD real

Ejecuté queries contra la BD (triggers, funciones, constraints, políticas, vistas). Resultado por hallazgo del R3:

### ✅ Bugs REALES (a corregir)

| # | Hallazgo | Evidencia verificada |
|---|---|---|
| **R3-02** | Pagos CxP MXN sin TC fallan | `pagos_proveedor.tipo_cambio_usd` es `NOT NULL` sin default (el CHECK ya permite NULL, pero el NOT NULL de columna lo bloquea antes) |
| **R3-03 (parcial)** | Falta índice único de contenedor y BL house | No existe `contenedores_numero_unico` ni `contenedores_bl_house_unico`. El CHECK ISO ya permite `''` correctamente |
| **R3-07** | Margen mínimo compara absoluto | `validar_cierre_embarque` hace `v_utilidad_mxn >= v_margen_min` (absoluto) y tiene `EXCEPTION WHEN OTHERS → utilidad=0` que traga errores del PNL |
| **R3-08** | UPDATE directo a `Cerrado` bypassea validación financiera | `trg_embarque_transicion_valida` sólo llama `assert_transicion_embarque`, nunca `validar_cierre_embarque`. `cerrar_embarque()` ya setea `app.bypass_cierre='on'` |
| **R3-09** | Soft-delete de pagos imposible | Policy `"Hide soft deleted pagos_factura update source"` tiene `USING (deleted_at IS NULL)` y `"Hide soft deleted pagos_proveedor"` es `FOR ALL USING (deleted_at IS NULL)` — al marcar soft-delete la fila resultante falla el `WITH CHECK`/`USING` |
| **R3-20 (parcial)** | Sin validación de `total ≈ cantidad × precio_unitario` en `conceptos_venta`; `facturas.total` acepta >2 decimales | Constraints listados no incluyen esa validación |

### ❌ Bugs FALSOS (ya arreglados en migraciones previas, no aplicar el parche)

- **R3-01** — Los tres triggers (`trg_recalcular_estado_factura`, `_nc`, `trg_pagos_factura_calc_ret`) ya existen.
- **R3-04** — `convertir_proformas_a_factura` ya usa `usuario_id/modulo/entidad_nombre/detalles`, ya popula `conceptos_factura` desde `proforma_conceptos_consolidados`, y ya tiene un solo gate (`LC_PROFORMA_SIN_PERMISO`).
- **R3-05** — `marcar_facturas_vencidas` ya setea `app.recalc_estado_factura='1'`.
- **R3-06** — `validar_cierre_embarque` ya arranca con guard `LC_ORG_FORBIDDEN`.
- **R3-11** — `costeo_tarifas_vigentes_v` ya filtra `estado='vigente' AND vigente_desde<=CURRENT_DATE AND (vigente_hasta IS NULL OR vigente_hasta>=CURRENT_DATE)`.
- **R3-12** — Índice único `uq_facturas_sustituye_a_viva` ya existe.
- **R3-13** — `actualizar_embarque_completo` y `crear_embarque_borrador_desde_cotizacion` tienen una sola firma cada una.
- **R3-17** — Trigger `trg_pago_sin_rep_vivo_delete` ya existe sobre DELETE.

### 🟡 No aplican / menores

- **R3-10** — La vista `embarque_estado_financiero` no existe en la BD (evidencia obsoleta).
- **R3-14** — `folio_secuencias` ya está inicializado con valores altos correctos por org (138, 144, 338…).
- **R3-15** — `handle_new_user_signup` ya respeta `skip_auto_org=true` (early return antes de insertar `user_roles`). El rol `admin_org` en signup normal es por diseño.
- **R3-16** — El código de `calcular_comision_pago` ya deriva TC del embarque según moneda cuando el TC del pago es 0.
- **R3-18/19** — UX / idempotencia de migraciones (no bloquean).

---

## Correcciones a aplicar (una migración consolidada)

**Archivo:** `supabase/migrations/2026072300xxxx_r3_regresiones.sql`

### 1. R3-02 · Pagos CxP sin TC (MXN)
- `ALTER TABLE public.pagos_proveedor ALTER COLUMN tipo_cambio_usd DROP NOT NULL;`
- Mantener el CHECK actual (`IS NULL OR > 0`).
- En el trigger de conversión (`trg_pago_proveedor_calc_usd` o similar): exigir TC sólo cuando `pago.moneda <> factura.moneda`, con `LC_PAGO_TC_REQUERIDO`.

### 2. R3-03 · Índices únicos de contenedor y BL house
```sql
CREATE UNIQUE INDEX IF NOT EXISTS contenedores_numero_unico
  ON public.embarque_contenedores (organization_id, numero_contenedor)
  WHERE numero_contenedor IS NOT NULL AND numero_contenedor <> ''
    AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contenedores_bl_house_unico
  ON public.embarque_contenedores (embarque_id, bl_house)
  WHERE bl_house IS NOT NULL;
```
Excluir org demo `00000000-0000-0000-0000-000000000001` si hay duplicados históricos (verificar antes de crear).

### 3. R3-07 · Margen mínimo como porcentaje
- Reescribir la regla `margen_minimo` en `validar_cierre_embarque`:
  ```sql
  v_margen_pct := CASE WHEN v_venta_mxn > 0 THEN v_utilidad_mxn / v_venta_mxn * 100.0 ELSE 0 END;
  v_ok := (v_venta_mxn <= 0) OR (v_margen_pct >= v_margen_min);
  v_puede := v_puede AND v_ok;
  ```
- Quitar el `EXCEPTION WHEN OTHERS → utilidad=0` del cálculo del PNL (dejar que propague o registrar `checks := checks || 'pnl_error'`).

### 4. R3-08 · Guard de cierre en trigger de transición
- Modificar `trg_fn_embarque_transicion_valida`:
  ```sql
  IF NEW.estado = 'Cerrado' AND OLD.estado IS DISTINCT FROM 'Cerrado'
     AND coalesce(current_setting('app.bypass_cierre', true),'off') <> 'on' THEN
    RAISE EXCEPTION 'LC_CIERRE_SOLO_RPC: use cerrar_embarque()' USING ERRCODE='P0001';
  END IF;
  ```
- `cerrar_embarque()` ya setea `app.bypass_cierre='on'`, así que no rompe el flujo válido.

### 5. R3-09 · Soft-delete de pagos posible
- **Opción elegida:** exponer RPC `soft_delete_pago_factura(uuid)` y `soft_delete_pago_proveedor(uuid)` en `SECURITY DEFINER` que validen org + rol financiero y hagan el `UPDATE ... SET deleted_at=now()`. Consistente con `soft_delete_proveedor_factura` que ya existe.
- Mantener las policies actuales (protegen lecturas). No abrir un UPDATE genérico que permita evadir estado.

### 6. R3-20 · Integridad menor
- CHECK `conceptos_venta_total_calc`: `total = ROUND(cantidad * precio_unitario, 2)` (permitir tolerancia de 0.01).
- CHECK `facturas_total_escala`: `total = ROUND(total, 2)`.

### 7. Aplicación y verificación
- Correr migración vía tool de migración.
- Ejecutar suite: `bunx vitest run src/lib/__tests__/architecture.test.ts` y los tests de invariantes (`bunx vitest run tests/db-invariants`).
- Actualizar `APP_VERSION` a `13.307.3` y agregar entrada en `CHANGELOG.md`.

## Detalles técnicos

- Todas las modificaciones a funciones usan `CREATE OR REPLACE FUNCTION` con firma exacta para no invalidar dependencias.
- Las policies no se tocan (sólo se agregan RPCs SECURITY DEFINER).
- Migración idempotente: `IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, `OR REPLACE`.
- No se modifica `handle_new_user_signup` (comportamiento por diseño).
- No se agrega parche para R3-01/04/05/06/11/12/13/17 (ya aplicados).
