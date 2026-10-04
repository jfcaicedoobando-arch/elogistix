-- AUD-57: leer eventos reales; los datos actuales no son snapshots del pasado.
-- Sin backfill ni modificación de facturas, pagos o notas de crédito existentes.
CREATE OR REPLACE FUNCTION public.historial_proveedor_factura(p_id uuid)
 RETURNS TABLE(ts timestamp with time zone, tipo text, descripcion text, actor_email text, monto numeric, moneda text, detalles jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT organization_id INTO v_org FROM public.proveedor_facturas WHERE id = p_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org AND om.user_id = v_uid
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role::text = 'super_admin'
  ) THEN RAISE EXCEPTION 'Sin acceso a la factura'; END IF;

  RETURN QUERY
  WITH bitacora AS (
    SELECT b.*,
      CASE WHEN length(b.detalles->>'total') <= 64
        AND b.detalles->>'total' ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (b.detalles->>'total')::numeric END AS total_historico,
      CASE WHEN b.detalles->>'moneda' IN ('MXN', 'USD', 'EUR')
        THEN b.detalles->>'moneda' END AS moneda_historica
    FROM public.bitacora_actividad b
    WHERE b.entidad_id = p_id AND b.modulo = 'cxp' AND b.organization_id = v_org
  ), captura AS (
    SELECT b.* FROM bitacora b WHERE b.accion = 'crear'
    ORDER BY b.created_at, b.id LIMIT 1
  ), eventos AS (
    SELECT pf.created_at AS ev_ts, 'creada'::text AS ev_tipo,
      'Factura capturada'::text AS ev_descripcion,
      COALESCE(b.usuario_email, u.email, '')::text AS ev_actor_email,
      b.total_historico AS ev_monto, b.moneda_historica AS ev_moneda,
      COALESCE(b.detalles, '{}'::jsonb) || jsonb_build_object(
        'folio', b.detalles->>'folio_proveedor', 'origen', CASE WHEN b.id IS NULL THEN 'registro_factura' ELSE 'bitacora' END,
        'snapshot_historico_disponible', b.total_historico IS NOT NULL AND b.moneda_historica IS NOT NULL
      ) AS ev_detalles
    FROM public.proveedor_facturas pf
    LEFT JOIN auth.users u ON u.id = pf.created_by
    LEFT JOIN captura b ON true
    WHERE pf.id = p_id AND pf.organization_id = v_org

    UNION ALL

    -- La columna aprobada_at conserva sólo la última decisión. Es un fallback
    -- para facturas antiguas sin su evento; nunca reemplaza decisiones de bitácora.
    SELECT pf.aprobada_at, pf.estado_aprobacion::text,
      CASE pf.estado_aprobacion::text WHEN 'aprobada' THEN 'Factura aprobada'
        ELSE 'Factura rechazada' END,
      COALESCE(u.email, '')::text, NULL::numeric, NULL::text,
      jsonb_build_object('motivo_rechazo', pf.motivo_rechazo,
        'origen', 'registro_factura', 'snapshot_historico_disponible', false)
    FROM public.proveedor_facturas pf
    LEFT JOIN auth.users u ON u.id = pf.aprobada_por
    WHERE pf.id = p_id AND pf.organization_id = v_org AND pf.aprobada_at IS NOT NULL
      AND pf.estado_aprobacion::text IN ('aprobada', 'rechazada')
      AND NOT EXISTS (
        SELECT 1 FROM bitacora b WHERE b.created_at = pf.aprobada_at
          AND b.accion = CASE pf.estado_aprobacion::text
            WHEN 'aprobada' THEN 'aprobar_factura_proveedor' ELSE 'rechazar_factura_proveedor' END
      )

    UNION ALL

    SELECT pp.created_at, 'pago'::text,
      ('Pago registrado' || CASE WHEN COALESCE(pp.referencia, '') <> ''
        THEN ' · ref ' || pp.referencia ELSE '' END)::text,
      COALESCE(u.email, '')::text, pp.monto, pp.moneda::text,
      jsonb_build_object('metodo_pago', pp.metodo_pago, 'referencia', pp.referencia, 'fecha_pago', pp.fecha_pago)
    FROM public.pagos_proveedor pp
    LEFT JOIN auth.users u ON u.id = pp.created_by
    WHERE pp.proveedor_factura_id = p_id AND pp.organization_id = v_org AND pp.deleted_at IS NULL

    UNION ALL

    SELECT nc.created_at, 'nota_credito'::text,
      ('Nota de crédito ' || COALESCE(nc.folio_nc, '') || CASE WHEN COALESCE(nc.motivo::text, '') <> ''
        THEN ' · ' || nc.motivo::text ELSE '' END)::text,
      COALESCE(u.email, '')::text, nc.monto, nc.moneda::text,
      jsonb_build_object('folio', nc.folio_nc, 'estado', nc.estado)
    FROM public.proveedor_notas_credito nc
    LEFT JOIN auth.users u ON u.id = nc.created_by
    WHERE nc.proveedor_factura_id = p_id AND nc.organization_id = v_org AND nc.deleted_at IS NULL

    UNION ALL

    SELECT pf.deleted_at, 'eliminada'::text, 'Factura enviada a papelera'::text,
      COALESCE(u.email, '')::text, NULL::numeric, NULL::text, '{}'::jsonb
    FROM public.proveedor_facturas pf
    LEFT JOIN auth.users u ON u.id = pf.deleted_by
    WHERE pf.id = p_id AND pf.organization_id = v_org AND pf.deleted_at IS NOT NULL

    UNION ALL

    SELECT b.created_at,
      CASE b.accion WHEN 'aprobar_factura_proveedor' THEN 'aprobada'
        WHEN 'rechazar_factura_proveedor' THEN 'rechazada' ELSE b.accion END::text,
      CASE b.accion WHEN 'aprobar_factura_proveedor' THEN 'Factura aprobada'
        WHEN 'rechazar_factura_proveedor' THEN 'Factura rechazada'
        WHEN 'editar' THEN 'Factura editada' ELSE COALESCE(b.entidad_nombre, b.accion) END::text,
      COALESCE(b.usuario_email, '')::text,
      CASE WHEN b.accion IN ('editar', 'aprobar_factura_proveedor', 'rechazar_factura_proveedor')
        THEN b.total_historico END,
      CASE WHEN b.accion IN ('editar', 'aprobar_factura_proveedor', 'rechazar_factura_proveedor')
        THEN b.moneda_historica END,
      COALESCE(b.detalles, '{}'::jsonb) || jsonb_build_object(
        'bitacora_id', b.id, 'origen', 'bitacora', 'motivo_rechazo', COALESCE(b.detalles->>'motivo_rechazo', b.detalles->>'motivo')
      ) || CASE WHEN b.accion IN ('editar', 'aprobar_factura_proveedor', 'rechazar_factura_proveedor')
        THEN jsonb_build_object('snapshot_historico_disponible',
          b.total_historico IS NOT NULL AND b.moneda_historica IS NOT NULL) ELSE '{}'::jsonb END
    FROM bitacora b WHERE b.accion <> 'crear'
  )
  SELECT e.ev_ts, e.ev_tipo, e.ev_descripcion, e.ev_actor_email, e.ev_monto, e.ev_moneda, e.ev_detalles
  FROM eventos e WHERE e.ev_ts IS NOT NULL ORDER BY e.ev_ts ASC;
