CREATE OR REPLACE FUNCTION public.aprobar_factura_proveedor(p_id uuid, p_aprobar boolean, p_motivo text DEFAULT NULL::text)
RETURNS public.proveedor_facturas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'No tiene permisos para aprobar facturas de proveedor';
  END IF;

  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id AND deleted_at IS NULL;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  -- Guard multi-tenant (Ola 3): la factura debe pertenecer a una organización
  -- donde el usuario sea miembro. super_admin es global.
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

  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id);
  END IF;

  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = NULL
    WHERE id = p_id RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id RETURNING * INTO v_row;
  END IF;

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
      jsonb_build_object('motivo', p_motivo, 'total', v_row.total, 'aprobada', p_aprobar)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora_actividad insert failed in aprobar_factura_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) TO authenticated, service_role;