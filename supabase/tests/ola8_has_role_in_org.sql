-- ============================================================================
-- Ola 8 · Test de regresión — has_role_in_org / has_any_role_in_org (+ FIX B-6)
-- ============================================================================
-- Cobertura (8 casos):
--   Helpers:
--     1. membresía directa → true
--     2. jerarquía (auxiliar_contable satisface 'contador' en el helper general)
--     3. cross-tenant → false (contador de org A no autoriza en org B)
--     4. bypass super_admin de plataforma (sin membresía) → true
--     5. uid NULL (anon) → false
--   Conductuales sobre el piloto CxC (registrar_pago_cliente_lote) con la
--   lista EXPLÍCITA del FIX B-6 {admin, admin_org, super_admin, contador,
--   tesorero}:
--     6. contador de la org del cliente PASA el guard de rol (cae después en
--        LC_COBRO_LOTE_MINIMO_FACTURAS por payload vacío — prueba de que el
--        bloqueo no fue de rol)
--     7. auxiliar_contable → LC_COBRO_LOTE_SIN_ROL (regresión H1: la expansión
--        de roles_jerarquia ya NO lo autoriza en el piloto; el modo exacto
--        tampoco lo satisface vía helper)
--     8. legacy H2: rol 'contador' sólo en user_roles, SIN membresía →
--        LC_COBRO_LOTE_SIN_ROL (bloqueo documentado en RN-5 /
--        scripts/db/predeploy_b6_roles_legacy.sql)
--
-- Cómo ejecutarlo (base de pruebas; no correr contra producción):
--   psql "$DATABASE_URL" -f supabase/tests/ola8_has_role_in_org.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. ROLLBACK al final.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  contador_a uuid := gen_random_uuid();
  aux_a uuid := gen_random_uuid();
  contador_b uuid := gen_random_uuid();
  super_u uuid := gen_random_uuid();
  legacy_u uuid := gen_random_uuid();
  cliente_a uuid := gen_random_uuid();
  v_err text;
  v_res jsonb;
