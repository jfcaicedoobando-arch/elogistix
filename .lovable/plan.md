
# Auditoría de tests RLS — Libre Carga

## Estado actual (lo que ya está bien)

- **8 suites SQL** con ~60 aserciones sobre 35 tablas + 1 RPC.
- **Workflow `rls-tests.yml`** con snapshot cacheado (pg_dump) y matriz; valida que cada `test_rls_*.sql` esté declarado en `matrix.suite` (bloquea "test huérfano en verde").
- **Verificador `_ci_verify_rls.sql`** falla si una tabla en `public` no tiene RLS o queda con RLS pero sin policies.
- **Helpers** (`as_user`, `as_postgres`, `assert_insert_blocked`) consistentes; el `nullif(...,'')::jsonb` en `auth.uid()` blinda el reset de claims.
- **Escalada `super_admin`** probada negativamente en `roles_no_admin` (Test 11b).
- **WITH CHECK cruzado** cubierto en 7 tablas financieras críticas.

---

## Hallazgos (ordenados por riesgo)

### H1 — Roles de negocio sin cobertura (ALTO)
Sólo se prueban 4 roles de los 18 del enum `app_role`. Sin tests:
- `vendedor` — debería ver **sólo sus leads/oportunidades**, no las de otros vendedores de la misma org.
- `contador`, `tesorero`, `ejecutivo_cobranza`, `auxiliar_contable` — acceso financiero diferenciado (¿ve todos los pagos? ¿modifica facturas?).
- `agente_carga` — partner externo con acceso vía `agente_users`; una policy laxa puede filtrar tarifas de otras orgs.
- `super_admin` — sólo se prueba el bloqueo de escalada; **no** que efectivamente vea todas las orgs (positivo).

### H2 — Portal cliente: aislamiento intra-org sin probar (ALTO)
`test_rls_isolation` cubre que un `user_cli` ligado a `cli_a` no vea embarques de otra org. **No prueba** que dentro de la misma org, `user_cli` (client_users→cli_a) no vea facturas/proformas/documentos/pagos del `cli_b` de esa misma org. Es el vector clásico de fuga en portales B2B.

### H3 — RPCs `SECURITY DEFINER` sin cobertura (ALTO)
El proyecto tiene **200+ funciones** `SECURITY DEFINER` (aplicar_anticipo_a_factura, cxp_aging_proveedores, clientes_listado, busqueda_global, portal_obtener_*, aprobar_factura_proveedor, etc.). Sólo **una** (`provision_organization`) tiene suite dedicada. Una RPC que hace `SELECT ... FROM facturas WHERE id = _id` sin filtrar por `current_user_org_id()` es un bypass total de RLS.

### H4 — Tablas de dinero sin test de aislamiento (ALTO)
Fuera de las suites existentes:
- `anticipos_proveedor`, `anticipos_aplicaciones` — saldos a favor y su aplicación.
- `cobranza_seguimiento` — actividades de cobranza.
- `facturapi_credenciales` — **contiene API keys de facturación**; una fuga cross-tenant es catastrófica.
- `embarque_garantias_contenedor` + `embarque_garantias_historial` — garantías con montos.
- `cotizacion_costos_historico` — snapshots de markups.
- `costeo_navieras_condiciones`, `costeo_tarifa_recargos`, `costeo_naviera_demoras_tarifa` — precios finos.

### H5 — Dimensiones faltantes sobre tablas ya cubiertas (MEDIO)
- **DELETE cross-tenant**: sólo probado en `facturas`. No en `embarques`, `pagos_factura`, `cuentas_bancarias`, `proveedor_facturas`.
- **UPDATE cross-tenant**: sólo `clientes`, `proveedores`, `costeo_tarifas`, `crm_leads`. Falta `facturas`, `pagos_factura`, `embarques`, `cuentas_bancarias`.
- **UPDATE que cambia `organization_id`** (row "moving" entre tenants): no probado en ninguna tabla. Un WITH CHECK que sólo valida `USING` deja pasar esto.

### H6 — Anon sin test de deny-all (MEDIO)
`fix45_anon_execute_whitelist.sql` valida EXECUTE de funciones. **No hay** una suite que asuma `role='anon'` y verifique que un SELECT contra `facturas`, `embarques`, `clientes` devuelve 0 filas / permission denied. Detectaría regresiones donde alguien haga `GRANT SELECT ... TO anon` inadvertidamente.

### H7 — Verificador de policies débil (MEDIO)
`_ci_verify_rls.sql` acepta "hay ≥1 policy" como OK. Una policy `USING (true) WITH CHECK (true)` pasaría el verificador y filtraría todo. Falta un lint que exija: policy no-`super_admin` referencia `organization_id`, `current_user_org_id()`, `has_role(...)`, `client_users`, o `agente_users`.

### H8 — Storage RLS no probado (MEDIO)
`storage.objects` tiene RLS habilitado en bootstrap. Las policies reales de buckets (documentos-embarque, facturas-pdf, xml-cfdi, comprobantes-pago) validan tenancy vía `EXISTS` contra la tabla del dominio (ver `mem://technical/storage-rls-paths`). **Ninguna suite** monta un `storage.objects` y prueba que `user_b` no puede leer un objeto de `org_a`.

### H9 — Silent RLS filter (BAJO / correctitud del helper)
`assert_insert_blocked` captura `insufficient_privilege OR check_violation`. Si una policy escribe silenciosamente (INSERT devuelve 0 rows sin excepción por WITH CHECK laxa + RLS SELECT que oculta), el helper lo cuenta como falla — bien. Pero **falta el caso inverso**: un INSERT que aparenta bloqueo pero en realidad persiste (row invisible al insertador pero visible a otro tenant). Sólo lo detectaríamos con un `SELECT COUNT(*)` en modo `postgres` después.

