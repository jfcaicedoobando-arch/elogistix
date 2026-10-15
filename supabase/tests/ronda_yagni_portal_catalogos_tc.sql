-- =============================================================
-- ronda_yagni_portal_catalogos_tc.sql · Ronda YAGNI 2026-09-02
--
-- Defectos cubiertos:
--   1) client_users cross-org: la pareja (cliente_id, organization_id) debe
--      cotejar contra clientes(id, organization_id).
--   2) catálogos globales: INSERT histórico de admins/gerente y CRUD de super_admin.
--   3) notificaciones_cliente: sin inyección cross-org y sólo URLs /portal.
--   4) facturas: el T/C se resuelve SIEMPRE del DOF a la fecha de emisión,
--      tanto al insertar con un valor arbitrario como al mover la fecha.
--   7) portal_factura_resumen_saldo existe y no es ejecutable por anon.
--
-- Todo dentro de BEGIN…ROLLBACK.
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ronda_yagni_portal_catalogos_tc.sql
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre) VALUES
  ('c1c1c1c1-0000-4000-8000-00000000000a'::uuid, 'YAGNI Org A'),
  ('c1c1c1c1-0000-4000-8000-00000000000b'::uuid, 'YAGNI Org B');

INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
  ('d1d1d1d1-0000-4000-8000-00000000000a'::uuid, 'c1c1c1c1-0000-4000-8000-00000000000a', 'Cliente A', 'yagni-a@test.mx'),
  ('d1d1d1d1-0000-4000-8000-00000000000b'::uuid, 'c1c1c1c1-0000-4000-8000-00000000000b', 'Cliente B', 'yagni-b@test.mx');

-- ── CASO 1 · client_users cross-org ────────────────────────────────────────
DO $t$
DECLARE v_uid uuid := 'e1e1e1e1-0000-4000-8000-000000000001';
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_uid, 'yagni-portal@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'CASO 1 OMITIDO — sin permisos sobre auth.users en este entorno';
    RETURN;
  END;

  BEGIN
    -- Cliente de la org B declarado como si fuera de la org A: el vector del P0.
    INSERT INTO public.client_users (user_id, cliente_id, organization_id)
    VALUES (v_uid, 'd1d1d1d1-0000-4000-8000-00000000000b',
                   'c1c1c1c1-0000-4000-8000-00000000000a');
    RAISE EXCEPTION 'CASO 1 FALLÓ: se aceptó un vínculo cliente/organización inconsistente';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'CASO 1 OK — el vínculo cross-org queda bloqueado por la BD';
  END;

  -- La pareja correcta sí se acepta.
  INSERT INTO public.client_users (user_id, cliente_id, organization_id)
  VALUES (v_uid, 'd1d1d1d1-0000-4000-8000-00000000000b',
                 'c1c1c1c1-0000-4000-8000-00000000000b');
  RAISE NOTICE 'CASO 1b OK — el vínculo consistente se acepta';
END
$t$;

-- Refuerzo estructural: el FK compuesto debe existir aunque el CASO 1
-- conductual se omita por falta de permisos sobre auth.users.
DO $t$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.client_users'::regclass
      AND contype = 'f'
      AND conname = 'client_users_cliente_org_fkey'
  ) THEN
    RAISE EXCEPTION 'CASO 1d FALLÓ: falta client_users_cliente_org_fkey (pareja cliente/organización)';
  END IF;
  RAISE NOTICE 'CASO 1d OK — existe el FK compuesto (cliente_id, organization_id)';
END
$t$;

-- El personal ya no tiene policy de escritura directa sobre client_users.
DO $t$
DECLARE v_escrituras int;
BEGIN
  SELECT count(*) INTO v_escrituras
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'client_users'
    AND cmd IN ('ALL', 'INSERT', 'DELETE')
    AND permissive = 'PERMISSIVE';
  IF v_escrituras > 0 THEN
    RAISE EXCEPTION 'CASO 1c FALLÓ: siguen existiendo % policies de escritura directa en client_users', v_escrituras;
  END IF;
  RAISE NOTICE 'CASO 1c OK — client_users sólo se escribe por RPC/service_role';
END
$t$;

-- ── CASO 2 · catálogos globales: altas 0015, UPDATE/DELETE sólo super_admin ──
DO $t$
DECLARE
  v_previous_search_path text := current_setting('search_path');
  v_authenticated oid;
  v_table_name text;
  v_table regclass;
  r pg_catalog.pg_policy%ROWTYPE;
  v_insert boolean;
  v_super boolean;
  -- Mismo predicado normalizado que el replay inmutable de Drizzle 0015.
  v_insert_check constant text := $expected$(( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'gerente_operaciones'::app_role) AS has_role))$expected$;
  v_super_check constant text := $expected$( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)$expected$;