BEGIN
  -- Seed base (como postgres, sin RLS)
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'TEST OLA8 A'), (org_b, 'TEST OLA8 B');
  -- v13.777.9: user_roles referencia auth.users; siembra best-effort.
  BEGIN
    INSERT INTO auth.users(id, email) VALUES
      (contador_a, 'ola8-contador-a@test.local'),
      (aux_a,      'ola8-aux-a@test.local'),
      (contador_b, 'ola8-contador-b@test.local'),
      (super_u,    'ola8-super@test.local'),
      (legacy_u,   'ola8-legacy@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- Membresías (el trigger _sync_user_roles_desde_membership espeja a
  -- user_roles, igual que en producción).
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, contador_a, 'contador'),
    (org_a, aux_a, 'auxiliar_contable'),
    (org_b, contador_b, 'contador');
  -- super_admin es rol de PLATAFORMA: vive en user_roles, prohibido en
  -- organization_members (_bloquear_rol_plataforma_om).
  -- legacy_u reproduce el caso H2: rol financiero global sin membresía.
  INSERT INTO public.user_roles(user_id, role) VALUES
    (super_u, 'super_admin'),
    (legacy_u, 'contador');

  INSERT INTO public.clientes(id, organization_id, nombre) VALUES
    (cliente_a, org_a, 'CLIENTE OLA8 A');

  -- =========================================================================
  -- TEST 1: membresía directa
  -- =========================================================================
  PERFORM pg_temp.assert(
    public.has_role_in_org(contador_a, 'contador', org_a),
    'OLA8 T1: contador con membresía directa no pasó has_role_in_org');

  -- =========================================================================
  -- TEST 2: jerarquía — auxiliar_contable satisface 'contador' en el helper
  -- general (roles_jerarquia), pero NO en el modo exacto del FIX B-6
  -- =========================================================================
  PERFORM pg_temp.assert(
    public.has_role_in_org(aux_a, 'contador', org_a),
    'OLA8 T2: la jerarquía dejó de cubrir auxiliar_contable → contador');
  PERFORM pg_temp.assert(
    NOT public.has_any_role_in_org_exact(aux_a, ARRAY['contador']::public.app_role[], org_a),
    'OLA8 T2b: has_any_role_in_org_exact expandió jerarquía (no debe)');

  -- =========================================================================
  -- TEST 3: cross-tenant — contador de org A NO autoriza en org B
  -- =========================================================================
  PERFORM pg_temp.assert(
    NOT public.has_role_in_org(contador_a, 'contador', org_b),
    'OLA8 T3: contador de org A autorizó en org B (fuga cross-tenant)');

  -- =========================================================================
  -- TEST 4: bypass super_admin de plataforma (sin membresía en la org)
  -- =========================================================================
  PERFORM pg_temp.assert(
    public.has_role_in_org(super_u, 'contador', org_a),
    'OLA8 T4: super_admin perdió su bypass de plataforma');
  PERFORM pg_temp.assert(
    public.has_any_role_in_org_exact(super_u, ARRAY['contador']::public.app_role[], org_a),
    'OLA8 T4b: super_admin perdió su bypass en el modo exacto');

  -- =========================================================================
  -- TEST 5: uid NULL (anon) → false en ambos modos
  -- =========================================================================
  PERFORM pg_temp.assert(
    NOT public.has_role_in_org(NULL, 'contador', org_a),
    'OLA8 T5: uid NULL devolvió true');
  PERFORM pg_temp.assert(
    NOT public.has_any_role_in_org_exact(NULL, ARRAY['contador']::public.app_role[], org_a),
    'OLA8 T5b: uid NULL devolvió true en modo exacto');

  -- =========================================================================
  -- TEST 6 (conductual CxC): contador de la org del cliente PASA el guard de
  -- rol — con payload sin renglones debe caer en LC_COBRO_LOTE_MINIMO_FACTURAS
  -- (posterior al chequeo de rol), no en LC_COBRO_LOTE_SIN_ROL.
  -- =========================================================================
  PERFORM pg_temp.as_user(contador_a);
  BEGIN
    v_res := public.registrar_pago_cliente_lote(jsonb_build_object(
      'cliente_id', cliente_a, 'moneda', 'MXN', 'renglones', '[]'::jsonb));
    RAISE EXCEPTION 'RLS TEST FAIL: OLA8 T6 — el cobro en lote vacío no debió ejecutarse';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    v_err := SQLERRM;
  END;
  PERFORM pg_temp.assert(v_err LIKE 'LC_COBRO_LOTE_MINIMO_FACTURAS%',
    'OLA8 T6: contador de la org fue bloqueado antes del reparto: ' || COALESCE(v_err,'<sin error>'));

  -- =========================================================================
  -- TEST 7 (conductual CxC, regresión H1): auxiliar_contable queda FUERA del
  -- piloto con la lista explícita (antes del FIX B-6 la expansión de
  -- roles_jerarquia('contador') lo dejaba pasar).
  -- =========================================================================
  PERFORM pg_temp.as_user(aux_a);
  BEGIN
    v_res := public.registrar_pago_cliente_lote(jsonb_build_object(
      'cliente_id', cliente_a, 'moneda', 'MXN', 'renglones', '[]'::jsonb));
    RAISE EXCEPTION 'RLS TEST FAIL: OLA8 T7 — auxiliar_contable registró un cobro en lote';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    v_err := SQLERRM;
  END;
  PERFORM pg_temp.assert(v_err LIKE 'LC_COBRO_LOTE_SIN_ROL%',
    'OLA8 T7: auxiliar_contable no recibió LC_COBRO_LOTE_SIN_ROL: ' || COALESCE(v_err,'<sin error>'));

  -- =========================================================================
  -- TEST 8 (conductual CxC, H2): rol 'contador' sólo en user_roles (sin
  -- membresía) queda bloqueado — comportamiento legacy documentado (RN-5).
  -- =========================================================================
  PERFORM pg_temp.as_user(legacy_u);
  BEGIN
    v_res := public.registrar_pago_cliente_lote(jsonb_build_object(
      'cliente_id', cliente_a, 'moneda', 'MXN', 'renglones', '[]'::jsonb));
    RAISE EXCEPTION 'RLS TEST FAIL: OLA8 T8 — usuario legacy sin membresía registró un cobro en lote';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    v_err := SQLERRM;
  END;
  PERFORM pg_temp.assert(v_err LIKE 'LC_COBRO_LOTE_SIN_ROL%',
    'OLA8 T8: legacy sin membresía no recibió LC_COBRO_LOTE_SIN_ROL: ' || COALESCE(v_err,'<sin error>'));

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'OK ola8_has_role_in_org (8 casos: helpers + piloto CxC con lista explícita)';
END;
$$;

ROLLBACK;
