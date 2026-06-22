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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT organization_id INTO v_org
  FROM public.proveedor_facturas
  WHERE id = p_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org AND om.user_id = v_uid
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role::text = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Sin acceso a la factura';
  END IF;

  RETURN QUERY
  WITH eventos AS (
    SELECT
      pf.created_at AS ts,
      'creada'::text AS tipo,
      'Factura capturada'::text AS descripcion,
      COALESCE(u.email, '')::text AS actor_email,
      pf.total AS monto,
      pf.moneda::text AS moneda,
      jsonb_build_object('folio', pf.folio_proveedor) AS detalles
    FROM public.proveedor_facturas pf
    LEFT JOIN auth.users u ON u.id = pf.created_by
    WHERE pf.id = p_id

    UNION ALL

    SELECT
      pf.aprobada_at,
      CASE pf.estado_aprobacion::text
        WHEN 'aprobada' THEN 'aprobada'
        WHEN 'rechazada' THEN 'rechazada'
        ELSE pf.estado_aprobacion::text
      END,
      CASE pf.estado_aprobacion::text
        WHEN 'aprobada' THEN 'Factura aprobada'
        WHEN 'rechazada' THEN 'Factura rechazada'
        ELSE 'Cambio de estado'
      END,
      COALESCE(u.email, '')::text,
      NULL::numeric,
      NULL::text,
      jsonb_build_object('motivo_rechazo', pf.motivo_rechazo)
    FROM public.proveedor_facturas pf
    LEFT JOIN auth.users u ON u.id = pf.aprobada_por
    WHERE pf.id = p_id AND pf.aprobada_at IS NOT NULL

    UNION ALL

    SELECT
      pp.fecha_pago::timestamptz,
      'pago'::text,
      ('Pago registrado' ||
        CASE WHEN pp.referencia IS NOT NULL AND pp.referencia <> ''
             THEN ' · ref ' || pp.referencia ELSE '' END)::text,
      COALESCE(u.email, '')::text,
      pp.monto,
      pp.moneda::text,
      jsonb_build_object('metodo_pago', pp.metodo_pago, 'referencia', pp.referencia)
    FROM public.pagos_proveedor pp
    LEFT JOIN auth.users u ON u.id = pp.created_by
    WHERE pp.proveedor_factura_id = p_id AND pp.deleted_at IS NULL

    UNION ALL

    SELECT
      nc.created_at,
      'nota_credito'::text,
      ('Nota de crédito ' || COALESCE(nc.folio_nc, '') ||
        CASE WHEN nc.motivo IS NOT NULL AND nc.motivo::text <> ''
             THEN ' · ' || nc.motivo::text ELSE '' END)::text,
      COALESCE(u.email, '')::text,
      nc.monto,
      nc.moneda::text,
      jsonb_build_object('folio', nc.folio_nc, 'estado', nc.estado)
    FROM public.proveedor_notas_credito nc
    LEFT JOIN auth.users u ON u.id = nc.created_by
    WHERE nc.proveedor_factura_id = p_id AND nc.deleted_at IS NULL

    UNION ALL

    SELECT
      pf.deleted_at,
      'eliminada'::text,
      'Factura enviada a papelera'::text,
      COALESCE(u.email, '')::text,
      NULL::numeric,
      NULL::text,
      '{}'::jsonb
    FROM public.proveedor_facturas pf
    LEFT JOIN auth.users u ON u.id = pf.deleted_by
    WHERE pf.id = p_id AND pf.deleted_at IS NOT NULL

    UNION ALL

    SELECT
      b.created_at,
      COALESCE(b.accion, 'evento')::text,
      COALESCE(b.entidad_nombre, b.accion)::text,
      COALESCE(b.usuario_email, '')::text,
      NULL::numeric,
      NULL::text,
      COALESCE(b.detalles, '{}'::jsonb)
    FROM public.bitacora_actividad b
    WHERE b.entidad_id = p_id
      AND b.modulo = 'cxp'
      AND b.accion NOT IN ('aprobar_factura_proveedor', 'rechazar_factura_proveedor')
  )
  SELECT * FROM eventos
  WHERE ts IS NOT NULL
  ORDER BY ts ASC;
END;
$function$;