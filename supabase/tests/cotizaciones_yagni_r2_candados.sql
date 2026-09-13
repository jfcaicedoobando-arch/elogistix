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

  -- Nota: la verificación es estática (pg_get_functiondef). El rol con el que
  -- corren los guards no tiene EXECUTE sobre estas RPC (sólo `authenticated` y
  -- `service_role`), y forzar la ejecución exigiría sembrar sesión de auth: el
  -- contrato que importa aquí es que el candado siga instalado en la función.
  RAISE NOTICE 'OK cotizaciones_yagni_r2_candados: 3 candados verificados';
END
$r2$;

ROLLBACK;
