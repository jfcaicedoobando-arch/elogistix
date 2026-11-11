BEGIN;
\i supabase/tests/rls/_helpers.sql

CREATE FUNCTION pg_temp.fallar_insert_tracking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ubicacion = 'Forzar fallo de evento' THEN
    RAISE EXCEPTION 'Fallo controlado al insertar evento';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fallar_insert_tracking BEFORE INSERT ON public.eventos_embarque
  FOR EACH ROW EXECUTE FUNCTION pg_temp.fallar_insert_tracking();

DO $$
DECLARE
  org uuid := gen_random_uuid();
  otra_org uuid := gen_random_uuid();
  operador uuid := gen_random_uuid();
  lector uuid := gen_random_uuid();
  cliente uuid := gen_random_uuid();
  embarque uuid := gen_random_uuid();
  posterior uuid := gen_random_uuid();
  borrado uuid := gen_random_uuid();
  no_elegible uuid := gen_random_uuid();
  documento uuid := gen_random_uuid();
  intento_eta uuid := gen_random_uuid();
  intento_arribo uuid := gen_random_uuid();
  intento_fallido uuid := gen_random_uuid();
  fecha_eta date := current_date + 1;
  fecha_llegada date := current_date - 1;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (org, 'Tracking CI'), (otra_org, 'Tracking CI otro tenant');
  INSERT INTO auth.users (id, email) VALUES
    (operador, operador::text || '@test.local'), (lector, lector::text || '@test.local');
  INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org, operador, 'coordinador_logistico'), (org, lector, 'customer_service');
  INSERT INTO public.user_roles (user_id, role) VALUES (operador, 'coordinador_logistico'), (lector, 'customer_service')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
    VALUES (cliente, org, 'Tracking CI', 'XAXX010101000', 'tracking-ci@test.local');
  INSERT INTO public.embarques (id, organization_id, cliente_id, expediente, estado, modo, tipo, etd, eta, deleted_at)
    VALUES
      (embarque, org, cliente, 'ELTRK00001', 'En Proceso', 'Marítimo', 'Importación', fecha_llegada, fecha_eta - 1, NULL),
      (posterior, org, cliente, 'ELTRK00002', 'En Aduana', 'Marítimo', 'Importación', fecha_llegada, fecha_eta - 1, NULL),
      (borrado, org, cliente, 'ELTRK00003', 'En Tránsito', 'Marítimo', 'Importación', fecha_llegada, fecha_eta - 1, now()),
      (no_elegible, org, cliente, 'ELTRK00004', 'Confirmado', 'Marítimo', 'Importación', fecha_llegada, fecha_eta - 1, NULL);
  INSERT INTO public.documentos_embarque (id, embarque_id, organization_id, nombre, estado)
    VALUES (documento, embarque, org, 'BL Master', 'Pendiente');

  PERFORM pg_temp.as_user(lector);
  BEGIN
    PERFORM public.registrar_evento_tracking_embarque(embarque, intento_eta, 'eta', fecha_eta, 'Naviera', org);
    RAISE EXCEPTION 'El lector pudo editar tracking';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM pg_temp.as_user(operador);
  BEGIN
    PERFORM public.registrar_evento_tracking_embarque(embarque, intento_eta, 'eta', fecha_eta, 'Naviera', otra_org);
    RAISE EXCEPTION 'Se aceptó una organización distinta';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.registrar_evento_tracking_embarque(borrado, intento_eta, 'eta', fecha_eta, 'Naviera', org);
    RAISE EXCEPTION 'Se editó un embarque eliminado';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.registrar_evento_tracking_embarque(no_elegible, intento_arribo, 'llegada', fecha_llegada, '', org);
    RAISE EXCEPTION 'Se registró una llegada desde Confirmado';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%Confirma y pon en tránsito%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.registrar_evento_tracking_embarque(embarque, intento_arribo, 'llegada', fecha_llegada - 1, '', org);
    RAISE EXCEPTION 'Se aceptó una llegada anterior al ETD';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%posterior al ETD%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.registrar_evento_tracking_embarque(embarque, intento_arribo, 'llegada', fecha_llegada, '', org);
    RAISE EXCEPTION 'Se aceptó el arribo con documentos pendientes';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'LC_TRACKING_DOCS_PENDIENTES:%' THEN RAISE; END IF;
  END;

  PERFORM pg_temp.assert(public.registrar_evento_tracking_embarque(embarque, intento_eta, 'eta', fecha_eta, 'Naviera', org) = intento_eta,
    'No se devolvió el ID confirmado del ETA');
  PERFORM pg_temp.assert(public.registrar_evento_tracking_embarque(embarque, intento_eta, 'eta', fecha_eta, 'Naviera', org) = intento_eta,
    'El reintento no devolvió el ID original');
  BEGIN
    PERFORM public.registrar_evento_tracking_embarque(embarque, intento_eta, 'eta', fecha_eta + 1, 'Naviera', org);
    RAISE EXCEPTION 'Se aceptaron otros datos con la misma clave';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.embarques WHERE id = embarque AND eta = fecha_eta AND eta_original = fecha_eta - 1),
    'No se guardó ETA o se perdió la ETA original');

  UPDATE public.documentos_embarque SET estado = 'Recibido' WHERE id = documento;
  BEGIN
    PERFORM public.registrar_evento_tracking_embarque(embarque, intento_fallido, 'llegada', fecha_llegada, 'Forzar fallo de evento', org);
    RAISE EXCEPTION 'No falló el INSERT del evento';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Fallo controlado al insertar evento' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.embarques WHERE id = embarque AND fecha_llegada_real IS NULL AND estado = 'En Proceso'),
    'Falló el evento y quedaron guardados la llegada o el estado');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.eventos_embarque WHERE id = intento_fallido), 'Persistió un evento fallido');

  PERFORM public.registrar_evento_tracking_embarque(embarque, intento_arribo, 'llegada', fecha_llegada, 'Puerto', org);
  PERFORM public.registrar_evento_tracking_embarque(embarque, intento_arribo, 'llegada', fecha_llegada, 'Puerto', org);
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.embarques WHERE id = embarque AND fecha_llegada_real = fecha_llegada AND estado = 'Arribo'),
    'El arribo no registró la fecha exacta ni avanzó de estado');
  PERFORM public.registrar_evento_tracking_embarque(posterior, gen_random_uuid(), 'llegada', fecha_llegada, '', org);
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.embarques WHERE id = posterior AND fecha_llegada_real = fecha_llegada AND estado = 'En Aduana'),
    'Registrar llegada real cambió un estado posterior');

  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert((SELECT count(*) = 2 FROM public.eventos_embarque WHERE embarque_id = embarque),
    'El mismo intento registró múltiples eventos');
  PERFORM pg_temp.assert((SELECT count(*) = 2 FROM public.bitacora_actividad
    WHERE entidad_id = embarque AND detalles->>'eventoId' = intento_eta::text), 'Las bitácoras del ETA no comparten el ID del evento');
END;
$$;

ROLLBACK;
