# Plan — Fixes E2E backend LibreCarga (16 correcciones)

Aplico los 16 fixes del documento **en el orden que indica** (BLOQUE 1 → 2 → 3), cada bloque en su propia migración nueva. Nada de editar migraciones previas.

Convenciones respetadas: RPC en Postgres para transacciones multi-tabla, RLS org-scoped, redondeo explícito a 2 decimales, conjunto canónico de estados de NC, regenerar `types.ts` y `typecheck` verde al final.

## Analogía rápida (para ti)

Piensa en la BD como un banco:
- **Bloque 1** = arreglar la caja (no puede cerrar el día, cuenta mal el saldo, aplica reglas con la métrica equivocada).
- **Bloque 2** = poner cerrojos: cada usuario solo debe ver/tocar lo suyo y solo el rol correcto puede mover dinero.
- **Bloque 3** = limpiar decimales y quitar valores "por default" trampa (TC=17.5), y dejar el esquema reproducible desde cero.

---

## BLOQUE 1 — Cierre de embarques y PNL (una sola migración)

`supabase/migrations/<ts>_fix_cierre_pnl_estados.sql`

1. **FIX-BL-01** — En `public.transicion_embarque_valida`, agregar `Entregado → Cerrado` (verificado hoy: solo permite `EIR → Cerrado`). Cierre real sigue pasando por `validar_cierre_embarque` (CxC/CxP liquidadas).
2. **FIX-BL-02** — Redefinir `public.pnl_financiero_embarque(_embarque_id)`:
   - CTE de facturas: `estado NOT IN ('Borrador','Cancelada','Sustituida')`.
   - `pdte_cobro_mxn` usando `saldo_factura(f.id)` por factura (no `total − algún neto`), convertido a MXN con TC del embarque.
   - Simetría en `pdte_pago_mxn`: por `proveedor_facturas` vigentes, restando `SUM(pagos_proveedor.monto_en_moneda_factura)` con `pp.deleted_at IS NULL`.
   - Recalcular snapshots/`embarques.pnl` afectados al final de la migración.
3. **FIX-BL-03** — En `validar_cierre_embarque`, cambiar `pnl->>'utilidad'` por `pnl->>'utilidad_mxn'`. Auditar en la misma migración todas las lecturas del JSON de PNL en funciones de cierre/comisiones y alinearlas al shape real.
4. **FIX-BL-04** — Redefinir `recalcular_estado_factura` (y su trigger asociado): condición de `Pagada` = `total_pagos_aplicados >= (total - COALESCE(ncs_aplicadas,0)) - 0.01`. Antes de eso, definir el **conjunto canónico** de estados de NC que descuentan saldo (propuesta: `('Aplicada')`) y reemplazarlo en `saldo_factura`, `saldo_factura_bruto`, `pnl_financiero_embarque` y guards de pago para que todos usen el mismo set.
5. **FIX-BL-05** — En `portal_responder_cotizacion` (ambas firmas), exigir `estado='Enviada' AND fecha_vigencia >= CURRENT_DATE`; si venció → `RAISE EXCEPTION 'LC_COTIZACION_VENCIDA'`. Ajustar copy en el portal para traducirlo.

**Aceptación:** cerrar E-4 pagado, `pnl(E-1) → venta 32,620.69 / pdte_cobro 16,480`, factura con NC+pago exacto → `Pagada`, cotización vencida → `LC_COTIZACION_VENCIDA`.

---

## BLOQUE 2 — Seguridad multi-tenant y roles (migración separada)

`supabase/migrations/<ts>_seguridad_tenant_roles.sql`

6. **FIX-BL-06** — Guard de tenant en TODAS las SECURITY DEFINER que reciben `uuid` y son consultables por `authenticated`:
   - `saldo_factura`, `saldo_factura_bruto`, `pnl_financiero_embarque`, y cualquier función de estado financiero / documentos / tracking que hoy no valide.
   - Patrón: leer `organization_id` del recurso; si `<> current_user_org_id()` → `RETURN NULL` (o `RAISE` según convención existente).
   - Añadir tests en `supabase/tests/rls/`.