BEGIN
  PERFORM set_config('search_path', 'public, pg_catalog', true);
  SELECT oid INTO v_authenticated FROM pg_catalog.pg_roles WHERE rolname = 'authenticated';
  IF v_authenticated IS NULL THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: falta el rol authenticated';
  END IF;
  FOREACH v_table_name IN ARRAY ARRAY['navieras', 'puertos', 'tipos_contenedor'] LOOP
    v_table := to_regclass('public.' || v_table_name);
    IF v_table IS NULL OR NOT COALESCE((SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = v_table), false) THEN
      RAISE EXCEPTION 'CASO 2 FALLÓ: falta catálogo o RLS habilitado en %', v_table_name;
    END IF;
    v_insert := false;
    v_super := false;
    FOR r IN SELECT * FROM pg_catalog.pg_policy WHERE polrelid = v_table AND polcmd <> 'r' LOOP
      IF r.polpermissive IS DISTINCT FROM true OR r.polroles IS DISTINCT FROM ARRAY[v_authenticated]::oid[] THEN
        RAISE EXCEPTION 'CASO 2 FALLÓ: roles o modo de policy inesperados en %/%', v_table_name, r.polname;
      END IF;
      IF r.polname = 'Gerente operaciones y admins dan de alta ' || v_table_name THEN
        v_insert := true;
        IF r.polcmd IS DISTINCT FROM 'a' OR r.polqual IS NOT NULL
           OR pg_get_expr(r.polwithcheck, r.polrelid) IS DISTINCT FROM v_insert_check THEN
          RAISE EXCEPTION 'CASO 2 FALLÓ: INSERT histórico alterado en %/%', v_table_name, r.polname;
        END IF;
      ELSIF r.polname = 'Super admin CRUD ' || v_table_name THEN
        v_super := true;
        IF r.polcmd IS DISTINCT FROM '*'
           OR pg_get_expr(r.polqual, r.polrelid) IS DISTINCT FROM v_super_check
           OR pg_get_expr(r.polwithcheck, r.polrelid) IS DISTINCT FROM v_super_check THEN
          RAISE EXCEPTION 'CASO 2 FALLÓ: CRUD de super_admin alterado en %/%', v_table_name, r.polname;
        END IF;
      ELSE
        RAISE EXCEPTION 'CASO 2 FALLÓ: policy de escritura inesperada en %/%', v_table_name, r.polname;
      END IF;
    END LOOP;
    IF NOT v_insert OR NOT v_super THEN
      RAISE EXCEPTION 'CASO 2 FALLÓ: falta policy de INSERT histórico o CRUD de super_admin en %', v_table_name;
    END IF;
  END LOOP;
  PERFORM set_config('search_path', v_previous_search_path, true);
  RAISE NOTICE 'CASO 2 OK — altas históricas 0015 y CRUD de super_admin, sin otras policies de escritura';
END
$t$;

-- ── CASO 3 · notificaciones_cliente ───────────────────────────────────────
DO $t$
BEGIN
  BEGIN
    INSERT INTO public.notificaciones_cliente
      (organization_id, cliente_id, tipo, titulo, mensaje)
    VALUES ('c1c1c1c1-0000-4000-8000-00000000000a',
            'd1d1d1d1-0000-4000-8000-00000000000b',
            'general', 'Hola', 'cross-org');
    RAISE EXCEPTION 'CASO 3 FALLÓ: se aceptó una notificación cross-org';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'CASO 3 OK — notificación cross-org rechazada';
  END;

  BEGIN
    INSERT INTO public.notificaciones_cliente
      (organization_id, cliente_id, tipo, titulo, mensaje, url)
    VALUES ('c1c1c1c1-0000-4000-8000-00000000000a',
            'd1d1d1d1-0000-4000-8000-00000000000a',
            'general', 'Hola', 'phishing', 'https://malicioso.example/login');
    RAISE EXCEPTION 'CASO 3b FALLÓ: se aceptó una URL externa';
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE NOTICE 'CASO 3b OK — sólo se aceptan enlaces internos /portal';
  END;

  INSERT INTO public.notificaciones_cliente
    (organization_id, cliente_id, tipo, titulo, mensaje, url)
  VALUES ('c1c1c1c1-0000-4000-8000-00000000000a',
          'd1d1d1d1-0000-4000-8000-00000000000a',
          'general', 'Hola', 'ok', '/portal/embarques/abc');
  RAISE NOTICE 'CASO 3c OK — la notificación legítima con ruta /portal se acepta';
