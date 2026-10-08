-- Auditoría94,99,100: folio canónico, efectivo sin conciliación y devolución explícita.
CREATE OR REPLACE FUNCTION public.libro_pagos(p_desde date, p_hasta date, p_org uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org       uuid;
  v_super     boolean;
  v_pagos     jsonb := '[]'::jsonb;
BEGIN
  IF p_desde IS NULL OR p_hasta IS NULL THEN
    RAISE EXCEPTION 'LC_LIBRO_PAGOS_PARAMS: el periodo es obligatorio';
  END IF;
  IF p_hasta < p_desde THEN
    RAISE EXCEPTION 'LC_LIBRO_PAGOS_RANGO: la fecha final no puede ser anterior a la inicial';
  END IF;
  v_org := current_user_org_id();
  v_super := has_role(auth.uid(), 'super_admin');
  IF v_super THEN
    IF p_org IS NULL THEN
      RAISE EXCEPTION 'LC_ORG_REQUERIDA: selecciona una organización para ver el libro de pagos' USING ERRCODE='42501';
    END IF;
    v_org := p_org;
    v_super := false;
  ELSIF p_org IS NOT NULL AND p_org IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_ORG_AJENA: no puedes consultar el libro de pagos de otra organización' USING ERRCODE='42501';
  END IF;
  IF v_org IS NULL AND NOT v_super THEN
    RAISE EXCEPTION 'LC_LIBRO_PAGOS_SIN_ORG: no se pudo determinar tu organización';
  END IF;
  WITH cobros AS (
    SELECT
      pf.id,
      'cobro'::text                             AS tipo,
      pf.fecha_pago                             AS fecha,
      c.nombre                                  AS contraparte,
      f.cliente_id                              AS contraparte_id,
      f.id                                      AS documento_id,
      CASE WHEN NULLIF(TRIM(f.serie), '') IS NULL OR LEFT(TRIM(COALESCE(f.numero::text, '')), LENGTH(TRIM(f.serie))) = TRIM(f.serie) THEN NULLIF(TRIM(f.numero::text), '') ELSE NULLIF(TRIM(f.serie) || TRIM(COALESCE(f.numero::text, '')), '') END AS documento_folio,
      pf.moneda::text                           AS moneda,
      COALESCE(pf.monto, 0)                     AS monto,
      NULLIF(pf.tipo_cambio, 0)                 AS tipo_cambio,
      CASE WHEN pf.moneda::text = 'MXN' THEN COALESCE(pf.monto, 0)
           WHEN COALESCE(pf.tipo_cambio, 0) > 0 THEN COALESCE(pf.monto, 0) * pf.tipo_cambio
           ELSE NULL END                        AS monto_mxn,
      pf.forma_pago                             AS metodo_pago,
      pf.referencia,
      pf.cuenta_bancaria_id,
      pf.notas,
      pf.embarque_id,
      COALESCE(pf.diferencia_cambiaria_mxn, 0)  AS diferencia_cambiaria_mxn,
      pf.estado_rep,
      NULLIF(TRIM(COALESCE(pf.serie_rep, '') || COALESCE(pf.folio_rep::text, '')), '') AS folio_rep,
      false                                     AS es_ajuste,
      false                                     AS es_anticipo_aplicado,
      pf.lote_id,
      pf.created_by,
      pf.created_at
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id AND f.deleted_at IS NULL
    LEFT JOIN public.clientes c ON c.id = f.cliente_id
    WHERE pf.deleted_at IS NULL
      AND pf.fecha_pago BETWEEN p_desde AND p_hasta
      AND (v_super OR pf.organization_id = v_org)
  ),
  pagos AS (
    SELECT
      pp.id,
      'pago'::text                              AS tipo,
      pp.fecha_pago                             AS fecha,
      pr.nombre                                 AS contraparte,
      pfa.proveedor_id                          AS contraparte_id,
      pfa.id                                    AS documento_id,
      COALESCE(pfa.folio_interno, pfa.folio_proveedor) AS documento_folio,
      pp.moneda::text                           AS moneda,
      COALESCE(pp.monto, 0)                     AS monto,
      NULLIF(pp.tipo_cambio_usd, 0)             AS tipo_cambio,
      CASE WHEN pp.moneda::text = 'MXN' THEN COALESCE(pp.monto, 0)
           WHEN COALESCE(pp.tipo_cambio_usd, 0) > 0 THEN COALESCE(pp.monto, 0) * pp.tipo_cambio_usd
           ELSE NULL END                        AS monto_mxn,
      pp.metodo_pago,
      pp.referencia,
      pp.cuenta_bancaria_id,
      pp.notas,
      pfa.embarque_id,
      COALESCE(pp.diferencia_cambiaria_mxn, 0)  AS diferencia_cambiaria_mxn,
      NULL::text                                AS estado_rep,
      NULL::text                                AS folio_rep,
      COALESCE(pp.es_ajuste, false)             AS es_ajuste,
      COALESCE(pp.es_anticipo_aplicado, false)  AS es_anticipo_aplicado,
      pp.lote_id,
      pp.created_by,
      pp.created_at
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pfa ON pfa.id = pp.proveedor_factura_id AND pfa.deleted_at IS NULL
    LEFT JOIN public.proveedores pr ON pr.id = pfa.proveedor_id
    WHERE pp.deleted_at IS NULL
      AND pp.fecha_pago BETWEEN p_desde AND p_hasta
      AND (v_super OR pp.organization_id = v_org)
  ),
  anticipos AS (
    SELECT
      ap.id,
      'anticipo'::text                          AS tipo,
      ap.fecha_anticipo                         AS fecha,
      pr.nombre                                 AS contraparte,
      ap.proveedor_id                           AS contraparte_id,
      NULL::uuid                                AS documento_id,
      NULL::text                                AS documento_folio,
      ap.moneda::text                           AS moneda,
      COALESCE(ap.monto, 0)                     AS monto,
      NULLIF(ap.tipo_cambio_usd, 0)             AS tipo_cambio,
      CASE WHEN ap.moneda::text = 'MXN' THEN COALESCE(ap.monto, 0)
           WHEN COALESCE(ap.tipo_cambio_usd, 0) > 0 THEN COALESCE(ap.monto, 0) * ap.tipo_cambio_usd
           ELSE NULL END                        AS monto_mxn,
      ap.metodo_pago,
      ap.referencia,
      ap.cuenta_bancaria_id,
      ap.notas,
      ap.embarque_id,
      0::numeric                                AS diferencia_cambiaria_mxn,
      NULL::text                                AS estado_rep,
      NULL::text                                AS folio_rep,
      false                                     AS es_ajuste,
      false                                     AS es_anticipo_aplicado,
      NULL::uuid                                AS lote_id,
      ap.created_by,
      ap.created_at
    FROM public.anticipos_proveedor ap
    LEFT JOIN public.proveedores pr ON pr.id = ap.proveedor_id
    WHERE ap.deleted_at IS NULL
      AND lower(COALESCE(ap.estado, 'vigente')) <> 'cancelado'
      AND ap.fecha_anticipo BETWEEN p_desde AND p_hasta
      AND (v_super OR ap.organization_id = v_org)
  ),
  devoluciones AS (
    -- AUD100: cada devolución es una entrada independiente. La salida original
    -- se conserva bruta; la fecha/cuenta/referencia proceden del asiento real.
    SELECT ap.id, 'devolucion_anticipo'::text AS tipo,
      COALESCE(ap.fecha_devolucion, d.fecha, (ap.devuelto_at AT TIME ZONE 'America/Mexico_City')::date) AS fecha,
      pr.nombre AS contraparte, ap.proveedor_id AS contraparte_id,
      NULL::uuid AS documento_id, NULL::text AS documento_folio,
      ap.moneda::text AS moneda, ap.monto_devuelto AS monto,
      NULLIF(ap.tipo_cambio_usd, 0) AS tipo_cambio,
      CASE WHEN ap.moneda::text = 'MXN' THEN ap.monto_devuelto
           WHEN ap.tipo_cambio_usd > 0 THEN ap.monto_devuelto * ap.tipo_cambio_usd
           ELSE NULL END AS monto_mxn,
      CASE WHEN ap.medio_devolucion = 'Efectivo' THEN 'Efectivo' WHEN d.id IS NOT NULL THEN 'Devolución bancaria' ELSE NULL END AS metodo_pago,
      CASE WHEN ap.medio_devolucion IS NOT NULL THEN ap.referencia_devolucion ELSE COALESCE(d.referencia, ap.referencia) END AS referencia,
      d.cuenta_bancaria_id,
      concat_ws(' · ', NULLIF(ap.motivo_devolucion, ''),
        CASE WHEN ap.fecha_devolucion IS NULL AND d.id IS NULL THEN 'Sin fecha bancaria de devolución; fecha de registro como referencia' END,
        CASE WHEN ap.moneda::text <> 'MXN' THEN 'Equivalente MXN al TC registrado del anticipo original' END) AS notas,
      ap.embarque_id, 0::numeric AS diferencia_cambiaria_mxn,
      NULL::text AS estado_rep, NULL::text AS folio_rep,
      false AS es_ajuste, false AS es_anticipo_aplicado, NULL::uuid AS lote_id,
      ap.devuelto_by AS created_by, ap.devuelto_at AS created_at
    FROM public.anticipos_proveedor ap
    LEFT JOIN public.proveedores pr ON pr.id = ap.proveedor_id
    LEFT JOIN LATERAL (
      SELECT m.id, m.fecha, m.referencia, m.cuenta_bancaria_id
      FROM public.bbva_movimientos m
      WHERE m.anticipo_proveedor_id = ap.id
        AND m.organization_id = ap.organization_id AND m.deleted_at IS NULL
        AND m.hash_dedupe = 'devolucion-' || ap.id::text AND m.abono > 0
      ORDER BY m.fecha, m.id LIMIT 1
    ) d ON true
    WHERE ap.deleted_at IS NULL AND lower(COALESCE(ap.estado, 'vigente')) <> 'cancelado'
      AND ap.monto_devuelto > 0 AND (v_super OR ap.organization_id = v_org)
      AND COALESCE(ap.fecha_devolucion, d.fecha, (ap.devuelto_at AT TIME ZONE 'America/Mexico_City')::date)
          BETWEEN p_desde AND p_hasta
  ),
  unidos AS (
    SELECT * FROM cobros
    UNION ALL SELECT * FROM pagos
    UNION ALL SELECT * FROM anticipos
    UNION ALL SELECT * FROM devoluciones
  ),
  enriquecidos AS (
    SELECT
      u.*,
      cb.alias                                  AS cuenta_alias,
      cb.banco                                  AS cuenta_banco,
      mov.id                                    AS movimiento_id,
      (mov.id IS NOT NULL)                      AS conciliado,
      CASE WHEN mov.id IS NOT NULL THEN 'Conciliado'
           WHEN u.cuenta_bancaria_id IS NULL AND lower(trim(COALESCE(u.metodo_pago, ''))) IN ('efectivo', '01')
             THEN 'No aplica' ELSE 'Pendiente' END AS estado_conciliacion
    FROM unidos u
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = u.cuenta_bancaria_id AND cb.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT m.id
      FROM public.bbva_movimientos m
      WHERE m.deleted_at IS NULL AND m.organization_id = v_org
        AND m.estado_conciliacion = 'Conciliado'::estado_conciliacion
        AND (
          (u.tipo = 'cobro'    AND (m.pago_factura_id = u.id
                                    OR (u.lote_id IS NOT NULL AND m.pago_factura_lote_id = u.lote_id)))
          OR (u.tipo = 'pago'  AND (m.pago_proveedor_id = u.id
                                    OR (u.lote_id IS NOT NULL AND m.pago_proveedor_lote_id = u.lote_id)))
          OR (u.tipo = 'anticipo' AND m.anticipo_proveedor_id = u.id AND m.cargo > 0)
          OR (u.tipo = 'devolucion_anticipo' AND m.anticipo_proveedor_id = u.id
              AND m.hash_dedupe = 'devolucion-' || u.id::text AND m.abono > 0)
        )
      LIMIT 1
    ) mov ON true
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.fecha DESC, e.created_at DESC), '[]'::jsonb)
    INTO v_pagos
  FROM enriquecidos e;
  RETURN jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'pagos', v_pagos
  );
END;
$$;
REVOKE ALL ON FUNCTION public.libro_pagos(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.libro_pagos(date, date, uuid) TO authenticated, service_role;
