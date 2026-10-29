-- Verify the real replay state before any harness grant can mask drift.
\ir _ci_check_global_catalog_acl.sql

-- Fail before blanket grants if either disabled Pricing lineage function leaked.
\ir _ci_check_pricing_lineage_acl.sql

\ir _ci_check_cotizacion_vendedor_acl.sql

-- Drizzle 0017 trigger helpers are owner-only, including for service_role.
-- Check the replay BEFORE any CI grant/revoke can hide an existing leak.
-- Keep the assertion session-local and reuse it on the final harness state.
CREATE FUNCTION pg_temp._ci_check_crm_empresa_owner_acl() RETURNS void
LANGUAGE plpgsql AS $crm_empresa_owner_acl$
DECLARE
  v_signature text;
  v_oid oid;
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_owner oid := pg_catalog.to_regrole('postgres');
  v_role text;
  v_found integer := 0;
BEGIN
  IF current_user <> 'postgres' OR session_user <> current_user OR v_owner IS NULL
     OR pg_catalog.to_regrole('anon') IS NULL
     OR pg_catalog.to_regrole('authenticated') IS NULL
     OR pg_catalog.to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION 'CI_CRM_EMPRESA_OWNER_ACL: exact owner and client roles required';
  END IF;
  FOREACH v_signature IN ARRAY ARRAY[
    'public._crm_empresa_no_borrar_cliente()',
    'public._crm_empresa_no_delete_fisico()'
  ] LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL THEN CONTINUE; END IF;
    v_found := v_found + 1;
    SELECT * INTO STRICT v_proc FROM pg_catalog.pg_proc WHERE oid = v_oid;
    IF v_proc.proowner IS DISTINCT FROM v_owner OR v_proc.prokind <> 'f'
       OR v_proc.prorettype <> 'pg_catalog.trigger'::regtype OR v_proc.prosecdef
       OR v_proc.proacl IS NULL
       OR (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl)) <> 1
       OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
         WHERE a.grantor <> v_owner OR a.grantee <> v_owner
           OR a.is_grantable OR a.privilege_type <> 'EXECUTE') THEN
      RAISE EXCEPTION 'CI_CRM_EMPRESA_OWNER_ACL: exact owner-only invoker trigger required for %', v_signature;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF pg_catalog.has_function_privilege(v_role, v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'CI_CRM_EMPRESA_OWNER_ACL: unexpected EXECUTE for % on %', v_role, v_signature;
      END IF;
    END LOOP;
  END LOOP;
  -- Both absent is the pre-0017 replay; a partial replay must fail closed.
  IF v_found = 1 THEN
    RAISE EXCEPTION 'CI_CRM_EMPRESA_OWNER_ACL: incomplete Drizzle 0017 replay';
  END IF;
END
$crm_empresa_owner_acl$;
SELECT pg_temp._ci_check_crm_empresa_owner_acl();

-- ============================================================================
-- Post-migración CI: relaja restricciones que dependen de GoTrue real.
--
-- Las suites RLS generan UUIDs aleatorios para usuarios simulados y los
-- pasan vía request.jwt.claims.sub. No insertan filas reales en auth.users
-- (no hay GoTrue en CI), así que los FK ... REFERENCES auth.users(id)
-- bloquearían los seeds. Soltamos esos FK únicamente en el contenedor CI.
-- ============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           con.conname
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE con.contype = 'f'
       AND con.confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      r.schema_name, r.table_name, r.conname
    );
  END LOOP;
END $$;

