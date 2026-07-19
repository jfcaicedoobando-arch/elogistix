
-- Fase M (v13.301.84) — Bug 20: gate de rol en cerrar_factura_proveedor_sin_pago.

CREATE OR REPLACE FUNCTION public.cerrar_factura_proveedor_sin_pago(
  p_factura_id uuid,
  p_motivo text,
  p_comentario text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_org      uuid;
  v_estado   public.estado_proveedor_factura;
  v_deleted  timestamptz;
  v_moneda   public.moneda;
  v_aprob    public.estado_aprobacion_factura_proveedor;
  v_saldo    numeric;
  v_pago_id  uuid;
  v_uid      uuid := auth.uid();
  v_rol_ejecutor text;
  v_valid_motivos text[] := ARRAY['compensacion', 'condonacion', 'ajuste_historico', 'duplicada'];
BEGIN
  IF p_motivo IS NULL OR NOT (p_motivo = ANY(v_valid_motivos)) THEN
    RAISE EXCEPTION 'Motivo inválido. Válidos: compensacion, condonacion, ajuste_historico, duplicada.'
      USING ERRCODE = '22023';
  END IF;

  SELECT pf.organization_id, pf.estado, pf.deleted_at, pf.moneda, pf.estado_aprobacion
    INTO v_org, v_estado, v_deleted, v_moneda, v_aprob
    FROM public.proveedor_facturas pf
   WHERE pf.id = p_factura_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'La factura está en la papelera; restáurala antes.' USING ERRCODE = '22023';
  END IF;
  IF v_estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'La factura ya está cancelada.' USING ERRCODE = '22023';
  END IF;
  IF v_estado = 'Pagada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'La factura ya está pagada.' USING ERRCODE = '22023';
  END IF;
  IF v_aprob <> 'aprobada'::public.estado_aprobacion_factura_proveedor THEN
    RAISE EXCEPTION 'La factura debe estar aprobada antes de cerrarla.' USING ERRCODE = '22023';
  END IF;

  -- Fase M: gate de rol.
  -- Bypass super_admin; en caso normal exige que el usuario pertenezca a la org
  -- de la factura Y tenga uno de los roles autorizados.
  IF public.has_role(v_uid, 'super_admin'::public.app_role) THEN
    v_rol_ejecutor := 'super_admin';
  ELSIF v_org = public.current_user_org_id() AND public.has_role(v_uid, 'admin'::public.app_role) THEN
    v_rol_ejecutor := 'admin';
  ELSIF v_org = public.current_user_org_id() AND public.has_role(v_uid, 'admin_org'::public.app_role) THEN
    v_rol_ejecutor := 'admin_org';
  ELSIF v_org = public.current_user_org_id() AND public.has_role(v_uid, 'contador'::public.app_role) THEN
    v_rol_ejecutor := 'contador';
  ELSIF v_org = public.current_user_org_id() AND public.has_role(v_uid, 'tesorero'::public.app_role) THEN
    v_rol_ejecutor := 'tesorero';
  ELSE
    RAISE EXCEPTION 'LC_CERRAR_FACTURA_SIN_ROL: sólo admin, admin_org, contador o tesorero pueden cerrar una factura sin pago.'
      USING ERRCODE = '42501',
            HINT = json_build_object(
              'rol_requerido', array['admin','admin_org','contador','tesorero','super_admin'],
              'factura_id', p_factura_id
            )::text;
  END IF;

  SELECT saldo INTO v_saldo
    FROM public.v_proveedor_facturas_saldo
   WHERE proveedor_factura_id = p_factura_id;

  IF COALESCE(v_saldo, 0) <= 0 THEN
    RAISE EXCEPTION 'La factura no tiene saldo pendiente que cerrar.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pagos_proveedor(
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd,
    metodo_pago, referencia, notas, es_ajuste, motivo_ajuste, created_by
  ) VALUES (
    v_org, p_factura_id, CURRENT_DATE, v_saldo, v_moneda, 0,
    'Ajuste', 'Cierre sin pago: ' || p_motivo,
    COALESCE(p_comentario, ''), true, p_motivo, v_uid
  )
  RETURNING id INTO v_pago_id;

  UPDATE public.proveedor_facturas
     SET estado = 'Pagada'::public.estado_proveedor_factura,
         updated_at = now()
   WHERE id = p_factura_id;

  INSERT INTO public.bitacora_actividad(
    organization_id, usuario_id, modulo, accion, entidad_id, detalles
  ) VALUES (
    v_org, v_uid, 'cxp', 'cerrar_sin_pago', p_factura_id,
    jsonb_build_object(
      'motivo', p_motivo,
      'saldo_ajustado', v_saldo,
      'pago_ajuste_id', v_pago_id,
      'comentario', p_comentario,
      'rol_ejecutor', v_rol_ejecutor
    )
  );

  RETURN v_pago_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cerrar_factura_proveedor_sin_pago(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerrar_factura_proveedor_sin_pago(uuid, text, text) TO authenticated, service_role;
