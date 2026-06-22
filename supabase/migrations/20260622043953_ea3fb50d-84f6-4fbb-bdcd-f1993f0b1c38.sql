
-- 1. Enum aprobación
DO $$ BEGIN
  CREATE TYPE public.estado_aprobacion_factura_proveedor AS ENUM ('pendiente','aprobada','rechazada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Columnas en proveedor_facturas
ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS estado_aprobacion public.estado_aprobacion_factura_proveedor NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS aprobada_por uuid,
  ADD COLUMN IF NOT EXISTS aprobada_at timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rechazo text;

-- 3. Backfill: facturas con pagos -> aprobada
UPDATE public.proveedor_facturas pf
SET estado_aprobacion = 'aprobada', aprobada_at = COALESCE(pf.updated_at, now())
WHERE pf.estado_aprobacion = 'pendiente'
  AND EXISTS (
    SELECT 1 FROM public.pagos_proveedor pp
    WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_proveedor_facturas_estado_aprobacion
  ON public.proveedor_facturas (organization_id, estado_aprobacion)
  WHERE deleted_at IS NULL;

-- 4. RPC aging
CREATE OR REPLACE FUNCTION public.cxp_aging_proveedores(
  p_org uuid DEFAULT NULL,
  p_fecha date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  proveedor_id uuid,
  proveedor_nombre text,
  saldo_total numeric,
  vigente numeric,
  d_1_30 numeric,
  d_31_60 numeric,
  d_61_90 numeric,
  mas_90 numeric,
  num_facturas integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH org AS (SELECT COALESCE(p_org, public.current_user_org_id()) AS oid),
  pagado AS (
    SELECT proveedor_factura_id, COALESCE(SUM(monto),0) AS pagado
    FROM public.pagos_proveedor
    WHERE deleted_at IS NULL
    GROUP BY proveedor_factura_id
  ),
  nc AS (
    SELECT proveedor_factura_id, COALESCE(SUM(monto),0) AS aplicado
    FROM public.proveedor_notas_credito
    WHERE estado = 'Aplicada'
    GROUP BY proveedor_factura_id
  ),
  saldos AS (
    SELECT
      pf.proveedor_id,
      pf.proveedor_nombre,
      pf.id AS factura_id,
      GREATEST(pf.total - COALESCE(pg.pagado,0) - COALESCE(nc.aplicado,0), 0) AS saldo,
      (p_fecha - COALESCE(pf.fecha_vencimiento, pf.fecha_emision))::int AS dias_vencido
    FROM public.proveedor_facturas pf
    LEFT JOIN pagado pg ON pg.proveedor_factura_id = pf.id
    LEFT JOIN nc       ON nc.proveedor_factura_id = pf.id
    JOIN org ON pf.organization_id = org.oid
    WHERE pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  )
  SELECT
    s.proveedor_id,
    MAX(s.proveedor_nombre) AS proveedor_nombre,
    SUM(s.saldo) AS saldo_total,
    SUM(CASE WHEN s.dias_vencido <= 0 THEN s.saldo ELSE 0 END) AS vigente,
    SUM(CASE WHEN s.dias_vencido BETWEEN 1 AND 30 THEN s.saldo ELSE 0 END) AS d_1_30,
    SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60 THEN s.saldo ELSE 0 END) AS d_31_60,
    SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90 THEN s.saldo ELSE 0 END) AS d_61_90,
    SUM(CASE WHEN s.dias_vencido > 90 THEN s.saldo ELSE 0 END) AS mas_90,
    COUNT(*)::int AS num_facturas
  FROM saldos s
  WHERE s.saldo > 0.005
  GROUP BY s.proveedor_id
  ORDER BY SUM(s.saldo) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.cxp_aging_proveedores(uuid, date) TO authenticated;

-- 5. RPC aprobar factura
CREATE OR REPLACE FUNCTION public.aprobar_factura_proveedor(
  p_id uuid,
  p_aprobar boolean,
  p_motivo text DEFAULT NULL
)
RETURNS public.proveedor_facturas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := auth.uid();
  v_autorizado boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'No tiene permisos para aprobar facturas de proveedor';
  END IF;

  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id AND deleted_at IS NULL;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF v_row.estado_aprobacion <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_row.estado_aprobacion;
  END IF;

  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = NULL
    WHERE id = p_id RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.bitacora_actividad (organization_id, user_id, accion, entidad, entidad_id, descripcion, metadata)
  VALUES (
    v_row.organization_id, v_uid,
    CASE WHEN p_aprobar THEN 'aprobar_factura_proveedor' ELSE 'rechazar_factura_proveedor' END,
    'proveedor_factura', v_row.id,
    'Factura ' || v_row.folio_proveedor || ' de ' || v_row.proveedor_nombre,
    jsonb_build_object('motivo', p_motivo, 'total', v_row.total)
  );

  RETURN v_row;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) TO authenticated;

