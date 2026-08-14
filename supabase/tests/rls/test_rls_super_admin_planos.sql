-- ============================================================================
-- Suite RLS — Ola 16 · separación de planos PLATAFORMA vs TENANT
-- ============================================================================
-- Bug corregido: 174 políticas de tablas de negocio decían
--   `... OR public.has_role(auth.uid(), 'super_admin')`
-- sin acotar al tenant activo, así que cualquier consulta del super admin que
-- no filtrara por `organization_id` devolvía filas de TODAS las organizaciones.
--
-- Cubre:
--   1. Super admin CON tenant activo → sólo ve filas de ese tenant (embarques,
--      clientes, facturas), aunque la query no filtre por organización.
--   2. Super admin SIN tenant activo → cero filas de negocio (fail-closed).
--   3. Super admin no puede INSERTAR en una organización distinta a la activa.
--   4. Plano PLATAFORMA intacto: sigue viendo TODAS las organizaciones y los
--      logs de plataforma (`app_logs`) de cualquier tenant.
--   5. Usuario normal: su visibilidad no cambia (ve su org, no la ajena).
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_super_admin_planos.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  u_a   uuid := gen_random_uuid();  -- admin_org de org_a
  u_sa  uuid := gen_random_uuid();  -- super_admin sin membresía
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  emb_b uuid := gen_random_uuid();
  v_n int;
BEGIN
  BEGIN
    INSERT INTO auth.users(id, email) VALUES
      (u_a, 'planos-a@test.local'), (u_sa, 'planos-sa@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- CI sin GoTrue: los FK contra auth.users ya no existen.
  END;

  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'PLANOS A'), (org_b, 'PLANOS B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, u_a, 'admin_org');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (u_a, 'admin_org'), (u_a, 'admin'), (u_sa, 'super_admin');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'CLI PLANOS A', 'XAXX010101010', 'pa@test.local', org_a),
    (cli_b, 'CLI PLANOS B', 'XAXX010101011', 'pb@test.local', org_b);

  INSERT INTO public.embarques(
    id, expediente, cliente_id, cliente_nombre, organization_id,
    modo, tipo, estado, incoterm, etd, eta
  ) VALUES
    (emb_a, 'ELPLA00001', cli_a, 'CLI PLANOS A', org_a,
      'Marítimo', 'Importación', 'Confirmado', 'FOB', CURRENT_DATE + 5, CURRENT_DATE + 30),
    (emb_b, 'ELPLB00001', cli_b, 'CLI PLANOS B', org_b,
      'Marítimo', 'Importación', 'Confirmado', 'FOB', CURRENT_DATE + 5, CURRENT_DATE + 30);

  INSERT INTO public.app_logs(organization_id, level, msg)
  VALUES (org_a, 'error', 'log plano A'), (org_b, 'error', 'log plano B');

  -- ==========================================================================
  -- 2) Super admin SIN tenant activo → fail-closed en tablas de negocio
  -- ==========================================================================
  PERFORM pg_temp.as_user(u_sa);

  SELECT count(*) INTO v_n FROM public.embarques WHERE id IN (emb_a, emb_b);
  PERFORM pg_temp.assert(v_n = 0,
    format('super admin sin tenant activo vio %s embarques (esperaba 0)', v_n));

  SELECT count(*) INTO v_n FROM public.clientes WHERE id IN (cli_a, cli_b);
  PERFORM pg_temp.assert(v_n = 0,
    format('super admin sin tenant activo vio %s clientes (esperaba 0)', v_n));

  -- ==========================================================================
  -- 4) Plano PLATAFORMA intacto (organizations + app_logs cross-tenant)
  -- ==========================================================================
  SELECT count(*) INTO v_n FROM public.organizations WHERE id IN (org_a, org_b);
  PERFORM pg_temp.assert(v_n = 2,
    format('super admin debe ver ambas organizaciones en el plano plataforma, vio %s', v_n));

  SELECT count(*) INTO v_n FROM public.app_logs WHERE organization_id IN (org_a, org_b);
  PERFORM pg_temp.assert(v_n >= 2,
    format('super admin debe ver los logs de plataforma de ambos tenants, vio %s', v_n));

  -- ==========================================================================
  -- 1) Super admin CON tenant activo → sólo el tenant elegido
  -- ==========================================================================
  PERFORM public.set_super_admin_org(org_a);

  SELECT count(*) INTO v_n FROM public.embarques WHERE id = emb_a;
  PERFORM pg_temp.assert(v_n = 1, 'super admin con tenant A no vio el embarque de A');

  SELECT count(*) INTO v_n FROM public.embarques WHERE id = emb_b;
  PERFORM pg_temp.assert(v_n = 0, 'FUGA: super admin con tenant A vio el embarque de B');

  SELECT count(*) INTO v_n FROM public.clientes WHERE id = cli_b;
  PERFORM pg_temp.assert(v_n = 0, 'FUGA: super admin con tenant A vio el cliente de B');

  -- ==========================================================================
  -- 3) Escritura cruzada bloqueada (WITH CHECK de la política RESTRICTIVE)
  -- ==========================================================================
  PERFORM pg_temp.assert_insert_blocked(
    format($sql$INSERT INTO public.clientes(nombre, rfc, email, organization_id)
                VALUES ('CRUZADO', 'XAXX010101012', 'x@test.local', %L)$sql$, org_b),
    'super admin con tenant A insertando en org B'
  );

  -- ==========================================================================
  -- 5) Usuario normal: sin cambios
  -- ==========================================================================
  PERFORM pg_temp.as_user(u_a);

  SELECT count(*) INTO v_n FROM public.embarques WHERE id = emb_a;
  PERFORM pg_temp.assert(v_n = 1, 'admin_org de A dejó de ver su propio embarque');

  SELECT count(*) INTO v_n FROM public.embarques WHERE id = emb_b;
  PERFORM pg_temp.assert(v_n = 0, 'FUGA: admin_org de A vio el embarque de B');

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'OK — planos plataforma/tenant separados.';
END $$;

ROLLBACK;
