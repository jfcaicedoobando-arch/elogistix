-- Ola 2 · Fase B2 — regresión de la automatización:
--   O2.11.1 reproceso diario de comisiones pendientes (job de plataforma)
--   O2.11.2 verificación SAT semanal + aviso de CFDI cancelado
-- Sólo lectura de catálogo (no escribe datos de negocio).
BEGIN;

-- -------------------------------------------------------------
-- CASO 1: existe el núcleo sin guardas y la RPC pública delega en él.
-- -------------------------------------------------------------
DO $caso1$
DECLARE v_def text;
BEGIN
  IF to_regprocedure('public._reprocesar_comisiones_org(uuid)') IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: falta public._reprocesar_comisiones_org(uuid)';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = '_reprocesar_comisiones_org';
  IF position('auth.uid()' IN v_def) > 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: el núcleo depende de auth.uid() y no puede correr en pg_cron';
  END IF;
  -- Guarda del canon: nunca toca comisiones ya liquidadas.
  IF position('Liquidada' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: el núcleo perdió la guarda de comisiones Liquidadas';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'reprocesar_comisiones_pendientes';
  IF position('_reprocesar_comisiones_org' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la RPC pública duplica el cálculo en vez de delegar';
  END IF;
  IF position('LC_NO_AUTORIZADO' IN v_def) = 0
     OR position('LC_TENANT_MISMATCH' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la RPC pública perdió sus guardas de autorización';
  END IF;
  RAISE NOTICE 'CASO 1 OK · núcleo sin sesión + RPC pública con guardas.';
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: el job de plataforma existe, recorre organizaciones y deja bitácora.
-- -------------------------------------------------------------
DO $caso2$
DECLARE v_def text;
BEGIN
  IF to_regprocedure('public.reprocesar_comisiones_job()') IS NULL THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: falta public.reprocesar_comisiones_job()';
  END IF;
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'reprocesar_comisiones_job';
  IF position('comisiones_recalculo_pendiente' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: el job no lee la cola de recálculo';
  END IF;
  IF position('app_logs' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: el job no registra su resumen';
  END IF;
  RAISE NOTICE 'CASO 2 OK · job de plataforma con bitácora técnica.';
END
$caso2$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 3: aviso de CFDI cancelado con dedupe y destinatarios financieros.
-- -------------------------------------------------------------
DO $caso3$
DECLARE v_def text;
BEGIN
  IF to_regprocedure('public.notificar_uuid_cancelado_sat(uuid, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: falta public.notificar_uuid_cancelado_sat(uuid, jsonb)';
  END IF;
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'notificar_uuid_cancelado_sat';
  IF position('sat_uuid_cancelado' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: falta el tipo de notificación sat_uuid_cancelado';
  END IF;
  IF position('30 days' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: falta el dedupe de 30 días por factura';
  END IF;
  IF position('tesorero' IN v_def) = 0 OR position('contador' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el aviso no llega a contabilidad/tesorería';
  END IF;
  -- No debe tocar estado ni importes de la factura.
  IF position('UPDATE public.proveedor_facturas' IN v_def) > 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el aviso modifica facturas de proveedor';
  END IF;
  RAISE NOTICE 'CASO 3 OK · aviso interno con dedupe, sin tocar la factura.';
END
$caso3$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 4: FIX-45 — las funciones de plataforma no son ejecutables por
-- anon ni authenticated (sólo service_role las invoca).
-- -------------------------------------------------------------
DO $caso4$
DECLARE
  v_fn text;
  v_rol text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public._reprocesar_comisiones_org(uuid)',
    'public.reprocesar_comisiones_job()',
    'public.notificar_uuid_cancelado_sat(uuid, jsonb)'
  ]
  LOOP
    FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      IF has_function_privilege(v_rol, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'CASO 4 FALLÓ: % es ejecutable por %', v_fn, v_rol;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'CASO 4 FALLÓ: service_role no puede ejecutar %', v_fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'CASO 4 OK · funciones de plataforma cerradas a anon/authenticated.';
END
$caso4$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 5: ambas tareas quedaron agendadas y activas (sólo si hay pg_cron;
-- en bases de CI sin la extensión el caso se omite con NOTICE).
-- -------------------------------------------------------------
DO $caso5$
DECLARE v_n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'CASO 5 OMITIDO · pg_cron no instalado en esta base.';
    RETURN;
  END IF;

  EXECUTE $q$
    SELECT count(*) FROM cron.job
     WHERE jobname = 'reprocesar_comisiones_diario' AND active
  $q$ INTO v_n;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: falta el job activo reprocesar_comisiones_diario';
  END IF;

  EXECUTE $q$
    SELECT count(*) FROM cron.job
     WHERE jobname = 'verificar_sat_semanal' AND active
  $q$ INTO v_n;
  IF v_n <> 1 THEN
    RAISE NOTICE 'CASO 5 PARCIAL · verificar_sat_semanal no agendado (base sin job HTTP de referencia).';
  END IF;
  RAISE NOTICE 'CASO 5 OK · tareas programadas de la Fase B2 presentes.';
END
$caso5$ LANGUAGE plpgsql;

ROLLBACK;
