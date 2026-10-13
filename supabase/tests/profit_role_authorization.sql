-- Behavioral authorization contract for profit_por_cliente and reportes_resumen.
-- Run as postgres against a disposable canonical database, with ON_ERROR_STOP.
-- All data is synthetic and rolled back. No policies/constraints are weakened.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT set_config('request.jwt.claim.sub', '', true);

CREATE TEMP TABLE profit_auth_cases (
  label text PRIMARY KEY, uid uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_role public.app_role, global_role public.app_role,
  org_key text, allowed boolean NOT NULL, expected_key text
);
CREATE TEMP TABLE profit_auth_orgs (
  key text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL DEFAULT gen_random_uuid()
);
INSERT INTO profit_auth_orgs(key) VALUES ('A'), ('B'), ('inactive');
INSERT INTO public.organizations(id, nombre, activo)
SELECT id, 'Profit role guard ' || key, key <> 'inactive' FROM profit_auth_orgs;

INSERT INTO profit_auth_cases(label, tenant_role, global_role, org_key, allowed, expected_key)
SELECT 'role/' || r::text,
       CASE WHEN r::text = 'super_admin' THEN 'viewer'::public.app_role ELSE r END,
       CASE WHEN r::text = 'super_admin' THEN r ELSE NULL END,
       'A', r::text = ANY(ARRAY['admin', 'admin_org', 'super_admin', 'ejecutivo_pricing',
          'contador', 'tesorero', 'gerente_operaciones', 'gerente_comercial',
          'gerente_visor', 'auxiliar_contable']), 'A'
FROM unnest(enum_range(NULL::public.app_role)) r;
INSERT INTO profit_auth_cases(label, tenant_role, global_role, org_key, allowed, expected_key) VALUES
 ('global-admin-tenant-viewer', 'viewer', 'admin', 'A', false, NULL),
 ('global-viewer-tenant-contador', 'contador', 'viewer', 'A', true, 'A'),
 ('global-contador-no-membership', NULL, 'contador', NULL, false, NULL),
 ('no-role-no-membership', NULL, NULL, NULL, false, NULL),
 ('inactive-contador', 'contador', 'contador', 'inactive', false, NULL),
 ('fake-tenant-superadmin', 'super_admin', 'viewer', 'A', false, NULL),
 ('fake-superadmin-no-global-role', 'super_admin', NULL, 'A', false, NULL),
 ('fake-superadmin-fallback-contador', 'super_admin', 'contador', 'A', true, 'A'),
 ('multi-a-viewer-b-contador', 'viewer', 'contador', 'A', false, NULL),
 ('multi-a-contador-b-viewer', 'contador', 'viewer', 'A', true, 'A'),
 ('tenant-b-contador', 'contador', NULL, 'B', true, 'B'),
 ('super-selected-b', 'viewer', 'super_admin', 'A', true, 'B'),
 ('super-selected-inactive', 'viewer', 'super_admin', 'A', false, 'inactive'),
 ('super-no-selection', 'viewer', 'super_admin', 'A', true, NULL);

INSERT INTO auth.users(id, email)
SELECT uid, 'profit-guard-' || uid::text || '@example.invalid' FROM profit_auth_cases;

-- Historical legacy roles and a corrupt tenant super_admin cannot be created
-- through current admission triggers. Seed ONLY these transaction-local fixtures
-- as postgres; retain NOT NULL, enum, unique and FK constraints throughout.
-- Restore every named trigger before exercising any application call.
ALTER TABLE public.organization_members DISABLE TRIGGER trg_bloquear_rol_legacy_om;
ALTER TABLE public.organization_members DISABLE TRIGGER trg_bloquear_rol_plataforma_om;
ALTER TABLE public.organization_members DISABLE TRIGGER trg_sync_user_roles_om_ins;
ALTER TABLE public.user_roles DISABLE TRIGGER trg_bloquear_rol_legacy_ur;
INSERT INTO public.organization_members(organization_id, user_id, role, created_at)
SELECT o.id, c.uid, c.tenant_role, '2020-01-01'::timestamptz
FROM profit_auth_cases c JOIN profit_auth_orgs o ON o.key = c.org_key
WHERE c.tenant_role IS NOT NULL;
-- organization_members_user_id_unique permits exactly one membership per user.
-- Simultaneous A/B memberships cannot be represented without weakening schema;
-- the two multi-* cases start in A and move to B after the first assertions.
INSERT INTO public.user_roles(user_id, role)
SELECT uid, global_role FROM profit_auth_cases WHERE global_role IS NOT NULL;
ALTER TABLE public.organization_members ENABLE TRIGGER trg_bloquear_rol_legacy_om;
ALTER TABLE public.organization_members ENABLE TRIGGER trg_bloquear_rol_plataforma_om;
ALTER TABLE public.organization_members ENABLE TRIGGER trg_sync_user_roles_om_ins;
ALTER TABLE public.user_roles ENABLE TRIGGER trg_bloquear_rol_legacy_ur;