-- ============================================================================
-- GRANTs por defecto del esquema public.
-- Supabase Cloud los aplica vía Data API; en el Postgres bare de CI hay que
-- emitirlos explícitamente o cualquier SELECT bajo el rol authenticated
-- falla con "permission denied". RLS sigue siendo el único gate de aislamiento.
-- ============================================================================
\ir _ci_selector148_capture_acl.sql

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- FIX-45-HARDENING: ya NO se otorga todo a `anon`. El grant masivo a anon
-- neutralizaba fix45_anon_execute_whitelist.sql (200+ funciones SECURITY
-- DEFINER "expuestas" artificialmente) y hacía a CI infiel a prod, donde
-- solo llegan a anon los GRANTs explícitos de las migraciones (p.ej.
-- demo_leads). USAGE en el schema se conserva.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
-- Remove only the two CI-added grants; 0022 and replay ACL stay immutable.
REVOKE EXECUTE ON FUNCTION public._cotizacion_vendedor_misma_org() FROM authenticated, service_role;
-- Undo only the CI-added EXECUTE grants on the already-verified 0017 helpers.
-- Do not put them in _ci_service_role_only: that would grant a new privilege.
DO $crm_empresa_owner_restore$
DECLARE v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public._crm_empresa_no_borrar_cliente()',
    'public._crm_empresa_no_delete_fisico()'
  ] LOOP
    IF pg_catalog.to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated, service_role', v_signature);
    END IF;
  END LOOP;
END
$crm_empresa_owner_restore$;
-- The broad CI-only CRUD grant above must not reopen direct DOF writes.
REVOKE INSERT, UPDATE, DELETE ON public.tipos_cambio_dof FROM authenticated;
\ir _ci_check_global_catalog_acl.sql
\ir _ci_selector148_restore_acl.sql

-- ============================================================================
-- Re-cierre de funciones de plataforma (regla H6).
-- El GRANT masivo de arriba (necesario para el Postgres bare de CI) pisa los
-- REVOKE explícitos de las migraciones. Las funciones que sólo debe invocar
-- `service_role` (jobs de pg_cron y sus helpers) se vuelven a cerrar aquí para
-- que CI sea fiel a prod y las regresiones tipo FIX-45 detecten fugas reales.
--
-- FIX4 (P3): la lista ya NO vive inline — es la lista canónica única
-- `_ci_service_role_only.sql`, la misma que audita el candado bidireccional
-- `_ci_check_service_role_only.sql` ANTES de este re-cierre. Así una función
-- service_role-only sin REVOKE en su migración rompe CI en vez de quedar
-- enmascarada por este archivo.
-- ============================================================================
\ir _ci_service_role_only.sql

DO $$
DECLARE
  v_fn text;
BEGIN
  FOR v_fn IN SELECT fn FROM _ci_service_role_only

  LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- FIX2 B-1: re-cierre de las columnas internas de `public.embarques`.
-- El `GRANT SELECT ... ON ALL TABLES` de arriba reinstala el privilegio a
-- nivel tabla, lo que anula los REVOKE por columna de las migraciones
-- 20260824033159 / 20260824033552. Se repite aquí el mismo patrón
-- (revoke de tabla + grant columna por columna) para que CI sea fiel a prod.
-- La lista de columnas internas vive en un catálogo único compartido con las
-- suites `fix2_embarques_interno_y_nc.sql` y
-- `embarques_listado_sin_select_estrella.sql`.
-- ============================================================================
\ir ../_catalogo_columnas_internas.sql

DO $$

DECLARE
  v_cols text;
  v_internas text[] := pg_temp.columnas_internas_embarques();
BEGIN
  IF to_regclass('public.embarques') IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'embarques'
    AND NOT (column_name = ANY (v_internas));

  EXECUTE 'REVOKE SELECT ON public.embarques FROM authenticated';
  EXECUTE 'REVOKE SELECT ON public.embarques FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON public.embarques TO authenticated', v_cols);
  EXECUTE format('GRANT SELECT (%s) ON public.embarques TO anon', v_cols);
END $$;


-- ============================================================================
-- Ola 1 C6: re-cierre del DELETE físico de facturas.
-- El `GRANT ... DELETE ON ALL TABLES` de arriba (necesario en el Postgres bare
-- de CI) reinstala el privilegio que la migración de la Ola 1 revocó. Se cierra
-- de nuevo aquí para que CI sea fiel a prod: las facturas sólo se cancelan.
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.facturas') IS NOT NULL THEN
    EXECUTE 'REVOKE DELETE ON public.facturas FROM authenticated, anon';
  END IF;
END $$;

