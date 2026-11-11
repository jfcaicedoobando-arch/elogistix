BEGIN;
\i supabase/tests/rls/_helpers.sql

CREATE FUNCTION pg_temp.rechazar_bitacora_webhook() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.detalles->>'event_id' = 'cancelacion' AND current_setting('test.webhook_fallar', true) = 'si' THEN
    RAISE EXCEPTION 'Fallo controlado en bitácora' USING ERRCODE = 'LW001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_rechazar_bitacora_webhook BEFORE INSERT ON public.bitacora_actividad
  FOR EACH ROW EXECUTE FUNCTION pg_temp.rechazar_bitacora_webhook();

DO $$
DECLARE
  org uuid;
  cliente uuid;
  factura uuid;
  version_actual timestamptz;
  version_anterior timestamptz;
  reserva jsonb;
  anterior jsonb;
  resultado jsonb;
  payload jsonb := '{"type":"invoice.canceled","data":{"object":{"id":"fa-qa"}}}';
  patch jsonb := '{"estado":"Cancelada","cancellation_status":"accepted"}';
BEGIN
  INSERT INTO public.organizations (nombre) VALUES ('Webhook fiscal CI') RETURNING id INTO org;
  INSERT INTO public.clientes (organization_id, nombre, email)
    VALUES (org, 'Cliente webhook CI', 'webhook-ci@test.invalid') RETURNING id INTO cliente;
  INSERT INTO public.facturas (organization_id, numero, cliente_id, cliente_nombre, fecha_vencimiento,
    estado, cancellation_status, facturapi_id)
    VALUES (org, 'F-WEBHOOK-CI', cliente, 'Cliente webhook CI', current_date + 30,
      'Emitida', 'pending', 'fa-qa') RETURNING id, updated_at INTO factura, version_actual;
  version_anterior := version_actual - interval '1 minute';
  INSERT INTO public.facturapi_webhook_eventos (organization_id, event_id, event_type, payload)
    VALUES (org, 'historico', 'invoice.canceled', payload);

  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);

  resultado := public.reservar_evento_facturapi_webhook(org, 'historico', payload);
  PERFORM pg_temp.assert(resultado = '{"estado":"terminado","resultado":"legado"}', 'Se repitió un evento histórico');

  anterior := public.reservar_evento_facturapi_webhook(org, 'cancelacion', payload);
  PERFORM pg_temp.assert(anterior->>'estado' = 'tomado', 'No se reservó la primera entrega');
  resultado := public.reservar_evento_facturapi_webhook(org, 'cancelacion', payload);
  PERFORM pg_temp.assert(resultado->>'estado' = 'ocupado', 'Una segunda entrega tomó una reserva en curso');
  UPDATE public.facturapi_webhook_eventos SET procesamiento_disponible_en = clock_timestamp() - interval '1 second'
   WHERE id = (anterior->>'id')::uuid;
  reserva := public.reservar_evento_facturapi_webhook(org, 'cancelacion');
  PERFORM pg_temp.assert(reserva->>'estado' = 'tomado' AND reserva->>'token' <> anterior->>'token'
    AND reserva->'payload' = payload, 'El cron no recuperó la reserva con el payload original');
  resultado := public.finalizar_evento_facturapi_webhook((anterior->>'id')::uuid, (anterior->>'token')::uuid, 'ignorado');
  PERFORM pg_temp.assert(resultado->>'estado' = 'reserva_perdida', 'Una reserva vencida pudo finalizar');

  resultado := public.finalizar_evento_facturapi_webhook((reserva->>'id')::uuid, (reserva->>'token')::uuid,
    'aplicar', NULL, 'facturas', factura, version_anterior, 'fa-qa', patch, 'facturapi_webhook_canceled');
  PERFORM pg_temp.assert(resultado->>'estado' = 'reintentable' AND resultado->>'motivo' = 'destino_actualizado',
    'Una versión obsoleta del documento se aplicó o se perdió');
  UPDATE public.facturapi_webhook_eventos SET procesamiento_disponible_en = clock_timestamp() - interval '1 second'
   WHERE id = (reserva->>'id')::uuid;
  reserva := public.reservar_evento_facturapi_webhook(org, 'cancelacion');

  PERFORM set_config('test.webhook_fallar', 'si', true);
  BEGIN
    PERFORM public.finalizar_evento_facturapi_webhook((reserva->>'id')::uuid, (reserva->>'token')::uuid,
      'aplicar', NULL, 'facturas', factura, version_actual, 'fa-qa', patch, 'facturapi_webhook_canceled');
    RAISE EXCEPTION 'La transacción no falló con el trigger de bitácora';
  EXCEPTION WHEN SQLSTATE 'LW001' THEN NULL;
  END;
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.facturas WHERE id = factura AND estado = 'Emitida' AND cancellation_status = 'pending'),
    'La factura se modificó aunque falló la bitácora');
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.facturapi_webhook_eventos
    WHERE id = (reserva->>'id')::uuid AND procesamiento_estado = 'procesando'), 'Se perdió la reserva tras el rollback');

  PERFORM set_config('test.webhook_fallar', 'no', true);
  resultado := public.finalizar_evento_facturapi_webhook((reserva->>'id')::uuid, (reserva->>'token')::uuid,
    'aplicar', NULL, 'facturas', factura, version_actual, 'fa-qa', patch, 'facturapi_webhook_canceled');
  PERFORM pg_temp.assert(resultado->>'estado' = 'procesado', 'No se confirmó la cancelación');
  resultado := public.reservar_evento_facturapi_webhook(org, 'cancelacion', payload);
  PERFORM pg_temp.assert(resultado = '{"estado":"terminado","resultado":"procesado"}', 'Un evento procesado se reservó de nuevo');
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.facturas WHERE id = factura AND estado = 'Cancelada' AND cancellation_status = 'accepted'),
    'La transacción no usó el cierre fiscal canónico');
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.bitacora_actividad WHERE entidad_id = factura AND detalles->>'event_id' = 'cancelacion'),
    'El mismo evento produjo más de una entrada de bitácora');

  reserva := public.reservar_evento_facturapi_webhook(org, 'recapturado', payload);
  resultado := public.finalizar_evento_facturapi_webhook((reserva->>'id')::uuid, (reserva->>'token')::uuid,
    'aplicar', NULL, 'facturas', factura, version_actual, 'otro-claim', patch, 'facturapi_webhook_canceled');
  PERFORM pg_temp.assert(resultado->>'estado' = 'ignorado' AND resultado->>'motivo' = 'claim_cambiado',
    'El evento con claim anterior alcanzó la escritura');

  SELECT updated_at INTO version_actual FROM public.facturas WHERE id = factura;
  reserva := public.reservar_evento_facturapi_webhook(org, 'entrega', '{"type":"invoice.delivered_to_customer"}');
  resultado := public.finalizar_evento_facturapi_webhook((reserva->>'id')::uuid, (reserva->>'token')::uuid,
    'aplicar', NULL, 'facturas', factura, version_actual, 'fa-qa',
    jsonb_build_object('enviada_cliente_at', version_actual), 'facturapi_webhook_delivered');
  PERFORM pg_temp.assert(resultado->>'estado' = 'procesado' AND EXISTS (SELECT 1 FROM public.facturas
    WHERE id = factura AND enviada_cliente_at = version_actual AND estado = 'Cancelada'),
    'El aviso de entrega no aplicó su único campo preservando el estado fiscal');
END;
$$;

ROLLBACK;