INSERT INTO public.super_admin_org_activa(user_id, organization_id)
SELECT c.uid, o.id FROM profit_auth_cases c JOIN profit_auth_orgs o
 ON o.key = CASE c.label WHEN 'super-selected-b' THEN 'B'
                         WHEN 'super-selected-inactive' THEN 'inactive' ELSE 'A' END
WHERE c.global_role = 'super_admin' AND c.label <> 'super-no-selection';

INSERT INTO public.clientes(id, organization_id, nombre, email)
SELECT client_id, id, 'Profit client ' || key, 'profit-' || lower(key) || '@example.invalid'
FROM profit_auth_orgs;
INSERT INTO public.embarques(id, organization_id, cliente_id, cliente_nombre,
 expediente, modo, tipo, estado, eta, tipo_cambio_usd, tipo_cambio_eur)
SELECT shipment_id, id, client_id, 'Profit client ' || key,
 'ELPGA' || (CASE key WHEN 'A' THEN '1' WHEN 'B' THEN '2' ELSE '3' END),
 'Marítimo', 'Importación', 'Arribo', CURRENT_DATE, 20, 22
FROM profit_auth_orgs;
INSERT INTO public.conceptos_costo(organization_id, embarque_id, concepto, monto, moneda)
SELECT id, shipment_id, 'Synthetic profit authorization cost',
 CASE key WHEN 'A' THEN 100 WHEN 'B' THEN 200 ELSE 300 END, 'MXN'
FROM profit_auth_orgs;

GRANT SELECT ON profit_auth_cases, profit_auth_orgs TO authenticated, service_role;

