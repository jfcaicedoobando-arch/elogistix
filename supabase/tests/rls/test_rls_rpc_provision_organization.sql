-- ============================================================================
-- Suite de pruebas — Autorización de la RPC `provision_organization`
-- ============================================================================
--
-- v13.301.56 — Verifica que sólo `super_admin` puede aprovisionar
-- organizaciones vía `public.provision_organization(text, text, uuid)` y que
-- registra la acción en `bitacora_actividad`.
--
-- Casos cubiertos:
--   1. Usuario anónimo (auth.uid() IS NULL) → 42501
--   2. Usuario autenticado sin rol           → 42501
--   3. Rol `admin` de una org               → 42501 (NO es super_admin)
--   4. Rol `operador`                        → 42501
--   5. Rol `viewer`                          → 42501
--   6. Rol `super_admin`                     → OK, crea org + membership
--   7. Rol `super_admin` con nombre vacío    → 22023
--   8. Rol `super_admin` con owner inexistente → 22023
--   9. Rol `super_admin` con nombre duplicado → 23505
--  10. Log en bitacora_actividad se genera con accion='provision_organization'
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rpc_provision_organization.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. NO ejecutar en producción.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- Helper local: espera que la RPC lance excepción con SQLSTATE dado.
CREATE OR REPLACE FUNCTION pg_temp.assert_rpc_denied(
  _nombre text, _rfc text, _owner uuid, _sqlstate text, _msg text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
BEGIN
  BEGIN
    PERFORM public.provision_organization(_nombre, _rfc, _owner);
    RAISE EXCEPTION 'RPC TEST FAIL: % — provision_organization NO fue rechazada', _msg;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    IF v_state <> _sqlstate THEN
      RAISE EXCEPTION 'RPC TEST FAIL: % — SQLSTATE esperado % pero fue %',
        _msg, _sqlstate, v_state;
    END IF;
  END;
END;
$$;

DO $$
DECLARE
  super_a uuid := gen_random_uuid();
  admin_a uuid := gen_random_uuid();
  operador_a uuid := gen_random_uuid();
  viewer_a uuid := gen_random_uuid();
  plano_a uuid := gen_random_uuid();
  ghost_owner uuid := gen_random_uuid();
  new_owner uuid := gen_random_uuid();
  seed_org uuid := gen_random_uuid();
  created_org uuid;
  visible int;
BEGIN
  -- ── Seed usuarios en auth.users (necesarios porque provision_organization
  --    valida la existencia del owner con EXISTS). Bootstrap CI define
  --    auth.users con columnas mínimas (id, email, raw_user_meta_data,
  --    created_at); en producción hay muchas más pero no las tocamos.
  --
  --    Deshabilitamos temporalmente `on_auth_user_created` porque en
  --    producción cada INSERT en auth.users auto-crea una organización +
  --    membership admin para el usuario. Como el UNIQUE(user_id) en
  --    organization_members impide más de una membresía por user_id, esa
  --    autoseed choca con los INSERTs manuales de seed_org de más abajo.
  ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

  INSERT INTO auth.users(id, email) VALUES
    (super_a,     'super_a+rpc@e2e.test'),
    (admin_a,     'admin_a+rpc@e2e.test'),
    (operador_a,  'oper_a+rpc@e2e.test'),
    (viewer_a,    'view_a+rpc@e2e.test'),
    (plano_a,     'plano+rpc@e2e.test'),
    (new_owner,   'owner+rpc@e2e.test');

  ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

  -- Org y roles previos.
  INSERT INTO public.organizations(id, nombre) VALUES (seed_org, 'RPC Provision Seed');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (seed_org, admin_a, 'admin_org'),
    (seed_org, operador_a, 'coordinador_logistico'),
    (seed_org, viewer_a, 'customer_service');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (super_a, 'super_admin'),
    (admin_a, 'admin_org'),
    (operador_a, 'coordinador_logistico'),
    (viewer_a, 'customer_service');
  -- plano_a a propósito NO tiene rol.

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 1: anónimo (auth.uid IS NULL) → 42501
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert_rpc_denied(
    'Org Anon', NULL, new_owner, '42501',
    'anónimo NO debe poder llamar provision_organization'
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 2: autenticado sin rol → 42501
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(plano_a);
  PERFORM pg_temp.assert_rpc_denied(
    'Org SinRol', NULL, new_owner, '42501',
    'usuario sin rol NO debe poder llamar provision_organization'
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 3-5: admin/operador/viewer → 42501
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(admin_a);
  PERFORM pg_temp.assert_rpc_denied(
    'Org Admin', NULL, new_owner, '42501',
    'admin (no super_admin) NO debe poder llamar provision_organization'
  );

  PERFORM pg_temp.as_user(operador_a);
  PERFORM pg_temp.assert_rpc_denied(
    'Org Operador', NULL, new_owner, '42501',
    'operador NO debe poder llamar provision_organization'
  );

  PERFORM pg_temp.as_user(viewer_a);
  PERFORM pg_temp.assert_rpc_denied(
    'Org Viewer', NULL, new_owner, '42501',
    'viewer NO debe poder llamar provision_organization'
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 6: super_admin → OK, crea org y membership
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(super_a);
  created_org := public.provision_organization('RPC Provision Nueva', 'RFC010101AAA', new_owner);
  PERFORM pg_temp.as_postgres();

  SELECT count(*) INTO visible FROM public.organizations WHERE id = created_org;
  PERFORM pg_temp.assert(visible = 1, 'super_admin debe haber creado la organización');

  SELECT count(*) INTO visible FROM public.organization_members
    WHERE organization_id = created_org AND user_id = new_owner AND role = 'admin';
  PERFORM pg_temp.assert(visible = 1,
    'super_admin debe haber dado de alta al owner como admin de la nueva org');

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 7: nombre vacío → 22023
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(super_a);
  PERFORM pg_temp.assert_rpc_denied(
    '   ', NULL, new_owner, '22023',
    'nombre vacío/whitespace debe fallar con 22023'
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 8: owner inexistente → 22023
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.assert_rpc_denied(
    'Org Ghost', NULL, ghost_owner, '22023',
    'owner que no existe en auth.users debe fallar con 22023'
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 9: duplicado exacto (nombre+rfc case-insensitive) → 23505
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.assert_rpc_denied(
    'rpc provision nueva', 'RFC010101AAA', new_owner, '23505',
    'duplicado exacto de nombre+rfc debe fallar con 23505'
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 10: la acción quedó registrada en bitacora_actividad
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.bitacora_actividad
    WHERE accion = 'provision_organization'
      AND entidad_id = created_org
      AND usuario_id = super_a;
  PERFORM pg_temp.assert(visible = 1,
    'debe existir un registro en bitacora_actividad para la org recién provisionada');

  RAISE NOTICE '✓ test_rpc_provision_organization: 10 aserciones OK';
END;
$$;

ROLLBACK;
