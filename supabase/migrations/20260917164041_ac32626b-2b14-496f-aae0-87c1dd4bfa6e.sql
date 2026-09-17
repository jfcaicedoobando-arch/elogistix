-- MNY-P2.3 / MNY-P2.1 / MNY-P2.4

-- 1) pago_detalle: sin T/C registrado no se inventa 1 (NULL = desconocido).
CREATE OR REPLACE FUNCTION public.pago_detalle(p_tipo text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org         uuid;
  v_super       boolean;
  v_pago        jsonb := NULL;
  v_mov         jsonb := NULL;
  v_aplic       jsonb := '[]'::jsonb;
  v_org_pago    uuid;
  v_lote        uuid := NULL;
  v_tipo        text;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_PARAMS: falta el identificador del pago';
  END IF;

  v_tipo := lower(coalesce(p_tipo, ''));
  IF v_tipo NOT IN ('cobro','pago','anticipo','lote','lote_cobro') THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_TIPO: tipo de pago no soportado (%)', p_tipo;
  END IF;

  v_org := current_user_org_id();
  v_super := has_role(auth.uid(), 'super_admin');
  IF v_org IS NULL AND NOT v_super THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_SIN_ORG: no se pudo determinar tu organización';
  END IF;

  IF v_tipo = 'cobro' THEN
    SELECT pf.organization_id,
           jsonb_build_object(
             'id', pf.id, 'tipo', 'cobro', 'fecha', pf.fecha_pago,
             'contraparte', c.nombre, 'contraparte_id', f.cliente_id,
             'moneda', pf.moneda::text, 'monto', COALESCE(pf.monto,0),
             'tipo_cambio', NULLIF(pf.tipo_cambio,0),
             'monto_mxn', CASE WHEN pf.moneda::text='MXN' THEN COALESCE(pf.monto,0)
                               WHEN COALESCE(pf.tipo_cambio,0) > 0 THEN COALESCE(pf.monto,0)*pf.tipo_cambio
                               ELSE NULL END,
             'metodo_pago', pf.forma_pago, 'referencia', pf.referencia,
             'cuenta_bancaria_id', pf.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', pf.notas, 'embarque_id', pf.embarque_id,
             'diferencia_cambiaria_mxn', COALESCE(pf.diferencia_cambiaria_mxn,0),
             'estado_rep', pf.estado_rep,
             'folio_rep', NULLIF(TRIM(COALESCE(pf.serie_rep,'')||COALESCE(pf.folio_rep::text,'')),''),
             'es_ajuste', false, 'lote_id', NULL::uuid,
             'created_by', pf.created_by, 'created_at', pf.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id
    LEFT JOIN public.clientes c ON c.id = f.cliente_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = pf.cuenta_bancaria_id
    WHERE pf.id = p_id AND pf.deleted_at IS NULL;

  ELSIF v_tipo = 'pago' THEN
    SELECT pp.organization_id, pp.lote_id,
           jsonb_build_object(
             'id', pp.id, 'tipo', 'pago', 'fecha', pp.fecha_pago,
             'contraparte', pr.nombre, 'contraparte_id', pfa.proveedor_id,
             'moneda', pp.moneda::text, 'monto', COALESCE(pp.monto,0),
             'tipo_cambio', NULLIF(pp.tipo_cambio_usd,0),
             'monto_mxn', CASE WHEN pp.moneda::text='MXN' THEN COALESCE(pp.monto,0)
                               WHEN COALESCE(pp.tipo_cambio_usd,0) > 0 THEN COALESCE(pp.monto,0)*pp.tipo_cambio_usd
                               ELSE NULL END,
             'metodo_pago', pp.metodo_pago, 'referencia', pp.referencia,
             'cuenta_bancaria_id', pp.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', pp.notas, 'embarque_id', pfa.embarque_id,
             'diferencia_cambiaria_mxn', COALESCE(pp.diferencia_cambiaria_mxn,0),
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', COALESCE(pp.es_ajuste,false), 'lote_id', pp.lote_id,
             'created_by', pp.created_by, 'created_at', pp.created_at
           )
      INTO v_org_pago, v_lote, v_pago
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pfa ON pfa.id = pp.proveedor_factura_id
    LEFT JOIN public.proveedores pr ON pr.id = pfa.proveedor_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = pp.cuenta_bancaria_id
    WHERE pp.id = p_id AND pp.deleted_at IS NULL;

  ELSIF v_tipo = 'lote' THEN
    v_lote := p_id;
    SELECT l.organization_id,
           jsonb_build_object(
             'id', l.id, 'tipo', 'lote', 'fecha', l.fecha_pago,
             'contraparte', pr.nombre, 'contraparte_id', l.proveedor_id,
             'moneda', l.moneda::text, 'monto', COALESCE(l.monto_total,0),
             'tipo_cambio', NULLIF(l.tipo_cambio_usd,0),
             'monto_mxn', CASE WHEN l.moneda::text='MXN' THEN COALESCE(l.monto_total,0)
                               WHEN COALESCE(l.tipo_cambio_usd,0) > 0 THEN COALESCE(l.monto_total,0)*l.tipo_cambio_usd
                               ELSE NULL END,
             'metodo_pago', l.metodo_pago, 'referencia', l.referencia,
             'cuenta_bancaria_id', l.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', l.notas, 'embarque_id', NULL::uuid,
             'diferencia_cambiaria_mxn', 0::numeric,
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', false, 'lote_id', l.id,
             'created_by', l.created_by, 'created_at', l.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.pagos_proveedor_lote l
    LEFT JOIN public.proveedores pr ON pr.id = l.proveedor_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = l.cuenta_bancaria_id
    WHERE l.id = p_id AND l.deleted_at IS NULL;

  ELSIF v_tipo = 'lote_cobro' THEN
    SELECT l.organization_id,
           jsonb_build_object(
             'id', l.id, 'tipo', 'lote_cobro', 'fecha', l.fecha_pago,
             'contraparte', c.nombre, 'contraparte_id', l.cliente_id,
             'moneda', l.moneda::text, 'monto', COALESCE(l.monto_total,0),
             'tipo_cambio', NULLIF(l.tipo_cambio_usd,0),
             'monto_mxn', CASE WHEN l.moneda::text='MXN' THEN COALESCE(l.monto_total,0)
                               WHEN COALESCE(l.tipo_cambio_usd,0) > 0 THEN COALESCE(l.monto_total,0)*l.tipo_cambio_usd
                               ELSE NULL END,
             'metodo_pago', l.forma_pago, 'referencia', l.referencia,
             'cuenta_bancaria_id', l.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', l.notas, 'embarque_id', NULL::uuid,
             'diferencia_cambiaria_mxn', 0::numeric,
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', false, 'lote_id', l.id,
             'created_by', l.created_by, 'created_at', l.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.pagos_factura_lote l
    LEFT JOIN public.clientes c ON c.id = l.cliente_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = l.cuenta_bancaria_id
    WHERE l.id = p_id AND l.deleted_at IS NULL;

  ELSE
    SELECT ap.organization_id,
           jsonb_build_object(
             'id', ap.id, 'tipo', 'anticipo', 'fecha', ap.fecha_anticipo,
             'contraparte', pr.nombre, 'contraparte_id', ap.proveedor_id,
             'moneda', ap.moneda::text, 'monto', COALESCE(ap.monto,0),
             'tipo_cambio', NULLIF(ap.tipo_cambio_usd,0),
             'monto_mxn', CASE WHEN ap.moneda::text='MXN' THEN COALESCE(ap.monto,0)
                               WHEN COALESCE(ap.tipo_cambio_usd,0) > 0 THEN COALESCE(ap.monto,0)*ap.tipo_cambio_usd
                               ELSE NULL END,
             'metodo_pago', ap.metodo_pago, 'referencia', ap.referencia,
             'cuenta_bancaria_id', ap.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', ap.notas, 'embarque_id', ap.embarque_id,
             'diferencia_cambiaria_mxn', 0::numeric,
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', false, 'lote_id', NULL::uuid,
             'estado', COALESCE(ap.estado,'Vigente'),
             'saldo_disponible', COALESCE(ap.saldo_disponible,0),
             'created_by', ap.created_by, 'created_at', ap.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.anticipos_proveedor ap
    LEFT JOIN public.proveedores pr ON pr.id = ap.proveedor_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = ap.cuenta_bancaria_id
    WHERE ap.id = p_id AND ap.deleted_at IS NULL;
  END IF;

  IF v_pago IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_NO_ENCONTRADO: el pago no existe o fue eliminado';
  END IF;

  IF NOT v_super AND v_org_pago IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_SIN_ACCESO: el pago pertenece a otra organización';
  END IF;

  SELECT jsonb_build_object(
           'id', m.id, 'fecha', m.fecha, 'concepto', m.concepto,
           'referencia', m.referencia, 'cargo', COALESCE(m.cargo,0), 'abono', COALESCE(m.abono,0),
           'saldo', m.saldo, 'estado_conciliacion', m.estado_conciliacion::text,
           'cuenta_bancaria_id', m.cuenta_bancaria_id,
           'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
           'conciliado_por', m.conciliado_por, 'conciliado_at', m.conciliado_at
         )
    INTO v_mov
  FROM public.bbva_movimientos m
  LEFT JOIN public.cuentas_bancarias cb ON cb.id = m.cuenta_bancaria_id
  WHERE m.deleted_at IS NULL
    AND (v_super OR m.organization_id = v_org)
    AND (
      (v_tipo = 'cobro'    AND m.pago_factura_id = p_id)
      OR (v_tipo = 'pago'  AND (m.pago_proveedor_id = p_id
                                OR (v_lote IS NOT NULL AND m.pago_proveedor_lote_id = v_lote)))
      OR (v_tipo = 'lote'  AND m.pago_proveedor_lote_id = p_id)
      OR (v_tipo = 'lote_cobro' AND m.pago_factura_lote_id = p_id)
      OR (v_tipo = 'anticipo' AND m.anticipo_proveedor_id = p_id)
    )
  ORDER BY m.fecha DESC
  LIMIT 1;

  IF v_tipo IN ('cobro','lote_cobro') THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_aplic
    FROM (
      SELECT jsonb_build_object(
               'documento_id', f.id, 'documento_tipo', 'cliente',
               'folio', NULLIF(TRIM(COALESCE(f.serie,'')||COALESCE(f.numero::text,'')),''),
               'embarque_id', pf.embarque_id,
               'moneda', f.moneda::text,
               'monto_aplicado', COALESCE(pf.monto_aplicado_factura, pf.monto, 0),
               'pago_id', pf.id,
               'total', COALESCE(f.total,0),
               'pagado', COALESCE((SELECT SUM(COALESCE(p2.monto_aplicado_factura, p2.monto, 0))
                                   FROM public.pagos_factura p2
                                   WHERE p2.factura_id = f.id AND p2.deleted_at IS NULL), 0)
             ) AS x
      FROM public.pagos_factura pf
      JOIN public.facturas f ON f.id = pf.factura_id
      WHERE pf.deleted_at IS NULL
        AND ((v_tipo = 'cobro' AND pf.id = p_id)
             OR (v_tipo = 'lote_cobro' AND pf.lote_id = p_id))
    ) s;

  ELSIF v_tipo IN ('pago','lote') THEN
    SELECT COALESCE(jsonb_agg(x ORDER BY folio), '[]'::jsonb) INTO v_aplic
    FROM (
      SELECT COALESCE(pfa.folio_interno, pfa.folio_proveedor) AS folio,
             jsonb_build_object(
               'documento_id', pfa.id, 'documento_tipo', 'proveedor',
               'folio', COALESCE(pfa.folio_interno, pfa.folio_proveedor),
               'folio_proveedor', pfa.folio_proveedor,
               'embarque_id', pfa.embarque_id,
               'moneda', pfa.moneda::text,
               'monto_aplicado', COALESCE(pp.monto_en_moneda_factura, pp.monto, 0),
               'pago_id', pp.id,
               'total', COALESCE(pfa.total,0),
               'pagado', COALESCE((SELECT SUM(COALESCE(p2.monto_en_moneda_factura, p2.monto, 0))
                                   FROM public.pagos_proveedor p2
                                   WHERE p2.proveedor_factura_id = pfa.id AND p2.deleted_at IS NULL), 0)
             ) AS x
      FROM public.pagos_proveedor pp
      JOIN public.proveedor_facturas pfa ON pfa.id = pp.proveedor_factura_id
      WHERE pp.deleted_at IS NULL
        AND ((v_lote IS NOT NULL AND pp.lote_id = v_lote) OR (v_lote IS NULL AND pp.id = p_id))
    ) s;

  ELSE
    SELECT COALESCE(jsonb_agg(x ORDER BY folio), '[]'::jsonb) INTO v_aplic
    FROM (
      SELECT COALESCE(pfa.folio_interno, pfa.folio_proveedor) AS folio,
             jsonb_build_object(
               'documento_id', pfa.id, 'documento_tipo', 'proveedor',
               'folio', COALESCE(pfa.folio_interno, pfa.folio_proveedor),
               'folio_proveedor', pfa.folio_proveedor,
               'embarque_id', pfa.embarque_id,
               'moneda', COALESCE(aa.moneda_aplicada::text, pfa.moneda::text),
               'monto_aplicado', COALESCE(aa.monto_aplicado,0),
               'fecha_aplicacion', aa.fecha_aplicacion,
               'total', COALESCE(pfa.total,0),
               'pagado', COALESCE((SELECT SUM(COALESCE(p2.monto_en_moneda_factura, p2.monto, 0))
                                   FROM public.pagos_proveedor p2
                                   WHERE p2.proveedor_factura_id = pfa.id AND p2.deleted_at IS NULL), 0)
             ) AS x
      FROM public.anticipos_aplicaciones aa
      JOIN public.proveedor_facturas pfa ON pfa.id = aa.proveedor_factura_id
      WHERE aa.anticipo_id = p_id AND aa.deleted_at IS NULL
    ) s;
  END IF;

  RETURN jsonb_build_object(
    'tipo', v_tipo,
    'pago', v_pago,
    'movimiento', v_mov,
    'aplicaciones', v_aplic
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.pago_detalle(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pago_detalle(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pago_detalle(text, uuid) TO authenticated;

-- 2) libro_pagos: T/C desconocido sin inventar 1 + cobros en lote (lote_id y
--    conciliación por el depósito del lote).
CREATE OR REPLACE FUNCTION public.libro_pagos(p_desde date, p_hasta date, p_org uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
      NULLIF(TRIM(COALESCE(f.serie, '') || COALESCE(f.numero::text, '')), '') AS documento_folio,
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
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = u.cuenta_bancaria_id AND cb.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT m.id
      FROM public.bbva_movimientos m
      WHERE m.deleted_at IS NULL
        AND m.estado_conciliacion = 'Conciliado'::estado_conciliacion
        AND (
          (u.tipo = 'cobro'    AND (m.pago_factura_id = u.id
                                    OR (u.lote_id IS NOT NULL AND m.pago_factura_lote_id = u.lote_id)))
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
$$;

REVOKE ALL ON FUNCTION public.libro_pagos(date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.libro_pagos(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.libro_pagos(date, date, uuid) TO service_role;

-- 3) aplicar_anticipo_a_factura: la bitácora registra el importe realmente
--    persistido en el pago (monto_en_moneda_factura), no un recálculo aparte.
CREATE OR REPLACE FUNCTION public.aplicar_anticipo_a_factura(p_anticipo_id uuid, p_factura_id uuid, p_monto numeric, p_fecha_aplicacion date DEFAULT CURRENT_DATE, p_request_id uuid DEFAULT NULL::uuid)
RETURNS public.anticipos_aplicaciones
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ant public.anticipos_proveedor;
  v_fact public.proveedor_facturas;
  v_pago public.pagos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_uid uuid := auth.uid();
  v_email text;
  v_monto_convertido numeric(18,4);
  v_monto_historico numeric(18,4);
  v_tc_aplicacion numeric;
  v_autorizado boolean;
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  v_cached := public.idempotency_claim(p_request_id, 'aplicar_anticipo_a_factura');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EN_PROCESO: Esta aplicación de anticipo ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_ap FROM public.anticipos_aplicaciones
     WHERE id = (v_cached->>'aplicacion_id')::uuid;
    IF v_ap.id IS NOT NULL THEN
      RETURN v_ap;
    END IF;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;
  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden aplicar anticipos.'
      USING ERRCODE = '42501';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto a aplicar debe ser mayor a cero.';
  END IF;
  SELECT * INTO v_ant FROM public.anticipos_proveedor WHERE id = p_anticipo_id FOR UPDATE;
  IF v_ant.id IS NULL OR v_ant.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;
  IF v_ant.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;
  IF v_ant.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo está cancelado.';
  END IF;
  IF v_ant.saldo_disponible + 0.01 < p_monto THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_SALDO: Saldo disponible (%.4f) insuficiente para aplicar %.4f.',
      v_ant.saldo_disponible, p_monto;
  END IF;
  SELECT * INTO v_fact FROM public.proveedor_facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_fact.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura no existe.';
  END IF;
  IF v_fact.estado_aprobacion <> 'aprobada' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura debe estar aprobada antes de aplicar un anticipo.';
  END IF;
  IF v_fact.estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_NO_VIVA: La factura está Cancelada y no admite anticipos.'
      USING ERRCODE = '23514';
  END IF;
  IF v_fact.organization_id <> v_ant.organization_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_ORG_MISMATCH: Anticipo y factura pertenecen a organizaciones distintas.';
  END IF;
  IF v_fact.proveedor_id IS DISTINCT FROM v_ant.proveedor_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_MISMATCH: Anticipo y factura pertenecen a proveedores distintos.';
  END IF;
  IF v_ant.moneda = v_fact.moneda THEN
    v_monto_convertido := p_monto;
    v_monto_historico := p_monto;
  ELSE
    v_monto_convertido := public.convertir_monto_dof(
      p_monto, v_ant.moneda::text, v_fact.moneda::text, p_fecha_aplicacion);
    BEGIN
      v_monto_historico := public.convertir_monto_pago_a_factura(
        p_monto, v_ant.moneda, v_ant.tipo_cambio_usd, v_fact.moneda, v_fact.tipo_cambio_usd);
    EXCEPTION WHEN OTHERS THEN
      v_monto_historico := NULL;
    END;
  END IF;
  v_tc_aplicacion := CASE
    WHEN v_ant.moneda = v_fact.moneda THEN v_ant.tipo_cambio_usd
    WHEN v_ant.moneda = 'MXN'::public.moneda THEN
      COALESCE(public.tc_dof_moneda(p_fecha_aplicacion, v_fact.moneda::text), v_ant.tipo_cambio_usd)
    ELSE COALESCE(public.tc_dof_moneda(p_fecha_aplicacion, v_ant.moneda::text), v_ant.tipo_cambio_usd)
  END;
  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
     tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas,
     created_by, es_anticipo_aplicado)
  VALUES
    (v_ant.organization_id, p_factura_id, p_fecha_aplicacion, p_monto, v_ant.moneda,
     v_tc_aplicacion,
     COALESCE(NULLIF(TRIM(v_ant.metodo_pago), ''), 'Transferencia'),
     COALESCE(v_ant.referencia,'') || ' (anticipo ' || v_ant.id::text || ')',
     v_ant.cuenta_bancaria_id, 'Aplicación de anticipo ' || v_ant.id::text,
     v_uid, true)
  RETURNING * INTO v_pago;
  -- MNY-P2.4: se relee el pago para tomar el valor que dejaron los triggers.
  SELECT * INTO v_pago FROM public.pagos_proveedor WHERE id = v_pago.id;
  INSERT INTO public.anticipos_aplicaciones
    (organization_id, anticipo_id, proveedor_factura_id, pago_proveedor_id,
     monto_aplicado, moneda_aplicada, fecha_aplicacion, created_by)
  VALUES
    (v_ant.organization_id, p_anticipo_id, p_factura_id, v_pago.id,
     p_monto, v_ant.moneda, p_fecha_aplicacion, v_uid)
  RETURNING * INTO v_ap;
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_ant.organization_id, v_uid, COALESCE(v_email,''), 'aplicar_anticipo_a_factura', 'cxp',
            v_ap.id, 'Aplicación ' || v_ap.id::text,
            jsonb_build_object('anticipo_id', p_anticipo_id, 'factura_id', p_factura_id,
                               'monto', p_monto, 'moneda', v_ant.moneda,
                               'monto_convertido', COALESCE(v_pago.monto_en_moneda_factura, v_monto_convertido),
                               'tc_aplicacion_dof', v_tc_aplicacion,
                               'monto_tc_historico', v_monto_historico,
                               'diferencial_cambiario',
                                 CASE WHEN v_monto_historico IS NULL THEN NULL
                                      ELSE round(COALESCE(v_pago.monto_en_moneda_factura, v_monto_convertido) - v_monto_historico, 4) END,
                               'pago_id', v_pago.id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en aplicar_anticipo_a_factura: % %', SQLSTATE, SQLERRM;
  END;
  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('aplicacion_id', v_ap.id, 'pago_id', v_pago.id));
  RETURN v_ap;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) TO service_role;