-- Helpers are SECURITY INVOKER, so execution takes place with the actual API
-- database role and claims. A failed expectation must never become a false pass.
CREATE FUNCTION pg_temp.profit_expect_denied(p_label text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  BEGIN
    PERFORM * FROM public.profit_por_cliente();
    RAISE EXCEPTION 'FAIL [%]: direct RPC succeeded', p_label;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Empty-result filters must not let an unauthorized caller skip the guard.
  BEGIN
    PERFORM * FROM public.profit_por_cliente('2100-01-01', '1900-01-01', 'none',
                                            '00000000-0000-4000-8000-000000000000');
    RAISE EXCEPTION 'FAIL [%]: filtered direct RPC succeeded', p_label;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.reportes_resumen();
    RAISE EXCEPTION 'FAIL [%]: wrapper succeeded', p_label;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
CREATE FUNCTION pg_temp.profit_expect_allowed(p_label text, p_key text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  expected_client uuid;
  expected_cost numeric;
  rows_count bigint;
  matching_count bigint;
  actual_cost numeric;
  actual_cost_usd numeric;
  payload jsonb;
BEGIN
  SELECT client_id, CASE key WHEN 'A' THEN 100 WHEN 'B' THEN 200 ELSE 300 END
    INTO expected_client, expected_cost FROM profit_auth_orgs WHERE key = p_key;
  SELECT count(*), count(*) FILTER (WHERE cliente_id = expected_client), sum(costo_mxn), sum(costo_usd)
    INTO rows_count, matching_count, actual_cost, actual_cost_usd FROM public.profit_por_cliente();
  IF p_key IS NULL THEN
    IF rows_count <> 0 THEN RAISE EXCEPTION 'FAIL [%]: unscoped data returned', p_label; END IF;
  ELSIF rows_count <> 1 OR matching_count <> 1 OR actual_cost IS DISTINCT FROM expected_cost THEN
    RAISE EXCEPTION 'FAIL [%]: tenant result rows=%, matching=%, cost=% expected=%',
      p_label, rows_count, matching_count, actual_cost, expected_cost;
  END IF;
  payload := public.reportes_resumen();
  IF jsonb_array_length(payload->'clientes') <> (CASE WHEN p_key IS NULL THEN 0 ELSE 1 END)
     OR (payload->'kpis'->>'totalClientes')::bigint <> rows_count THEN
    RAISE EXCEPTION 'FAIL [%]: wrapper count mismatch: %', p_label, payload;
  END IF;
  IF p_key IS NOT NULL AND (payload->'clientes'->0->>'cliente_id')::uuid IS DISTINCT FROM expected_client THEN
    RAISE EXCEPTION 'FAIL [%]: wrapper crossed tenant: %', p_label, payload;
  END IF;
  IF p_key IS NOT NULL AND (
       actual_cost_usd IS DISTINCT FROM round(expected_cost / 20, 4)
       OR (payload->'clientes'->0->>'costo_usd')::numeric IS DISTINCT FROM actual_cost_usd
       OR (payload->'clientes'->0->>'profit_usd')::numeric IS DISTINCT FROM -actual_cost_usd
       OR (payload->'kpis'->>'profit')::numeric IS DISTINCT FROM -actual_cost_usd) THEN
    RAISE EXCEPTION 'FAIL [%]: direct/wrapper financial mismatch: %', p_label, payload;
  END IF;
  -- An explicit foreign client ID cannot expand org_scope, even for superadmin.
  SELECT count(*) INTO rows_count FROM public.profit_por_cliente(NULL, NULL, NULL,
    (SELECT client_id FROM profit_auth_orgs WHERE key = CASE p_key WHEN 'A' THEN 'B' ELSE 'A' END));
  IF rows_count <> 0 THEN RAISE EXCEPTION 'FAIL [%]: foreign client filter leaked', p_label; END IF;
END;
$$;

SET LOCAL ROLE authenticated;
DO $tests$
DECLARE c record; expected_scope uuid; allowed_roles integer := 0; denied_roles integer := 0;
BEGIN
  IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'FAIL: wrong API role'; END IF;
  FOR c IN SELECT * FROM profit_auth_cases ORDER BY label LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', c.uid, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', c.uid::text, true);
    SELECT id INTO expected_scope FROM profit_auth_orgs
      WHERE key = CASE WHEN c.global_role = 'super_admin' THEN c.expected_key ELSE c.org_key END;
    IF public.org_scope() IS DISTINCT FROM expected_scope THEN
      RAISE EXCEPTION 'FAIL [%]: fixture org_scope incorrect', c.label;
    END IF;
    IF c.allowed THEN
      PERFORM pg_temp.profit_expect_allowed(c.label, c.expected_key);
      IF c.label LIKE 'role/%' THEN allowed_roles := allowed_roles + 1; END IF;
    ELSE
      PERFORM pg_temp.profit_expect_denied(c.label);
      IF c.label LIKE 'role/%' THEN denied_roles := denied_roles + 1; END IF;
    END IF;
  END LOOP;
  IF allowed_roles <> 10 OR denied_roles <> 8 THEN
    RAISE EXCEPTION 'FAIL: enum role coverage changed: % allowed, % denied', allowed_roles, denied_roles;
  END IF;
  RAISE NOTICE 'Role matrix executed: % allowed, % denied (direct + wrapper)', allowed_roles, denied_roles;
  -- An authenticated request without a subject is not a service-role request.
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM pg_temp.profit_expect_denied('authenticated-no-subject');
  -- JWT text alone must not impersonate the physical service database role.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM pg_temp.profit_expect_denied('authenticated-spoof-service-no-subject');
END;
$tests$;
RESET ROLE;

-- Exercise tenant changes with the current unique-user membership contract.
-- Only postgres mutates synthetic fixtures; calls still run as authenticated.
SELECT set_config('request.jwt.claims', '{}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
UPDATE public.organization_members m
SET organization_id = o.id,
    role = CASE c.label WHEN 'multi-a-viewer-b-contador' THEN 'contador'::public.app_role
                       ELSE 'viewer'::public.app_role END
FROM profit_auth_cases c CROSS JOIN profit_auth_orgs o
WHERE m.user_id = c.uid AND o.key = 'B'
  AND c.label IN ('multi-a-viewer-b-contador', 'multi-a-contador-b-viewer');
SET LOCAL ROLE authenticated;
DO $moved$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM profit_auth_cases
    WHERE label IN ('multi-a-viewer-b-contador', 'multi-a-contador-b-viewer') LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', c.uid, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', c.uid::text, true);
    IF public.org_scope() IS DISTINCT FROM (SELECT id FROM profit_auth_orgs WHERE key = 'B') THEN
      RAISE EXCEPTION 'FAIL [%]: moved membership has wrong scope', c.label;
    END IF;
    IF c.label = 'multi-a-viewer-b-contador' THEN
      PERFORM pg_temp.profit_expect_allowed('moved/' || c.label, 'B');
    ELSE
      PERFORM pg_temp.profit_expect_denied('moved/' || c.label);
    END IF;
  END LOOP;
END;
$moved$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $service$
DECLARE c record;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF auth.uid() IS NOT NULL OR public.org_scope() IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: no-subject service fixture has identity/scope';
  END IF;
  PERFORM pg_temp.profit_expect_allowed('service-no-subject', NULL);
  FOR c IN SELECT * FROM profit_auth_cases WHERE label IN
    ('global-admin-tenant-viewer', 'global-viewer-tenant-contador',
     'global-contador-no-membership', 'inactive-contador', 'fake-tenant-superadmin') LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', c.uid, 'role', 'service_role')::text, true);
    PERFORM set_config('request.jwt.claim.sub', c.uid::text, true);
    IF c.allowed THEN
      PERFORM pg_temp.profit_expect_allowed('service/' || c.label, c.expected_key);
    ELSE
      PERFORM pg_temp.profit_expect_denied('service/' || c.label);
    END IF;
  END LOOP;
END;
$service$;
RESET ROLE;

-- ACL regression plus real anonymous execution, not source-text matching.
DO $acl$
BEGIN
  IF has_function_privilege('anon', 'public.profit_por_cliente(date,date,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon retains EXECUTE on profit_por_cliente';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.profit_por_cliente(date,date,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.profit_por_cliente(date,date,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: intended API role lost RPC EXECUTE';
  END IF;
END;
$acl$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT pg_temp.profit_expect_denied('anon');
RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'OK: profit roles, SQLSTATE 42501, wrapper, service identity, ACL and tenant isolation'; END $$;
ROLLBACK;
