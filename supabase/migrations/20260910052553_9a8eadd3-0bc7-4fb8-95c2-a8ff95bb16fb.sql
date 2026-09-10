CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque(_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tc_usd numeric; _tc_eur numeric; _org uuid;
  _has_pf boolean; _has_seg boolean;
  _estado_costos text;
  _base jsonb;
BEGIN
  SELECT COALESCE(tipo_cambio_usd,0), COALESCE(tipo_cambio_eur,0), organization_id
    INTO _tc_usd, _tc_eur, _org
  FROM public.embarques WHERE id = _embarque_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque % no encontrado', _embarque_id;
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND _org IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'Sin acceso al embarque %', _embarque_id USING ERRCODE='42501';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.proveedor_facturas WHERE embarque_id=_embarque_id AND deleted_at IS NULL
                  AND estado::text NOT IN ('Borrador','Cancelada')) INTO _has_pf;
  SELECT EXISTS(SELECT 1 FROM public.seguros_embarque WHERE embarque_id=_embarque_id AND deleted_at IS NULL) INTO _has_seg;

  IF NOT _has_pf AND NOT _has_seg THEN
    _estado_costos := 'incompleto';
  ELSE
    _estado_costos := 'completo';
  END IF;

  WITH
  -- P1 (v13.823.274): el presupuesto usa EXCLUSIVAMENTE el T/C congelado del
  -- embarque (misma base que la pestaña Costos). Antes se derivaba del DOF de
  -- ETA/ETD, por lo que el presupuesto cambiaba al mover la ETA.
  cv AS (
    SELECT lower(trim(coalesce(descripcion,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(total,0)::numeric AS monto,
           CASE WHEN UPPER(moneda::text) = 'EUR' THEN NULLIF(_tc_eur,0) ELSE NULLIF(_tc_usd,0) END AS tc_doc
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(monto,0)::numeric AS monto,
           proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           CASE WHEN UPPER(moneda::text) = 'EUR' THEN NULLIF(_tc_eur,0) ELSE NULLIF(_tc_usd,0) END AS tc_doc
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  seg AS (
    SELECT 'seguro de carga'::text AS concepto, moneda::text AS moneda,
           coalesce(prima,0)::numeric AS monto,
           NULL::uuid AS proveedor_id, aseguradora AS proveedor_nombre,
           CASE WHEN UPPER(moneda::text) = 'EUR' THEN NULLIF(_tc_eur,0) ELSE NULLIF(_tc_usd,0) END AS tc_doc
    FROM public.seguros_embarque
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  f AS (
    SELECT id, coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda,
           estado::text AS estado, total::numeric AS total,
           (SELECT t.tc FROM public.tc_para_documento(fecha_emision, moneda::text, tipo_cambio, CASE WHEN UPPER(moneda::text) = 'EUR' THEN _tc_eur ELSE _tc_usd END) t) AS tc_doc
    FROM public.facturas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada','Sustituida')
  ),
  fnc AS (
    SELECT n.factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.factura_notas_credito n
    JOIN f ON f.id = n.factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  f_neto AS (
    SELECT f.id, f.moneda, f.estado, f.tc_doc,
           f.subtotal - coalesce((SELECT sum(monto) FROM fnc WHERE factura_id = f.id),0) AS monto
    FROM f
  ),
  f_saldo AS (
    SELECT f.id, f.moneda, f.estado, f.tc_doc, public.saldo_factura(f.id) AS saldo FROM f
  ),
  pf AS (
    SELECT id, proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           coalesce(NULLIF(total,0), subtotal, 0)::numeric AS total,
           GREATEST(
             coalesce(
               NULLIF(subtotal,0),
               coalesce(NULLIF(total,0),0) - coalesce(iva,0) + coalesce(retenciones,0),
               0
             )::numeric, 0)::numeric AS base_gravable,
           moneda::text AS moneda, estado::text AS estado,
           (SELECT t.tc FROM public.tc_para_documento(fecha_emision, moneda::text, tipo_cambio_usd, CASE WHEN UPPER(moneda::text) = 'EUR' THEN _tc_eur ELSE _tc_usd END) t) AS tc_doc
    FROM public.proveedor_facturas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada')
  ),
  pnc AS (
    SELECT n.proveedor_factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.proveedor_notas_credito n JOIN pf ON pf.id = n.proveedor_factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  pf_neto AS (
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado, pf.tc_doc,
           pf.base_gravable
             - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0)
               * CASE WHEN pf.total > 0 THEN pf.base_gravable / pf.total ELSE 1 END AS monto
    FROM pf
  ),
  pf_saldo AS (
    SELECT pf.id, pf.moneda, pf.estado, pf.tc_doc,
           (pf.total
              - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0)
              - coalesce((SELECT sum(pp.monto_en_moneda_factura)
                          FROM public.pagos_proveedor pp
                          WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL),0)
           ) AS saldo
    FROM pf
  ),
  totales AS (
    SELECT
      (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM f_neto) AS venta_real_mxn,
      (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM pf_neto)
        + (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM seg) AS costo_real_mxn
  )
  SELECT jsonb_build_object(
    'embarque_id', _embarque_id,
    'tipo_cambio_usd', _tc_usd,
    'tipo_cambio_eur', _tc_eur,
    'estado_costos', _estado_costos,
    'tc_por_documento', true,
    'excluidos_sin_tc', (
      (SELECT count(*) FROM cv WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      + (SELECT count(*) FROM cc WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      + (SELECT count(*) FROM f_neto WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      + (SELECT count(*) FROM pf_neto WHERE moneda <> 'MXN' AND tc_doc IS NULL)
    ),
    'venta', jsonb_build_object(
      'presupuestada_mxn', (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM cv),
      'real_mxn', t.venta_real_mxn,
      'pdte_cobro_mxn', (SELECT coalesce(sum(public.a_mxn(saldo, moneda, tc_doc, tc_doc)),0)
                          FROM f_saldo WHERE estado IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar'))
    ),
    'costo', jsonb_build_object(
      'presupuestado_mxn', (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM cc),
      'real_mxn', t.costo_real_mxn,
      'pdte_pago_mxn', (SELECT coalesce(sum(public.a_mxn(saldo, moneda, tc_doc, tc_doc)),0)
                         FROM pf_saldo WHERE estado IN ('Vigente','Parcial','Por vencer','Vencida'))
    ),
    'utilidad_mxn', CASE
      WHEN _estado_costos = 'incompleto' THEN NULL
      ELSE round((t.venta_real_mxn - t.costo_real_mxn)::numeric, 2)
    END,
    'por_concepto', (
      SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY (x.presupuestada_mxn + x.real_mxn) DESC), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup),0) AS presupuestada_mxn,
               coalesce(sum(real),0) AS real_mxn
        FROM (
          SELECT concepto,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc) AS presup,
                 0::numeric AS real FROM cv
          UNION ALL
          SELECT lower(trim(coalesce(NULLIF(fc.descripcion,''), '(sin concepto)'))),
                 0::numeric,
                 public.a_mxn(coalesce(fc.total,0), f.moneda, f.tc_doc, f.tc_doc)
          FROM public.conceptos_factura fc
          JOIN f ON f.id = fc.factura_id
          WHERE fc.deleted_at IS NULL
        ) u GROUP BY concepto
      ) x
    ),
    'por_concepto_costo', (
      SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY (x.presupuestado_mxn + x.real_mxn) DESC), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup),0) AS presupuestado_mxn,
               coalesce(sum(real),0) AS real_mxn
        FROM (
          SELECT concepto,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc) AS presup,
                 0::numeric AS real FROM cc
          UNION ALL
          SELECT lower(trim(coalesce(NULLIF(pfc.descripcion,''), '(sin concepto)'))),
                 0::numeric,
                 public.a_mxn(coalesce(pfc.monto, 0), pf.moneda, pf.tc_doc, pf.tc_doc)
          FROM public.proveedor_facturas_conceptos pfc
          JOIN pf ON pf.id = pfc.proveedor_factura_id
          UNION ALL
          SELECT '(factura completa)'::text,
                 0::numeric,
                 public.a_mxn(pf_neto.monto, pf_neto.moneda, pf_neto.tc_doc, pf_neto.tc_doc)
          FROM pf_neto
          WHERE NOT EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos pfc
                              WHERE pfc.proveedor_factura_id = pf_neto.id)
          UNION ALL
          SELECT concepto, 0::numeric,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc)
          FROM seg
        ) u GROUP BY concepto
      ) x
    ),
    'por_proveedor', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT proveedor_id, proveedor_nombre,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0) AS real_mxn,
               coalesce(sum(facturas_count),0) AS facturas_count
        FROM (
          SELECT proveedor_id, proveedor_nombre,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc) AS presup_mxn,
                 0::numeric AS real_mxn, 0 AS facturas_count FROM cc
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc), 1 FROM pf_neto
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc), 1 FROM seg
        ) u GROUP BY proveedor_id, proveedor_nombre
      ) x
    )
  ) INTO _base FROM totales t;

  RETURN _base;
END;
$function$;