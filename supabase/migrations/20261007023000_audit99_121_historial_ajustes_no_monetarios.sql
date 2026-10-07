-- ID provisional y no aplicado: confirmar en el futuro envelope autorizado.
-- DDL de la función lectora; conserva firma, owner, ACL y alcance de organización.
-- Sin DML de negocio, backfill ni reescritura de eventos.
-- AUD-57/121: eventos reales; clasifica ajustes sólo desde el flag persistido.
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
      CASE WHEN jsonb_typeof(b.detalles) = 'object' THEN b.detalles
        ELSE jsonb_build_object('datos_originales', b.detalles) END AS datos_registrados,
      COALESCE(b.fuente_evento = 'rpc_aprobar_factura_proveedor'
        AND b.accion IN ('aprobar_factura_proveedor', 'rechazar_factura_proveedor'), false) AS evento_verificado,
      CASE WHEN length(b.detalles->>'total') <= 64
        AND b.detalles->>'total' ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (b.detalles->>'total')::numeric END AS total_historico,
      CASE WHEN b.detalles->>'moneda' IN ('MXN', 'USD', 'EUR')
        THEN b.detalles->>'moneda' END AS moneda_historica
    FROM public.bitacora_actividad b
    WHERE b.entidad_id = p_id AND b.modulo = 'cxp' AND b.organization_id = v_org
  ), eventos AS (
    SELECT pf.created_at AS ev_ts, 'creada'::text AS ev_tipo,
      'Factura capturada'::text AS ev_descripcion,
      COALESCE(u.email, '')::text AS ev_actor_email,
      NULL::numeric AS ev_monto, NULL::text AS ev_moneda,
      jsonb_build_object('origen', 'registro_factura', 'snapshot_historico_disponible', false,
        'procedencia_verificada', true) AS ev_detalles
    FROM public.proveedor_facturas pf
    LEFT JOIN auth.users u ON u.id = pf.created_by
    WHERE pf.id = p_id AND pf.organization_id = v_org

    UNION ALL

    -- La columna aprobada_at conserva sólo la última decisión. Es un fallback
    -- para facturas antiguas sin su evento; nunca reemplaza decisiones de bitácora.
    SELECT pf.aprobada_at, pf.estado_aprobacion::text,
      CASE pf.estado_aprobacion::text WHEN 'aprobada' THEN 'Factura aprobada'
        ELSE 'Factura rechazada' END,
      COALESCE(u.email, '')::text, NULL::numeric, NULL::text,
      jsonb_build_object('motivo_rechazo', pf.motivo_rechazo,
        'origen', 'registro_factura', 'snapshot_historico_disponible', false, 'procedencia_verificada', true)
    FROM public.proveedor_facturas pf
    LEFT JOIN auth.users u ON u.id = pf.aprobada_por
    WHERE pf.id = p_id AND pf.organization_id = v_org AND pf.aprobada_at IS NOT NULL
      AND pf.estado_aprobacion::text IN ('aprobada', 'rechazada')
      AND NOT EXISTS (
        SELECT 1 FROM bitacora b WHERE b.evento_verificado AND b.created_at = pf.aprobada_at
          AND b.accion = CASE pf.estado_aprobacion::text
            WHEN 'aprobada' THEN 'aprobar_factura_proveedor' ELSE 'rechazar_factura_proveedor' END
      )

    UNION ALL

    SELECT pp.created_at, 'pago'::text,
      (CASE WHEN pp.es_ajuste THEN 'Ajuste no monetario registrado' ELSE 'Pago registrado' END
        || CASE WHEN COALESCE(pp.referencia, '') <> ''
        THEN ' · ref ' || pp.referencia ELSE '' END)::text,
      COALESCE(u.email, '')::text, pp.monto, pp.moneda::text,
      jsonb_build_object('metodo_pago', pp.metodo_pago, 'referencia', pp.referencia, 'fecha_pago', pp.fecha_pago,
        'pago_id', pp.id, 'es_ajuste', pp.es_ajuste, 'motivo_ajuste', pp.motivo_ajuste)
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
      CASE WHEN b.evento_verificado THEN
        CASE b.accion WHEN 'aprobar_factura_proveedor' THEN 'aprobada' ELSE 'rechazada' END
        ELSE 'actividad' END::text,
      CASE WHEN b.evento_verificado THEN
        CASE b.accion WHEN 'aprobar_factura_proveedor' THEN 'Factura aprobada' ELSE 'Factura rechazada' END
        ELSE CASE b.accion WHEN 'aprobar_factura_proveedor' THEN 'Aprobación registrada en bitácora'
          WHEN 'rechazar_factura_proveedor' THEN 'Rechazo registrado en bitácora'
          WHEN 'crear' THEN 'Captura registrada en bitácora'
          WHEN 'editar' THEN 'Edición registrada en bitácora'
          ELSE 'Actividad registrada: ' || COALESCE(NULLIF(b.entidad_nombre, ''), b.accion) END END::text,
      COALESCE(b.usuario_email, '')::text,
      CASE WHEN b.evento_verificado
        THEN b.total_historico END,
      CASE WHEN b.evento_verificado
        THEN b.moneda_historica END,
      b.datos_registrados || jsonb_build_object(
        'bitacora_id', b.id, 'origen', 'bitacora', 'fuente_evento', b.fuente_evento,
        'procedencia_verificada', b.evento_verificado,
        'accion_registrada', b.accion, 'motivo_rechazo', COALESCE(b.detalles->>'motivo_rechazo', b.detalles->>'motivo'),
        'snapshot_historico_disponible', b.evento_verificado AND b.total_historico IS NOT NULL AND b.moneda_historica IS NOT NULL
      )
    FROM bitacora b
  )
  SELECT e.ev_ts, e.ev_tipo, e.ev_descripcion, e.ev_actor_email, e.ev_monto, e.ev_moneda, e.ev_detalles
  FROM eventos e WHERE e.ev_ts IS NOT NULL ORDER BY e.ev_ts ASC;
END;
$function$;
REVOKE ALL ON FUNCTION public.historial_proveedor_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.historial_proveedor_factura(uuid) TO authenticated, service_role;
