
CREATE OR REPLACE FUNCTION public.limpiar_cancellation_status_verificado(
  p_factura_id uuid,
  p_remote_cancellation_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_factura record;
  v_email text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(NULLIF(TRIM(p_remote_cancellation_status), ''), '') <> '' THEN
    RAISE EXCEPTION 'facturapi_reporta_cancelacion_activa' USING ERRCODE = '22023';
  END IF;

  SELECT id, organization_id, cancellation_status, cancelado_en, acuse_cancelacion_status, numero
    INTO v_factura
    FROM public.facturas
   WHERE id = p_factura_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'factura_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_role(v_user, 'admin'::public.app_role)
    OR public.has_role(v_user, 'admin_org'::public.app_role)
    OR public.has_role(v_user, 'super_admin'::public.app_role)
    OR public.has_role(v_user, 'contador'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden_role' USING ERRCODE = '42501';
  END IF;

  IF v_factura.cancelado_en IS NOT NULL OR v_factura.acuse_cancelacion_status IS NOT NULL THEN
    RAISE EXCEPTION 'factura_ya_cancelada' USING ERRCODE = '22023';
  END IF;

  IF v_factura.cancellation_status NOT IN ('pending', 'verifying') THEN
    RAISE EXCEPTION 'factura_no_esta_pendiente' USING ERRCODE = '22023';
  END IF;

  UPDATE public.facturas
     SET cancellation_status = NULL,
         cancelacion_solicitada_en = NULL,
         cancelacion_vence_en = NULL
   WHERE id = p_factura_id;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;

  INSERT INTO public.bitacora_actividad
    (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, detalles)
  VALUES (
    v_factura.organization_id,
    v_user,
    v_email,
    'facturacion',
    'facturapi_pending_limpiada_manual',
    v_factura.id,
    jsonb_build_object(
      'numero', v_factura.numero,
      'cancellation_status_previo', v_factura.cancellation_status,
      'verificado_via', 'facturapi-consultar (GET /invoices/{id})'
    )
  );

  RETURN jsonb_build_object('ok', true, 'factura_id', p_factura_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.limpiar_cancellation_status_verificado(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpiar_cancellation_status_verificado(uuid, text) TO authenticated;