END;
$function$;
REVOKE ALL ON FUNCTION public.historial_proveedor_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.historial_proveedor_factura(uuid) TO authenticated, service_role;

-- Las decisiones nuevas conservan su propia moneda/TC en la bitácora.
CREATE OR REPLACE FUNCTION public.aprobar_factura_proveedor(p_id uuid, p_aprobar boolean, p_motivo text DEFAULT NULL::text)
RETURNS proveedor_facturas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_es_admin boolean;
  v_desvinculo jsonb := '{}'::jsonb;
  v_estado_actual text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: Tu rol no puede aprobar ni rechazar facturas de proveedor.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin'])
  ) INTO v_es_admin;

  -- A-3: FOR UPDATE serializa dos clics simultáneos sobre la misma factura.
  SELECT * INTO v_row FROM public.proveedor_facturas
   WHERE id = p_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = v_row.organization_id
          AND om.user_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = '42501';
  END IF;

  IF v_row.estado_aprobacion <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_row.estado_aprobacion;
  END IF;

  -- SoD: quien capturó no aprueba su propia factura (salvo administradores)
  IF p_aprobar
     AND v_row.created_by IS NOT NULL
     AND v_row.created_by = v_uid
     AND NOT v_es_admin
  THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: No puedes aprobar una factura que tú mismo capturaste. Pide la aprobación a otra persona.';
  END IF;

  -- Ola 4 (H2): al aprobar, `p_motivo` es la justificación del gasto sin respaldo.
  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id, p_motivo);
  END IF;

  -- A-3: relectura redundante dentro del bloqueo (defensa ante validaciones
  -- que pudieran liberar el lock por subtransacciones).
  SELECT estado_aprobacion::text INTO v_estado_actual
    FROM public.proveedor_facturas WHERE id = p_id FOR UPDATE;
  IF v_estado_actual <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_estado_actual;
  END IF;

  -- RNF-07: marca de sesión requerida por trg_guard_aprobacion_proveedor_factura
  PERFORM set_config('app.aprobando_cxp', '1', true);

  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada',
        aprobada_por = v_uid,
        aprobada_at = now(),
        motivo_rechazo = NULL,
        aprobacion_heredada = false,
        justificacion_sin_vinculo = NULLIF(btrim(COALESCE(p_motivo,'')), '')
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'La factura ya fue procesada por otra sesión. Recarga la pantalla.'
      USING ERRCODE = 'serialization_failure';
  END IF;

  IF NOT p_aprobar THEN
    -- v13.493.0 — el rechazo rompe el vínculo con el embarque.
    v_desvinculo := public._cxp_desvincular_por_rechazo(p_id, p_motivo);
    SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id;
  END IF;

  PERFORM set_config('app.aprobando_cxp', '0', true);

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (
      v_row.organization_id,
      v_uid,
      COALESCE(v_email, ''),
      CASE WHEN p_aprobar THEN 'aprobar_factura_proveedor' ELSE 'rechazar_factura_proveedor' END,
      'cxp',
      v_row.id,
      'Factura ' || COALESCE(v_row.folio_proveedor,'') || ' de ' || COALESCE(v_row.proveedor_nombre,''),
      jsonb_build_object(
        'motivo', p_motivo,
        'total', v_row.total,
        'moneda', v_row.moneda,
        'tipo_cambio_usd', v_row.tipo_cambio_usd,
        'aprobada', p_aprobar,
        'justificacion_sin_vinculo', v_row.justificacion_sin_vinculo
      ) || v_desvinculo
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora_actividad insert failed in aprobar_factura_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) TO authenticated, service_role;
