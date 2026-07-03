
-- ============================================================
-- Fix IVA en Borradores de factura
-- 1. Rewrite convertir_proformas_a_factura para poblar tipo_iva y tasa_iva_aplicada,
--    y recalcular header desde renglones (MXN y USD).
-- 2. Backfill de Borradores existentes con tasa_iva_aplicada NULL.
-- ============================================================

CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(
  p_proforma_ids uuid[],
  p_serie_id uuid,
  p_metodo_pago text,
  p_forma_pago text,
  p_uso_cfdi text,
  p_dias_credito integer DEFAULT NULL,
  p_notas text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS SETOF public.facturas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached         jsonb;
  v_count          int;
  v_first          public.proformas;
  v_org            uuid;
  v_caller_org     uuid;
  v_cliente        public.clientes;
  v_serie          public.factura_series;
  v_subtotal_usd   numeric := 0;
  v_iva_usd        numeric := 0;
  v_total_usd      numeric := 0;
  v_subtotal_mxn   numeric := 0;
  v_iva_mxn        numeric := 0;
  v_total_mxn      numeric := 0;
  v_distinct_cli   int;
  v_distinct_org   int;
  v_factura_ids    uuid[] := ARRAY[]::uuid[];
  v_factura_mxn_id uuid;
  v_factura_usd_id uuid;
  v_numero_tmp     text;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'convertir_proformas_a_factura');
  IF v_cached IS NOT NULL AND (v_cached ? 'factura_ids') THEN
    RETURN QUERY
      SELECT * FROM public.facturas
      WHERE id = ANY(ARRAY(SELECT jsonb_array_elements_text(v_cached->'factura_ids'))::uuid[])
        AND deleted_at IS NULL;
    RETURN;
  END IF;

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes proporcionar al menos una proforma';
  END IF;
  IF p_metodo_pago NOT IN ('PUE', 'PPD') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_metodo_pago;
  END IF;
  IF coalesce(p_forma_pago, '') = '' OR coalesce(p_uso_cfdi, '') = '' THEN
    RAISE EXCEPTION 'forma_pago y uso_cfdi son obligatorios';
  END IF;

  v_caller_org := public.current_user_org_id();
  IF NOT (public.has_role(auth.uid(), 'admin_org'::app_role)
          OR public.has_role(auth.uid(), 'contador'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No tienes permiso para convertir proformas a factura';
  END IF;

  SELECT count(*), count(DISTINCT organization_id), count(DISTINCT cliente_id)
    INTO v_count, v_distinct_org, v_distinct_cli
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;

  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o están eliminadas';
  END IF;
  IF v_distinct_org <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a una sola organización';
  END IF;
  IF v_distinct_cli <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a un solo cliente';
  END IF;

  SELECT * INTO v_first
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids)
  ORDER BY created_at ASC
  LIMIT 1;

  v_org := v_first.organization_id;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) AND v_org <> v_caller_org THEN
    RAISE EXCEPTION 'No puedes convertir proformas de otra organización';
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_first.cliente_id;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;

  SELECT * INTO v_serie FROM public.factura_series WHERE id = p_serie_id AND organization_id = v_org;
  IF v_serie IS NULL THEN RAISE EXCEPTION 'Serie no encontrada'; END IF;

  -- Subtotales por moneda (sólo para decidir si crear factura MXN / USD; los totales reales
  -- se recomputan después desde conceptos_factura ya insertados).
  IF v_first.es_consolidada THEN
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN total ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN total ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.proforma_conceptos_consolidados
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  ELSE
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.conceptos_venta
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  END IF;

  IF v_subtotal_mxn > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      0, 0, 0, 'MXN'::public.moneda, 1,
      CURRENT_DATE,
      CURRENT_DATE + make_interval(days => COALESCE(p_dias_credito, v_first.dias_credito, 0)),
      'Borrador'::estado_factura,
      v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, COALESCE(p_dias_credito, v_first.dias_credito, 0),
      p_notas, 'conversion_proforma'
    )
    RETURNING id INTO v_factura_mxn_id;

    IF v_first.es_consolidada THEN
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada
      )
      SELECT v_factura_mxn_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
             pcc.moneda, pcc.total, v_org,
             COALESCE(public.resolver_clave_sat(v_org, pcc.descripcion), '78101800'),
             CASE
               WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN 'exento'
               WHEN COALESCE(pcc.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
               ELSE 'gravado_16'
             END,
             CASE
               WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN NULL
               ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16)
             END
      FROM public.proforma_conceptos_consolidados pcc
      WHERE pcc.proforma_id = ANY(p_proforma_ids)
        AND pcc.moneda = 'MXN'::public.moneda
        AND pcc.deleted_at IS NULL;
    ELSE
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada
      )
      SELECT v_factura_mxn_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
             cv.moneda, cv.cantidad * cv.precio_unitario, v_org,
             COALESCE(public.resolver_clave_sat(v_org, cv.descripcion), '78101800'),
             CASE
               WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN 'exento'
               WHEN COALESCE(cv.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
               ELSE 'gravado_16'
             END,
             CASE
               WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN NULL
               ELSE COALESCE(cv.tasa_iva_aplicada, 0.16)
             END
      FROM public.conceptos_venta cv
      WHERE cv.proforma_id = ANY(p_proforma_ids)
        AND cv.moneda = 'MXN'::public.moneda
        AND cv.deleted_at IS NULL;
    END IF;

    -- Recomputar totales desde renglones reales
    SELECT
      COALESCE(SUM(cantidad * precio_unitario), 0),
      COALESCE(SUM(cantidad * precio_unitario * COALESCE(tasa_iva_aplicada, 0)), 0)
    INTO v_subtotal_mxn, v_iva_mxn
    FROM public.conceptos_factura
    WHERE factura_id = v_factura_mxn_id AND deleted_at IS NULL;
    v_subtotal_mxn := round(v_subtotal_mxn, 2);
    v_iva_mxn := round(v_iva_mxn, 2);
    v_total_mxn := v_subtotal_mxn + v_iva_mxn;

    UPDATE public.facturas
    SET subtotal = v_subtotal_mxn, iva = v_iva_mxn, total = v_total_mxn
    WHERE id = v_factura_mxn_id;

    v_factura_ids := array_append(v_factura_ids, v_factura_mxn_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    )
    VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_mxn_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'MXN',
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  IF v_subtotal_usd > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      0, 0, 0, 'USD'::public.moneda, 1,
      CURRENT_DATE,
      CURRENT_DATE + make_interval(days => COALESCE(p_dias_credito, v_first.dias_credito, 0)),
      'Borrador'::estado_factura,
      v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, COALESCE(p_dias_credito, v_first.dias_credito, 0),
      p_notas, 'conversion_proforma'
    )
    RETURNING id INTO v_factura_usd_id;

    IF v_first.es_consolidada THEN
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada
      )
      SELECT v_factura_usd_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
             pcc.moneda, pcc.total, v_org,
             COALESCE(public.resolver_clave_sat(v_org, pcc.descripcion), '78101800'),
             CASE
               WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN 'exento'
               WHEN COALESCE(pcc.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
               ELSE 'gravado_16'
             END,
             CASE
               WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN NULL
               ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16)
             END
      FROM public.proforma_conceptos_consolidados pcc
      WHERE pcc.proforma_id = ANY(p_proforma_ids)
        AND pcc.moneda = 'USD'::public.moneda
        AND pcc.deleted_at IS NULL;
    ELSE
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada
      )
      SELECT v_factura_usd_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
             cv.moneda, cv.cantidad * cv.precio_unitario, v_org,
             COALESCE(public.resolver_clave_sat(v_org, cv.descripcion), '78101800'),
             CASE
               WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN 'exento'
               WHEN COALESCE(cv.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
               ELSE 'gravado_16'
             END,
             CASE
               WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN NULL
               ELSE COALESCE(cv.tasa_iva_aplicada, 0.16)
             END
      FROM public.conceptos_venta cv
      WHERE cv.proforma_id = ANY(p_proforma_ids)
        AND cv.moneda = 'USD'::public.moneda
        AND cv.deleted_at IS NULL;
    END IF;

    SELECT
      COALESCE(SUM(cantidad * precio_unitario), 0),
      COALESCE(SUM(cantidad * precio_unitario * COALESCE(tasa_iva_aplicada, 0)), 0)
    INTO v_subtotal_usd, v_iva_usd
    FROM public.conceptos_factura
    WHERE factura_id = v_factura_usd_id AND deleted_at IS NULL;
    v_subtotal_usd := round(v_subtotal_usd, 2);
    v_iva_usd := round(v_iva_usd, 2);
    v_total_usd := v_subtotal_usd + v_iva_usd;

    UPDATE public.facturas
    SET subtotal = v_subtotal_usd, iva = v_iva_usd, total = v_total_usd
    WHERE id = v_factura_usd_id;

    v_factura_ids := array_append(v_factura_ids, v_factura_usd_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    )
    VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_usd_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'USD',
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  UPDATE public.proformas
  SET estado = 'Facturada'::estado_proforma, facturada_at = now()
  WHERE id = ANY(p_proforma_ids);

  PERFORM public.idempotency_commit(
    p_request_id, 'convertir_proformas_a_factura',
    jsonb_build_object('factura_ids', to_jsonb(v_factura_ids))
  );

  RETURN QUERY
    SELECT * FROM public.facturas WHERE id = ANY(v_factura_ids) AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO authenticated, service_role;

-- ============================================================
-- Backfill: renglones de Borradores no timbrados con tasa NULL
-- ============================================================
UPDATE public.conceptos_factura cf
SET tasa_iva_aplicada = CASE cf.tipo_iva
  WHEN 'gravado_16' THEN 0.16
  WHEN 'tasa_0'     THEN 0
  ELSE NULL
END
FROM public.facturas f
WHERE cf.factura_id = f.id
  AND cf.deleted_at IS NULL
  AND cf.tasa_iva_aplicada IS NULL
  AND cf.tipo_iva IN ('gravado_16','tasa_0')
  AND f.estado = 'Borrador'
  AND f.uuid_fiscal IS NULL;

-- Recomputar header de todos los Borradores no timbrados desde sus renglones
WITH sums AS (
  SELECT
    cf.factura_id,
    round(COALESCE(SUM(cf.cantidad * cf.precio_unitario), 0)::numeric, 2) AS subtotal_new,
    round(COALESCE(SUM(cf.cantidad * cf.precio_unitario * COALESCE(cf.tasa_iva_aplicada, 0)), 0)::numeric, 2) AS iva_new
  FROM public.conceptos_factura cf
  WHERE cf.deleted_at IS NULL
  GROUP BY cf.factura_id
)
UPDATE public.facturas f
SET subtotal = s.subtotal_new,
    iva = s.iva_new,
    total = s.subtotal_new + s.iva_new
FROM sums s
WHERE f.id = s.factura_id
  AND f.estado = 'Borrador'
  AND f.uuid_fiscal IS NULL
  AND f.deleted_at IS NULL;
