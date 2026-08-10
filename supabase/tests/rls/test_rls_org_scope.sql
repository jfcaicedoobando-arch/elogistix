-- ============================================================================
-- Suite RLS — `org_scope()` aísla los tableros del super admin por tenant
-- ============================================================================
-- Bug corregido: las RPC de agregación filtraban con
--   `organization_id = current_user_org_id() OR has_role(uid,'super_admin')`
-- por lo que un super admin recibía los datos de TODAS las organizaciones
-- mezclados, sin importar el tenant elegido en el selector.
--
-- Cubre:
--   1. Usuario normal: `org_scope()` = su propia organización (ignora la
--      selección de super admin de cualquier otro usuario).
--   2. Super admin SIN tenant activo: `org_scope()` es NULL y los tableros
--      no devuelven ningún embarque (nunca mezclan tenants).
--   3. Super admin CON tenant activo: sólo ve la organización elegida.
--   4. `set_super_admin_org` es fail-closed para usuarios no super admin.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_org_scope.sql
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
  v_scope uuid;
  v_total int;
  v_msg text;
BEGIN
  BEGIN
    INSERT INTO auth.users(id, email) VALUES
      (u_a, 'scope-a@test.local'), (u_sa, 'scope-sa@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- CI sin GoTrue: los FK contra auth.users ya no existen.
  END;

  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'SCOPE A'), (org_b, 'SCOPE B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, u_a, 'admin_org');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (u_a, 'admin_org'), (u_sa, 'super_admin');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'CLI SCOPE A', 'XAXX010101010', 'sa@test.local', org_a),
    (cli_b, 'CLI SCOPE B', 'XAXX010101011', 'sb@test.local', org_b);

  INSERT INTO public.embarques(
    id, expediente, cliente_id, cliente_nombre, organization_id,
    modo, tipo, estado, incoterm, etd, eta
  ) VALUES
    (emb_a, 'ELSCP00001', cli_a, 'CLI SCOPE A', org_a,
      'Marítimo', 'Importación', 'Confirmado', 'FOB', CURRENT_DATE + 5, CURRENT_DATE + 30),
    (emb_b, 'ELSCP00002', cli_b, 'CLI SCOPE B', org_b,
      'Marítimo', 'Importación', 'Confirmado', 'FOB', CURRENT_DATE + 5, CURRENT_DATE + 30);

  -- ── 1. Usuario normal: su propia org ────────────────────────────────────
  PERFORM pg_temp.as_user(u_a);
  v_scope := public.org_scope();
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(v_scope = org_a,
    format('org_scope() para admin_org devolvió %s, esperaba %s', v_scope, org_a));

  -- ── 2. Super admin sin tenant activo: NULL y tableros vacíos ────────────
  PERFORM pg_temp.as_user(u_sa);
  v_scope := public.org_scope();
  v_total := coalesce((public.dashboard_summary() ->> 'totalActivos')::int, 0);
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(v_scope IS NULL,
    'org_scope() debe ser NULL para super_admin sin tenant activo');
  PERFORM pg_temp.assert(v_total = 0,
    format('dashboard_summary() sin tenant activo devolvió %s activos, esperaba 0', v_total));

  -- ── 3. Super admin con tenant activo: sólo esa org ──────────────────────
  PERFORM pg_temp.as_user(u_sa);
  PERFORM public.set_super_admin_org(org_b);
  v_scope := public.org_scope();
  v_total := coalesce((public.dashboard_summary() ->> 'totalActivos')::int, 0);
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(v_scope = org_b,
    format('org_scope() con tenant activo devolvió %s, esperaba %s', v_scope, org_b));
  PERFORM pg_temp.assert(v_total = 1,
    format('dashboard_summary() con org_b devolvió %s activos, esperaba 1 (sólo su tenant)', v_total));

  -- ── 4. Fail-closed: un usuario normal no puede fijar tenant ─────────────
  PERFORM pg_temp.as_user(u_a);
  BEGIN
    PERFORM public.set_super_admin_org(org_b);
    PERFORM pg_temp.as_postgres();
    RAISE EXCEPTION 'RLS TEST FAIL: set_super_admin_org NO fue rechazada para admin_org';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      PERFORM pg_temp.as_postgres();
      IF position('LC_NO_AUTORIZADO' IN v_msg) = 0 THEN
        RAISE EXCEPTION 'RLS TEST FAIL: set_super_admin_org falló con "%", se esperaba LC_NO_AUTORIZADO', v_msg;
      END IF;
  END;

  RAISE NOTICE 'OK — org_scope() aísla los tableros por organización';
END $$;

ROLLBACK;
