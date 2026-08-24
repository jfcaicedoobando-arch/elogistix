-- Fix B-3 — regresión: el barrido SAT semanal debe ROTAR entre organizaciones.
-- Antes la edge hacía ORDER BY created_at ASC LIMIT 5 (siempre las mismas orgs).
-- Se ejecuta en transacción y hace ROLLBACK: no deja datos.
BEGIN;

-- -------------------------------------------------------------
-- CASO 1: la RPC existe, es SECURITY DEFINER y NO es ejecutable
-- por anon ni authenticated (guardas FIX-45 / H6).
-- -------------------------------------------------------------
DO $caso1$
DECLARE v_oid oid;
BEGIN
  v_oid := to_regprocedure('public.seleccionar_lote_sat_semanal(integer)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: falta public.seleccionar_lote_sat_semanal(integer)';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la RPC debe ser SECURITY DEFINER';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la RPC es ejecutable por anon/authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: service_role no puede ejecutar la RPC';
  END IF;
END $caso1$;

-- -------------------------------------------------------------
-- CASO 2: el cursor persistente existe en organizations.
-- -------------------------------------------------------------
DO $caso2$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'organizations'
       AND column_name = 'sat_barrido_fecha'
  ) THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: falta organizations.sat_barrido_fecha';
  END IF;
END $caso2$;

-- -------------------------------------------------------------
-- CASO 3: rotación real. Con 3 orgs con RFC y lote de 2, dos corridas
-- consecutivas deben cubrir las 3 (nunca repetir el mismo lote completo).
-- -------------------------------------------------------------
DO $caso3$
DECLARE
  v_a uuid; v_b uuid; v_c uuid;
  v_lote1 uuid[]; v_lote2 uuid[]; v_union uuid[];
BEGIN
  INSERT INTO public.organizations (nombre, rfc, sat_barrido_fecha)
  VALUES ('ZZ Test Rot A', 'AAA010101AAA', NULL) RETURNING id INTO v_a;
  INSERT INTO public.organizations (nombre, rfc, sat_barrido_fecha)
  VALUES ('ZZ Test Rot B', 'BBB010101BBB', NULL) RETURNING id INTO v_b;
  INSERT INTO public.organizations (nombre, rfc, sat_barrido_fecha)
  VALUES ('ZZ Test Rot C', 'CCC010101CCC', NULL) RETURNING id INTO v_c;

  -- Las orgs preexistentes se marcan como "recién barridas" para que el
  -- orden NULLS FIRST priorice a las tres de prueba.
  UPDATE public.organizations
     SET sat_barrido_fecha = now() + interval '1 day'
   WHERE id NOT IN (v_a, v_b, v_c);

  SELECT array_agg(organization_id) INTO v_lote1
    FROM public.seleccionar_lote_sat_semanal(2);
  SELECT array_agg(organization_id) INTO v_lote2
    FROM public.seleccionar_lote_sat_semanal(2);

  IF array_length(v_lote1, 1) <> 2 OR array_length(v_lote2, 1) <> 2 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el lote no respeta p_max_orgs (% / %)',
      array_length(v_lote1, 1), array_length(v_lote2, 1);
  END IF;

  SELECT array_agg(DISTINCT x) INTO v_union
    FROM unnest(v_lote1 || v_lote2) AS x;
  IF NOT (v_a = ANY(v_union) AND v_b = ANY(v_union) AND v_c = ANY(v_union)) THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: sin rotación — dos corridas no cubrieron las 3 orgs';
  END IF;

  -- El cursor quedó estampado en las orgs seleccionadas.
  IF EXISTS (
    SELECT 1 FROM public.organizations
     WHERE id IN (v_a, v_b, v_c) AND sat_barrido_fecha IS NULL
  ) THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: sat_barrido_fecha no se estampó al seleccionar';
  END IF;
END $caso3$;

ROLLBACK;