-- 6. RPC salud proveedor
CREATE OR REPLACE FUNCTION public.proveedor_salud(p_proveedor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_facturas_12m integer;
  v_monto_12m numeric;
  v_saldo numeric;
  v_dias_promedio numeric;
  v_pct_a_tiempo numeric;
  v_nc_count integer;
  v_nc_monto numeric;
  v_embarques_activos integer;
  v_mensual jsonb;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total),0)
  INTO v_facturas_12m, v_monto_12m
  FROM public.proveedor_facturas
  WHERE proveedor_id = p_proveedor_id AND organization_id = v_oid
    AND deleted_at IS NULL AND estado <> 'Cancelada'
    AND fecha_emision >= (CURRENT_DATE - INTERVAL '12 months');

  SELECT COALESCE(SUM(GREATEST(pf.total - COALESCE(pg.pagado,0) - COALESCE(nc.aplicado,0),0)),0)
  INTO v_saldo
  FROM public.proveedor_facturas pf
  LEFT JOIN (SELECT proveedor_factura_id, SUM(monto) pagado FROM public.pagos_proveedor WHERE deleted_at IS NULL GROUP BY 1) pg
    ON pg.proveedor_factura_id = pf.id
  LEFT JOIN (SELECT proveedor_factura_id, SUM(monto) aplicado FROM public.proveedor_notas_credito WHERE estado='Aplicada' GROUP BY 1) nc
    ON nc.proveedor_factura_id = pf.id
  WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
    AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada';

  WITH pagos_x_fact AS (
    SELECT pf.id, pf.fecha_emision, MAX(pp.fecha_pago) AS fecha_ultimo_pago,
           pf.fecha_vencimiento, SUM(pp.monto) AS pagado, pf.total
    FROM public.proveedor_facturas pf
    JOIN public.pagos_proveedor pp ON pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
    GROUP BY pf.id, pf.fecha_emision, pf.fecha_vencimiento, pf.total
    HAVING SUM(pp.monto) >= pf.total - 0.01
  )
  SELECT
    AVG(fecha_ultimo_pago - fecha_emision)::numeric,
    CASE WHEN COUNT(*)=0 THEN NULL
         ELSE 100.0 * SUM(CASE WHEN fecha_vencimiento IS NULL OR fecha_ultimo_pago <= fecha_vencimiento THEN 1 ELSE 0 END) / COUNT(*) END
  INTO v_dias_promedio, v_pct_a_tiempo FROM pagos_x_fact;

  SELECT COUNT(*), COALESCE(SUM(monto),0)
  INTO v_nc_count, v_nc_monto
  FROM public.proveedor_notas_credito nc
  JOIN public.proveedor_facturas pf ON pf.id = nc.proveedor_factura_id
  WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
    AND nc.estado <> 'Cancelada';

  v_embarques_activos := 0;
  BEGIN
    SELECT COUNT(DISTINCT e.id) INTO v_embarques_activos
    FROM public.embarques e
    WHERE e.organization_id = v_oid
      AND (e.naviera_id = p_proveedor_id OR e.agente_origen_id = p_proveedor_id OR e.agente_destino_id = p_proveedor_id)
      AND COALESCE(e.estado,'') NOT IN ('Entregado','Cancelado','Cerrado');
  EXCEPTION WHEN undefined_column THEN v_embarques_activos := 0; END;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY mes), '[]'::jsonb)
  INTO v_mensual
  FROM (
    SELECT to_char(date_trunc('month', fecha_emision), 'YYYY-MM') AS mes,
           SUM(total) AS monto, COUNT(*) AS facturas
    FROM public.proveedor_facturas
    WHERE proveedor_id = p_proveedor_id AND organization_id = v_oid
      AND deleted_at IS NULL AND estado <> 'Cancelada'
      AND fecha_emision >= (CURRENT_DATE - INTERVAL '12 months')
    GROUP BY 1
  ) t;

  RETURN jsonb_build_object(
    'facturas_12m', v_facturas_12m,
    'monto_12m', v_monto_12m,
    'saldo_actual', v_saldo,
    'dias_promedio_pago', v_dias_promedio,
    'pct_pagadas_a_tiempo', v_pct_a_tiempo,
    'notas_credito_count', v_nc_count,
    'notas_credito_monto', v_nc_monto,
    'embarques_activos', v_embarques_activos,
    'mensual', v_mensual
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.proveedor_salud(uuid) TO authenticated;
