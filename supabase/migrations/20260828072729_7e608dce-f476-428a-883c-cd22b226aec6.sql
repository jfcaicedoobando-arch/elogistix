-- Ola E2/E3 · Sub-ola D — Multi-moneda y montos (N10, N14)

-- 1) Helper: paridad DOF (MXN por 1 unidad) para una moneda y fecha.
CREATE OR REPLACE FUNCTION public.tc_dof_moneda(p_fecha date, p_moneda text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN UPPER(COALESCE(p_moneda,'MXN')) = 'MXN' THEN 1::numeric
    ELSE (
      SELECT CASE WHEN UPPER(p_moneda) = 'USD' THEN NULLIF(d.usd_mxn, 0)
                  WHEN UPPER(p_moneda) = 'EUR' THEN NULLIF(d.eur_mxn, 0)
                  ELSE NULL END
        FROM public.tipos_cambio_dof d
       WHERE d.fecha <= p_fecha
         AND CASE WHEN UPPER(p_moneda) = 'USD' THEN NULLIF(d.usd_mxn,0)
                  WHEN UPPER(p_moneda) = 'EUR' THEN NULLIF(d.eur_mxn,0)
                  ELSE NULL END IS NOT NULL
       ORDER BY d.fecha DESC
       LIMIT 1
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.tc_dof_moneda(date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tc_dof_moneda(date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.tc_dof_moneda(date, text) TO authenticated, service_role;

-- 2) N10 — retenciones prorrateadas sobre base neta de NC + residuo al pago liquidador.
CREATE OR REPLACE FUNCTION public.calc_pago_retenciones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fac_subtotal numeric; v_fac_iva numeric;
  v_fac_ret_isr numeric; v_fac_ret_iva numeric;
  v_ncs numeric; v_base numeric; v_ratio numeric; v_monto numeric;
  v_prev_isr numeric; v_prev_iva numeric; v_prev_monto numeric;
BEGIN
  IF COALESCE(NEW.ret_isr,0) > 0 OR COALESCE(NEW.ret_iva,0) > 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(subtotal,0), COALESCE(iva,0), COALESCE(ret_isr,0), COALESCE(ret_iva,0)
    INTO v_fac_subtotal, v_fac_iva, v_fac_ret_isr, v_fac_ret_iva
    FROM public.facturas WHERE id = NEW.factura_id;

  IF COALESCE(v_fac_ret_isr,0) = 0 AND COALESCE(v_fac_ret_iva,0) = 0 THEN
    RETURN NEW;
  END IF;

  -- N10: la base debe ser neta de las NC ya aplicadas (misma moneda de la
  -- factura); antes se prorrateaba contra el total bruto y las retenciones
  -- sumaban más de lo retenido realmente.
  v_ncs := COALESCE(public.nc_aplicadas_en_moneda_factura(NEW.factura_id), 0);
  v_base := v_fac_subtotal + v_fac_iva - v_fac_ret_iva - v_fac_ret_isr - v_ncs;

  -- FIX-R4-05: si monto_aplicado_factura aún no llegó (otro trigger BEFORE lo poblará),
  -- usar NEW.monto como base para prorratear las retenciones.
  v_monto := COALESCE(NULLIF(NEW.monto_aplicado_factura,0), NEW.monto);

  IF v_base <= 0 OR COALESCE(v_monto,0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(COALESCE(p.ret_isr,0)),0),
         COALESCE(SUM(COALESCE(p.ret_iva,0)),0),
         COALESCE(SUM(COALESCE(NULLIF(p.monto_aplicado_factura,0), p.monto)),0)
    INTO v_prev_isr, v_prev_iva, v_prev_monto
    FROM public.pagos_factura p
   WHERE p.factura_id = NEW.factura_id
     AND p.deleted_at IS NULL
     AND p.id IS DISTINCT FROM NEW.id;

  IF v_prev_monto + v_monto >= v_base - 0.01 THEN
    -- Pago liquidador: absorbe el residuo de centavos del prorrateo.
    NEW.ret_isr := GREATEST(ROUND(v_fac_ret_isr - v_prev_isr, 2), 0);
    NEW.ret_iva := GREATEST(ROUND(v_fac_ret_iva - v_prev_iva, 2), 0);
  ELSE
    v_ratio := v_monto / v_base;
    NEW.ret_isr := ROUND(v_fac_ret_isr * v_ratio, 2);
    NEW.ret_iva := ROUND(v_fac_ret_iva * v_ratio, 2);
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) N10b — alerta de revisión cuando una NC entra después de pagos con retenciones.
CREATE OR REPLACE FUNCTION public._nc_alerta_retenciones_pagadas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_ret numeric;
BEGIN
  IF NEW.factura_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.estado::text NOT IN ('Aplicada','Timbrada') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado::text = NEW.estado::text THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(COALESCE(p.ret_isr,0) + COALESCE(p.ret_iva,0)), 0)
    INTO v_ret
    FROM public.pagos_factura p
   WHERE p.factura_id = NEW.factura_id AND p.deleted_at IS NULL;

  IF v_ret > 0 THEN
    INSERT INTO public.alertas_sistema (severity, source, message, payload, dedupe_key)
    VALUES ('warning', 'retenciones_nc',
            'Nota de crédito aplicada a una factura con pagos que ya declararon retenciones: revisa el prorrateo.',
            jsonb_build_object('factura_id', NEW.factura_id, 'nota_credito_id', NEW.id,
                               'retenciones_pagadas', v_ret),
            'retenciones_nc:' || NEW.id::text)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._nc_alerta_retenciones_pagadas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._nc_alerta_retenciones_pagadas() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_nc_alerta_retenciones ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_alerta_retenciones
AFTER INSERT OR UPDATE OF estado ON public.factura_notas_credito
FOR EACH ROW EXECUTE FUNCTION public._nc_alerta_retenciones_pagadas();

-- 4) N14 — anticipos de proveedor: conversión con paridad DOF de la fecha de aplicación.
CREATE OR REPLACE FUNCTION public.convertir_monto_dof(
  p_monto numeric, p_moneda_origen text, p_moneda_destino text, p_fecha date)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_o numeric; v_d numeric;
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF UPPER(COALESCE(p_moneda_origen,'MXN')) = UPPER(COALESCE(p_moneda_destino,'MXN')) THEN
    RETURN p_monto;
  END IF;
  v_o := public.tc_dof_moneda(p_fecha, p_moneda_origen);
  v_d := public.tc_dof_moneda(p_fecha, p_moneda_destino);
  IF v_o IS NULL OR v_d IS NULL OR v_o <= 0 OR v_d <= 0 THEN
    RAISE EXCEPTION 'LC_SIN_TC_DOF: no hay tipo de cambio DOF para % o % al %.',
      p_moneda_origen, p_moneda_destino, p_fecha
      USING ERRCODE = '22023';
  END IF;
  RETURN round(p_monto * v_o / v_d, 4);
