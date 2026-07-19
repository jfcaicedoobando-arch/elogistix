-- Fase R.1 (v13.301.92): Bug 7 — proformas huérfanas al eliminar embarques
-- 1) eliminar_embarque_completo cuenta proformas aprobadas no facturadas
-- 2) convertir_proformas_a_factura rechaza embarques ya eliminados

CREATE OR REPLACE FUNCTION public.eliminar_embarque_completo(p_embarque_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_uid uuid := auth.uid();
  v_uemail text;
  v_org uuid;
  v_expediente text;
  v_estado text;
  v_cerrado_at timestamptz;
  v_cotizacion_id uuid;
  v_remaining int;
  v_facturas int;
  v_cxp int;
  v_pagos_cxc int;
  v_pagos_cxp int;
  v_ncs_cxc int;
  v_ncs_cxp int;
  v_comisiones int;
  v_proformas int;
  v_motivos jsonb;
BEGIN
  SELECT expediente, estado::text, cerrado_at, cotizacion_id, organization_id
    INTO v_expediente, v_estado, v_cerrado_at, v_cotizacion_id, v_org
  FROM public.embarques
  WHERE id = p_embarque_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque % no existe o ya está eliminado', p_embarque_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_facturas
  FROM public.facturas
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND estado NOT IN ('Cancelada', 'Sustituida');

  SELECT count(*) INTO v_cxp
  FROM public.proveedor_facturas
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND estado <> 'Cancelada';

  SELECT count(*) INTO v_pagos_cxc
  FROM public.pagos_factura pf
  JOIN public.facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id
    AND pf.deleted_at IS NULL
    AND f.deleted_at IS NULL;

  SELECT count(*) INTO v_pagos_cxp
  FROM public.pagos_proveedor pp
  JOIN public.proveedor_facturas pf ON pf.id = pp.factura_id
  WHERE pf.embarque_id = p_embarque_id
    AND pf.deleted_at IS NULL;

  SELECT count(*) INTO v_ncs_cxc
  FROM public.factura_notas_credito nc
  JOIN public.facturas f ON f.id = nc.factura_id
  WHERE f.embarque_id = p_embarque_id
    AND nc.deleted_at IS NULL
    AND f.deleted_at IS NULL;

  SELECT count(*) INTO v_ncs_cxp
  FROM public.proveedor_notas_credito nc
  JOIN public.proveedor_facturas pf ON pf.id = nc.factura_id
  WHERE pf.embarque_id = p_embarque_id
    AND pf.deleted_at IS NULL;

  SELECT count(*) INTO v_comisiones
  FROM public.comisiones_devengadas
  WHERE embarque_id = p_embarque_id
    AND definitiva = true;

  -- Fase R.1: proformas aprobadas no facturadas quedarían huérfanas
  SELECT count(*) INTO v_proformas
  FROM public.proformas
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND COALESCE(estado_aprobacion, '') <> 'borrador'
    AND COALESCE(estado_proforma, 'pendiente') = 'pendiente';

  IF v_facturas > 0
     OR v_cxp > 0
     OR v_pagos_cxc > 0
     OR v_pagos_cxp > 0
     OR v_ncs_cxc > 0
     OR v_ncs_cxp > 0
     OR v_comisiones > 0
     OR v_proformas > 0
     OR v_estado = 'Cerrado'
     OR v_cerrado_at IS NOT NULL
  THEN
    v_motivos := jsonb_build_object(
      'facturas', v_facturas,
      'cxp', v_cxp,
      'pagos_cxc', v_pagos_cxc,
      'pagos_cxp', v_pagos_cxp,
      'notas_credito_cxc', v_ncs_cxc,
      'notas_credito_cxp', v_ncs_cxp,
      'comisiones_definitivas', v_comisiones,
      'proformas', v_proformas,
      'cerrado', (v_estado = 'Cerrado' OR v_cerrado_at IS NOT NULL),
      'expediente', v_expediente
    );
    RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO: el embarque % tiene dependencias fiscales o está cerrado', v_expediente
      USING HINT = v_motivos::text,
            ERRCODE = 'check_violation';
  END IF;

  UPDATE public.conceptos_venta        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.conceptos_costo        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.documentos_embarque    SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.notas_embarque         SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.eventos_embarque       SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.embarque_contenedores  SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.seguros_embarque       SET deleted_at = v_now                    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.embarques
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE id = p_embarque_id AND deleted_at IS NULL;

  IF v_cotizacion_id IS NOT NULL THEN
    SELECT count(*) INTO v_remaining
    FROM public.embarques
    WHERE cotizacion_id = v_cotizacion_id AND deleted_at IS NULL;

    IF v_remaining = 0 THEN
      UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_cotizacion_id;
    END IF;
  END IF;

  BEGIN
    SELECT email INTO v_uemail FROM auth.users WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_uemail := NULL;
  END;

  IF v_uid IS NOT NULL THEN
    INSERT INTO public.bitacora_actividad
      (usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id)
    VALUES
      (v_uid, v_uemail, 'eliminar_embarque', 'embarques', p_embarque_id, v_expediente,
       jsonb_build_object(
         'cotizacion_revertida', (v_cotizacion_id IS NOT NULL AND v_remaining = 0),
         'estado_previo', v_estado
       ),
       v_org);
  END IF;
END;
$function$;

-- convertir_proformas_a_factura: bloquear embarques eliminados
CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura_check_embarque_vivo(p_proforma_ids uuid[])
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expediente_muerto text;
BEGIN
  SELECT e.expediente INTO v_expediente_muerto
  FROM public.proformas p
  JOIN public.embarques e ON e.id = p.embarque_id
  WHERE p.id = ANY(p_proforma_ids)
    AND e.deleted_at IS NOT NULL
  LIMIT 1;

  IF v_expediente_muerto IS NOT NULL THEN
    RAISE EXCEPTION 'LC_EMBARQUE_ELIMINADO: el embarque % ya fue eliminado; no se puede facturar sus proformas', v_expediente_muerto
      USING ERRCODE = 'check_violation',
            HINT = v_expediente_muerto;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura_check_embarque_vivo(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura_check_embarque_vivo(uuid[]) TO authenticated, service_role;

-- Inyectar la comprobación al inicio de convertir_proformas_a_factura vía trigger BEFORE INSERT en facturas
-- (mecanismo simple: no re-escribimos la RPC completa; llamamos al validador desde un trigger sobre proformas
-- pero como la RPC crea facturas directamente, agregamos el check dentro de la propia RPC).
-- Reemplazamos SÓLO el prólogo de la RPC agregando el check después de las validaciones básicas.

CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(
  p_proforma_ids uuid[],
  p_serie_id uuid,
  p_metodo_pago text,
  p_forma_pago text,
  p_uso_cfdi text,
  p_dias_credito integer DEFAULT NULL::integer,
  p_notas text DEFAULT NULL::text,
  p_request_id uuid DEFAULT NULL::uuid
)
 RETURNS SETOF facturas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_embarque_ids   uuid[];
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

  -- Fase R.1 (v13.301.92): impedir facturación si el embarque está eliminado
  PERFORM public.convertir_proformas_a_factura_check_embarque_vivo(p_proforma_ids);

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

  SELECT array_agg(DISTINCT embarque_id)
  INTO v_embarque_ids
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND embarque_id IS NOT NULL;

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
        tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
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
             END,
             p.embarque_id, pcc.proforma_id
      FROM public.proforma_conceptos_consolidados pcc
      JOIN public.proformas p ON p.id = pcc.proforma_id
      WHERE pcc.proforma_id = ANY(p_proforma_ids)
        AND pcc.moneda = 'MXN'::public.moneda
        AND pcc.deleted_at IS NULL;
    ELSE
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
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
             END,
             p.embarque_id, cv.proforma_id
      FROM public.conceptos_venta cv
      JOIN public.proformas p ON p.id = cv.proforma_id
      WHERE cv.proforma_id = ANY(p_proforma_ids)
        AND cv.moneda = 'MXN'::public.moneda
        AND cv.deleted_at IS NULL;
    END IF;

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

    IF v_embarque_ids IS NOT NULL THEN
      INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id)
      SELECT v_factura_mxn_id, unnest(v_embarque_ids), v_org
      ON CONFLICT DO NOTHING;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_mxn_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    )
    VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_mxn_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'MXN',
                        'embarque_ids', to_jsonb(v_embarque_ids),
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
        tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
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
             END,
             p.embarque_id, pcc.proforma_id
      FROM public.proforma_conceptos_consolidados pcc
      JOIN public.proformas p ON p.id = pcc.proforma_id
      WHERE pcc.proforma_id = ANY(p_proforma_ids)
        AND pcc.moneda = 'USD'::public.moneda
        AND pcc.deleted_at IS NULL;
    ELSE
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
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
             END,
             p.embarque_id, cv.proforma_id
      FROM public.conceptos_venta cv
      JOIN public.proformas p ON p.id = cv.proforma_id
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

    IF v_embarque_ids IS NOT NULL THEN
      INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id)
      SELECT v_factura_usd_id, unnest(v_embarque_ids), v_org
      ON CONFLICT DO NOTHING;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_usd_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    )
    VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_usd_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'USD',
                        'embarque_ids', to_jsonb(v_embarque_ids),
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  IF p_request_id IS NOT NULL THEN
    PERFORM public.idempotency_commit(p_request_id, jsonb_build_object('factura_ids', to_jsonb(v_factura_ids)));
  END IF;

  RETURN QUERY SELECT * FROM public.facturas WHERE id = ANY(v_factura_ids);
END;
$function$;

-- Preservar el contrato de grants de la Fase E: la RPC eliminar_embarque_completo
-- sólo puede ser invocada por usuarios autenticados o el service_role.
REVOKE ALL ON FUNCTION public.eliminar_embarque_completo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eliminar_embarque_completo(uuid) TO authenticated, service_role;
