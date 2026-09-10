-- Fuente canónica del SALDO DE FACTURA (Ola v17 — fuente única de verdad).
--
-- Un solo cálculo: public._saldo_factura_calc
--   saldo = total − Σ pagos vigentes − Σ NC aplicadas (en moneda de la factura)
-- Terminal (saldo 0) SÓLO 'Cancelada' y 'Sustituida'. 'Pagada' ya NO es
-- terminal: ese atajo legacy creaba la circularidad saldo → estado → saldo que
-- impedía sacar de 'Pagada' una factura cuyo único pago quedó ANULADO por
-- cancelación del REP (bug F1015).
--
-- Envolturas (sólo ACL, sin fórmula propia):
--   public.saldo_factura       — ACL por organización + portal del cliente.
--   public.saldo_factura_bruto — ACL por organización (usada por el trigger
--                                recalcular_estado_factura).
--
-- Helpers PUROS (IMMUTABLE, sin acceso a tablas → seguros para authenticated):
--   public.nc_convertida_a_moneda_factura — única cascada de conversión de NC.
--   public.pago_rep_anulado               — única definición de pago anulado.

CREATE OR REPLACE FUNCTION public.nc_convertida_a_moneda_factura(
  p_monto numeric,
  p_moneda_nc text,
  p_tc_nc numeric,
  p_moneda_factura text,
  p_tc_factura numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_monto IS NULL OR p_moneda_factura IS NULL THEN 0
    WHEN p_moneda_nc = p_moneda_factura THEN p_monto
    WHEN p_moneda_factura = 'MXN' AND p_moneda_nc <> 'MXN' AND COALESCE(p_tc_nc, 0) > 1
      THEN p_monto * p_tc_nc
    WHEN p_moneda_factura <> 'MXN' AND p_moneda_nc = 'MXN' AND COALESCE(p_tc_factura, 0) > 1
      THEN p_monto / p_tc_factura
    WHEN p_moneda_factura <> 'MXN' AND p_moneda_nc <> 'MXN'
         AND p_moneda_factura <> p_moneda_nc
         AND COALESCE(p_tc_nc, 0) > 1 AND COALESCE(p_tc_factura, 0) > 1
      THEN (p_monto * p_tc_nc) / p_tc_factura
    ELSE 0
  END
$function$;

REVOKE ALL ON FUNCTION public.nc_convertida_a_moneda_factura(numeric, text, numeric, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nc_convertida_a_moneda_factura(numeric, text, numeric, text, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pago_rep_anulado(p_estado_rep text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT lower(btrim(COALESCE(p_estado_rep, ''))) = 'cancelado'
$function$;

REVOKE ALL ON FUNCTION public.pago_rep_anulado(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pago_rep_anulado(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._saldo_factura_calc(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_moneda text; v_tc numeric; v_estado estado_factura;
  v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT f.total, f.moneda::text, f.tipo_cambio, f.estado
    INTO v_total, v_moneda, v_tc, v_estado
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_estado IN ('Cancelada', 'Sustituida') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(p.monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura p
  WHERE p.factura_id = p_factura_id AND p.deleted_at IS NULL
    AND NOT public.pago_rep_anulado(p.estado_rep);

  SELECT COALESCE(SUM(public.nc_convertida_a_moneda_factura(
           nc.monto, nc.moneda::text, nc.tipo_cambio, v_moneda, v_tc)), 0)
    INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - COALESCE(v_pagos, 0) - COALESCE(v_ncs, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public._saldo_factura_calc(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._saldo_factura_calc(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_cliente uuid; v_uid uuid; v_caller_org uuid;
BEGIN
  SELECT f.organization_id, f.cliente_id INTO v_org, v_cliente
  FROM public.facturas f WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      -- Portal: el usuario cliente sí puede consultar el saldo de SU factura.
      IF v_cliente IS NULL
         OR v_cliente NOT IN (SELECT public.current_user_client_ids()) THEN
        RETURN 0;
      END IF;
    END IF;
  END IF;

  RETURN public._saldo_factura_calc(p_factura_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.saldo_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_uid uuid; v_caller_org uuid;
BEGIN
  SELECT f.organization_id INTO v_org
  FROM public.facturas f WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();
  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN 0;
    END IF;
  END IF;

  RETURN public._saldo_factura_calc(p_factura_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.saldo_factura_bruto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura_bruto(uuid) TO authenticated, service_role;

-- Guard: impide registrar NC en moneda no convertible.
CREATE OR REPLACE FUNCTION public.guard_nc_cliente_moneda_convertible()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_moneda text; v_tc numeric;
BEGIN
  IF NEW.estado <> 'Aplicada'::public.estado_nota_credito THEN RETURN NEW; END IF;

  SELECT f.moneda::text, f.tipo_cambio INTO v_moneda, v_tc
  FROM public.facturas f WHERE f.id = NEW.factura_id;
  IF v_moneda IS NULL OR NEW.moneda::text = v_moneda THEN RETURN NEW; END IF;

  IF NEW.moneda::text <> 'MXN' AND COALESCE(NEW.tipo_cambio, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_NC_MONEDA_SIN_TC: captura el tipo de cambio de la nota de crédito en % antes de aplicarla', NEW.moneda
      USING ERRCODE = '22023';
  END IF;
  IF v_moneda <> 'MXN' AND COALESCE(v_tc, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_NC_MONEDA_SIN_TC: la factura en % no tiene tipo de cambio para convertir la nota de crédito', v_moneda
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_nc_cliente_moneda_convertible() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_nc_cliente_moneda_convertible() TO authenticated, service_role;
