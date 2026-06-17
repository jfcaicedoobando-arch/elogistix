CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque(_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _tc_usd numeric;
  _tc_eur numeric;
  _result jsonb;
BEGIN
  SELECT COALESCE(tipo_cambio_usd, 0), COALESCE(tipo_cambio_eur, 0)
    INTO _tc_usd, _tc_eur
  FROM public.embarques WHERE id = _embarque_id;

  IF _tc_usd IS NULL THEN
    RAISE EXCEPTION 'Embarque % no encontrado o sin acceso', _embarque_id;
  END IF;

  WITH
  -- Presupuesto venta
  cv AS (
    SELECT lower(trim(coalesce(descripcion,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda,
           coalesce(total,0)::numeric AS monto
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  -- Presupuesto costo
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda,
           coalesce(monto,0)::numeric AS monto,
           proveedor_id,
           coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  -- Venta real (facturas vigentes)
  f AS (
    SELECT id, coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda, estado::text AS estado
    FROM public.facturas
    WHERE embarque_id = _embarque_id
      AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada')
  ),
  fnc AS (
    SELECT n.factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.factura_notas_credito n
    JOIN f ON f.id = n.factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text IN ('Aprobada','Aplicada')
  ),
  f_neto AS (
    SELECT f.id, f.moneda, f.estado,
           f.subtotal - coalesce((SELECT sum(monto) FROM fnc WHERE factura_id = f.id),0) AS monto
    FROM f
  ),
  fc AS (
    SELECT lower(trim(coalesce(cf.descripcion,'(sin concepto)'))) AS concepto,
           cf.moneda::text AS moneda,
           coalesce(cf.total,0)::numeric AS monto
    FROM public.conceptos_factura cf
    JOIN f ON f.id = cf.factura_id
    WHERE cf.deleted_at IS NULL
  ),
  -- Costo real (facturas de proveedor vigentes)
  pf AS (
    SELECT id, proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           coalesce(subtotal,0)::numeric AS subtotal,
           moneda::text AS moneda, estado::text AS estado
    FROM public.proveedor_facturas
    WHERE embarque_id = _embarque_id
      AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada')
  ),
  pnc AS (
    SELECT n.proveedor_factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.proveedor_notas_credito n
    JOIN pf ON pf.id = n.proveedor_factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text IN ('Aprobada','Aplicada')
  ),
  pf_neto AS (
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado,
           pf.subtotal - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0) AS monto
    FROM pf
  ),
  pfc AS (
    SELECT lower(trim(coalesce(c.descripcion,'(sin concepto)'))) AS concepto,
           pf.moneda, coalesce(c.monto,0)::numeric AS monto
    FROM public.proveedor_facturas_conceptos c
    JOIN pf ON pf.id = c.proveedor_factura_id
  ),
  -- Helpers de conversion
  conv AS (
    SELECT _tc_usd::numeric AS tc_usd, _tc_eur::numeric AS tc_eur
  )
  SELECT jsonb_build_object(
    'embarque_id', _embarque_id,
    'tipo_cambio_usd', _tc_usd,
    'tipo_cambio_eur', _tc_eur,
    'venta', jsonb_build_object(
      'presupuestada_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cv),
      'real_mxn',          (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM f_neto),
      'pdte_cobro_mxn',    (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0)
                            FROM f_neto WHERE estado IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar'))
    ),
    'costo', jsonb_build_object(
      'presupuestado_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cc),
      'real_mxn',          (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM pf_neto),
      'pdte_pago_mxn',     (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0)
                            FROM pf_neto WHERE estado = 'Vigente')
    ),
    'por_concepto', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0)   AS real_mxn,
               coalesce(sum(real_mxn),0) - coalesce(sum(presup_mxn),0) AS desviacion_mxn
        FROM (
          SELECT concepto, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn, 0::numeric AS real_mxn FROM cv
          UNION ALL
          SELECT concepto, 0::numeric, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) FROM fc
        ) u
        GROUP BY concepto
        ORDER BY concepto
      ) t
    ),
    'por_concepto_costo', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0)   AS real_mxn,
               coalesce(sum(real_mxn),0) - coalesce(sum(presup_mxn),0) AS desviacion_mxn
        FROM (
          SELECT concepto, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn, 0::numeric AS real_mxn FROM cc
          UNION ALL
          SELECT concepto, 0::numeric, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) FROM pfc
        ) u
        GROUP BY concepto
        ORDER BY concepto
      ) t
    ),
    'por_proveedor', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT proveedor_id, proveedor_nombre,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0)   AS real_mxn,
               coalesce(sum(facturas_count),0) AS facturas_count
        FROM (
          SELECT proveedor_id, proveedor_nombre,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn,
                 0::numeric AS real_mxn, 0 AS facturas_count
          FROM cc
          UNION ALL
          SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1
          FROM pf_neto
        ) u
        GROUP BY proveedor_id, proveedor_nombre
        ORDER BY proveedor_nombre
      ) t
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- Helper de conversión a MXN (idempotente)
CREATE OR REPLACE FUNCTION public.convertir_a_mxn(_monto numeric, _moneda text, _tc_usd numeric, _tc_eur numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(coalesce(_moneda,'MXN'))
    WHEN 'USD' THEN round(coalesce(_monto,0) * coalesce(_tc_usd,0), 2)
    WHEN 'EUR' THEN round(coalesce(_monto,0) * coalesce(_tc_eur,0), 2)
    ELSE round(coalesce(_monto,0), 2)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_a_mxn(numeric, text, numeric, numeric) TO authenticated, anon;
