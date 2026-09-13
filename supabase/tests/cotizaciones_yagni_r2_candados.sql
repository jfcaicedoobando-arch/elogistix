-- =============================================================
-- cotizaciones_yagni_r2_candados.sql
--
-- Auditoría YAGNI r2 (v13.823.355) — tres candados de Cotizaciones → Embarques:
--
--   1. `aceptar_cotizacion_version`: una cotización de PROSPECTO sin
--      oportunidad ligada no puede aceptarse (`LC_COT_SIN_OPORTUNIDAD`).
--      Antes quedaba en un callejón sin salida: Aceptada, sin cliente, no
--      convertible y no editable (COT-2026-0016).
--   2. `revalidar_tarifa_cotizacion`: una cotización soft-deleted ya no puede
--      revalidarse por RPC directa (`LC_COTIZACION_ELIMINADA`).
--   3. `crear_embarque_borrador_core`: el agente se lee acotado a la
--      organización de la cotización (`LC_AGENTE_ORG_INVALIDA`), para que una
--      referencia cruzada no copie el nombre de un agente de otro tenant.
--
-- Se verifica sobre el código instalado (pg_get_functiondef) y, cuando es
-- posible, ejecutando la ruta real; así no dependemos de auth.uid() ni de
-- datos productivos.
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cotizaciones_yagni_r2_candados.sql
-- =============================================================

BEGIN;

DO $r2$
DECLARE
  d_aceptar text := pg_get_functiondef('public.aceptar_cotizacion_version(uuid)'::regprocedure);
  d_reval   text := pg_get_functiondef('public.revalidar_tarifa_cotizacion(uuid)'::regprocedure);
  d_crear   text := pg_get_functiondef(
    (SELECT p.oid::regprocedure
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'crear_embarque_borrador_core'
      LIMIT 1));
  v_org uuid;
  v_cli uuid;
  v_cot uuid;
  v_bloqueo boolean := false;
BEGIN
  -- 1) Prospecto sin oportunidad no se acepta.
  IF position('LC_COT_SIN_OPORTUNIDAD' in d_aceptar) = 0 THEN
    RAISE EXCEPTION 'REGRESION: aceptar_cotizacion_version ya no exige oportunidad ligada en prospectos';
  END IF;
  IF position('es_prospecto' in d_aceptar) = 0 THEN
    RAISE EXCEPTION 'REGRESION: aceptar_cotizacion_version ya no lee es_prospecto';
  END IF;

  -- 2) Revalidación de eliminadas.
  IF position('LC_COTIZACION_ELIMINADA' in d_reval) = 0 THEN
    RAISE EXCEPTION 'REGRESION: revalidar_tarifa_cotizacion ya no rechaza cotizaciones eliminadas';
  END IF;

  -- 3) Agente acotado a la organización de la cotización.
  IF position('LC_AGENTE_ORG_INVALIDA' in d_crear) = 0 THEN
    RAISE EXCEPTION 'REGRESION: crear_embarque_borrador_core ya no valida la organización del agente';
  END IF;
  IF d_crear !~ 'costeo_agentes[^;]*organization_id' THEN
    RAISE EXCEPTION 'REGRESION: la lectura de costeo_agentes dejó de acotarse por organization_id';
  END IF;

  -- Ejecución real del caso 1 (prospecto sin oportunidad).
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST YAGNI R2', 'TYR000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE YAGNI R2', 'XAXX010101000', 'yagni-r2@test.local')
  RETURNING id INTO v_cli;

  INSERT INTO public.cotizaciones (
    organization_id, cliente_id, estado, folio, modo, tipo,
    es_prospecto, prospecto_empresa, oportunidad_id, subtotal
  )
  VALUES (
    v_org, NULL, 'Enviada'::public.estado_cotizacion, 'COT-YR2-0001',
    'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
    true, 'PROSPECTO YAGNI R2', NULL, 1000
  )
  RETURNING id INTO v_cot;

  BEGIN
    PERFORM public.aceptar_cotizacion_version(v_cot);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%LC_COT_SIN_OPORTUNIDAD%' THEN
      v_bloqueo := true;
    END IF;
  END;
  IF NOT v_bloqueo THEN
    RAISE EXCEPTION 'REGRESION: un prospecto sin oportunidad ligada pudo aceptarse';
  END IF;

  -- Ejecución real del caso 2 (cotización eliminada).
  UPDATE public.cotizaciones SET deleted_at = now() WHERE id = v_cot;
  v_bloqueo := false;
  BEGIN
    PERFORM public.revalidar_tarifa_cotizacion(v_cot);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%LC_COTIZACION_ELIMINADA%' THEN
      v_bloqueo := true;
    END IF;
  END;
  IF NOT v_bloqueo THEN
    RAISE EXCEPTION 'REGRESION: una cotización eliminada pudo revalidarse';
  END IF;

  RAISE NOTICE 'OK cotizaciones_yagni_r2_candados: 3 candados verificados';
END
$r2$;

ROLLBACK;
