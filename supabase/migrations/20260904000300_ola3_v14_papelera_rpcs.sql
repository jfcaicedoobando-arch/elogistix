-- M-17: sugerencias de embarques no deben incluir papelera
CREATE OR REPLACE FUNCTION public.sugerir_embarques_para_proveedor(_proveedor_id uuid, _organization_id uuid, _limit integer DEFAULT 10)
 RETURNS TABLE(embarque_id uuid, expediente text, cliente_nombre text, estado text, etd date, eta date, match_tipo text, score integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _prov_nombre text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _organization_id AND m.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  SELECT lower(nombre) INTO _prov_nombre
  FROM public.proveedores
  WHERE id = _proveedor_id AND organization_id = _organization_id;

  IF _prov_nombre IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT
      e.id AS embarque_id,
      e.expediente,
      e.cliente_nombre,
      e.estado::text AS estado,
      e.etd,
      e.eta,
      'Nombre coincide (agente/naviera/transportista)'::text AS match_tipo,
      100 AS score
    FROM public.embarques e
    WHERE e.organization_id = _organization_id
      AND e.deleted_at IS NULL
      AND e.estado NOT IN ('Cerrado','Cancelado','Entregado')
      AND (
        lower(coalesce(e.agente,'')) = _prov_nombre
        OR lower(coalesce(e.naviera,'')) = _prov_nombre
        OR lower(coalesce(e.transportista,'')) = _prov_nombre
        OR lower(coalesce(e.aerolinea,'')) = _prov_nombre
      )

    UNION ALL

    SELECT
      e.id, e.expediente, e.cliente_nombre, e.estado::text, e.etd, e.eta,
      'Tarifa vinculada (agente)'::text,
      80
    FROM public.embarques e
    JOIN public.costeo_tarifas t ON t.id = e.tarifa_id_aplicada
    JOIN public.costeo_agentes a ON a.id = t.agente_id
    WHERE e.organization_id = _organization_id
      AND e.deleted_at IS NULL
      AND e.estado NOT IN ('Cerrado','Cancelado','Entregado')
      AND a.proveedor_id = _proveedor_id

    UNION ALL

    SELECT
      e.id, e.expediente, e.cliente_nombre, e.estado::text, e.etd, e.eta,
      'Tarifa vinculada (naviera)'::text,
      80
    FROM public.embarques e
    JOIN public.costeo_tarifas t ON t.id = e.tarifa_id_aplicada
    JOIN public.costeo_navieras_condiciones nc
      ON nc.naviera_id = t.naviera_id AND nc.organization_id = e.organization_id
    WHERE e.organization_id = _organization_id
      AND e.deleted_at IS NULL
      AND e.estado NOT IN ('Cerrado','Cancelado','Entregado')
      AND nc.proveedor_id = _proveedor_id
  )
  SELECT DISTINCT ON (c.embarque_id)
    c.embarque_id, c.expediente, c.cliente_nombre, c.estado, c.etd, c.eta, c.match_tipo, c.score
  FROM candidatos c
  ORDER BY c.embarque_id, c.score DESC, c.eta DESC NULLS LAST
  LIMIT _limit;
END;
$function$;

-- B-1: reabrir_embarque no debe operar sobre embarques en papelera
CREATE OR REPLACE FUNCTION public.reabrir_embarque(p_embarque_id uuid, p_usuario_email text, p_motivo text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_estado_actual text;
  v_resp jsonb;
  v_es_admin boolean;
  v_motivo text := NULLIF(trim(COALESCE(p_motivo, '')), '');
  v_actor_id uuid := auth.uid();
  v_actor_email text;
BEGIN
  -- B-06: identidad no falsificable. `p_usuario_email` se ignora.
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  v_actor_email := COALESCE(v_actor_email, 'usuario:' || COALESCE(v_actor_id::text, 'desconocido'));

  v_resp := public.idempotency_claim(p_request_id, 'reabrir_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  IF v_motivo IS NULL OR length(v_motivo) < 20 THEN
    RAISE EXCEPTION 'Motivo de reapertura requerido (mínimo 20 caracteres)';
  END IF;

  SELECT organization_id, estado::text
    INTO v_org_id, v_estado_actual
    FROM embarques
   WHERE id = p_embarque_id
     AND deleted_at IS NULL;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  v_es_admin := public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'super_admin'::app_role)
             OR public.has_role(auth.uid(), 'admin_org'::app_role);
  IF NOT v_es_admin THEN
    RAISE EXCEPTION 'Solo administradores pueden reabrir embarques cerrados';
  END IF;

  PERFORM public._assert_writer(v_org_id);

  IF v_estado_actual <> 'Cerrado' THEN
    RAISE EXCEPTION 'Solo embarques en estado Cerrado pueden reabrirse (estado actual: %)', v_estado_actual;
  END IF;

  PERFORM set_config('app.bypass_cierre','on', true);
  PERFORM set_config('app.bypass_transicion','on', true);

  UPDATE embarques
     SET estado = 'Por liquidar'::estado_embarque,
         reabierto_at = now(),
         reabierto_por = auth.uid(),
         reabierto_motivo = v_motivo,
         updated_at = now()
   WHERE id = p_embarque_id;

  PERFORM set_config('app.bypass_transicion','off', true);

  UPDATE comisiones_devengadas
     SET definitiva = false,
         updated_at = now()
   WHERE embarque_id = p_embarque_id;

  PERFORM set_config('app.bypass_cierre','off', true);

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Embarque reabierto desde Cerrado a Por liquidar. Motivo: ' || v_motivo,
          'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, 'Otro'::tipo_evento_tracking, 'Embarque reabierto por administrador', '', now(), v_actor_email, v_org_id);

  BEGIN
    INSERT INTO cierre_embarque_log(embarque_id, organization_id, accion, usuario_id, motivo, snapshot)
    VALUES (p_embarque_id, v_org_id, 'reabrir', auth.uid(), v_motivo, NULL);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM public.registrar_bitacora(
    'embarques', 'reabrir_embarque', p_embarque_id, '',
    jsonb_build_object('motivo', v_motivo), v_org_id, auth.uid()
  );

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Por liquidar');
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;