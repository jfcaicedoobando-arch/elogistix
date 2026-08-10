CREATE OR REPLACE FUNCTION public.aplicar_anticipo_a_factura(
  p_anticipo_id uuid,
  p_factura_id uuid,
  p_monto numeric,
  p_fecha_aplicacion date DEFAULT CURRENT_DATE
)
RETURNS public.anticipos_aplicaciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ant public.anticipos_proveedor;
  v_fact public.proveedor_facturas;
  v_pago public.pagos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_uid uuid := auth.uid();
  v_email text;
  v_monto_convertido numeric(18,4);
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
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden aplicar anticipos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto a aplicar debe ser mayor a cero.';
  END IF;

  SELECT * INTO v_ant FROM public.anticipos_proveedor WHERE id = p_anticipo_id;
  IF v_ant.id IS NULL OR v_ant.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;

  IF v_ant.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;

  IF v_ant.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo está cancelado.';
  END IF;
  IF v_ant.saldo_disponible + 0.01 < p_monto THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_SALDO: Saldo disponible (%.4f) insuficiente para aplicar %.4f.',
      v_ant.saldo_disponible, p_monto;
  END IF;

  SELECT * INTO v_fact FROM public.proveedor_facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_fact.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura no existe.';
  END IF;
  IF v_fact.estado_aprobacion <> 'aprobada' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura debe estar aprobada antes de aplicar un anticipo.';
  END IF;
  IF v_fact.organization_id <> v_ant.organization_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_ORG_MISMATCH: Anticipo y factura pertenecen a organizaciones distintas.';
  END IF;
  IF v_fact.proveedor_id IS DISTINCT FROM v_ant.proveedor_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_MISMATCH: Anticipo y factura pertenecen a proveedores distintos.';
  END IF;

  v_monto_convertido := public.convertir_monto_pago_a_factura(
    p_monto, v_ant.moneda, v_ant.tipo_cambio_usd, v_fact.moneda, v_fact.tipo_cambio_usd);

  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
     tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas,
     created_by, es_anticipo_aplicado)
  VALUES
    (v_ant.organization_id, p_factura_id, p_fecha_aplicacion, p_monto, v_ant.moneda,
     v_ant.tipo_cambio_usd,
     COALESCE(NULLIF(TRIM(v_ant.metodo_pago), ''), 'Transferencia'),
     COALESCE(v_ant.referencia,'') || ' (anticipo ' || v_ant.id::text || ')',
     v_ant.cuenta_bancaria_id, 'Aplicación de anticipo ' || v_ant.id::text,
     v_uid, true)
  RETURNING * INTO v_pago;

  INSERT INTO public.anticipos_aplicaciones
    (organization_id, anticipo_id, proveedor_factura_id, pago_proveedor_id,
     monto_aplicado, moneda_aplicada, fecha_aplicacion, created_by)
  VALUES
    (v_ant.organization_id, p_anticipo_id, p_factura_id, v_pago.id,
     p_monto, v_ant.moneda, p_fecha_aplicacion, v_uid)
  RETURNING * INTO v_ap;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_ant.organization_id, v_uid, COALESCE(v_email,''), 'aplicar_anticipo_a_factura', 'cxp',
            v_ap.id, 'Aplicación ' || v_ap.id::text,
            jsonb_build_object('anticipo_id', p_anticipo_id, 'factura_id', p_factura_id,
                               'monto', p_monto, 'moneda', v_ant.moneda,
                               'monto_convertido', v_monto_convertido,
                               'pago_id', v_pago.id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en aplicar_anticipo_a_factura: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_ap;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_anticipo_proveedor(
  p_id uuid,
  p_motivo text
)
RETURNS public.anticipos_proveedor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_email text;
  v_aplicaciones integer;
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
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden cancelar anticipos.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(trim(p_motivo),'') = '' OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOTIVO_REQUERIDO: Debes indicar un motivo de cancelación.';
  END IF;

  SELECT * INTO v_row FROM public.anticipos_proveedor WHERE id = p_id AND deleted_at IS NULL;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;

  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo ya está cancelado.';
  END IF;

  SELECT COUNT(*) INTO v_aplicaciones
    FROM public.anticipos_aplicaciones
    WHERE anticipo_id = p_id AND deleted_at IS NULL;

  IF v_aplicaciones > 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CON_APLICACIONES: No se puede cancelar un anticipo con aplicaciones vivas. Reversa las aplicaciones primero.';
  END IF;

  UPDATE public.anticipos_proveedor
    SET estado = 'cancelado',
        saldo_disponible = 0,
        motivo_cancelacion = p_motivo,
        deleted_at = now(),
        deleted_by = v_uid,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;

  UPDATE public.bbva_movimientos
    SET deleted_at = now(), deleted_by = v_uid
    WHERE anticipo_proveedor_id = p_id AND deleted_at IS NULL;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'cancelar_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('motivo', p_motivo, 'monto', v_row.monto, 'moneda', v_row.moneda));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en cancelar_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

-- H6: permisos explícitos (idempotente).
REVOKE ALL ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancelar_anticipo_proveedor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_anticipo_proveedor(uuid, text) TO authenticated, service_role;
