-- 1) Columna de vínculo con embarque (opcional)
ALTER TABLE public.anticipos_proveedor
  ADD COLUMN IF NOT EXISTS embarque_id uuid NULL REFERENCES public.embarques(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_anticipos_proveedor_embarque
  ON public.anticipos_proveedor (embarque_id)
  WHERE deleted_at IS NULL AND embarque_id IS NOT NULL;

-- 2) registrar_anticipo_proveedor: nuevo parámetro p_embarque_id
CREATE OR REPLACE FUNCTION public.registrar_anticipo_proveedor(
  p_proveedor_id uuid,
  p_monto numeric,
  p_moneda moneda,
  p_fecha_anticipo date DEFAULT CURRENT_DATE,
  p_tipo_cambio_usd numeric DEFAULT NULL::numeric,
  p_metodo_pago text DEFAULT NULL::text,
  p_referencia text DEFAULT NULL::text,
  p_cuenta_bancaria_id uuid DEFAULT NULL::uuid,
  p_notas text DEFAULT NULL::text,
  p_embarque_id uuid DEFAULT NULL::uuid
)
RETURNS anticipos_proveedor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_emb_org uuid;
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

  IF p_embarque_id IS NOT NULL THEN
    SELECT organization_id INTO v_emb_org FROM public.embarques WHERE id = p_embarque_id;
    IF v_emb_org IS NULL OR v_emb_org <> v_org THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EMBARQUE_INVALIDO: El embarque no existe o pertenece a otra organización.';
    END IF;
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
     estado, saldo_disponible, created_by, embarque_id)
  VALUES
    (v_org, p_proveedor_id, p_fecha_anticipo, p_monto, p_moneda, p_tipo_cambio_usd,
     v_metodo, p_referencia, p_cuenta_bancaria_id, p_notas,
     'disponible', p_monto, v_uid, p_embarque_id)
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
                               'cuenta_bancaria_id', p_cuenta_bancaria_id, 'metodo_pago', v_metodo,
                               'embarque_id', p_embarque_id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

-- 3) Vincular / corregir / quitar el embarque de un anticipo existente
CREATE OR REPLACE FUNCTION public.vincular_anticipo_embarque(
  p_id uuid,
  p_embarque_id uuid DEFAULT NULL::uuid
)
RETURNS anticipos_proveedor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_emb_org uuid;
  v_anterior uuid;
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
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden vincular anticipos.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.anticipos_proveedor
  WHERE id = p_id AND deleted_at IS NULL;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;

  IF v_row.organization_id <> public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.';
  END IF;

  IF v_row.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CANCELADO: No se puede vincular un anticipo cancelado.';
  END IF;

  IF p_embarque_id IS NOT NULL THEN
    SELECT organization_id INTO v_emb_org FROM public.embarques WHERE id = p_embarque_id;
    IF v_emb_org IS NULL OR v_emb_org <> v_row.organization_id THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EMBARQUE_INVALIDO: El embarque no existe o pertenece a otra organización.';
    END IF;
  END IF;

  v_anterior := v_row.embarque_id;

  UPDATE public.anticipos_proveedor
     SET embarque_id = p_embarque_id, updated_at = now()
   WHERE id = p_id
  RETURNING * INTO v_row;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''),
            CASE WHEN p_embarque_id IS NULL THEN 'desvincular_anticipo_embarque'
                 ELSE 'vincular_anticipo_embarque' END,
            'cxp', v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('embarque_id_anterior', v_anterior, 'embarque_id', p_embarque_id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en vincular_anticipo_embarque: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.vincular_anticipo_embarque(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_anticipo_embarque(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_anticipo_embarque(uuid, uuid) TO service_role;