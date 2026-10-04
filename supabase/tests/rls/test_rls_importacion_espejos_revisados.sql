-- AUD40: función DEFINER conserva autorización y aislamiento por cuenta/org.
BEGIN;
\i supabase/tests/rls/_helpers.sql
\i supabase/tests/_audit40_importacion_fixture.sql

DO $tests$
DECLARE
  v_orgs record;
  v_cuenta uuid := gen_random_uuid();
  v_otra uuid := gen_random_uuid();
  v_lector uuid := gen_random_uuid();
  v_mov uuid;
  v_fila jsonb;
  v_estado jsonb;
  v_denegado boolean;
  v_error text;
BEGIN
  SELECT * INTO STRICT v_orgs FROM pg_temp.seed_org_pair('AUD40RLS');
  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (v_orgs.org_a, v_lector, 'customer_service');
  INSERT INTO public.user_roles(user_id, role) VALUES (v_lector, 'customer_service')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.cuentas_bancarias(id, organization_id, alias, moneda, saldo_inicial, fecha_saldo_inicial)
  VALUES (v_cuenta, v_orgs.org_a, 'AUD40RLS A', 'MXN', 0, public.fecha_negocio_mx() - 10),
         (v_otra, v_orgs.org_b, 'AUD40RLS B', 'MXN', 0, public.fecha_negocio_mx() - 10);
  PERFORM pg_temp.as_user(v_orgs.admin_a);
  v_mov := pg_temp.audit40_espejo(v_orgs.org_a, v_cuenta, 100, public.fecha_negocio_mx());
  v_fila := pg_temp.audit40_fila(v_mov, 'AUD40RLS-IMPORT');
  v_estado := pg_temp.audit40_estado(v_cuenta);

  PERFORM pg_temp.as_user(v_orgs.admin_b);
  v_denegado := false;
  BEGIN
    PERFORM public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_fila));
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_denegado := true;
    PERFORM pg_temp.assert(v_error = 'Permisos insuficientes', 'AUD40RLS: otro tenant dio error inesperado: ' || v_error);
  END;
  PERFORM pg_temp.assert(v_denegado, 'AUD40RLS: otro tenant pudo absorber');

  PERFORM pg_temp.as_user(v_lector);
  v_denegado := false;
  BEGIN
    PERFORM public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_fila));
  EXCEPTION WHEN insufficient_privilege THEN
    v_denegado := true;
  END;
  PERFORM pg_temp.assert(v_denegado, 'AUD40RLS: lector pudo absorber');

  PERFORM pg_temp.as_user(gen_random_uuid());
  v_denegado := false;
  BEGIN
    PERFORM public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_fila));
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_denegado := true;
    PERFORM pg_temp.assert(v_error LIKE 'LC_SIN_ORG%', 'AUD40RLS: sin org dio otro error');
  END;
  PERFORM pg_temp.assert(v_denegado, 'AUD40RLS: sesión sin org pudo absorber');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(pg_temp.audit40_estado(v_cuenta) IS NOT DISTINCT FROM v_estado,
    'AUD40RLS: una llamada denegada cambió origen o bitácora');
  PERFORM pg_temp.assert(NOT has_function_privilege('anon',
    'public.absorber_espejos_importacion(uuid,jsonb)', 'EXECUTE'), 'AUD40RLS: función expuesta a anon');
  PERFORM pg_temp.as_user(v_orgs.admin_a);
  PERFORM public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_fila));
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.bbva_movimientos
    WHERE id = v_mov AND hash_dedupe = 'AUD40RLS-IMPORT'), 'AUD40RLS: administrador propio no pudo confirmar');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD40RLS: tenant, cuenta, rol, sesión y ACL de importación protegidos';
END;
$tests$;
ROLLBACK;
