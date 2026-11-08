-- Un prospecto nuevo no puede enviarse desde Borrador, pero sí debe vencer.
-- Los prospectos históricos ya enviados conservan sus transiciones posteriores.
BEGIN;
DO $test$
DECLARE
  v_org uuid;
  v_cliente uuid;
  v_borrador uuid;
  v_enviada uuid;
  v_historica uuid;
  v_rechazo uuid;
  v_resultado jsonb;
  v_bloqueo text;
BEGIN
  INSERT INTO public.organizations(nombre)
  VALUES('QA prospecto housekeeping') RETURNING id INTO v_org;
  INSERT INTO public.clientes(organization_id, nombre, email)
  VALUES(v_org, 'Cliente housekeeping', gen_random_uuid()::text || '@test.invalid')
  RETURNING id INTO v_cliente;

  INSERT INTO public.cotizaciones(
    organization_id, folio, modo, tipo, es_prospecto, prospecto_empresa, estado, updated_at
  ) VALUES(
    v_org, 'QA-PROS-0001', 'Marítimo', 'Importación', true, 'Prospecto borrador',
    'Borrador', now() - interval '8 days'
  ) RETURNING id INTO v_borrador;

  INSERT INTO public.cotizaciones(
    organization_id, folio, modo, tipo, cliente_id, estado, fecha_vigencia, validez_propuesta
  ) VALUES(
    v_org, 'QA-PROS-0002', 'Marítimo', 'Importación', v_cliente, 'Enviada',
    current_date - 1, current_date - 1
  ) RETURNING id INTO v_enviada;

  INSERT INTO public.cotizaciones(
    organization_id, folio, modo, tipo, cliente_id, estado, fecha_vigencia, validez_propuesta
  ) VALUES(
    v_org, 'QA-PROS-0003', 'Marítimo', 'Importación', v_cliente, 'Enviada',
    current_date - 1, current_date - 1
  ) RETURNING id INTO v_historica;
  UPDATE public.cotizaciones
  SET es_prospecto = true, cliente_id = NULL, prospecto_empresa = 'Prospecto histórico'
  WHERE id = v_historica;

  -- El lote completo debe terminar: un prospecto viejo no frena a los demás.
  v_resultado := public.expirar_cotizaciones_job();
  IF (v_resultado->>'borradores_vencidos')::int <> 1
      OR (v_resultado->>'enviadas_vencidas')::int <> 2
      OR v_resultado->>'error_archivado' IS NOT NULL THEN
    RAISE EXCEPTION 'REGRESION: housekeeping incompleto: %', v_resultado;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.cotizaciones
      WHERE id = v_borrador AND estado = 'Vencida' AND estado_anterior = 'Borrador') THEN
    RAISE EXCEPTION 'REGRESION: el prospecto borrador no venció';
  END IF;

  -- Un histórico enviado todavía puede rechazarse.
  INSERT INTO public.cotizaciones(organization_id, folio, modo, tipo, cliente_id, estado)
  VALUES(v_org, 'QA-PROS-0004', 'Marítimo', 'Importación', v_cliente, 'Enviada')
  RETURNING id INTO v_rechazo;
  UPDATE public.cotizaciones
  SET es_prospecto = true, cliente_id = NULL, prospecto_empresa = 'Prospecto por rechazar'
  WHERE id = v_rechazo;
  UPDATE public.cotizaciones SET estado = 'Rechazada' WHERE id = v_rechazo;

  -- Aísla este candado de autorización, importes y otras reglas de cotización.
  CREATE TEMP TABLE pg_temp.prospecto_trigger_fixture(
    es_prospecto boolean,
    cliente_id uuid,
    prospecto_empresa text,
    estado public.estado_cotizacion,
    estado_anterior public.estado_cotizacion
  );
  CREATE TRIGGER validar_prospecto BEFORE INSERT OR UPDATE
  ON pg_temp.prospecto_trigger_fixture
  FOR EACH ROW EXECUTE FUNCTION public._cotizaciones_validar_prospecto();
  INSERT INTO pg_temp.prospecto_trigger_fixture(
    es_prospecto, prospecto_empresa, estado
  ) VALUES(true, 'Prospecto bloqueado', 'Borrador');
  BEGIN
    UPDATE pg_temp.prospecto_trigger_fixture SET estado = 'Enviada';
  EXCEPTION WHEN OTHERS THEN
    v_bloqueo := SQLERRM;
  END;
  IF v_bloqueo NOT LIKE 'LC_COT_PROSPECTO_SOLO_BORRADOR:%' THEN
    RAISE EXCEPTION 'REGRESION: bloqueo de prospecto incorrecto: %', COALESCE(v_bloqueo, 'sin error');
  END IF;

  RAISE NOTICE 'cotizacion_prospecto_housekeeping: PASS';
END $test$;
ROLLBACK;
