-- Ola 2 · O2.5 — idempotencia en el ALTA de anticipo a proveedor.
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
  p_embarque_id uuid DEFAULT NULL::uuid,
  p_request_id uuid DEFAULT NULL::uuid)
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
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- O2.5: reclamo atómico de la llave (patrón bl05/bl08). Doble submit del
  -- diálogo ya no crea dos anticipos ni dos cargos bancarios conciliados.
  v_cached := public.idempotency_claim(p_request_id, 'registrar_anticipo_proveedor');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EN_PROCESO: Este anticipo ya se está registrando; espera unos segundos y verifica el listado antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_row FROM public.anticipos_proveedor
    WHERE id = (v_cached->>'anticipo_id')::uuid;
    IF v_row.id IS NOT NULL THEN
      RETURN v_row;
    END IF;
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

  IF v_org IS DISTINCT FROM public.current_user_org_id() AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
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

  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('anticipo_id', v_row.id, 'monto', p_monto));

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid, uuid) TO service_role;

-- La firma anterior (sin p_request_id) queda fuera para evitar ambigüedad.
DROP FUNCTION IF EXISTS public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid);

-- Ola 2 · O2.6 — ciclo de vida de liquidaciones de comisión.
ALTER TABLE public.liquidaciones_comision
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'Generada',
  ADD COLUMN IF NOT EXISTS cancelada_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text;

DO $liq$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'liquidaciones_comision_estado_chk'
  ) THEN
    ALTER TABLE public.liquidaciones_comision
      ADD CONSTRAINT liquidaciones_comision_estado_chk
      CHECK (estado IN ('Generada','Pagada','Cancelada'));
  END IF;
END
$liq$;

UPDATE public.liquidaciones_comision
   SET estado = 'Pagada'
 WHERE fecha_pago IS NOT NULL AND estado = 'Generada';

-- Registro de pago con candado: sólo una vez y sólo si no está cancelada.
CREATE OR REPLACE FUNCTION public.registrar_pago_liquidacion(
  p_liquidacion_id uuid,
  p_fecha_pago date,
  p_metodo_pago text,
  p_referencia text DEFAULT NULL::text,
  p_notas text DEFAULT NULL::text)
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

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden pagar liquidaciones.'
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
GRANT EXECUTE ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) TO service_role;

-- Cancelación de liquidación: devuelve las comisiones a Devengada.
CREATE OR REPLACE FUNCTION public.cancelar_liquidacion_comision(
  p_liquidacion_id uuid,
  p_motivo text)
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

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden cancelar liquidaciones.'
      USING ERRCODE = '42501';
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

  IF v_row.estado = 'Cancelada' THEN
    RETURN v_row;
  END IF;

  IF v_row.fecha_pago IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_PAGADA_NO_CANCELABLE: La liquidación ya fue pagada; registra el ajuste en la siguiente liquidación.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.comisiones_devengadas
     SET estado = 'Devengada', liquidacion_id = NULL, updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id;

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
GRANT EXECUTE ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) TO service_role;