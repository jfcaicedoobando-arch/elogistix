
-- =========================================================================
-- R4-15.1 · crear_proforma_atomica: convertir USD → MXN con TC del embarque
-- =========================================================================
CREATE OR REPLACE FUNCTION public.crear_proforma_atomica(
  p_organization_id uuid, p_embarque_id uuid, p_cliente_id uuid,
  p_cliente_nombre text, p_expediente text, p_bl_master text,
  p_concepto_ids uuid[], p_subtotal_usd numeric, p_iva_usd numeric,
  p_total_usd numeric, p_subtotal_mxn numeric, p_iva_mxn numeric,
  p_total_mxn numeric, p_notas text, p_operador text,
  p_dias_credito integer, p_tasa_iva numeric,
  p_iva_overrides jsonb DEFAULT '{}'::jsonb
)
RETURNS proformas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_numero text;
  v_proforma public.proformas;
  v_override record;
  v_org uuid;
  v_sub_usd numeric := 0;
  v_iva_usd numeric := 0;
  v_sub_mxn numeric := 0;
  v_iva_mxn numeric := 0;
  v_tc numeric;
BEGIN
  IF p_concepto_ids IS NULL OR array_length(p_concepto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un concepto';
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;
  PERFORM public._assert_writer(v_org);

  -- Aplicar overrides IVA
  IF p_iva_overrides IS NOT NULL AND p_iva_overrides <> '{}'::jsonb THEN
    FOR v_override IN
      SELECT key AS concepto_id, (value)::text::boolean AS aplica
      FROM jsonb_each(p_iva_overrides)
    LOOP
      UPDATE public.conceptos_venta
      SET aplica_iva = v_override.aplica
      WHERE id = v_override.concepto_id::uuid
        AND organization_id = v_org;
    END LOOP;
  END IF;

  -- Totales server-side
  SELECT
    COALESCE(SUM(CASE WHEN moneda='USD' THEN cantidad*precio_unitario ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='USD' AND aplica_iva
                      THEN cantidad*precio_unitario*COALESCE(tasa_iva_aplicada, p_tasa_iva)
                      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN' THEN cantidad*precio_unitario ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN' AND aplica_iva
                      THEN cantidad*precio_unitario*COALESCE(tasa_iva_aplicada, p_tasa_iva)
                      ELSE 0 END), 0)
  INTO v_sub_usd, v_iva_usd, v_sub_mxn, v_iva_mxn
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids) AND organization_id = v_org;

  -- FIX R4-15.1: convertir USD→MXN usando TC del embarque
  IF v_sub_usd > 0 THEN
    SELECT tipo_cambio_usd INTO v_tc
    FROM public.embarques
    WHERE id = p_embarque_id AND organization_id = v_org;

    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PROFORMA_TC_REQUERIDO: el embarque no tiene tipo de cambio USD para convertir los conceptos en dólares'
        USING ERRCODE='P0001';
    END IF;

    v_sub_mxn := v_sub_mxn + round(v_sub_usd * v_tc, 2);
    v_iva_mxn := v_iva_mxn + round(v_iva_usd * v_tc, 2);
  END IF;

  IF ABS(COALESCE(p_iva_usd,0) - v_iva_usd) > 0.01
     OR ABS(COALESCE(p_iva_mxn,0) - v_iva_mxn) > 0.01 THEN
    RAISE NOTICE 'crear_proforma_atomica: desfase cliente vs server';
  END IF;

  v_numero := public.generar_numero_proforma(v_org);

  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_sub_usd, v_iva_usd, v_sub_usd + v_iva_usd,
    v_sub_mxn, v_iva_mxn, v_sub_mxn + v_iva_mxn,
    p_notas, p_operador, p_dias_credito, v_org, p_tasa_iva
  )
  RETURNING * INTO v_proforma;

  UPDATE public.conceptos_venta
  SET estado_facturacion = 'en_proforma', proforma_id = v_proforma.id
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org;

  RETURN v_proforma;
END;
$function$;

