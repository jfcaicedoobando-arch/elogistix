-- Espejo canónico de public.cancelar_liquidacion_comision
-- Fuente vigente (mayor timestamp): 20260911000400_liquidacion_estado_previo_y_venta_eur_guard.sql
-- Vigilado por `bun run audit:replay-mirror` y `audit:schema-functions`.

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

  -- YG-02: rol financiero POR MEMBRESÍA en la org dueña de la liquidación.
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

  -- YG-03: cada comisión regresa a su estado previo. El fallback cubre filas
  -- legacy sin `estado_previo_liquidacion` capturado.
  UPDATE public.comisiones_devengadas
     SET estado = COALESCE(
           estado_previo_liquidacion,
           CASE WHEN estado = 'Cancelada' THEN 'Por recuperar'::public.estado_comision
                ELSE 'Devengada'::public.estado_comision END),
         estado_previo_liquidacion = NULL,
         liquidacion_id = NULL,
         updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id
     AND estado IN ('Liquidada', 'Cancelada');

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

REVOKE ALL ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) TO authenticated, service_role;
