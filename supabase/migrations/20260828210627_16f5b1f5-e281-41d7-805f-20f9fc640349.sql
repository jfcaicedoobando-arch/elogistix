-- N13: devolución simple de anticipo de proveedor.
ALTER TABLE public.anticipos_proveedor
  DROP CONSTRAINT IF EXISTS anticipos_proveedor_estado_check;

ALTER TABLE public.anticipos_proveedor
  ADD CONSTRAINT anticipos_proveedor_estado_check
  CHECK (estado = ANY (ARRAY['disponible'::text,'aplicado_parcial'::text,'aplicado_total'::text,'cancelado'::text,'devuelto'::text]));

ALTER TABLE public.anticipos_proveedor
  ADD COLUMN IF NOT EXISTS devuelto_at timestamptz,
  ADD COLUMN IF NOT EXISTS devuelto_by uuid,
  ADD COLUMN IF NOT EXISTS monto_devuelto numeric(18,4),
  ADD COLUMN IF NOT EXISTS motivo_devolucion text;

-- El recálculo automático no debe reabrir el saldo de un anticipo devuelto.
CREATE OR REPLACE FUNCTION public._recalc_anticipo_saldo(p_anticipo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.anticipos_proveedor;
  v_aplicado numeric(18,4);
  v_nuevo_saldo numeric(18,4);
  v_nuevo_estado text;
BEGIN
  SELECT * INTO v_row FROM public.anticipos_proveedor WHERE id = p_anticipo_id;
  IF v_row.id IS NULL THEN RETURN; END IF;
  -- Respeta cancelado, devuelto (N13) y soft-deleted.
  IF v_row.estado IN ('cancelado','devuelto') OR v_row.deleted_at IS NOT NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
    FROM public.anticipos_aplicaciones
    WHERE anticipo_id = p_anticipo_id
      AND deleted_at IS NULL
      AND moneda_aplicada = v_row.moneda;

  v_nuevo_saldo := v_row.monto - v_aplicado;

  IF v_aplicado <= 0.01 THEN
    v_nuevo_estado := 'disponible';
  ELSIF v_nuevo_saldo <= 0.01 THEN
    v_nuevo_estado := 'aplicado_total';
  ELSE
    v_nuevo_estado := 'aplicado_parcial';
  END IF;

  UPDATE public.anticipos_proveedor
    SET saldo_disponible = v_nuevo_saldo,
        estado = v_nuevo_estado,
        updated_at = now()
    WHERE id = p_anticipo_id
      AND (saldo_disponible IS DISTINCT FROM v_nuevo_saldo OR estado IS DISTINCT FROM v_nuevo_estado);
END;
$function$;

CREATE OR REPLACE FUNCTION public.devolver_anticipo_proveedor(
  p_id uuid,
  p_monto numeric,
  p_fecha date,
  p_cuenta_bancaria_id uuid,
  p_referencia text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
 RETURNS public.anticipos_proveedor
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_cuenta_org uuid;
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
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden registrar devoluciones de anticipo.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(trim(p_motivo),'') = '' OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOTIVO_REQUERIDO: Debes indicar el motivo de la devolución.';
  END IF;

  -- N18: candado de fila antes de validar estado (doble clic / doble pestaña).
  SELECT * INTO v_row FROM public.anticipos_proveedor
   WHERE id = p_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;

  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo está cancelado; no puede devolverse.';
  END IF;
  IF v_row.estado = 'devuelto' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_DEVUELTO: Este anticipo ya tiene una devolución registrada.';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto devuelto debe ser mayor a cero.';
  END IF;
  IF p_monto > COALESCE(v_row.saldo_disponible,0) + 0.01 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_EXCEDE_SALDO: La devolución (%) excede el saldo disponible (%).',
      p_monto, COALESCE(v_row.saldo_disponible,0);
  END IF;

  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_REQUERIDA: Indica la fecha de la devolución.';
  END IF;
  IF p_fecha < v_row.fecha_anticipo THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_INVALIDA: La devolución no puede ser anterior a la fecha del anticipo (%).',
      v_row.fecha_anticipo;
  END IF;

  SELECT cb.organization_id INTO v_cuenta_org
    FROM public.cuentas_bancarias cb
   WHERE cb.id = p_cuenta_bancaria_id;
  IF v_cuenta_org IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_REQUERIDA: Selecciona la cuenta bancaria donde entró el dinero.';
  END IF;
  IF v_cuenta_org IS DISTINCT FROM v_row.organization_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.anticipos_proveedor
    SET estado = 'devuelto',
        saldo_disponible = 0,
        monto_devuelto = p_monto,
        motivo_devolucion = trim(p_motivo),
        devuelto_at = now(),
        devuelto_by = v_uid,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;

  INSERT INTO public.bbva_movimientos
    (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
     cargo, abono, estado_conciliacion, anticipo_proveedor_id, importado_por, importado_en)
  VALUES
    (v_row.organization_id, p_cuenta_bancaria_id, p_fecha,
     'Devolución de anticipo ' || v_row.id::text, NULLIF(trim(COALESCE(p_referencia,'')),''),
     0, p_monto, 'Pendiente'::public.estado_conciliacion, v_row.id, v_uid, now());

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'devolver_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('motivo', trim(p_motivo), 'monto_devuelto', p_monto,
                               'moneda', v_row.moneda, 'fecha', p_fecha,
                               'cuenta_bancaria_id', p_cuenta_bancaria_id,
                               'referencia', p_referencia));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en devolver_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text) TO service_role;