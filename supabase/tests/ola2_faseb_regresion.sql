-- Ola 2 · Fase B — regresión de O2.3 (notas de crédito), O2.4 (consolidadas)
-- y O2.10 (papelera libera cotización). Sólo lectura de catálogo + rollback.
BEGIN;

-- -------------------------------------------------------------
-- CASO 1: la comisión resuelve embarques por el puente consolidado.
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_def text;
BEGIN
  IF to_regprocedure('public.comision_embarques_de_factura(uuid)') IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: falta comision_embarques_de_factura';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'comision_embarques_de_factura';
  IF position('factura_embarques' IN v_def) = 0 OR position('activa' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: no usa el puente factura_embarques activo';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'calcular_comision_pago'
    AND p.pronargs = 1;
  IF position('comision_embarques_de_factura' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: calcular_comision_pago no resuelve consolidadas';
  END IF;
  IF position('consolidada_sin_embarque' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la consolidada sin embarque no se encola';
  END IF;
  RAISE NOTICE 'CASO 1 OK · consolidadas resueltas por puente y encoladas si no hay embarque.';
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: la nota de crédito aplicada dispara el recálculo de comisiones.
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_def text;
  v_trg text;
BEGIN
  SELECT pg_get_triggerdef(t.oid) INTO v_trg
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.factura_notas_credito'::regclass
    AND t.tgname = 'trg_nc_cliente_recalcular_comisiones';
  IF v_trg IS NULL THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: no existe el disparador de NC → comisiones';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_nc_cliente_recalcular_comisiones';
  IF position('calcular_comision_pago' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: el disparador no recalcula la comisión';
  END IF;
  IF position('ajuste_nc_liquidada' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: no registra el ajuste de comisión ya liquidada';
  END IF;
  RAISE NOTICE 'CASO 2 OK · NC aplicada recalcula y respeta lo ya liquidado.';
END
$caso2$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 3: la papelera del embarque libera la cotización.
-- -------------------------------------------------------------
DO $caso3$
DECLARE
  v_def text;
  v_trg text;
BEGIN
  SELECT pg_get_triggerdef(t.oid) INTO v_trg
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.embarques'::regclass
    AND t.tgname = 'trg_sync_cotizacion_embarque_link';
  IF v_trg IS NULL OR position('deleted_at' IN v_trg) = 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el disparador no escucha cambios de deleted_at';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sync_cotizacion_embarque_link';
  IF position('embarque_id = NULL' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: no desvincula la cotización al enviar a papelera';
  END IF;
  RAISE NOTICE 'CASO 3 OK · papelera desvincula y regresa la cotización a Aceptada.';
END
$caso3$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 4: las funciones nuevas no quedan expuestas a anon (FIX-45).
-- -------------------------------------------------------------
DO $caso4$
DECLARE
  v_malas text[];
BEGIN
  SELECT COALESCE(ARRAY_AGG(p.proname), ARRAY[]::text[]) INTO v_malas
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('comision_embarques_de_factura', '_nc_cliente_recalcular_comisiones')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF array_length(v_malas, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: funciones ejecutables por anon: %', v_malas;
  END IF;
  RAISE NOTICE 'CASO 4 OK · permisos explícitos sin exposición anónima.';
END
$caso4$ LANGUAGE plpgsql;

ROLLBACK;
