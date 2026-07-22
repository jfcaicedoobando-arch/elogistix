-- =========================================================================
-- v13.305.8 · Trigger de sobrepago no debe ocultar fallas RLS cross-tenant
-- =========================================================================

CREATE OR REPLACE FUNCTION public.tg_pago_factura_no_sobrepago()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_saldo numeric;
  v_delta numeric;
  v_factura_org uuid;
  v_caller_org uuid;
BEGIN
  -- Solo aplicamos si el pago es "vivo".
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
    v_delta := COALESCE(NEW.monto_aplicado_factura,0) - COALESCE(OLD.monto_aplicado_factura,0);
  ELSE
    v_delta := COALESCE(NEW.monto_aplicado_factura,0);
  END IF;

  IF v_delta <= 0 THEN RETURN NEW; END IF;

  SELECT organization_id INTO v_factura_org
  FROM public.facturas
  WHERE id = NEW.factura_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_caller_org := public.current_user_org_id();

  -- En intentos cross-tenant, dejar que el WITH CHECK de RLS emita el bloqueo
  -- de seguridad esperado. Si validamos saldo aquí, saldo_factura() devuelve 0
  -- por guard multi-tenant y la prueba/UX recibe un error de negocio engañoso.
  IF v_caller_org IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND v_factura_org IS DISTINCT FROM v_caller_org THEN
    RETURN NEW;
  END IF;

  -- saldo_factura devuelve total - pagos_vigentes - NC.
  -- Al momento del BEFORE, OLD ya está descontado en saldo si es UPDATE.
  SELECT public.saldo_factura(NEW.factura_id) INTO v_saldo;
  IF TG_OP = 'UPDATE' THEN
    v_saldo := v_saldo + COALESCE(OLD.monto_aplicado_factura,0);
  END IF;

  IF v_delta > v_saldo + 0.005 THEN
    RAISE EXCEPTION 'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura',
      round(v_delta,2), round(v_saldo,2)
      USING ERRCODE='P0001';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.tg_pago_factura_no_sobrepago() IS
  'BL-13 impide sobrepago, pero permite que RLS emita el error correcto en intentos cross-tenant.';