END
$t$;

-- ── CASO 4 · T/C DOF forzado a la fecha de emisión ────────────────────────
DO $t$
DECLARE
  v_id uuid;
  v_tc numeric;
  v_f1 date;
  v_f2 date;
  v_esperado1 numeric;
  v_esperado2 numeric;
BEGIN
  SELECT min(fecha), max(fecha) INTO v_f1, v_f2
  FROM (SELECT fecha FROM public.tipos_cambio_dof
        WHERE usd_mxn > 1 ORDER BY fecha DESC LIMIT 30) s;
  IF v_f1 IS NULL OR v_f1 = v_f2 THEN
    RAISE NOTICE 'CASO 4 OMITIDO — se necesitan dos fechas DOF distintas';
    RETURN;
  END IF;
  -- En producción el trigger corre como 'authenticated', que sí tiene EXECUTE
  -- sobre tc_dof_vigente. En entornos de prueba con otro rol hay que otorgarlo
  -- (el ROLLBACK final lo revierte) o el caso se omite.
  IF NOT has_function_privilege(current_user, 'public.tc_dof_vigente(date)', 'EXECUTE') THEN
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.tc_dof_vigente(date) TO %I', current_user);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'CASO 4 OMITIDO — el rol % no puede ejecutar tc_dof_vigente', current_user;
      RETURN;
    END;
  END IF;
  SELECT usd_mxn INTO v_esperado1 FROM public.tipos_cambio_dof WHERE fecha = v_f1;
  SELECT usd_mxn INTO v_esperado2 FROM public.tipos_cambio_dof WHERE fecha = v_f2;

  -- Un T/C arbitrario (99) no debe persistir.
  INSERT INTO public.facturas
    (organization_id, cliente_id, numero, moneda, fecha_emision, fecha_vencimiento,
     tipo_cambio, estado, subtotal, iva, total)
  VALUES ('c1c1c1c1-0000-4000-8000-00000000000a',
          'd1d1d1d1-0000-4000-8000-00000000000a',
          'YAGNI-TC-1', 'USD', v_f2, v_f2 + 30, 99, 'Borrador', 100, 16, 116)
  RETURNING id, tipo_cambio INTO v_id, v_tc;

  IF v_tc IS DISTINCT FROM v_esperado2 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: persistió T/C % en lugar del DOF %', v_tc, v_esperado2;
  END IF;
  RAISE NOTICE 'CASO 4 OK — el T/C arbitrario se reemplazó por el DOF (%)', v_tc;

  -- Al mover la fecha de emisión el T/C se recalcula (D1 → D2).
  UPDATE public.facturas SET fecha_emision = v_f1 WHERE id = v_id
  RETURNING tipo_cambio INTO v_tc;
  IF v_tc IS DISTINCT FROM v_esperado1 THEN
    RAISE EXCEPTION 'CASO 4b FALLÓ: tras cambiar la fecha el T/C quedó en % (esperado %)', v_tc, v_esperado1;
  END IF;
  RAISE NOTICE 'CASO 4b OK — el T/C se resincroniza al cambiar la fecha de emisión';

  -- Y un UPDATE que intenta imponer un T/C arbitrario también se corrige.
  UPDATE public.facturas SET tipo_cambio = 250 WHERE id = v_id
  RETURNING tipo_cambio INTO v_tc;
  IF v_tc IS DISTINCT FROM v_esperado1 THEN
    RAISE EXCEPTION 'CASO 4c FALLÓ: se pudo imponer T/C % por UPDATE', v_tc;
  END IF;
  RAISE NOTICE 'CASO 4c OK — un UPDATE de tipo_cambio no puede salirse del DOF';
END
$t$;

-- ── CASO 7 · RPC de saldo del portal ─────────────────────────────────────
DO $t$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'portal_factura_resumen_saldo'
  ) THEN
    RAISE EXCEPTION 'CASO 7 FALLÓ: falta portal_factura_resumen_saldo';
  END IF;
  IF has_function_privilege('anon', 'public.portal_factura_resumen_saldo(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'CASO 7 FALLÓ: anon puede ejecutar portal_factura_resumen_saldo';
  END IF;
  RAISE NOTICE 'CASO 7 OK — el resumen de saldo existe y no está expuesto a anon';
END
$t$;

ROLLBACK;
