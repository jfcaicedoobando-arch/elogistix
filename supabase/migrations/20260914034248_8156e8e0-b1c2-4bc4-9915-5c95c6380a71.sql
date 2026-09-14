-- R1/B15: restaurar semántica de factura viva (no cancelada/sustituida/papelera)
CREATE OR REPLACE FUNCTION public.eliminar_proforma_rpc(p_proforma_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_numero text;
  v_estado text;
  v_factura uuid;
  v_factura2 uuid;
  v_folio_ext text;
  v_deleted timestamptz;
  v_embarque uuid;
  v_factura_viva boolean;
BEGIN
  SELECT organization_id, numero, estado_proforma, factura_id, factura_secundaria_id,
         folio_factura_externa, deleted_at, embarque_id
    INTO v_org, v_numero, v_estado, v_factura, v_factura2, v_folio_ext, v_deleted, v_embarque
  FROM public.proformas WHERE id = p_proforma_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;
  -- Espejo de la policy RLS `Tenant delete proformas`.
  IF auth.uid() IS NOT NULL AND NOT public.has_any_role_efectivo(
       auth.uid(),
       ARRAY['admin'::public.app_role, 'admin_org'::public.app_role,
             'operador'::public.app_role, 'contador'::public.app_role,
             'super_admin'::public.app_role]
     ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: tu rol no puede eliminar proformas'
      USING ERRCODE = '42501';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque, 'eliminada', false);
  END IF;

  -- RG10 + R1: el folio externo suelto NO bloquea; una factura cancelada,
  -- sustituida o en papelera tampoco. Sólo factura viva o estado 'facturada'.
  SELECT EXISTS (
    SELECT 1 FROM public.facturas fa
     WHERE fa.id IN (v_factura, v_factura2)
       AND fa.deleted_at IS NULL
       AND fa.estado::text NOT IN ('Cancelada', 'Sustituida')
  ) INTO v_factura_viva;

  IF v_factura_viva OR lower(COALESCE(v_estado, '')) = 'facturada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_FACTURADA';
  END IF;

  UPDATE public.conceptos_venta
     SET estado_facturacion = 'pendiente', proforma_id = NULL
   WHERE proforma_id = p_proforma_id;

  UPDATE public.proformas
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE id = p_proforma_id;

  RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque, 'eliminada', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO service_role;

-- R2/B14: detectar el vínculo por existencia (id), no por folio.
CREATE OR REPLACE FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid;
  v_folio text;
BEGIN
  IF NEW.monto IS NOT DISTINCT FROM OLD.monto
     AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
     AND NEW.proveedor_id IS NOT DISTINCT FROM OLD.proveedor_id THEN
    RETURN NEW;
  END IF;

  SELECT pf.id, COALESCE(pf.folio_interno, pf.folio_proveedor)
    INTO v_factura_id, v_folio
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
   WHERE pfc.concepto_costo_id = NEW.id
     AND pf.deleted_at IS NULL
     AND pf.estado::text <> 'Cancelada'
   LIMIT 1;

  IF v_factura_id IS NOT NULL THEN
    RAISE EXCEPTION
      'LC_COSTO_VINCULADO_CXP: el costo está vinculado a la factura de proveedor %; desvincula o corrige esa factura antes de cambiar monto, moneda o proveedor',
      COALESCE(NULLIF(btrim(v_folio), ''), '(sin folio)')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- R3/B11: acotar la lista de folios a los primeros 10 + "y N más".
CREATE OR REPLACE FUNCTION public.get_exposicion_credito_cliente(p_cliente_id uuid)
 RETURNS TABLE(cliente_id uuid, organization_id uuid, dias_credito integer, limite_mxn numeric, en_uso_mxn numeric, disponible_mxn numeric, excedido boolean, facturas_vivas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_dias integer;
  v_limite numeric;
  v_en_uso numeric := 0;
  v_facturas integer := 0;
  v_malas text[] := ARRAY[]::text[];
  v_saldo numeric;
  v_total_malas integer;
  v_lista text;
  f record;
BEGIN
  SELECT c.organization_id, c.dias_credito, c.limite_credito_mxn
    INTO v_org, v_dias, v_limite
  FROM public.clientes c
  WHERE c.id = p_cliente_id
    AND c.deleted_at IS NULL
    AND (
      c.organization_id = public.current_user_org_id()
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    );

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado o sin acceso'
      USING ERRCODE = '42501';
  END IF;

  FOR f IN
    SELECT fa.id, fa.numero, COALESCE(fa.total, 0) AS total,
           fa.moneda::text AS moneda, fa.tipo_cambio AS tc
      FROM public.facturas fa
     WHERE fa.cliente_id = p_cliente_id
       AND fa.deleted_at IS NULL
       AND fa.estado IN ('Emitida','Vencida','Parcialmente pagada','Pagada')
  LOOP
    v_facturas := v_facturas + 1;

    SELECT GREATEST(
             0,
             f.total
               - COALESCE((SELECT SUM(p.monto_aplicado_factura)
                             FROM public.pagos_factura p
                            WHERE p.factura_id = f.id AND p.deleted_at IS NULL), 0)
               - public.nc_aplicadas_en_moneda_factura(f.id)
           )
      INTO v_saldo;

    IF f.moneda = 'MXN' THEN
      v_en_uso := v_en_uso + v_saldo;
    ELSIF v_saldo > 0 THEN
      IF f.tc IS NULL OR f.tc < 5 OR f.tc > 40 THEN
        v_malas := array_append(v_malas, COALESCE(NULLIF(btrim(f.numero), ''), f.id::text));
      ELSE
        v_en_uso := v_en_uso + (v_saldo * f.tc);
      END IF;
    END IF;
  END LOOP;

  v_total_malas := COALESCE(array_length(v_malas, 1), 0);
  IF v_total_malas > 0 THEN
    v_lista := array_to_string(v_malas[1:10], ', ');
    IF v_total_malas > 10 THEN
      v_lista := v_lista || format(' y %s más', v_total_malas - 10);
    END IF;
    RAISE EXCEPTION 'LC_CREDITO_TC_INVALIDO: corrige el tipo de cambio de la(s) factura(s) en moneda extranjera %; sin él no se puede calcular la exposición de crédito.',
      v_lista
      USING ERRCODE = '22023';
  END IF;

  cliente_id      := p_cliente_id;
  organization_id := v_org;
  dias_credito    := v_dias;
  limite_mxn      := v_limite;
  en_uso_mxn      := ROUND(v_en_uso, 2);
  disponible_mxn  := CASE WHEN v_limite IS NULL THEN NULL ELSE ROUND(v_limite - v_en_uso, 2) END;
  excedido        := CASE WHEN v_limite IS NULL THEN false ELSE v_en_uso > v_limite END;
  facturas_vivas  := v_facturas;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_exposicion_credito_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exposicion_credito_cliente(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_exposicion_credito_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exposicion_credito_cliente(uuid) TO service_role;