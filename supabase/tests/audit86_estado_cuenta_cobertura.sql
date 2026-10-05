-- Auditoría 86: cobertura histórica del estado bancario, sin saldos futuros.
-- Sólo para la base local efímera; todos los datos se revierten al terminar.
BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $test$
DECLARE
  v_org uuid := gen_random_uuid();
  v_otra_org uuid := gen_random_uuid();
  v_usuario uuid := gen_random_uuid();
  v_otro_usuario uuid := gen_random_uuid();
  v_cuenta uuid := gen_random_uuid();
  v_cuenta_cero uuid := gen_random_uuid();
  v_corte date := public.fecha_negocio_mx() - 2;
  v_resultado jsonb;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES
    (v_org, 'Audit86 cobertura'), (v_otra_org, 'Audit86 otra organización');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (v_org, v_usuario, 'contador'), (v_otra_org, v_otro_usuario, 'contador');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (v_usuario, 'contador'), (v_otro_usuario, 'contador')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.cuentas_bancarias(id, organization_id, banco, alias, moneda, saldo_inicial, fecha_saldo_inicial)
  VALUES (v_cuenta, v_org, 'Banco de pruebas', 'Audit86 apertura 1000', 'MXN', 1000, v_corte),
    (v_cuenta_cero, v_org, 'Banco de pruebas', 'Audit86 apertura cero', 'MXN', 0, v_corte);
  INSERT INTO public.bbva_movimientos(organization_id, cuenta_bancaria_id, fecha, concepto, cargo, abono, hash_dedupe, deleted_at)
  VALUES (v_org, v_cuenta, v_corte - 1, 'Importado anterior al corte', 0, 999, gen_random_uuid()::text, NULL),
    (v_org, v_cuenta, v_corte, 'Entrada al arranque', 0, 50, gen_random_uuid()::text, NULL),
    (v_org, v_cuenta, v_corte + 1, 'Salida posterior', 20, 0, gen_random_uuid()::text, NULL),
    (v_org, v_cuenta, v_corte + 1, 'Movimiento eliminado', 0, 999, gen_random_uuid()::text, now());

  PERFORM pg_temp.as_user(v_usuario);

  v_resultado := public.estado_cuenta_bancario(v_cuenta, v_corte - 2, v_corte - 1);
  PERFORM pg_temp.assert(v_resultado->>'cobertura_historica' IS NOT DISTINCT FROM 'sin_cobertura', '86: periodo anterior debe carecer de cobertura');
  PERFORM pg_temp.assert(v_resultado->'saldo_inicial' IS NOT DISTINCT FROM 'null'::jsonb
    AND v_resultado->'saldo_final' IS NOT DISTINCT FROM 'null'::jsonb
    AND v_resultado->'total_entradas' IS NOT DISTINCT FROM 'null'::jsonb
    AND v_resultado->'total_salidas' IS NOT DISTINCT FROM 'null'::jsonb,
    '86: importes anteriores al arranque deben ser NULL, nunca apertura ni cero');
  PERFORM pg_temp.assert((v_resultado->>'desde')::date IS NOT DISTINCT FROM v_corte - 2
    AND (v_resultado->>'hasta')::date IS NOT DISTINCT FROM v_corte - 1
    AND v_resultado->'movimientos' IS NOT DISTINCT FROM '[]'::jsonb,
    '86: conserva rango solicitado no invertido y no inventa movimientos cubiertos');

  v_resultado := public.estado_cuenta_bancario(v_cuenta, v_corte - 2, v_corte + 1);
  PERFORM pg_temp.assert(v_resultado->>'cobertura_historica' IS NOT DISTINCT FROM 'parcial'
    AND (v_resultado->>'desde_solicitado')::date IS NOT DISTINCT FROM v_corte - 2
    AND (v_resultado->>'desde')::date IS NOT DISTINCT FROM v_corte,
    '86: cruce del arranque distingue inicio solicitado y efectivo');
  PERFORM pg_temp.assert((v_resultado->>'saldo_inicial')::numeric IS NOT DISTINCT FROM 1000
    AND (v_resultado->>'total_entradas')::numeric IS NOT DISTINCT FROM 50
    AND (v_resultado->>'total_salidas')::numeric IS NOT DISTINCT FROM 20
    AND (v_resultado->>'saldo_final')::numeric IS NOT DISTINCT FROM 1030
    AND (v_resultado->>'movimientos_previos_corte')::integer IS NOT DISTINCT FROM 1
    AND jsonb_array_length(v_resultado->'movimientos') IS NOT DISTINCT FROM 2,
    '86: cruce mantiene apertura, totales y exclusión de movimientos previos/eliminados');
  PERFORM pg_temp.assert((v_resultado->'movimientos'->0->>'saldo_corrido')::numeric IS NOT DISTINCT FROM 1050
    AND (v_resultado->'movimientos'->1->>'saldo_corrido')::numeric IS NOT DISTINCT FROM 1030,
    '86: saldos corridos se conservan');

  v_resultado := public.estado_cuenta_bancario(v_cuenta, v_corte, v_corte);
  PERFORM pg_temp.assert(v_resultado->>'cobertura_historica' IS NOT DISTINCT FROM 'completa'
    AND (v_resultado->>'saldo_inicial')::numeric IS NOT DISTINCT FROM 1000
    AND (v_resultado->>'saldo_final')::numeric IS NOT DISTINCT FROM 1050,
    '86: el día exacto de arranque tiene cobertura y conserva apertura');

  v_resultado := public.estado_cuenta_bancario(v_cuenta, v_corte + 1, v_corte + 1);
  PERFORM pg_temp.assert(v_resultado->>'cobertura_historica' IS NOT DISTINCT FROM 'completa'
    AND (v_resultado->>'saldo_inicial')::numeric IS NOT DISTINCT FROM 1050
    AND (v_resultado->>'total_entradas')::numeric IS NOT DISTINCT FROM 0
    AND (v_resultado->>'total_salidas')::numeric IS NOT DISTINCT FROM 20
    AND (v_resultado->>'saldo_final')::numeric IS NOT DISTINCT FROM 1030,
    '86: periodo posterior acumula sólo los movimientos cubiertos previos');

  v_resultado := public.estado_cuenta_bancario(v_cuenta_cero, v_corte, v_corte + 1);
  PERFORM pg_temp.assert((v_resultado->>'saldo_inicial')::numeric IS NOT DISTINCT FROM 0
    AND (v_resultado->>'saldo_final')::numeric IS NOT DISTINCT FROM 0,
    '86: cero conocido sigue siendo cero');

  BEGIN
    PERFORM public.estado_cuenta_bancario(v_cuenta, NULL, v_corte);
    RAISE EXCEPTION '86: aceptó parámetros incompletos';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_ESTADO_CUENTA_PARAMS:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.estado_cuenta_bancario(v_cuenta, v_corte, v_corte - 1);
    RAISE EXCEPTION '86: aceptó rango invertido';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_ESTADO_CUENTA_RANGO:%' THEN RAISE; END IF;
  END;

  PERFORM pg_temp.as_user(v_otro_usuario);
  BEGIN
    PERFORM public.estado_cuenta_bancario(v_cuenta, v_corte - 2, v_corte - 1);
    RAISE EXCEPTION '86: expuso cuenta de otra organización antes del corte';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_ESTADO_CUENTA_SIN_ACCESO:%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(
    has_function_privilege('authenticated', 'public.estado_cuenta_bancario(uuid,date,date)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.estado_cuenta_bancario(uuid,date,date)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.estado_cuenta_bancario(uuid,date,date)', 'EXECUTE'),
    '86: se conservan grants, sin acceso anónimo');
  RAISE NOTICE 'Audit86: cobertura, importes, validaciones, aislamiento y grants correctos';
END;
$test$;
ROLLBACK;