-- ============================================================================
-- CRM · re-cierre del DELETE físico de leads.
-- En prod el ACL de `public.crm_leads` es `authenticated=arw` (sin DELETE): los
-- leads sólo se archivan con soft-delete. El `GRANT ... DELETE ON ALL TABLES`
-- de arriba reinstala el privilegio en el Postgres bare de CI y hacía fallar el
-- caso E5 de `crm_leads_ownership.sql`.
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.crm_leads') IS NOT NULL THEN
    EXECUTE 'REVOKE DELETE ON public.crm_leads FROM authenticated, anon';
  END IF;
END $$;

-- ============================================================================
-- Triggers de comisiones.
--
-- Antes se dropeaba `trg_pago_factura_comision_ins` aquí para evitar un bug
-- legacy de `calcular_comision_pago(uuid)` que leía `embarques.tipo_cambio`.
-- Ese bug ya fue corregido por la migración 20260616231916 para usar
-- `tipo_cambio_usd`, y `schema-invariants.sql` ahora exige que el trigger
-- exista. No lo removemos en CI: si vuelve a romper, queremos detectarlo.
-- ============================================================================

-- ============================================================================
-- Stub deny-all removido: las 3 policies reales de tracking_externo ya viven
-- en supabase/migrations/20260703185259_*.sql (13.162.0). Sólo limpiamos aquí
-- el stub deny-all que instala _ci_drift.sql antes de aplicar migraciones.
-- ============================================================================
DROP POLICY IF EXISTS "_ci_stub_deny_all" ON public.tracking_externo;


-- ============================================================================
-- Ola P1 (P1-3): re-cierre de los grants directos de `idempotency_keys`.
-- El `GRANT ... ON ALL TABLES` de arriba reinstala lo que la migración
-- 20260908000100 revocó: `anon` no debe tocar la tabla y `authenticated` no
-- debe poder borrar claves (sólo se escriben vía idempotency_claim/store).
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.idempotency_keys') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.idempotency_keys FROM anon';
    EXECUTE 'REVOKE DELETE ON public.idempotency_keys FROM authenticated';
  END IF;
END $$;

-- ============================================================================
-- v13.821.3 · Centinela de bootstrap super_admin.
--
-- El trigger `on_auth_user_created` (restaurado en el squash) corona como
-- super_admin al PRIMER usuario cuando `public.user_roles` está vacía. En una
-- base de pruebas recién creada eso convertía al primer usuario de cada suite
-- en super_admin y rompía las aserciones de rol/organización.
--
-- Sembramos un usuario centinela con su rol para que la corona ya esté puesta,
-- igual que en producción. Las suites que prueban el bootstrap en sí (p. ej.
-- fix4_signup_bootstrap_lock) vacían `user_roles` dentro de su transacción.
-- ============================================================================
DO $$
DECLARE
  v_uid uuid := '00000000-0000-4000-8000-00000000ce41';
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regclass('public.user_roles') IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (v_uid, 'ci-centinela@test.local', '{"skip_auto_org":"true"}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'super_admin'::public.app_role)
  ON CONFLICT DO NOTHING;
END $$;

-- Drizzle 0010 grants SELECT/INSERT/UPDATE only: physical deletion is not part
-- of the tarifario contract. Undo the broad test-only DELETE grant above.
DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['costeo_cargos_fob_agente', 'costeo_cargos_locales_naviera'] LOOP
    IF to_regclass('public.' || tabla) IS NOT NULL THEN
      EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated', tabla);
    END IF;
  END LOOP;
END $$;

-- Pricing lineage remains disabled in the disposable CI database too.
-- Restore only its two reviewed revocations after the blanket grants above.
REVOKE ALL ON FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_cotizacion_origen_pricing() FROM PUBLIC, anon, authenticated, service_role;
-- This final assertion fails on any direct or inherited client EXECUTE leak.
\ir _ci_check_pricing_lineage_acl.sql
SELECT pg_temp._ci_check_crm_empresa_owner_acl();
DROP FUNCTION pg_temp._ci_check_crm_empresa_owner_acl();

\ir _ci_check_cotizacion_vendedor_acl.sql
