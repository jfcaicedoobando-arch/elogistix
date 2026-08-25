-- Fix: el candado anti-sobrepago de notas de crédito no aplica a facturas borradas.
-- `saldo_factura_bruto` devuelve 0 para facturas en papelera; sin esta guarda el
-- trigger abortaba con LC_NC_EXCEDE_SALDO al registrar NCs históricas de una
-- factura ya eliminada (regresión detectada por test_rls_soft_delete_reportes).
CREATE OR REPLACE FUNCTION public.assert_nc_no_excede_saldo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fac record;
  v_saldo_doc numeric;
  v_saldo_mxn numeric;
  v_ncs_previas_mxn numeric;
  v_nc_nueva_mxn numeric;
  v_total_ncs_mxn numeric;
  v_tol_mxn numeric;
BEGIN
  -- Sólo restringe NCs vivas y aplicadas (borradores y canceladas se permiten).
  IF NEW.deleted_at IS NOT NULL OR NEW.estado::text NOT IN ('Aplicada','Emitida') THEN
    RETURN NEW;
  END IF;

  SELECT f.moneda::text AS moneda, f.tipo_cambio, f.fecha_emision
    INTO v_fac
  FROM public.facturas f
  WHERE f.id = NEW.factura_id
    AND f.deleted_at IS NULL;

  -- Factura inexistente o en papelera: fuera del alcance del candado.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_saldo_doc := public.saldo_factura_bruto(NEW.factura_id);
  v_saldo_mxn := public.a_mxn_doc(v_saldo_doc, v_fac.moneda, v_fac.fecha_emision, v_fac.tipo_cambio, NULL);

  v_nc_nueva_mxn := public.a_mxn_doc(
    COALESCE(NEW.monto, 0),
    COALESCE(NEW.moneda::text, v_fac.moneda),
    COALESCE(NEW.fecha_emision, v_fac.fecha_emision),
    NEW.tipo_cambio,
    v_fac.tipo_cambio
  );

  -- Fail-closed: sin tipo de cambio no se puede comparar dinero de forma segura.
  IF v_saldo_mxn IS NULL OR v_nc_nueva_mxn IS NULL THEN
    RAISE EXCEPTION 'LC_NC_SIN_TC: no hay tipo de cambio para validar la nota de crédito contra el saldo de la factura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'moneda_factura', v_fac.moneda,
              'moneda_nota_credito', COALESCE(NEW.moneda::text, v_fac.moneda),
              'fecha_nota_credito', COALESCE(NEW.fecha_emision, v_fac.fecha_emision)
            )::text;
  END IF;

  SELECT COALESCE(SUM(
           public.a_mxn_doc(
             nc.monto,
             COALESCE(nc.moneda::text, v_fac.moneda),
             COALESCE(nc.fecha_emision, v_fac.fecha_emision),
             nc.tipo_cambio,
             v_fac.tipo_cambio
           )
         ), 0)
    INTO v_ncs_previas_mxn
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = NEW.factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado::text IN ('Aplicada','Emitida')
    AND nc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_total_ncs_mxn := v_ncs_previas_mxn + v_nc_nueva_mxn;

  -- Tolerancia de un centavo expresada en la moneda de la factura.
  v_tol_mxn := GREATEST(
    0.01,
    COALESCE(public.a_mxn_doc(0.01, v_fac.moneda, v_fac.fecha_emision, v_fac.tipo_cambio, NULL), 0.01)
  );

  IF v_total_ncs_mxn > v_saldo_mxn + v_tol_mxn THEN
    RAISE EXCEPTION 'LC_NC_EXCEDE_SALDO: la nota de crédito excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'moneda_factura', v_fac.moneda,
              'saldo_disponible_mxn', round(v_saldo_mxn - v_ncs_previas_mxn, 2),
              'monto_intentado_mxn', round(v_nc_nueva_mxn, 2),
              'monto_intentado', NEW.monto,
              'moneda_nota_credito', COALESCE(NEW.moneda::text, v_fac.moneda)
            )::text;
  END IF;

  RETURN NEW;
END;
$function$;