### H10 — Inconsistencias menores (BAJO)
- `test_rls_operaciones.sql` y `test_rls_crm_operacional.sql` usan `RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);` en lugar de `pg_temp.as_postgres()`. Trabaja, pero rompe consistencia.
- `test_rls_isolation` Test 6 usa `visible <= 1` en lugar de `= 0`; laxo (deja pasar filtrado imperfecto).

---

## Plan de remediación por olas

### Ola 1 — Coberturas críticas (H1, H2, H3, H4)
Cuatro suites nuevas en `supabase/tests/rls/`, cada una siguiendo el patrón `BEGIN → seed → assert → ROLLBACK`:

1. `test_rls_portal_intra_org.sql` — misma org, cliente A vs cliente B: facturas, proformas, pagos_factura, documentos_embarque, notificaciones_cliente, factura_envios. (H2)
2. `test_rls_roles_negocio.sql` — vendedor (crm_leads/oportunidades scoped al propio email), contador (lectura financiera + bloqueo de INSERT en facturas timbradas), tesorero (cuentas_bancarias/bbva), ejecutivo_cobranza (cobranza_seguimiento). (H1)
3. `test_rls_rpc_financieras.sql` — invoca 8-10 RPCs `SECURITY DEFINER` de alto riesgo como `user_b` y valida 0 filas / 42501: `aplicar_anticipo_a_factura`, `cxp_aging_proveedores`, `cxc_aging_clientes`, `clientes_listado`, `cotizaciones_listado`, `busqueda_global`, `cartera_pendiente`, `portal_obtener_proforma_por_token`. (H3)
4. `test_rls_tablas_dinero_extra.sql` — anticipos_proveedor/aplicaciones, cobranza_seguimiento, facturapi_credenciales, embarque_garantias_*, cotizacion_costos_historico, costeo_navieras_condiciones. (H4)

Registrar los 4 en `matrix.suite` del workflow.

### Ola 2 — Dimensiones y anon (H5, H6)
Extender suites existentes (sin crear archivos nuevos):

5. Añadir a `test_rls_financiero_critico.sql`:
   - `DELETE` cross-tenant en `pagos_factura`, `cuentas_bancarias`, `proveedor_facturas`.
   - `UPDATE ... SET organization_id = org_a` desde `user_b` sobre `facturas`, `pagos_factura` (row-move attack).
6. Añadir a `test_rls_operaciones.sql`: `DELETE` cross-tenant en `embarques`, `embarque_contenedores`.
7. Nueva suite corta `test_rls_anon_denyall.sql` (H6): con `role=anon` (ya soportado por helper si extendemos `as_anon()`), asegurar que SELECT sobre `facturas`, `embarques`, `clientes`, `pagos_factura` retorna 0/deniega. Whitelist explícita: `demo_leads`, `tracking_links`, `email_unsubscribe_tokens` con token válido.

### Ola 3 — Meta-linter y storage (H7, H8)
8. Extender `_ci_verify_rls.sql`: para cada policy en `public`, si `polqual` (USING) no contiene ninguno de `organization_id`, `current_user_org_id`, `has_role`, `client_users`, `agente_users`, `is_super_admin` → warning/fail (con whitelist para catálogos globales).
9. Nueva suite `test_rls_storage_objects.sql`: seed en `storage.objects` con `path_tokens[1] = embarque_a.id`, valida que `user_b` no puede leer/mutar. Cubre buckets `documentos-embarque` y `facturas-pdf`.

### Ola 4 — Higiene (H9, H10)
10. Endurecer `assert_insert_blocked`: después de capturar la excepción, hacer un `SELECT COUNT(*)` como `postgres` para confirmar que la fila NO quedó persistida (defensa contra "INSERT que dice fallar pero deja residuo").
11. Reemplazar los 6 usos crudos de `RESET ROLE; set_config(...)` por `pg_temp.as_postgres()` en `operaciones` y `crm_operacional`.
12. Endurecer `test_rls_isolation` Test 6: cambiar `<= 1` a `= 1`.

---

## Impacto esperado

| Antes | Después Ola 1-2 | Después Ola 3-4 |
|---|---|---|
| 8 suites, ~60 aserciones, 35 tablas, 1 RPC, 4 roles | ~12 suites, ~110 aserciones, 55 tablas, 10 RPCs, 8 roles | +anon denyall, +storage, +policy linter, helper endurecido |

## Detalles técnicos (no crítico para aprobar el plan)

- Todas las suites nuevas usan la misma plantilla `BEGIN → \i _helpers → DO $$ ... $$ → ROLLBACK`; cero persistencia.
- Extender `_helpers.sql` con `pg_temp.as_anon()` (idéntico a `as_user` pero role='anon' y sub=null).
- La verificación de policies "sin filtro tenant" del meta-linter se implementa parseando `pg_policy.polqual::text` con `regexp_matches`; whitelist inicial: `catalogo_claves_sat`, `puertos`, `navieras`, `tipos_contenedor`, `planes`, `demo_leads`, `tracking_links`, `email_unsubscribe_tokens`, `ratelimit_buckets`.
- Para las RPCs de la Ola 1, la validación es: `SET LOCAL role=authenticated + JWT de user_b`, invocar la función pasando ids/tokens de `org_a`; esperar `raise_exception`/`42501` **o** empty result. Nunca ambos.
- El workflow no requiere cambios estructurales; sólo añadir las nuevas suites al bloque `matrix.suite` y el `expected` check ya las descubre automáticamente.

Al aprobar, arranco por la Ola 1 (mayor ROI de seguridad).
