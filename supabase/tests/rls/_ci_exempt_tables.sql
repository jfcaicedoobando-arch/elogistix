-- ============================================================================
-- Catálogo ÚNICO de tablas exentas de los linters de RLS.
--
-- Antes cada linter mantenía su propia lista inline y se desincronizaban: una
-- tabla nueva de catálogo global se agregaba en un archivo y el otro fallaba
-- (o peor: una tabla con datos de tenant se colaba en una lista y quedaba sin
-- auditar en silencio).
--
-- Categorías:
--   'sin-rls'           → legítimamente NO necesita RLS habilitado
--                         (consumidor: _ci_verify_rls.sql).
--   'sin-filtro-tenant' → tiene columna organization_id pero su acceso NO se
--                         resuelve por tenant (token, key, service_role…)
--                         (consumidor: test_rls_policy_linter.sql).
--
-- Reglas: toda entrada nueva DEBE traer motivo. Los backups temporales viven
-- fuera de `public` o con RLS deny-all; NUNCA se exentan aquí.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp._ci_exempt_tables;
CREATE TEMP TABLE _ci_exempt_tables (tabla text, categoria text, motivo text);

INSERT INTO _ci_exempt_tables (tabla, categoria, motivo) VALUES
  ('ratelimit_buckets', 'sin-rls', 'bucket de rate limiting interno (por key, sin dueño)'),

  ('catalogo_claves_sat',        'sin-filtro-tenant', 'catálogo SAT global'),
  ('planes',                     'sin-filtro-tenant', 'catálogo de planes'),
  ('tipos_contenedor',           'sin-filtro-tenant', 'catálogo global'),
  ('navieras',                   'sin-filtro-tenant', 'catálogo global de líneas navieras'),
  ('puertos',                    'sin-filtro-tenant', 'catálogo UN/LOCODE'),
  ('configuracion_global',       'sin-filtro-tenant', 'config app-wide (owner)'),
  ('email_unsubscribe_tokens',   'sin-filtro-tenant', 'acceso vía token, no por org'),
  ('tracking_links',             'sin-filtro-tenant', 'acceso vía token'),
  ('ratelimit_buckets',          'sin-filtro-tenant', 'acceso vía key'),
  ('suppressed_emails',          'sin-filtro-tenant', 'supresión de correo global'),
  ('demo_leads',                 'sin-filtro-tenant', 'landing público'),
  ('folio_secuencias',           'sin-filtro-tenant', 'app-wide'),
  ('idempotency_keys',           'sin-filtro-tenant', 'se resuelve por user_id'),
  ('email_send_state',           'sin-filtro-tenant', 'interno de edge functions'),
  ('facturapi_webhook_eventos',  'sin-filtro-tenant', 'ingest interno de FacturAPI (solo service_role)');

CREATE OR REPLACE FUNCTION pg_temp.tablas_exentas(_categoria text) RETURNS text[]
LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_agg(tabla), ARRAY[]::text[])
    FROM pg_temp._ci_exempt_tables
   WHERE categoria = _categoria;
$$;
