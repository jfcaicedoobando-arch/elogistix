-- Fase G: grafo de transiciones de estado de embarque (Bug 12 auditoría ronda 2)
-- Valida que UPDATE embarques SET estado = ... siga aristas legales.

CREATE OR REPLACE FUNCTION public.transicion_embarque_valida(
  p_actual public.estado_embarque,
  p_nuevo  public.estado_embarque
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotente: mismo estado siempre válido.
  IF p_actual = p_nuevo THEN RETURN true; END IF;

  -- Cualquier estado no terminal permite cancelar.
  IF p_nuevo = 'Cancelado' AND p_actual <> 'Cancelado' THEN
    RETURN true;
  END IF;

  RETURN CASE p_actual
    WHEN 'Borrador'    THEN p_nuevo IN ('Cotización')
    WHEN 'Cotización'  THEN p_nuevo IN ('Confirmado','Borrador')
    WHEN 'Confirmado'  THEN p_nuevo IN ('En Tránsito','Cotización')
    WHEN 'En Tránsito' THEN p_nuevo IN ('En Aduana','En Proceso','Llegada')
    WHEN 'En Aduana'   THEN p_nuevo IN ('Llegada','En Tránsito')
    WHEN 'Llegada'     THEN p_nuevo IN ('Arribo','En Aduana')
    WHEN 'Arribo'      THEN p_nuevo IN ('Entregado','Llegada')
    WHEN 'Entregado'   THEN p_nuevo IN ('EIR','Arribo')
    WHEN 'EIR'         THEN p_nuevo IN ('Cerrado','Entregado')
    WHEN 'Cerrado'     THEN p_nuevo IN ('EIR')  -- reapertura
    WHEN 'En Proceso'  THEN p_nuevo IN ('En Tránsito','En Aduana','Llegada','Arribo')
    WHEN 'Cancelado'   THEN false  -- terminal
    ELSE false
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.transicion_embarque_valida(public.estado_embarque, public.estado_embarque) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transicion_embarque_valida(public.estado_embarque, public.estado_embarque) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assert_transicion_embarque(
  p_actual public.estado_embarque,
  p_nuevo  public.estado_embarque,
  p_expediente text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permitidas text;
BEGIN
  IF public.transicion_embarque_valida(p_actual, p_nuevo) THEN
    RETURN;
  END IF;

  -- Recolectar transiciones permitidas para el HINT (UX + debugging).
  SELECT COALESCE(string_agg(v::text, ',' ORDER BY v::text), '')
    INTO v_permitidas
  FROM unnest(enum_range(NULL::public.estado_embarque)) AS v
  WHERE public.transicion_embarque_valida(p_actual, v);

  RAISE EXCEPTION 'LC_TRANSICION_INVALIDA: no se permite pasar de % a %', p_actual, p_nuevo
    USING
      ERRCODE = 'P0001',
      HINT = jsonb_build_object(
        'estado_actual', p_actual::text,
        'estado_nuevo', p_nuevo::text,
        'expediente', COALESCE(p_expediente, ''),
        'transiciones_permitidas', v_permitidas
      )::text;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_transicion_embarque(public.estado_embarque, public.estado_embarque, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_transicion_embarque(public.estado_embarque, public.estado_embarque, text) TO authenticated, service_role;

-- Trigger: última línea de defensa incluso para UPDATEs directos (actualizarEstadoEmbarque).
CREATE OR REPLACE FUNCTION public.trg_fn_embarque_transicion_valida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass controlado para backfills / migraciones legítimas.
  IF current_setting('app.bypass_transicion', true) = 'on' THEN
    RETURN NEW;
  END IF;
  PERFORM public.assert_transicion_embarque(OLD.estado, NEW.estado, NEW.expediente);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_embarque_transicion_valida ON public.embarques;
CREATE TRIGGER trg_embarque_transicion_valida
  BEFORE UPDATE OF estado ON public.embarques
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION public.trg_fn_embarque_transicion_valida();

-- Reescritura de avanzar_estado_embarque para invocar el assert como primer paso.
CREATE OR REPLACE FUNCTION public.avanzar_estado_embarque(
  p_embarque_id uuid,
  p_nuevo_estado text,
  p_usuario_email text,
  p_tipo_evento text,
  p_descripcion_evento text,
  p_request_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  v_faltantes text[];
  v_flr date;
  v_estado_actual public.estado_embarque;
  v_expediente text;
  v_estados_bloqueantes text[] := ARRAY['En Tránsito','En Aduana','Llegada','Arribo','Entregado','EIR','Cerrado'];
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'avanzar_estado_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id, fecha_llegada_real, estado, expediente
    INTO v_org_id, v_flr, v_estado_actual, v_expediente
  FROM embarques WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  -- Fase G: candado de transición ANTES de cualquier side-effect.
  PERFORM public.assert_transicion_embarque(v_estado_actual, p_nuevo_estado::public.estado_embarque, v_expediente);

  -- Cierre: delegar al flujo oficial cerrar_embarque.
  IF p_nuevo_estado = 'Cerrado' THEN
    PERFORM public.cerrar_embarque(p_embarque_id);

    PERFORM set_config('app.bypass_cierre','on', true);

    INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
    VALUES (p_embarque_id, 'Estado cambiado a "Cerrado"', 'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

    INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
    VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), p_usuario_email, v_org_id);

    PERFORM set_config('app.bypass_cierre','off', true);

    v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Cerrado');
    PERFORM public.idempotency_store(p_request_id, v_resp);
    RETURN v_resp;
  END IF;

  -- Candado: Arribo requiere fecha_llegada_real registrada.
  IF p_nuevo_estado = 'Arribo' AND v_flr IS NULL THEN
    RAISE EXCEPTION 'fecha_llegada_real_requerida: Registra la Llegada real desde el tab Tracking antes de avanzar a Arribo.'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_nuevo_estado = ANY(v_estados_bloqueantes) THEN
    v_faltantes := public.embarque_docs_faltantes(p_embarque_id, p_nuevo_estado);
    IF array_length(v_faltantes, 1) IS NOT NULL THEN
      RAISE EXCEPTION 'documentos_faltantes: %', array_to_string(v_faltantes, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE embarques
     SET estado = p_nuevo_estado::estado_embarque, updated_at = now()
   WHERE id = p_embarque_id;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Estado cambiado a "' || p_nuevo_estado || '"', 'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), p_usuario_email, v_org_id);

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', p_nuevo_estado);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

COMMENT ON FUNCTION public.transicion_embarque_valida(public.estado_embarque, public.estado_embarque) IS
'Fase G (Bug 12): grafo dirigido de transiciones válidas del estado de embarque. Idempotente (mismo→mismo permitido). Cancelado terminal. Cerrado sólo puede reabrirse a EIR. En Proceso (legacy) tolera múltiples destinos operativos.';
