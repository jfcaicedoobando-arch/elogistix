-- BUG-2026-08-25: `saldo_factura` ahora devuelve 0 en estados terminales
-- (incluida 'Pagada'). El candado anti-sobrepago necesita el saldo BRUTO
-- (total − pagos − NC) para seguir permitiendo la captura de pagos históricos
-- en facturas ya marcadas como Pagada sin dejar pasar sobrepagos.
CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(f.total, 0)
       - COALESCE((SELECT SUM(p.monto_aplicado_factura) FROM public.pagos_factura p
                    WHERE p.factura_id = f.id AND p.deleted_at IS NULL), 0)
       - COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                    WHERE nc.factura_id = f.id AND nc.deleted_at IS NULL
                      AND nc.estado = 'Aplicada'), 0)
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador');
$function$;

REVOKE ALL ON FUNCTION public.saldo_factura_bruto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.saldo_factura_bruto(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura_bruto(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_pago_factura_no_sobrepago()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo numeric;
  v_delta numeric;
  v_factura_org uuid;
  v_caller_org uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
    v_delta := COALESCE(NEW.monto_aplicado_factura,0) - COALESCE(OLD.monto_aplicado_factura,0);
  ELSE
    v_delta := COALESCE(NEW.monto_aplicado_factura,0);
  END IF;

  IF v_delta <= 0 THEN RETURN NEW; END IF;

  -- FIX-R4-04: lock de la factura para serializar pagos concurrentes.
  PERFORM 1 FROM public.facturas
    WHERE id = NEW.factura_id AND deleted_at IS NULL FOR UPDATE;

  SELECT organization_id INTO v_factura_org
  FROM public.facturas
  WHERE id = NEW.factura_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.organization_id IS DISTINCT FROM v_factura_org THEN
    RAISE EXCEPTION 'LC_TENANT_MISMATCH: el pago debe pertenecer a la misma organización que la factura'
      USING ERRCODE='23514';
  END IF;

  v_caller_org := public.current_user_org_id();

  IF v_caller_org IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND v_factura_org IS DISTINCT FROM v_caller_org THEN
    RETURN NEW;
  END IF;

  -- BUG-2026-08-25: saldo BRUTO (no el "por cobrar") para no bloquear la
  -- captura de pagos históricos de facturas ya marcadas como Pagada.
  SELECT COALESCE(public.saldo_factura_bruto(NEW.factura_id), 0) INTO v_saldo;
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