-- =========================================================================
-- R4-15.2 · Deduplicar triggers en pagos_proveedor
-- Legacy: check_pago_proveedor_factura_aprobada + check_no_sobrepago_proveedor
-- Canónicos: tg_pagos_proveedor_requiere_aprobacion + tg_pago_proveedor_no_sobrepago
-- =========================================================================
DROP TRIGGER IF EXISTS trg_pago_requiere_aprobacion ON public.pagos_proveedor;
DROP TRIGGER IF EXISTS trg_check_no_sobrepago ON public.pagos_proveedor;
DROP FUNCTION IF EXISTS public.check_pago_proveedor_factura_aprobada() CASCADE;
DROP FUNCTION IF EXISTS public.check_no_sobrepago_proveedor() CASCADE;

-- =========================================================================
-- R4-15.3 · Errcodes estables en convertir_proformas_a_factura
-- (parche puntual sin re-crear la función completa)
-- =========================================================================
DO $mig$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc
  WHERE proname='convertir_proformas_a_factura'
  LIMIT 1;

  -- Reemplazos idempotentes
  v_src := replace(v_src,
    $$RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: rol no autorizado para convertir proformas';$$,
    $$RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: rol no autorizado para convertir proformas' USING ERRCODE='P0001';$$
  );
  v_src := replace(v_src,
    $$RAISE EXCEPTION 'LC_PROFORMA_YA_FACTURADA: una o más proformas ya fueron facturadas';$$,
    $$RAISE EXCEPTION 'LC_PROFORMA_YA_FACTURADA: una o más proformas ya fueron facturadas' USING ERRCODE='P0002';$$
  );
  EXECUTE v_src;
END
$mig$;

-- =========================================================================
-- R4-15.4 · Unificar oráculo en soft_delete_pago_*
-- =========================================================================
CREATE OR REPLACE FUNCTION public.soft_delete_pago_factura(p_pago_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_deleted timestamptz;
BEGIN
  SELECT organization_id, deleted_at INTO v_org, v_deleted
    FROM public.pagos_factura WHERE id = p_pago_id;

  -- No revelar existencia de IDs ajenos: mismo error para "no existe" y "otra org"
  IF NOT FOUND
     OR v_deleted IS NOT NULL
     OR (v_org <> public.current_user_org_id()
         AND NOT public.has_role(auth.uid(),'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO' USING ERRCODE='P0002';
  END IF;

  IF NOT public.es_escritor_financiero(auth.uid()) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO' USING ERRCODE='P0001';
  END IF;

  UPDATE public.pagos_factura
    SET deleted_at = now(), updated_at = now()
    WHERE id = p_pago_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_pago_proveedor(p_pago_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_deleted timestamptz;
BEGIN
  SELECT organization_id, deleted_at INTO v_org, v_deleted
    FROM public.pagos_proveedor WHERE id = p_pago_id;

  IF NOT FOUND
     OR v_deleted IS NOT NULL
     OR (v_org <> public.current_user_org_id()
         AND NOT public.has_role(auth.uid(),'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO' USING ERRCODE='P0002';
  END IF;

  IF NOT public.es_escritor_financiero(auth.uid()) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO' USING ERRCODE='P0001';
  END IF;

  UPDATE public.pagos_proveedor
    SET deleted_at = now(), updated_at = now()
    WHERE id = p_pago_id;
END;
$function$;

-- =========================================================================
-- R4-15.5 · Escala de 2 decimales en montos de pagos
-- =========================================================================
ALTER TABLE public.pagos_factura
  DROP CONSTRAINT IF EXISTS pagos_factura_monto_escala;
ALTER TABLE public.pagos_factura
  ADD CONSTRAINT pagos_factura_monto_escala
  CHECK (
    scale(monto) <= 2
    AND scale(COALESCE(ret_iva, 0)) <= 2
    AND scale(COALESCE(ret_isr, 0)) <= 2
  );

ALTER TABLE public.pagos_proveedor
  DROP CONSTRAINT IF EXISTS pagos_proveedor_monto_escala;
ALTER TABLE public.pagos_proveedor
  ADD CONSTRAINT pagos_proveedor_monto_escala
  CHECK (scale(monto) <= 2);
