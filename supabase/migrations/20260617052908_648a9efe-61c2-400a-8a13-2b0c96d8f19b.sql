-- Bloque Q: bandejas por rol + cobranza_seguimiento (final)

CREATE TABLE IF NOT EXISTS public.cobranza_seguimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  factura_id uuid NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('recordatorio_email','llamada','promesa_pago','nota','visita')),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  comentario text,
  monto_promesa numeric(14,2),
  fecha_promesa date,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranza_seguimiento TO authenticated;
GRANT ALL ON public.cobranza_seguimiento TO service_role;
ALTER TABLE public.cobranza_seguimiento ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cobranza_seg_factura ON public.cobranza_seguimiento(factura_id);
CREATE INDEX IF NOT EXISTS idx_cobranza_seg_org_fecha ON public.cobranza_seguimiento(organization_id, fecha DESC);

CREATE POLICY "cobranza_seg_select_org" ON public.cobranza_seguimiento FOR SELECT TO authenticated USING (
  organization_id = public.current_user_org_id() AND (
    public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'tesorero'::app_role)
    OR public.has_role(auth.uid(), 'ejecutivo_cobranza'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente_operaciones'::app_role)
    OR public.has_role(auth.uid(), 'gerente_visor'::app_role)
  )
);

CREATE POLICY "cobranza_seg_insert_org" ON public.cobranza_seguimiento FOR INSERT TO authenticated WITH CHECK (
  organization_id = public.current_user_org_id() AND (
    public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'ejecutivo_cobranza'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE POLICY "cobranza_seg_update_org" ON public.cobranza_seguimiento FOR UPDATE TO authenticated USING (
  organization_id = public.current_user_org_id()
  AND (usuario_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "cobranza_seg_delete_org" ON public.cobranza_seguimiento FOR DELETE TO authenticated USING (
  organization_id = public.current_user_org_id()
  AND (usuario_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE TRIGGER trg_cobranza_seg_updated_at
  BEFORE UPDATE ON public.cobranza_seguimiento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS estado_captura text NOT NULL DEFAULT 'capturada'
  CHECK (estado_captura IN ('pendiente_xml','capturada','conciliada','pagada'));

CREATE INDEX IF NOT EXISTS idx_prov_fact_estado_captura
  ON public.proveedor_facturas(organization_id, estado_captura)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.cxp_por_capturar()
RETURNS TABLE (
  embarque_id uuid, expediente text, cliente_nombre text,
  costos_presupuestados numeric, facturas_capturadas integer, ultima_factura_fecha date
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT e.id, e.expediente, c.nombre,
    COALESCE(SUM(cc.monto), 0),
    (SELECT COUNT(*)::int FROM public.proveedor_facturas pf
       WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL),
    (SELECT MAX(pf.fecha_emision) FROM public.proveedor_facturas pf
       WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL)
  FROM public.embarques e
  LEFT JOIN public.clientes c ON c.id = e.cliente_id
  LEFT JOIN public.conceptos_costo cc ON cc.embarque_id = e.id AND cc.deleted_at IS NULL
  WHERE e.deleted_at IS NULL
  GROUP BY e.id, e.expediente, c.nombre
  HAVING COALESCE(SUM(cc.monto), 0) > 0
  ORDER BY e.created_at DESC
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.cxp_por_pagar()
RETURNS TABLE (
  factura_id uuid, proveedor_nombre text, folio_proveedor text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_para_vencer integer,
  moneda text, total numeric, pagado numeric, saldo numeric, estado_captura text
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT pf.id, pf.proveedor_nombre, pf.folio_proveedor,
    pf.embarque_id, e.expediente,
    pf.fecha_emision, pf.fecha_vencimiento,
    (pf.fecha_vencimiento - CURRENT_DATE)::int,
    pf.moneda::text, pf.total,
    COALESCE((SELECT SUM(pp.monto) FROM public.pagos_proveedor pp
                WHERE pp.proveedor_factura_id = pf.id), 0),
    pf.total - COALESCE((SELECT SUM(pp.monto) FROM public.pagos_proveedor pp
                          WHERE pp.proveedor_factura_id = pf.id), 0),
    pf.estado_captura
  FROM public.proveedor_facturas pf
  LEFT JOIN public.embarques e ON e.id = pf.embarque_id
  WHERE pf.deleted_at IS NULL AND pf.estado::text = 'Vigente'
  ORDER BY pf.fecha_vencimiento NULLS LAST, pf.created_at DESC
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.facturacion_por_emitir()
RETURNS TABLE (
  proforma_id uuid, numero_proforma text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text, total numeric, dias_desde_emision integer
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.id, p.numero, p.cliente_id, COALESCE(c.nombre, p.cliente_nombre),
    p.embarque_id, e.expediente,
    COALESCE(p.total_mxn, p.total_usd, 0),
    GREATEST(0, (CURRENT_DATE - p.fecha_emision))::int
  FROM public.proformas p
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  LEFT JOIN public.embarques e ON e.id = p.embarque_id
  WHERE p.deleted_at IS NULL
    AND COALESCE(p.estado_aprobacion, '') = 'Aprobada'
    AND p.factura_id IS NULL
    AND COALESCE(p.estado_proforma, '') <> 'Cancelada'
  ORDER BY p.fecha_emision ASC NULLS LAST
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE (
  factura_id uuid, numero text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  ultimo_contacto date, estado text
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre,
      COALESCE((SELECT SUM(pf.monto) FROM public.pagos_factura pf
                  WHERE pf.factura_id = f.id), 0) AS pagado
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    GREATEST(0, (CURRENT_DATE - b.fecha_vencimiento))::int,
    b.moneda, b.total, b.pagado, (b.total - b.pagado),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id = b.id),
    b.estado
  FROM base b
  LEFT JOIN public.clientes c ON c.id = b.cliente_id
  LEFT JOIN public.embarques e ON e.id = b.embarque_id
  WHERE (b.total - b.pagado) > 0
  ORDER BY GREATEST(0, (CURRENT_DATE - b.fecha_vencimiento)) DESC, b.fecha_vencimiento ASC
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.embarque_estado_financiero(_embarque_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_costo_pres numeric; v_costo_capturado numeric; v_costo_pagado numeric;
  v_tiene_proforma boolean; v_tiene_factura boolean; v_factura_pagada boolean;
  v_factura_total numeric; v_factura_cobrado numeric;
  v_semaforo_costo text; v_semaforo_facturacion text;
BEGIN
  SELECT COALESCE(SUM(monto), 0) INTO v_costo_pres
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(total), 0) INTO v_costo_capturado
    FROM public.proveedor_facturas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(pp.monto), 0) INTO v_costo_pagado
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    WHERE pf.embarque_id = _embarque_id AND pf.deleted_at IS NULL;

  SELECT EXISTS(SELECT 1 FROM public.proformas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
      AND COALESCE(estado_aprobacion,'') = 'Aprobada') INTO v_tiene_proforma;

  SELECT
    EXISTS(SELECT 1 FROM public.facturas
      WHERE embarque_id = _embarque_id AND deleted_at IS NULL AND estado::text <> 'Cancelada'),
    COALESCE(SUM(total) FILTER (WHERE estado::text <> 'Cancelada'), 0)
    INTO v_tiene_factura, v_factura_total
  FROM public.facturas
  WHERE embarque_id = _embarque_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(pf.monto), 0) INTO v_factura_cobrado
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id
    WHERE f.embarque_id = _embarque_id AND f.deleted_at IS NULL;

  v_factura_pagada := v_tiene_factura AND v_factura_cobrado >= v_factura_total AND v_factura_total > 0;

  v_semaforo_costo := CASE
    WHEN v_costo_pres = 0 THEN 'sin_costos'
    WHEN v_costo_capturado = 0 THEN 'pendiente'
    WHEN v_costo_pagado >= v_costo_capturado AND v_costo_capturado > 0 THEN 'pagado'
    WHEN v_costo_capturado > 0 THEN 'capturado'
    ELSE 'pendiente'
  END;

  v_semaforo_facturacion := CASE
    WHEN v_factura_pagada THEN 'cobrada'
    WHEN v_tiene_factura THEN 'facturada'
    WHEN v_tiene_proforma THEN 'proforma_lista'
    ELSE 'sin_proforma'
  END;

  RETURN jsonb_build_object(
    'costo', jsonb_build_object(
      'semaforo', v_semaforo_costo,
      'presupuestado', v_costo_pres,
      'capturado', v_costo_capturado,
      'pagado', v_costo_pagado),
    'facturacion', jsonb_build_object(
      'semaforo', v_semaforo_facturacion,
      'tiene_proforma', v_tiene_proforma,
      'tiene_factura', v_tiene_factura,
      'total_facturado', v_factura_total,
      'cobrado', v_factura_cobrado,
      'saldo', GREATEST(v_factura_total - v_factura_cobrado, 0))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cxp_por_capturar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cxp_por_pagar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.facturacion_por_emitir() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO authenticated;
GRANT EXECUTE ON FUNCTION public.embarque_estado_financiero(uuid) TO authenticated;