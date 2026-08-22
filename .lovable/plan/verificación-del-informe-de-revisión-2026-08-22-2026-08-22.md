# Verificación del informe de revisión (2026-08-22)

Revisé los 6 bloqueantes contra la base viva y el repositorio. **5 de 6 son bugs reales**; uno es real pero sólo en despliegue limpio, y otro (B-4) es real en la dirección del problema aunque falta confirmarlo con números.

## Veredicto por bloqueante

| # | Hallazgo | Veredicto | Evidencia |
|---|---|---|---|
| B-1 | Guard `IF NOT is_org_member(...)` no dispara para usuarios sin organización | **REAL (crítico)** | `is_org_member` = `current_user_org_id() = p_org OR has_role(super_admin)`; sin org devuelve NULL → `NOT NULL` = NULL → no lanza. El patrón aparece en **16 funciones** de la base actual |
| B-1b | `revertir_proforma_al_cancelar_sustitucion` inserta `usuario_email = NULL` | **REAL** | El INSERT a bitácora pasa `NULL` en esa posición; la columna es NOT NULL → la reversión falla siempre |
| B-2 | El espejo `20260826003000_ola2_comisiones_espejo.sql` (última en orden de replay) redefine `calcular_comision_pago` **sin** el puente `factura_embarques` | **REAL** | Cero ocurrencias de `factura_embarques` en esa migración; en la base viva existen dos versiones y una no lo usa → facturas consolidadas quedan en comisión 0 |
| B-3 | `rechazar_documento_embarque` llama `_assert_writer()` sin argumentos | **REAL (funcionalidad caída)** | El único overload existente es `_assert_writer(uuid)` → error 42883 en cada llamada |
| B-4 | La nota de crédito no reduce la comisión | **REAL en dirección, pendiente de cuantificar** | La NC sólo se resta en el **denominador** (`venta_embarque_mxn_neta`); el numerador (cobrado) no se ajusta → la proporción sube. Falta un caso numérico que fije el valor esperado |
| B-5 | El fix de zona horaria CDMX se pierde en replay limpio | **REAL sólo en base nueva** | La base viva sí tiene `America/Mexico_City`, pero la última migración que define `generar_liquidacion_comision` (`bl05`, 20260825000400) no la incluye |
| B-6 | `has_any_role_in_org` amplía acceso a `auxiliar_contable` | **REAL (cambio de acceso no documentado)** | `roles_jerarquia('contador')` = `{contador, auxiliar_contable, admin_org, super_admin}` |
| Tests | `ola2_faseb_regresion.sql` y `ola2_faseb2_regresion.sql` no están en CI | **REAL** | `rls-tests.yml` sólo ejecuta `ola1_candados_regresion.sql` y `ola2_comisiones_regresion.sql` |

Los 13 hallazgos medios (M-1 a M-13) no los verifiqué uno por uno; los dos de seguridad (M-1 vendedor global, M-2 orden de guards) siguen el mismo patrón que B-1 y B-6, así que son creíbles.

## Plan de corrección propuesto (por entregas)

### Entrega 1 — Seguridad y funciones caídas (bloqueantes)
1. Sustituir `IF NOT public.is_org_member(x)` por `IF public.is_org_member(x) IS NOT TRUE` en las 16 funciones detectadas (lógica trivaluada: NULL ya no pasa).
2. `revertir_proforma_al_cancelar_sustitucion`: usar `COALESCE(auth.email(), '')` en la bitácora.
3. `rechazar_documento_embarque`: pasar `v_org` a `_assert_writer`, proteger documentos `Validado`, elevar el mínimo del motivo a 10 caracteres (igual que el front) y notificar a quien subió el documento.
4. Tests SQL nuevos: usuario **sin organización** contra las RPCs con guard de org, y rechazo de documento (camino feliz + writer sin permiso).

### Entrega 2 — Comisiones y replay (bloqueantes)
5. Re-emitir el cuerpo definitivo de `calcular_comision_pago` **después** del espejo, con el puente `factura_embarques`, y actualizar el espejo canónico en `supabase/schema/`.
6. Migración posterior a `bl05` que reponga la zona `America/Mexico_City` en `generar_liquidacion_comision`.
7. Incorporar la NC al prorrateo (numerador alineado con `saldo_factura`) y excluir `ajuste_nc_liquidada` del auto-cierre del cron, con caso numérico de regresión (factura cobrada 100% + NC 20% → comisión al 80%).
8. Corregir la entrada 13.709.0 del CHANGELOG (facturas consolidadas quedó revertida).

### Entrega 3 — Red de CI y accesos
9. Cablear `ola2_faseb_regresion.sql` y `ola2_faseb2_regresion.sql` en `rls-tests.yml`.
10. Check de CI que compare el cuerpo final de las ~20 funciones de dinero contra su espejo en `supabase/schema/` (extender `audit:replay-mirror`), para que no vuelva a pasar lo de B-2/B-5.
11. Query pre-deploy de usuarios con rol financiero en `user_roles` sin membresía en `organization_members`, decisión documentada sobre `auxiliar_contable` y backfill si aplica.

### Entrega 4 — Medios de seguridad
12. M-1: acotar `crm_propagar_conversion_cliente` al vendedor dueño (o rol gerencial) y no pisar conversiones previas.
13. M-2: validar rol **antes** de existencia/tenencia en las RPCs de lote (evita el oráculo de existencia).

El resto de medios (M-3 a M-13) quedan como backlog priorizado después del release.

## Detalles técnicos

- Todas las correcciones de SQL van en migraciones nuevas con timestamp posterior al espejo `20260826003000`, más su espejo en `supabase/schema/` para sobrevivir un replay limpio.
- Cada `CREATE OR REPLACE FUNCTION` conserva `SECURITY DEFINER` + `SET search_path = public` y los GRANT/REVOKE actuales (sin `anon`, para no romper la lista blanca FIX-45).
- Cada entrega bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
