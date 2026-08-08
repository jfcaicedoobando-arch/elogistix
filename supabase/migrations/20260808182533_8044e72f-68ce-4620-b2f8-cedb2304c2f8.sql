CREATE OR REPLACE FUNCTION public.libro_pagos(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      NULLIF(TRIM(COALESCE(f.serie, '') || COALESCE(f.numero::text, '')), '') AS documento_folio,
      pf.moneda::text                           AS moneda,
      COALESCE(pf.monto, 0)                     AS monto,
      COALESCE(pf.tipo_cambio, 1)               AS tipo_cambio,
      CASE WHEN pf.moneda::text = 'MXN'
           THEN COALESCE(pf.monto, 0)
           ELSE COALESCE(pf.monto, 0) * COALESCE(pf.tipo_cambio, 1) END AS monto_mxn,
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
      NULL::uuid                                AS lote_id,
      pf.created_by,
      pf.created_at
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id
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
      COALESCE(pp.tipo_cambio_usd, 1)           AS tipo_cambio,
      CASE WHEN pp.moneda::text = 'MXN'
           THEN COALESCE(pp.monto, 0)
           ELSE COALESCE(pp.monto, 0) * COALESCE(pp.tipo_cambio_usd, 1) END AS monto_mxn,
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
    JOIN public.proveedor_facturas pfa ON pfa.id = pp.proveedor_factura_id
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
      COALESCE(ap.tipo_cambio_usd, 1)           AS tipo_cambio,
      CASE WHEN ap.moneda::text = 'MXN'
           THEN COALESCE(ap.monto, 0)
           ELSE COALESCE(ap.monto, 0) * COALESCE(ap.tipo_cambio_usd, 1) END AS monto_mxn,
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
      AND COALESCE(ap.estado, 'Vigente') <> 'Cancelado'
      AND ap.fecha_anticipo BETWEEN p_desde AND p_hasta
      AND (v_super OR ap.organization_id = v_org)
  ),
  unidos AS (
    SELECT * FROM cobros
    UNION ALL SELECT * FROM pagos
    UNION ALL SELECT * FROM anticipos
  ),
  enriquecidos AS (
    SELECT
      u.*,
      cb.alias                                  AS cuenta_alias,
      cb.banco                                  AS cuenta_banco,
      mov.id                                    AS movimiento_id,
      (mov.id IS NOT NULL)                      AS conciliado
    FROM unidos u
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = u.cuenta_bancaria_id
    LEFT JOIN LATERAL (
      SELECT m.id
      FROM public.bbva_movimientos m
      WHERE m.deleted_at IS NULL
        AND m.estado_conciliacion = 'Conciliado'::estado_conciliacion
        AND (
          (u.tipo = 'cobro'    AND m.pago_factura_id = u.id)
          OR (u.tipo = 'pago'  AND (m.pago_proveedor_id = u.id
                                    OR (u.lote_id IS NOT NULL AND m.pago_proveedor_lote_id = u.lote_id)))
          OR (u.tipo = 'anticipo' AND m.anticipo_proveedor_id = u.id)
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
$function$;

REVOKE ALL ON FUNCTION public.libro_pagos(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.libro_pagos(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.libro_pagos(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.libro_pagos(date, date) TO service_role;