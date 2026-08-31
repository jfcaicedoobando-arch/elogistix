-- YG-02 (auditoría YAGNI 2026-08-31) · Autorización por organización en las
-- RPC de liquidaciones de comisión.
--
-- Problema: `registrar_pago_liquidacion` y `cancelar_liquidacion_comision`
-- validaban el rol contra `public.user_roles` GLOBAL (¿tiene el rol en algún
-- lado?), no contra la organización dueña de la liquidación.
--
-- Fix: cargar primero la liquidación con FOR UPDATE y autorizar contra
-- `v_row.organization_id` con el helper canónico
-- `public.has_any_role_in_org_exact` (membresía en esa org, lista EXACTA sin
-- expansión de jerarquía), conservando la política explícita de `super_admin`.

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

CREATE OR REPLACE FUNCTION public.cancelar_liquidacion_comision(p_liquidacion_id uuid, p_motivo text)
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

  IF COALESCE(TRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_MOTIVO_REQUERIDO: Captura el motivo de la cancelación.'
      USING ERRCODE = '42501';
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

  IF NOT public.has_any_role_in_org_exact(v_uid,
       ARRAY['admin','admin_org','super_admin','contador','tesorero']::public.app_role[],
       v_row.organization_id) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden cancelar liquidaciones.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.estado = 'Cancelada' THEN
    RETURN v_row;
  END IF;

  IF v_row.fecha_pago IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_PAGADA_NO_CANCELABLE: La liquidación ya fue pagada; registra el ajuste en la siguiente liquidación.'
      USING ERRCODE = '42501';
  END IF;

  -- A-2 (Ola 1): comisiones ORDINARIAS de la liquidación vuelven a devengarse.
  UPDATE public.comisiones_devengadas
     SET estado = 'Devengada', liquidacion_id = NULL, updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id
     AND estado = 'Liquidada';

  -- A-2 (Ola 1): las RECUPERACIONES que esta liquidación descontó quedaron
  -- marcadas 'Cancelada'. Al cancelar la liquidación la deuda sigue viva:
  -- regresan a 'Por recuperar', no a 'Devengada' (eso las volvía pagables).
  UPDATE public.comisiones_devengadas
     SET estado = 'Por recuperar', liquidacion_id = NULL, updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id
     AND estado = 'Cancelada';

  UPDATE public.liquidaciones_comision
     SET estado = 'Cancelada',
         cancelada_at = now(),
         cancelada_por = v_uid,
         motivo_cancelacion = TRIM(p_motivo),
         updated_at = now()
   WHERE id = p_liquidacion_id
  RETURNING * INTO v_row;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'cancelar_liquidacion_comision', 'comisiones',
            v_row.id, 'Liquidación ' || v_row.periodo,
            jsonb_build_object('motivo', TRIM(p_motivo), 'total_mxn', v_row.total_mxn));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en cancelar_liquidacion_comision: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) TO authenticated, service_role;
