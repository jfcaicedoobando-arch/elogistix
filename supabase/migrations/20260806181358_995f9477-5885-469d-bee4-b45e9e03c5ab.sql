-- 1) Enlace movimiento bancario ↔ anticipo a proveedor
ALTER TABLE public.bbva_movimientos
  ADD COLUMN IF NOT EXISTS anticipo_proveedor_id uuid
    REFERENCES public.anticipos_proveedor(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bbva_movimientos_anticipo
  ON public.bbva_movimientos (anticipo_proveedor_id)
  WHERE anticipo_proveedor_id IS NOT NULL;

-- 2) Trigger de consistencia: acepta movimientos de anticipo y prohíbe doble vínculo
CREATE OR REPLACE FUNCTION public.assert_movimiento_pago_consistente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pago_org uuid;
  v_pago_moneda text;
  v_cuenta_moneda text;
  v_vinculos int;
BEGIN
  -- Sólo puede estar vinculado a UN origen a la vez.
  v_vinculos :=
      (CASE WHEN NEW.pago_factura_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.anticipo_proveedor_id IS NOT NULL THEN 1 ELSE 0 END);

  IF v_vinculos > 1 THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_DOBLE_VINCULO: un movimiento no puede vincularse a más de un origen (pago de factura, pago de proveedor o anticipo)'
      USING ERRCODE = 'P0001';
  END IF;

  -- Moneda de la cuenta bancaria del movimiento (para validar contra el pago).
  IF NEW.cuenta_bancaria_id IS NOT NULL THEN
    SELECT moneda::text INTO v_cuenta_moneda
    FROM public.cuentas_bancarias
    WHERE id = NEW.cuenta_bancaria_id AND deleted_at IS NULL;
  END IF;

  IF NEW.pago_factura_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_factura
    WHERE id = NEW.pago_factura_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de factura % no existe o está eliminado', NEW.pago_factura_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de factura pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_proveedor
    WHERE id = NEW.pago_proveedor_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor % no existe o está eliminado', NEW.pago_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de proveedor pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.anticipo_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.anticipos_proveedor
    WHERE id = NEW.anticipo_proveedor_id;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ANTICIPO_INEXISTENTE: el anticipo % no existe', NEW.anticipo_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el anticipo pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del anticipo (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Registrar anticipo: exige cuenta (salvo Efectivo) y genera el cargo bancario conciliado
CREATE OR REPLACE FUNCTION public.registrar_anticipo_proveedor(
  p_proveedor_id uuid,
  p_monto numeric,
  p_moneda moneda,
  p_fecha_anticipo date DEFAULT CURRENT_DATE,
  p_tipo_cambio_usd numeric DEFAULT NULL::numeric,
  p_metodo_pago text DEFAULT NULL::text,
  p_referencia text DEFAULT NULL::text,
  p_cuenta_bancaria_id uuid DEFAULT NULL::uuid,
  p_notas text DEFAULT NULL::text
)
RETURNS public.anticipos_proveedor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_org uuid;
  v_email text;
  v_autorizado boolean;
  v_metodo text := COALESCE(NULLIF(TRIM(p_metodo_pago), ''), 'Transferencia');
  v_cuenta public.cuentas_bancarias;
  v_proveedor_nombre text;
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
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden registrar anticipos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto debe ser mayor a cero.';
  END IF;

  SELECT organization_id, nombre INTO v_org, v_proveedor_nombre
  FROM public.proveedores WHERE id = p_proveedor_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_NO_EXISTE: El proveedor no existe.';
  END IF;

  IF v_org <> public.current_user_org_id() AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_OTRA_ORG: El proveedor pertenece a otra organización.';
  END IF;

  -- Sin cuenta bancaria el anticipo no genera movimiento conciliable.
  IF p_cuenta_bancaria_id IS NULL AND v_metodo <> 'Efectivo' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_REQUERIDA: Selecciona la cuenta bancaria de donde sale el anticipo (sólo Efectivo puede omitirla).';
  END IF;

  IF p_cuenta_bancaria_id IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM public.cuentas_bancarias
    WHERE id = p_cuenta_bancaria_id AND deleted_at IS NULL;

    IF v_cuenta.id IS NULL THEN
      RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_INVALIDA: La cuenta bancaria no existe o está dada de baja.';
    END IF;
    IF v_cuenta.organization_id <> v_org THEN
      RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.';
    END IF;
    IF v_cuenta.moneda <> p_moneda THEN
      RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_DIVISA: La cuenta está en % y el anticipo en %.', v_cuenta.moneda, p_moneda;
    END IF;
  END IF;

  INSERT INTO public.anticipos_proveedor
    (organization_id, proveedor_id, fecha_anticipo, monto, moneda, tipo_cambio_usd,
     metodo_pago, referencia, cuenta_bancaria_id, notas,
     estado, saldo_disponible, created_by)
  VALUES
    (v_org, p_proveedor_id, p_fecha_anticipo, p_monto, p_moneda, p_tipo_cambio_usd,
     v_metodo, p_referencia, p_cuenta_bancaria_id, p_notas,
     'disponible', p_monto, v_uid)
  RETURNING * INTO v_row;

  -- Cargo bancario conciliado (el saldo de la cuenta baja de inmediato).
  IF p_cuenta_bancaria_id IS NOT NULL THEN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
       cargo, abono, hash_dedupe, estado_conciliacion,
       anticipo_proveedor_id, conciliado_por, conciliado_at, importado_por)
    VALUES
      (v_org, p_cuenta_bancaria_id, p_fecha_anticipo,
       'Anticipo — ' || COALESCE(v_proveedor_nombre, 'proveedor'),
       COALESCE(p_referencia, ''),
       p_monto, 0, 'anticipo-' || v_row.id::text, 'Conciliado',
       v_row.id, v_uid, now(), v_uid);
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_org, v_uid, COALESCE(v_email,''), 'registrar_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('proveedor_id', p_proveedor_id, 'monto', p_monto, 'moneda', p_moneda,
                               'cuenta_bancaria_id', p_cuenta_bancaria_id, 'metodo_pago', v_metodo));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

-- 4) Cancelar anticipo: da de baja su movimiento bancario
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

  -- El dinero regresa: se da de baja el cargo bancario del anticipo.
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