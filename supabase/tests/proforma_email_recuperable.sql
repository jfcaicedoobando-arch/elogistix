BEGIN;

DO $fixture$
DECLARE
  org uuid := gen_random_uuid();
  usuario uuid := gen_random_uuid();
  ajeno uuid := gen_random_uuid();
  cliente uuid := gen_random_uuid();
  embarque uuid := gen_random_uuid();
  proforma uuid := gen_random_uuid();
  intento uuid := gen_random_uuid();
  reserva uuid := gen_random_uuid();
  otra_reserva uuid := gen_random_uuid();
  previo uuid := gen_random_uuid();
  base text := 'https://example.invalid';
  solicitud jsonb := '{
    "dias_vigencia": 30,
    "destinatarios": [{"email": "para@example.invalid"}],
    "cc": ["cc@example.invalid"],
    "asunto": "Proforma de prueba",
    "mensaje": "Mensaje",
    "recipients": [{"email": "para@example.invalid", "tipo": "to"}, {"email": "cc@example.invalid", "tipo": "cc"}]
  }';
  inicial jsonb;
  recuperada jsonb;
  resultado jsonb;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (org, 'CI correo de proformas');
  INSERT INTO auth.users (id, email) VALUES
    (usuario, usuario::text || '@example.invalid'), (ajeno, ajeno::text || '@example.invalid');
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (org, usuario, 'admin_org');
  INSERT INTO public.clientes (id, organization_id, nombre, email)
    VALUES (cliente, org, 'Cliente CI correo', 'cliente-ci@example.invalid');
  INSERT INTO public.embarques (id, organization_id, cliente_id, expediente, modo, tipo)
    VALUES (embarque, org, cliente, 'DEMO-2026-999102', 'Marítimo', 'Importación');
  INSERT INTO public.proformas (id, organization_id, numero, embarque_id, cliente_id, cliente_nombre,
    expediente, estado_proforma, estado_cliente, token_publico, token_expira_at)
    VALUES (proforma, org, 'CI-CORREO', embarque, cliente, 'Cliente CI correo',
      'DEMO-2026-999102', 'pendiente', 'pendiente', previo, now() - interval '1 day');

  IF (public.reservar_proforma_email(proforma, ajeno, intento, reserva, solicitud, base)->>'estado')
    IS DISTINCT FROM 'sin_acceso' THEN RAISE EXCEPTION 'Acceso de otro tenant'; END IF;
  inicial := public.reservar_proforma_email(proforma, usuario, intento, reserva, solicitud, base);
  IF inicial->>'estado' IS DISTINCT FROM 'reservado'
    OR inicial->'contenido'->>'token' IN (previo::text, '') THEN RAISE EXCEPTION 'No se renovó el token'; END IF;
  IF public.reservar_proforma_email(proforma, usuario, gen_random_uuid(), otra_reserva, solicitud, base)
      ->'contenido'->>'token' IS DISTINCT FROM inicial->'contenido'->>'token' THEN
    RAISE EXCEPTION 'Dos intentos renovaron el mismo token';
  END IF;
  IF (public.reservar_proforma_email(proforma, usuario, intento, otra_reserva, solicitud, base)->>'estado')
    IS DISTINCT FROM 'en_proceso' THEN RAISE EXCEPTION 'Se duplicó una reserva vigente'; END IF;

  PERFORM public.email_send_log_touch('proforma:' || intento || ':1',
    'proforma-enviada', 'para@example.invalid', 'sent', NULL);
  resultado := public.finalizar_proforma_email(intento, usuario, reserva);
  IF resultado->>'estado' IS DISTINCT FROM 'pendiente'
    OR resultado->'resultados'->0->>'estado' IS DISTINCT FROM 'enviado'
    OR resultado->'resultados'->1->>'estado' IS DISTINCT FROM 'pendiente' THEN
    RAISE EXCEPTION 'No se preservó el resultado de cada destinatario: %', resultado;
  END IF;
  recuperada := public.reservar_proforma_email(proforma, usuario, intento, otra_reserva, solicitud, base);
  IF recuperada IS DISTINCT FROM inicial THEN RAISE EXCEPTION 'El reintento cambió el contenido del envío'; END IF;
  IF (public.finalizar_proforma_email(intento, usuario, reserva)->>'estado')
    IS DISTINCT FROM 'pendiente' THEN RAISE EXCEPTION 'La reserva anterior finalizó el intento'; END IF;
  UPDATE public.proforma_email_intentos SET reserva_hasta = now() - interval '1 second' WHERE id = intento;
  IF public.reservar_proforma_email(proforma, usuario, intento, reserva, solicitud, base)
      IS DISTINCT FROM inicial THEN RAISE EXCEPTION 'No se recuperó la reserva interrumpida'; END IF;
  PERFORM public.email_send_log_touch('proforma:' || intento || ':2',
    'proforma-enviada', 'cc@example.invalid', 'suppressed', 'Baja');
  resultado := public.finalizar_proforma_email(intento, usuario, reserva);
  IF resultado->>'estado' IS DISTINCT FROM 'parcial'
    OR resultado->'resultados'->1->>'estado' IS DISTINCT FROM 'suprimido'
    OR NOT EXISTS (SELECT 1 FROM public.proforma_envios WHERE id = intento AND estado = 'parcial')
    OR NOT EXISTS (SELECT 1 FROM public.proformas WHERE id = proforma AND enviada_por = usuario) THEN
    RAISE EXCEPTION 'El cierre no registró el envío parcial: %', resultado;
  END IF;
  IF public.finalizar_proforma_email(intento, usuario, otra_reserva) IS DISTINCT FROM resultado
    OR (SELECT count(*) FROM public.bitacora_actividad WHERE entidad_id = proforma
      AND accion = 'proforma_enviada_email') <> 1 THEN RAISE EXCEPTION 'El cierre no es idempotente'; END IF;
END;
$fixture$;

ROLLBACK;
