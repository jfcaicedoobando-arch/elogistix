-- v13.320.34 · Wave 3 backend fixes (B-008, B-018)

-- ============================================================================
-- B-008 — Cliente único por (organization_id, RFC) — normalizado a mayúsculas y sin espacios.
-- Los proveedores ya lo tienen (proveedores_org_rfc_unique). El índice es parcial:
-- ignora RFC vacío/nulo y soft-deleted, para no bloquear altas legítimas sin RFC.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS clientes_org_rfc_unique
  ON public.clientes (organization_id, upper(btrim(rfc)))
  WHERE rfc IS NOT NULL
    AND btrim(rfc) <> ''
    AND upper(btrim(rfc)) NOT IN ('XEXX010101000','XAXX010101000')
    AND deleted_at IS NULL;

-- ============================================================================
-- B-018 — pnl_financiero_embarque: usar total (con IVA) para CxP.
-- Antes: pf.subtotal → subestimaba pasivo por 16 % IVA (34,800 mostrado como 30,000).
-- Ahora: pf.total menos NC y menos pagos ya emitidos.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque(_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tc_usd numeric; _tc_eur numeric; _org uuid;
  _has_cv boolean; _has_pf boolean; _has_seg boolean; _has_cc boolean;
  _estado_costos text;
  _base jsonb;
BEGIN
  SELECT COALESCE(tipo_cambio_usd,0), COALESCE(tipo_cambio_eur,0), organization_id
    INTO _tc_usd, _tc_eur, _org
  FROM public.embarques WHERE id = _embarque_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque % no encontrado', _embarque_id;
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND _org <> public.current_user_org_id() THEN
    RAISE EXCEPTION 'Sin acceso al embarque %', _embarque_id USING ERRCODE='42501';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.conceptos_venta WHERE embarque_id=_embarque_id AND deleted_at IS NULL) INTO _has_cv;
  SELECT EXISTS(SELECT 1 FROM public.conceptos_costo WHERE embarque_id=_embarque_id AND deleted_at IS NULL) INTO _has_cc;
  SELECT EXISTS(SELECT 1 FROM public.proveedor_facturas WHERE embarque_id=_embarque_id AND deleted_at IS NULL
                  AND estado::text NOT IN ('Borrador','Cancelada')) INTO _has_pf;
  SELECT EXISTS(SELECT 1 FROM public.seguros_embarque WHERE embarque_id=_embarque_id AND deleted_at IS NULL) INTO _has_seg;

  IF NOT _has_pf AND NOT _has_seg THEN
    _estado_costos := 'incompleto';
  ELSE
    _estado_costos := 'completo';
  END IF;

  WITH
  cv AS (
    SELECT lower(trim(coalesce(descripcion,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(total,0)::numeric AS monto
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(monto,0)::numeric AS monto,
           proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  seg AS (
    SELECT 'seguro de carga'::text AS concepto, moneda::text AS moneda,
           coalesce(prima,0)::numeric AS monto,
           NULL::uuid AS proveedor_id, aseguradora AS proveedor_nombre
    FROM public.seguros_embarque
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  f AS (
    SELECT id, coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda,
           estado::text AS estado, total::numeric AS total
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
    SELECT f.id, f.moneda, f.estado,
           f.subtotal - coalesce((SELECT sum(monto) FROM fnc WHERE factura_id = f.id),0) AS monto
    FROM f
  ),
  f_saldo AS (
    SELECT f.id, f.moneda, f.estado, public.saldo_factura(f.id) AS saldo FROM f
  ),
  pf AS (
    -- B-018: incluir total (con IVA − retenciones). Fallback a subtotal si total
    -- es NULL en facturas legacy previas al enriquecimiento del parser XML.
    SELECT id, proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           coalesce(NULLIF(total,0), subtotal, 0)::numeric AS total,
           moneda::text AS moneda, estado::text AS estado
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
    -- B-018: costo real ahora incluye IVA (total, no subtotal).
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado,
           pf.total - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0) AS monto
    FROM pf
  ),
  pf_saldo AS (
    -- B-018: saldo pendiente ahora contra total (con IVA), no subtotal.
    SELECT pf.id, pf.moneda, pf.estado,
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
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM f_neto) AS venta_real_mxn,
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM pf_neto)
        + (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM seg) AS costo_real_mxn
  )
  SELECT jsonb_build_object(
    'embarque_id', _embarque_id,
    'tipo_cambio_usd', _tc_usd,
    'tipo_cambio_eur', _tc_eur,
    'estado_costos', _estado_costos,
    'venta', jsonb_build_object(
      'presupuestada_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cv),
      'real_mxn', t.venta_real_mxn,
      'pdte_cobro_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                          FROM f_saldo WHERE estado IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar'))
    ),
    'costo', jsonb_build_object(
      'presupuestado_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cc),
      'real_mxn', t.costo_real_mxn,
      'pdte_pago_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                         FROM pf_saldo WHERE estado IN ('Vigente','Parcial','Por vencer','Vencida'))
    ),
    'utilidad_mxn', CASE
      WHEN _estado_costos = 'incompleto' THEN NULL
      ELSE round((t.venta_real_mxn - t.costo_real_mxn)::numeric, 2)
    END,
    'por_proveedor', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT proveedor_id, proveedor_nombre,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0) AS real_mxn,
               coalesce(sum(facturas_count),0) AS facturas_count
        FROM (
          SELECT proveedor_id, proveedor_nombre,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn,
                 0::numeric AS real_mxn, 0 AS facturas_count FROM cc
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1 FROM pf_neto
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1 FROM seg
        ) u GROUP BY proveedor_id, proveedor_nombre
      ) x
    )
  ) INTO _base FROM totales t;

  RETURN _base;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO service_role;
