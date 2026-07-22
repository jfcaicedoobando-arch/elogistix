## Objetivo

Aplicar el **BLOQUE B (P1)** de la auditoría R2: 13 correcciones de alto impacto sobre motor financiero, RLS multi-tenant, máquina de estados y reportes. Todo se resuelve con una migración correctiva + ajustes mínimos en frontend donde afecta a filtros de moneda; no hay cambios de UI ni de rutas.

**Nota:** FIX-R2-08 (diferencial cambiario CxP) ya quedó cubierto por FIX-R2-03 en el Bloque A; se registra como "ya aplicado" en el changelog y no se re-implementa aquí.

## Cambios (una sola migración `blockB_p1_r2.sql`)

Se agrupan por dominio para minimizar riesgo:

### 1. Motor de saldos y estados de factura (cliente)
- **FIX-R2-05** — `recalcular_estado_factura` suma NCs aplicadas al total cobrado antes de comparar contra el total, para que factura 10000 + NC 4000 + pago 6000 quede en `Pagada` (no `Parcialmente pagada`).
- **FIX-R2-07** — nuevo trigger `guard_estado_factura` sobre `public.facturas`:
  - Prohíbe reabrir facturas `Cancelada`.
  - Prohíbe pasar a `Cancelada` por UPDATE directo (sólo vía función `cancelar_factura` marcando `app.cancelando_factura='1'`) y sólo si no tiene pagos vivos.
  - Restringe estados calculados (`Pagada`, `Parcialmente pagada`, `Vencida`) a la ventana `app.recalc_estado='1'` que setea `recalcular_estado_factura`.
- **FIX-R2-15** — índice único parcial `facturas_numero_org_unico (organization_id, numero) WHERE deleted_at IS NULL AND numero IS NOT NULL`. Antes de crearlo, script defensivo `DO $$ ... $$` que renombra duplicados existentes a `numero || '-DUP-' || id[:8]` para no romper la migración.

### 2. Retenciones y prorrateo
- **FIX-R2-06** — en `calc_pago_retenciones`, base = `subtotal + iva − ret_iva − ret_isr` (total neto), no `subtotal + iva`.

### 3. CxP: pagos, monedas, aging
- **FIX-R2-08** — ya resuelto en Bloque A (FIX-R2-03). Sólo se documenta.
- **FIX-R2-09** — CHECK constraints:
  - `pagos_proveedor.monto > 0`, `pagos_factura.monto > 0`.
  - `pagos_proveedor.tipo_cambio_usd IS NULL OR > 0` y análogo en `pagos_factura`.
  - El `RAISE` cuando falta TC en cruce de monedas ya está en el guard existente (Bloque A).
- **FIX-R2-10** — reescribir `cxp_por_pagar` y `cxp_aging_proveedores` para sumar `monto_en_moneda_factura` en lugar de `monto`. Verificar previamente los nombres reales de columna con `psql` antes de ejecutar la migración; ajustar si difieren.

### 4. Multi-tenant / oráculos
- **FIX-R2-13** — endurecer `cxp_aging_proveedores(p_org)` y `embarques_list_extras(p_ids)`:
  - Ignorar `p_org` recibido; usar `current_user_org_id()` salvo `super_admin`.
  - En `embarques_list_extras`, JOIN a `public.embarques` con `organization_id = current_user_org_id() OR has_role('super_admin')`.
- **FIX-R2-14** — recargar policy `Tenant read clientes` para excluir al rol `cliente` (portal), que sigue leyendo vía la policy existente `Cliente read own clientes`. Verificar el nombre exacto y el helper `current_user_org_role()` antes de escribir.

### 5. Reportes financieros
- **FIX-R2-17** — tres arreglos:
  - `cartera_pendiente()`: `saldo := total − pagado − nc_aplicadas`.
  - `embarque_estado_financiero()`: excluir `Sustituida` además de `Cancelada`; normalizar capturado/pagado a MXN vía `convertir_a_mxn` antes de comparar semáforo de costos.
  - `facturacion_por_emitir()`: usar `lower(p.estado_aprobacion) = 'aprobada'` para tolerar variantes de case.

### 6. Cotizaciones
- **FIX-R2-11** — en `aceptar_cotizacion_version` y `crear_embarque_borrador_desde_cotizacion`, `RAISE 'LC_COT_VENCIDA'` si `fecha_vigencia < CURRENT_DATE`.

### 7. Proformas EUR
- **FIX-R2-12** — en `convertir_proformas_a_factura`:
  - Ampliar el filtro a `moneda IN ('MXN','USD','EUR')` en los `SELECT` sobre `conceptos_venta` y `proforma_conceptos_consolidados`.
  - Emitir factura EUR (tercer bloque análogo al MXN/USD) o convertir EUR→MXN/USD si la política del proyecto lo pide. **Pregunta abierta**: el manifiesto no aclara; propongo emitir tercera factura EUR con `tipo_cambio_eur` del embarque como TC en base MXN.
  - Si aparece moneda no soportada → `RAISE 'LC_PROFORMA_MONEDA_NO_SOPORTADA'`.

### 8. Signup y roles
- **FIX-R2-16** — reescribir `handle_new_user_signup`:
  - No insertar rol `admin` por defecto.
  - Sólo si `NOT EXISTS (SELECT 1 FROM user_roles)` → asignar `super_admin` al primer usuario.
  - Eliminar la creación automática de "Mi organización" con membresía admin. La membresía viene por invitación/onboarding.
  - **Riesgo alto:** este cambio afecta el flujo de alta actual. Antes de aplicar, verificar que exista un flujo de invitación o de onboarding que asigne membresía; si no, dejar FIX-R2-16 fuera del bloque y ejecutarlo en un ciclo posterior con el flujo de invitación listo.

## Verificaciones post-migración

1. `bunx vitest run` completo — atención a `saldo-factura-fase-d.test.ts` y tests de proformas.
2. `bun run lint -- --max-warnings 0`.
3. Query de humo:
   - Crear factura + NC + pago → verificar estado final `Pagada` (R2-05).
   - Intentar `UPDATE facturas SET estado='Cancelada'` a mano → debe fallar (R2-07).
   - `INSERT` de segunda factura con mismo `numero` en misma org → debe fallar (R2-15).
   - Como usuario portal `cliente`, `SELECT * FROM clientes` → sólo su registro (R2-14).
   - Como Org B, `cxp_aging_proveedores('org-A-uuid')` → error `LC_ORG_FORBIDDEN` (R2-13).
   - Proforma EUR → conversión emite factura EUR (R2-12).

## Bump y changelog

- `APP_VERSION` → `13.306.0` (subida de minor por cambio de contrato en máquina de estados de facturas y signup).
- Entrada consolidada en `CHANGELOG.md` con un bullet por FIX + analogía global.

## Preguntas antes de migrar

1. **FIX-R2-12 (proformas EUR):** ¿emitir tercera factura EUR o forzar conversión a MXN/USD antes de facturar?
2. **FIX-R2-16 (signup):** ¿ya existe un flujo de invitación operativo, o dejamos este FIX para después y aplicamos los otros 12?
3. **FIX-R2-14:** ¿el rol del portal se llama exactamente `cliente` en `current_user_org_role()`?

Si prefieres, arranco con los FIX que no dependen de estas respuestas (05, 06, 07, 09, 10, 11, 13, 15, 17) y dejamos 12/14/16 para un segundo empujón.
