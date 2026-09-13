-- =============================================================
-- cotizacion_vencida_convertible.sql
--
-- Regla de negocio (v13.823.316): la vigencia de una cotización limita la
-- RESPUESTA del cliente, no la ejecución de lo ya aceptado.
--
--   Caso A — cotización Aceptada / En operación con vigencia expirada:
--            `crear_embarque_borrador_desde_cotizacion` NO debe bloquear por
--            vencimiento (el CTA "Crear embarque" es válido).
--   Caso B — cotización en cualquier otro estado con vigencia expirada:
--            sigue bloqueada con `LC_COT_VENCIDA`.
--
-- Se verifica sobre el código instalado (pg_get_functiondef) y ejecutando
-- directamente `enforce_cotizacion_vigente`, para no depender de auth.uid(),
-- roles, tarifas ni datos reales.
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cotizacion_vencida_convertible.sql
-- =============================================================

BEGIN;

DO $cot$
DECLARE
  d text := pg_get_functiondef(
    'public.crear_embarque_borrador_desde_cotizacion(uuid, text, uuid, jsonb)'::regprocedure);
  v_org uuid;
  v_cli uuid;
  v_cot_aceptada uuid;
  v_cot_enviada uuid;
  v_hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_bloqueo_aceptada boolean := false;
  v_bloqueo_enviada boolean := false;
BEGIN
  -- 1) El candado de vigencia debe estar condicionado al estado.
  IF position('enforce_cotizacion_vigente' in d) = 0 THEN
    RAISE EXCEPTION 'REGRESION: la conversión ya no valida vigencia en ningún estado';
  END IF;
  IF d !~ 'estado NOT IN \(''Aceptada''' THEN
    RAISE EXCEPTION 'REGRESION: el candado de vigencia dejó de excluir a las cotizaciones Aceptada/En operación';
  END IF;

  -- 2) Datos temporales aislados (todo se revierte con el ROLLBACK final).
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST COT VENCIDA', 'TCV000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE COT VENCIDA', 'XAXX010101000', 'cot-vencida@test.local')
  RETURNING id INTO v_cli;

  INSERT INTO public.cotizaciones (organization_id, cliente_id, estado, folio, modo, tipo, validez_propuesta)
  VALUES (v_org, v_cli, 'Aceptada'::public.estado_cotizacion, 'COT-VENC-0001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, v_hoy - 2)
  RETURNING id INTO v_cot_aceptada;

  INSERT INTO public.cotizaciones (organization_id, cliente_id, estado, folio, modo, tipo, validez_propuesta)
  VALUES (v_org, v_cli, 'Enviada'::public.estado_cotizacion, 'COT-VENC-0002',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, v_hoy - 2)
  RETURNING id INTO v_cot_enviada;

  -- 3) Caso B: la no aceptada sí debe reventar por vencimiento.
  BEGIN
    PERFORM public.enforce_cotizacion_vigente(v_cot_enviada);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%LC_COT_VENCIDA%' THEN
      v_bloqueo_enviada := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_bloqueo_enviada THEN
    RAISE EXCEPTION 'REGRESION: una cotización Enviada vencida ya no se bloquea';
  END IF;

  -- 4) Caso A: la aceptada vencida no debe bloquearse por la ruta de conversión.
  BEGIN
    PERFORM public.crear_embarque_borrador_desde_cotizacion(v_cot_aceptada);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%LC_COT_VENCIDA%' THEN
      v_bloqueo_aceptada := true;
    END IF;
    -- Cualquier otro error (rol, tarifa, prospecto, datos incompletos) es
    -- esperado en este entorno sintético y no afecta al invariante probado.
  END;
  IF v_bloqueo_aceptada THEN
    RAISE EXCEPTION 'REGRESION: la cotización Aceptada vencida sigue bloqueada con LC_COT_VENCIDA';
  END IF;

  RAISE NOTICE 'cotizacion_vencida_convertible: PASS';
END $cot$;

ROLLBACK;
