-- Espejo canónico de public.registrar_pago_liquidacion
-- Fuente vigente (mayor timestamp): 20260831211719_782b01f9-bd93-4a02-adeb-50ea3c35d9c7.sql
-- Vigilado por `bun run audit:replay-mirror` y `audit:schema-functions`.

CREATE OR REPLACE FUNCTION public.registrar_pago_liquidacion(p_liquidacion_id uuid, p_fecha_pago date, p_metodo_pago text, p_referencia text DEFAULT NULL::text, p_notas text DEFAULT NULL::text)
 RETURNS public.liquidaciones_comision
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.liquidaciones_comision;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  -- YG-02: primero la fila (con candado), después la autorización por org.
  SELECT * INTO v_row FROM public.liquidaciones_comision
  WHERE id = p_liquidacion_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_NO_EXISTE: La liquidación no existe.';
  END IF;

  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_OTRA_ORG: La liquidación pertenece a otra organización.';
  END IF;

  -- YG-02: rol financiero POR MEMBRESÍA en la org dueña de la liquidación,
  -- lista exacta {admin, admin_org, super_admin, contador, tesorero}.
  IF NOT public.has_any_role_in_org_exact(v_uid,
       ARRAY['admin','admin_org','super_admin','contador','tesorero']::public.app_role[],
       v_row.organization_id) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden pagar liquidaciones.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.estado = 'Cancelada' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_CANCELADA: La liquidación está cancelada; genera una nueva.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.fecha_pago IS NOT NULL OR v_row.estado = 'Pagada' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_YA_PAGADA: Esta liquidación ya tiene un pago registrado el %.', v_row.fecha_pago
      USING ERRCODE = '42501';
  END IF;

  IF p_fecha_pago IS NULL OR p_fecha_pago > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_FECHA_FUTURA: La fecha del pago no puede ser futura.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.liquidaciones_comision
     SET fecha_pago = p_fecha_pago,
         metodo_pago = p_metodo_pago,
         referencia = COALESCE(p_referencia, referencia),
         notas = COALESCE(p_notas, notas),
         estado = 'Pagada',
         updated_at = now()
   WHERE id = p_liquidacion_id
     AND fecha_pago IS NULL
     AND estado = 'Generada'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_YA_PAGADA: Esta liquidación ya tiene un pago registrado.'
      USING ERRCODE = '42501';
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'registrar_pago_liquidacion', 'comisiones',
            v_row.id, 'Liquidación ' || v_row.periodo,
            jsonb_build_object('fecha_pago', p_fecha_pago, 'metodo_pago', p_metodo_pago,
                               'total_mxn', v_row.total_mxn));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_pago_liquidacion: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) TO authenticated, service_role;
