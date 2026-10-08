-- Explicit cash/bank refund; historical metadata is never backfilled.
CREATE OR REPLACE FUNCTION public.devolver_anticipo_proveedor(p_id uuid, p_monto numeric, p_fecha date, p_cuenta_bancaria_id uuid, p_referencia text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text, p_medio text DEFAULT 'Bancario'::text) RETURNS public.anticipos_proveedor
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_cuenta_org uuid;
  v_hoy_mx date := public.fecha_negocio_mx();
  v_cierre date;
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
  -- F2 (decisión 2026-08-29): sólo devolución TOTAL. Una parcial dejaba el
  -- remanente fuera del sistema (saldo forzado a 0 sin asiento contable).
  IF p_monto < COALESCE(v_row.saldo_disponible,0) - 0.01 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_DEVOLUCION_TOTAL: La devolución debe ser por el saldo completo (%); no se permiten devoluciones parciales.',
      COALESCE(v_row.saldo_disponible,0);
  END IF;
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_REQUERIDA: Indica la fecha de la devolución.';
  END IF;
  IF p_fecha < v_row.fecha_anticipo THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_INVALIDA: La devolución no puede ser anterior a la fecha del anticipo (%).',
      v_row.fecha_anticipo;
  END IF;
  -- MNY P1.2: fecha de negocio México, nunca futura, y periodo contable abierto.
  IF p_fecha > v_hoy_mx THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_FUTURA: la fecha de la devolución (%) no puede ser futura', p_fecha
      USING ERRCODE = '22023';
  END IF;
  IF current_setting('app.bypass_cierre_periodo', true) IS DISTINCT FROM '1' THEN
    v_cierre := public.cierre_periodo_fecha(v_row.organization_id);
    IF v_cierre IS NOT NULL AND p_fecha <= v_cierre THEN
      RAISE EXCEPTION 'LC_PERIODO_CERRADO: el periodo contable está cerrado hasta el %; la fecha % no es válida',
        v_cierre, p_fecha USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF p_medio IS NULL OR p_medio NOT IN ('Efectivo', 'Bancario') THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MEDIO_DEVOLUCION: Selecciona Efectivo o Bancario.' USING ERRCODE = '22023';
  END IF;
  IF p_medio = 'Efectivo' AND p_cuenta_bancaria_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_EFECTIVO_CON_CUENTA: Una devolución en efectivo no lleva cuenta bancaria.' USING ERRCODE = '22023';
  END IF;
  IF p_medio = 'Bancario' THEN
  SELECT cb.organization_id INTO v_cuenta_org
    FROM public.cuentas_bancarias cb
   WHERE cb.id = p_cuenta_bancaria_id AND cb.activa AND cb.deleted_at IS NULL
     AND cb.moneda = v_row.moneda;
  IF v_cuenta_org IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_REQUERIDA: Selecciona la cuenta bancaria donde entró el dinero.';
  END IF;
  IF v_cuenta_org IS DISTINCT FROM v_row.organization_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;
  END IF;
  UPDATE public.anticipos_proveedor
    SET estado = 'devuelto',
        saldo_disponible = 0,
        monto_devuelto = p_monto,
        fecha_devolucion = p_fecha,
        medio_devolucion = p_medio,
        referencia_devolucion = NULLIF(trim(COALESCE(p_referencia,'')),''),
        motivo_devolucion = trim(p_motivo),
        devuelto_at = now(),
        devuelto_by = v_uid,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;
  -- F1: hash_dedupe es NOT NULL; sin él el INSERT lanzaba 23502 y toda la
  -- devolución hacía rollback.
  IF p_medio = 'Bancario' THEN
  INSERT INTO public.bbva_movimientos
    (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
     cargo, abono, estado_conciliacion, anticipo_proveedor_id, importado_por, importado_en,
     hash_dedupe)
  VALUES
    (v_row.organization_id, p_cuenta_bancaria_id, p_fecha,
     'Devolución de anticipo ' || v_row.id::text, NULLIF(trim(COALESCE(p_referencia,'')),''),
     0, p_monto, 'Pendiente'::public.estado_conciliacion, v_row.id, v_uid, now(),
     'devolucion-' || v_row.id::text);
  END IF;
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'devolver_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('motivo', trim(p_motivo), 'monto_devuelto', p_monto,
                               'moneda', v_row.moneda, 'fecha', p_fecha, 'medio', p_medio,
                               'cuenta_bancaria_id', p_cuenta_bancaria_id,
                               'referencia', p_referencia));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en devolver_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text, text) TO authenticated, service_role;
