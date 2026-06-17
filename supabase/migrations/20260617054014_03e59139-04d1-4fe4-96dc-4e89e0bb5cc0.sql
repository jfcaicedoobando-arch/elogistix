
-- ============================================================
-- Bloque R: Seguros de carga por embarque
-- ============================================================

-- 1. Tabla seguros_embarque
CREATE TABLE IF NOT EXISTS public.seguros_embarque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  aseguradora text NOT NULL,
  numero_poliza text NOT NULL,
  certificado_url text,
  cobertura_descripcion text,
  suma_asegurada numeric(14,2) NOT NULL DEFAULT 0,
  deducible numeric(14,2) NOT NULL DEFAULT 0,
  prima numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'MXN',
  vigencia_desde date NOT NULL,
  vigencia_hasta date NOT NULL,
  contacto text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_seguros_embarque_embarque ON public.seguros_embarque(embarque_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seguros_embarque_org ON public.seguros_embarque(organization_id);
CREATE INDEX IF NOT EXISTS idx_seguros_embarque_vigencia ON public.seguros_embarque(vigencia_hasta) WHERE deleted_at IS NULL;

-- 2. GRANTS (PostgREST exige grants explícitos en public)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seguros_embarque TO authenticated;
GRANT ALL ON public.seguros_embarque TO service_role;

-- 3. RLS
ALTER TABLE public.seguros_embarque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted seguros"
  ON public.seguros_embarque FOR ALL
  USING (deleted_at IS NULL);

CREATE POLICY "Tenant read seguros"
  ON public.seguros_embarque FOR SELECT
  USING (
    organization_id = public.current_user_org_id()
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Tenant CRUD seguros"
  ON public.seguros_embarque FOR ALL
  USING (
    (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'operador'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'operador'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 4. updated_at trigger
DROP TRIGGER IF EXISTS trg_seguros_embarque_updated_at ON public.seguros_embarque;
CREATE TRIGGER trg_seguros_embarque_updated_at
  BEFORE UPDATE ON public.seguros_embarque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Actualizar RPC pnl_financiero_embarque para incluir la prima como costo real
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
  cv AS (
    SELECT lower(trim(coalesce(descripcion,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda,
           coalesce(total,0)::numeric AS monto
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda,
           coalesce(monto,0)::numeric AS monto,
           proveedor_id,
           coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  -- Bloque R: seguros como costo real (prima en su moneda)
  seg AS (
    SELECT 'seguro de carga'::text AS concepto,
           moneda::text AS moneda,
           coalesce(prima,0)::numeric AS monto,
           NULL::uuid AS proveedor_id,
           aseguradora AS proveedor_nombre
    FROM public.seguros_embarque
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
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
      'real_mxn',          (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM pf_neto)
                         + (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM seg),
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
          UNION ALL
          SELECT concepto, 0::numeric, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) FROM seg
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
          UNION ALL
          SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1
          FROM seg
        ) u
        GROUP BY proveedor_id, proveedor_nombre
        ORDER BY proveedor_nombre
      ) t
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated;