END;
$function$;
REVOKE ALL ON FUNCTION public.convertir_monto_dof(numeric, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_monto_dof(numeric, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.convertir_monto_dof(numeric, text, text, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.aplicar_anticipo_a_factura(p_anticipo_id uuid, p_factura_id uuid, p_monto numeric, p_fecha_aplicacion date DEFAULT CURRENT_DATE, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS anticipos_aplicaciones
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ant public.anticipos_proveedor;
  v_fact public.proveedor_facturas;
  v_pago public.pagos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_uid uuid := auth.uid();
  v_email text;
  v_monto_convertido numeric(18,4);
  v_monto_historico numeric(18,4);
  v_tc_aplicacion numeric;
  v_autorizado boolean;
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

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

  -- N14: la conversión se valúa con la paridad DOF del día de la aplicación
  -- (soporta EUR y el cruce USD/EUR). El T/C histórico del anticipo sólo sirve
  -- para calcular y registrar el diferencial cambiario.
  IF v_ant.moneda = v_fact.moneda THEN
    v_monto_convertido := p_monto;
    v_monto_historico := p_monto;
  ELSE
    v_monto_convertido := public.convertir_monto_dof(
      p_monto, v_ant.moneda::text, v_fact.moneda::text, p_fecha_aplicacion);
    BEGIN
      v_monto_historico := public.convertir_monto_pago_a_factura(
        p_monto, v_ant.moneda, v_ant.tipo_cambio_usd, v_fact.moneda, v_fact.tipo_cambio_usd);
    EXCEPTION WHEN OTHERS THEN
      v_monto_historico := NULL;
    END;
  END IF;

  v_tc_aplicacion := CASE
    WHEN v_ant.moneda = 'MXN'::public.moneda THEN v_ant.tipo_cambio_usd
    ELSE COALESCE(public.tc_dof_moneda(p_fecha_aplicacion, v_ant.moneda::text), v_ant.tipo_cambio_usd)
  END;

  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
     tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas,
     created_by, es_anticipo_aplicado)
  VALUES
    (v_ant.organization_id, p_factura_id, p_fecha_aplicacion, p_monto, v_ant.moneda,
     v_tc_aplicacion,
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
                               'tc_aplicacion_dof', v_tc_aplicacion,
                               'monto_tc_historico', v_monto_historico,
                               'diferencial_cambiario',
                                 CASE WHEN v_monto_historico IS NULL THEN NULL
                                      ELSE round(v_monto_convertido - v_monto_historico, 4) END,
                               'pago_id', v_pago.id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en aplicar_anticipo_a_factura: % %', SQLSTATE, SQLERRM;
  END;

  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('aplicacion_id', v_ap.id, 'pago_id', v_pago.id));

  RETURN v_ap;
END;
$function$;
REVOKE ALL ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) TO authenticated, service_role;