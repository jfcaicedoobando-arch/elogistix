-- ============================================================
-- BL-08 · aplicar_anticipo_a_factura sin llave de idempotencia → doble
-- aplicación.
--
-- Causa raíz (firma vigente en
-- 20260817090000_ola4_n31_anticipos_lock_saldo_check.sql:26-31): sin
-- request_id ni idempotency_claim. El FOR UPDATE del anticipo serializa y
-- el CHECK de saldo evita sobre-aplicar, pero un doble submit legítimo
-- (dos clicks con monto parcial, retry del navegador/React Query) crea dos
-- pagos_proveedor y dos anticipos_aplicaciones idénticos — no había forma
-- de distinguir reintento de intención.
--
-- Fix: p_request_id uuid DEFAULT NULL + idempotency_claim/store (patrón
-- avanzar_estado_embarque, supabase/schema/embarques/avanzar_estado_embarque.sql:21-22).
-- La respuesta almacena aplicacion_id/pago_id y el replay devuelve la fila
-- original de anticipos_aplicaciones. La llave la genera el hook
-- useAplicarAnticipo (src/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations.ts)
-- por intento de submit.
--
-- ACUMULATIVA: incluye el guard BL-03 de 20260825000200 (rechazo de
-- factura Cancelada) íntegro.
--
-- CAMBIO DE FIRMA: se dropea la firma anterior (uuid,uuid,numeric,date) —
-- precedente 20260808011825. Mismos grants.
-- ============================================================

DROP FUNCTION IF EXISTS public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date);

CREATE OR REPLACE FUNCTION public.aplicar_anticipo_a_factura(
  p_anticipo_id uuid,
  p_factura_id uuid,
  p_monto numeric,
  p_fecha_aplicacion date DEFAULT CURRENT_DATE,
  p_request_id uuid DEFAULT NULL
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
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- BL-08: reclamo atómico de la llave de idempotencia (patrón
  -- avanzar_estado_embarque). Reintento del mismo submit → la aplicación
  -- original; ejecución aún en vuelo → rechazo claro. Sin llave (NULL) el
  -- comportamiento es idéntico al anterior.
  v_cached := public.idempotency_claim(p_request_id, 'aplicar_anticipo_a_factura');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EN_PROCESO: Esta aplicación de anticipo ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_ap FROM public.anticipos_aplicaciones
     WHERE id = (v_cached->>'aplicacion_id')::uuid;
    IF v_ap.id IS NOT NULL THEN
      RETURN v_ap;
    END IF;
    -- Si la fila ya no existe (cleanup), continuar el flujo normal.
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

  -- Ola 4 · N31: FOR UPDATE serializa aplicaciones concurrentes del mismo
  -- anticipo; la segunda transacción re-lee el saldo ya post-commit de la
  -- primera y cae en LC_ANTICIPO_SIN_SALDO en vez de dejar saldo negativo.
  SELECT * INTO v_ant FROM public.anticipos_proveedor WHERE id = p_anticipo_id FOR UPDATE;
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
  -- BL-03: la aprobación no basta — una factura Cancelada conservaba
  -- estado_aprobacion='aprobada' (cancelar_factura_proveedor no lo
  -- reseteaba antes de este parche) y admitía anticipos sobre saldo muerto.
  IF v_fact.estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_NO_VIVA: La factura está Cancelada y no admite anticipos.'
      USING ERRCODE = '23514';
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

  -- BL-08: almacena la referencia de la aplicación para los reintentos
  -- con la misma llave (no-op cuando p_request_id viene NULL).
  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('aplicacion_id', v_ap.id, 'pago_id', v_pago.id));

  RETURN v_ap;
END;
$$;


REVOKE ALL ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) TO authenticated, service_role;