7. **FIX-BL-07** — Redefinir policies `FOR ALL` de `pagos_factura`, `factura_notas_credito`, `pagos_proveedor`, `proveedor_notas_credito` y la RPC de pago masivo: **escritura solo `admin | contador` (+ rol de cobranza si aplica)**; `operador` queda `SELECT`. Revisar también compuertas dentro de RPCs.
8. **FIX-BL-08** — Policy `Tenant CRUD clientes`: DELETE **solo `admin`** en catálogos maestros (clientes, proveedores, puertos, navieras). Soft-delete via `deleted_at` sigue disponible para roles operativos donde el negocio lo pida.
9. **FIX-BL-09** — Definir un **conjunto canónico de roles escritores financieros** (propuesta: `admin_org | contador | super_admin`) y aplicarlo en la compuerta externa y en `_assert_writer` interno de `convertir_proformas_a_factura`, `registrar_pago*`, RPCs de NCs y cierre.
10. **FIX-BL-10** — Ajustar policy "Hide soft deleted pagos_factura" para permitir `UPDATE deleted_at` a los roles escritores financieros, o encapsular el borrado en RPC `eliminar_pago` con la misma compuerta.

**Aceptación:** cross-tenant `saldo_factura` → NULL; operador `INSERT` en `pagos_factura` → denied; contador puede convertir proformas y soft-deletear pagos.

---

## BLOQUE 3 — Integridad financiera y esquema (migración final)

`supabase/migrations/<ts>_integridad_financiera_schema.sql`

11. **FIX-BL-11** — `embarques.tipo_cambio_usd/_eur`: quitar `DEFAULT 17.5/19.0`. En `crear_embarque_completo` y `crear_embarque_borrador_desde_cotizacion` setear TC vigente del día desde la tabla/servicio de TC; si no hay TC, dejar NULL (UI ya muestra "TC faltante"). Nunca convertir 1:1.
12. **FIX-BL-12** — En `convertir_proformas_a_factura`:
    - Validar `Σ conceptos = encabezado ± 0.01`; si no → `LC_PROFORMA_DESCUADRADA` con ambos montos.
    - Soportar EUR usando `tipo_cambio_eur` **o** rechazar con `LC_MONEDA_NO_SOPORTADA`. Nunca retornar vacío silencioso.
13. **FIX-BL-13** — Guard de pagos (CxC y CxP): rechazar si `saldo_disponible <= 0.005`. Mantener tolerancia solo para redondeo genuino.
14. **FIX-BL-14** — `on_auth_user_created`: respetar `raw_user_meta_data.role` validado contra un allowlist server-side; nunca auto-asignar `admin` fuera del bootstrap explícito de la primera org. Documentar el flujo de provisionamiento en un comentario de la migración.
15. **FIX-BL-15** — Colapsar sobrecargas de `convertir_proformas_a_factura`: dejar **una firma canónica** con parámetros nombrados; renombrar la legacy a `*_v1` marcada `DEPRECATED` (o `DROP` si no hay callers). Frontend siempre con named params.
16. **FIX-BL-16** — Migración "schema-reconciliation" con `CREATE ... IF NOT EXISTS` para: `tracking_externo`, `tracking_intentos`, `proformas.es_consolidada`, `proformas.estado_aprobacion`, secuencia `embarque_consecutivo_seq`. Shape idéntico al de producción para que `supabase db reset` reconstruya todo.

---

## Post-migración (obligatorio en cada bloque)

- Regenerar `src/integrations/supabase/types.ts`.
- Ajustar callers en `src/features/**` cuando cambien firmas (BL-15) o mensajes de error nuevos (BL-05/BL-12).
- Ejecutar checklist final del documento:
  ```bash
  supabase db reset && supabase test db
  bun run typecheck && bun run test:fast
  ```
- Bumpear `APP_VERSION` y anotar cada bloque en `CHANGELOG.md` (formato `## [X.Y.Z] - YYYY-MM-DD`).

## Riesgos y mitigación

- **Cambios de firma (BL-15) y de estados de NC (BL-04)** pueden romper callers. Antes de aplicar hago un `rg` completo sobre `src/` y `supabase/functions/` para listar consumidores y ajustarlos en el mismo PR.
- **Guard de tenant (BL-06)** puede devolver NULL en pantallas legítimas si un caller pasa un UUID sin sesión válida — reviso los tests RLS y agrego cobertura antes de mergear.
- **Recálculo de snapshots PNL (BL-02)** puede ser costoso; lo hago en un `DO $$` idempotente al final de la migración para evitar dobles cargos.

Cuando apruebes el plan cambio a modo build y ejecuto en el orden listado, deteniéndome tras cada bloque para verificar los criterios de aceptación.
