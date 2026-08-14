CREATE OR REPLACE FUNCTION public.refacturacion_expediente(p_caso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_c.organization_id = public.current_user_org_id()
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: no tienes acceso a este caso' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'caso', jsonb_build_object(
      'id', v_c.id,
      'estado', v_c.estado,
      'paso_actual', v_c.paso_actual,
      'ruta_fiscal', v_c.ruta_fiscal,
      'motivo', v_c.motivo,
      'created_at', v_c.created_at,
      'cerrado_at', v_c.cerrado_at,
      'creado_por_email', COALESCE((SELECT email FROM auth.users WHERE id = v_c.created_by), ''),
      'cliente_origen', (SELECT nombre FROM public.clientes WHERE id = v_c.cliente_origen_id),
      'cliente_destino', (SELECT nombre FROM public.clientes WHERE id = v_c.cliente_destino_id),
      'embarque_id', v_c.embarque_id,
      'embarque_expediente', (SELECT expediente FROM public.embarques WHERE id = v_c.embarque_id)
    ),
    'factura_original', (
      SELECT jsonb_build_object('id', f.id, 'numero', f.numero, 'estado', f.estado,
                                'uuid_fiscal', f.uuid_fiscal, 'total', f.total, 'moneda', f.moneda,
                                'cancelado_en', f.cancelado_en)
      FROM public.facturas f WHERE f.id = v_c.factura_original_id
    ),
    'factura_nueva', (
      SELECT jsonb_build_object('id', f.id, 'numero', f.numero, 'estado', f.estado,
                                'uuid_fiscal', f.uuid_fiscal, 'total', f.total, 'moneda', f.moneda,
                                'cancelado_en', f.cancelado_en)
      FROM public.facturas f WHERE f.id = v_c.factura_nueva_id
    ),
    'pagos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'factura_id', p.factura_id, 'fecha_pago', p.fecha_pago,
               'monto', p.monto, 'moneda', p.moneda, 'uuid_rep', p.uuid_rep,
               'estado_rep', p.estado_rep, 'rep_cancelado_en', p.rep_cancelado_en,
               'deleted_at', p.deleted_at, 'ordenante_nombre', p.ordenante_nombre,
               'ordenante_rfc', p.ordenante_rfc,
               'es_nuevo', (p.id = v_c.pago_nuevo_id)
             ) ORDER BY p.created_at)
      FROM public.pagos_factura p
      WHERE p.id IN (v_c.pago_original_id, v_c.pago_nuevo_id)
         OR p.refacturacion_id = v_c.id
    ), '[]'::jsonb),
    'eventos', COALESCE((
      SELECT jsonb_agg(e ORDER BY (e->>'ts'))
      FROM (
        SELECT jsonb_build_object(
                 'id', b.id,
                 'ts', b.created_at,
                 'accion', b.accion,
                 'usuario_email', COALESCE(NULLIF(b.usuario_email, ''),
                                           (SELECT email FROM auth.users WHERE id = b.usuario_id), ''),
                 'entidad_nombre', COALESCE(b.entidad_nombre, ''),
                 'detalles', COALESCE(b.detalles, '{}'::jsonb)
               ) AS e
        FROM public.bitacora_actividad b
        WHERE b.organization_id = v_c.organization_id
          AND (
            b.detalles->>'caso_id' = v_c.id::text
            OR (
              b.entidad_id IN (v_c.factura_original_id, v_c.factura_nueva_id)
              AND b.created_at >= v_c.created_at - interval '1 minute'
              AND b.accion IN (
                'refacturacion_abierta','refacturacion_borrador_creado',
                'refacturacion_pago_reasignado','refacturacion_completada','refacturacion_cancelada',
                'timbrar_factura','facturapi_emitida','actualizar_datos_timbrado_factura',
                'facturapi_cancelacion_solicitada','facturapi_cancelada','facturapi_cancelada_async',
                'facturapi_cancelar_failed','facturapi_rep_emitido','facturapi_rep_emitir_failed',
                'facturapi_rep_cancelacion_solicitada','facturapi_rep_cancelado',
                'facturapi_rep_cancelar_failed','facturapi_rep_cancelacion_rechazada',
                'registrar_pago','factura_enviada_email'
              )
            )
          )
      ) s
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.refacturacion_expediente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refacturacion_expediente(uuid) TO authenticated, service_role;
