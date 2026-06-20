
-- Índice parcial para acelerar el conteo en estados pre-cierre
CREATE INDEX IF NOT EXISTS idx_embarques_estado_admin_pendiente
  ON public.embarques (organization_id, estado)
  WHERE estado IN ('Entregado', 'EIR') AND deleted_at IS NULL;

-- Resumen por embarque: cuántos pendientes administrativos quedan
CREATE OR REPLACE FUNCTION public.embarque_admin_pendientes_resumen(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cxc_pendiente numeric := 0;
  v_cxp_pendiente numeric := 0;
  v_docs_faltantes int := 0;
  v_venta_no_facturada numeric := 0;
  v_pendientes int := 0;
BEGIN
  -- CxC pendiente (facturas no canceladas, saldo > 0)
  SELECT COALESCE(SUM(f.total),0) - COALESCE((
    SELECT SUM(pf.monto)
    FROM pagos_factura pf
    JOIN facturas fi ON fi.id = pf.factura_id
    WHERE fi.embarque_id = p_embarque_id AND fi.deleted_at IS NULL AND fi.estado <> 'Cancelada'
  ),0)
  INTO v_cxc_pendiente
  FROM facturas f
  WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL AND f.estado <> 'Cancelada';

  -- CxP pendiente
  SELECT COALESCE(SUM(pf.total),0) - COALESCE((
    SELECT SUM(pp.monto)
    FROM pagos_proveedor pp
    JOIN proveedor_facturas pfx ON pfx.id = pp.proveedor_factura_id
    WHERE pfx.embarque_id = p_embarque_id AND pfx.deleted_at IS NULL AND pfx.estado <> 'Cancelada'
  ),0)
  INTO v_cxp_pendiente
  FROM proveedor_facturas pf
  WHERE pf.embarque_id = p_embarque_id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada';

  -- Documentos sin archivo
  SELECT COUNT(*) INTO v_docs_faltantes
  FROM documentos_embarque
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND (archivo IS NULL OR archivo = '');

  -- Venta no facturada: conceptos_venta cuyo monto no aparece en facturas
  SELECT GREATEST(
    COALESCE((SELECT SUM(monto_total) FROM conceptos_venta WHERE embarque_id = p_embarque_id),0)
    - COALESCE((SELECT SUM(total) FROM facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada'),0),
  0)
  INTO v_venta_no_facturada;

  v_pendientes :=
    (CASE WHEN v_cxc_pendiente > 0.01 THEN 1 ELSE 0 END) +
    (CASE WHEN v_cxp_pendiente > 0.01 THEN 1 ELSE 0 END) +
    (CASE WHEN v_docs_faltantes > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN v_venta_no_facturada > 0.01 THEN 1 ELSE 0 END);

  RETURN jsonb_build_object(
    'pendientes', v_pendientes,
    'cxc_pendiente', v_cxc_pendiente,
    'cxp_pendiente', v_cxp_pendiente,
    'docs_faltantes', v_docs_faltantes,
    'venta_no_facturada', v_venta_no_facturada
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.embarque_admin_pendientes_resumen(uuid) TO authenticated;

-- Conteo global para el sidebar (alcance: organización del usuario)
CREATE OR REPLACE FUNCTION public.embarques_admin_pendientes_count()
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_count int := 0;
BEGIN
  -- Organización activa del usuario
  SELECT om.organization_id INTO v_org
  FROM organization_members om
  WHERE om.user_id = auth.uid()
  ORDER BY om.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_org IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM embarques e
  WHERE e.organization_id = v_org
    AND e.estado IN ('Entregado', 'EIR')
    AND e.deleted_at IS NULL
    AND (
      -- Tiene saldo de cobranza
      EXISTS (
        SELECT 1 FROM facturas f
        WHERE f.embarque_id = e.id AND f.deleted_at IS NULL AND f.estado <> 'Cancelada'
        GROUP BY f.embarque_id
        HAVING SUM(f.total) > COALESCE((
          SELECT SUM(pf.monto) FROM pagos_factura pf
          JOIN facturas fi ON fi.id = pf.factura_id
          WHERE fi.embarque_id = e.id AND fi.deleted_at IS NULL AND fi.estado <> 'Cancelada'
        ),0) + 0.01
      )
      -- Tiene saldo de pago a proveedor
      OR EXISTS (
        SELECT 1 FROM proveedor_facturas pf
        WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
        GROUP BY pf.embarque_id
        HAVING SUM(pf.total) > COALESCE((
          SELECT SUM(pp.monto) FROM pagos_proveedor pp
          JOIN proveedor_facturas pfx ON pfx.id = pp.proveedor_factura_id
          WHERE pfx.embarque_id = e.id AND pfx.deleted_at IS NULL AND pfx.estado <> 'Cancelada'
        ),0) + 0.01
      )
      -- Documentos sin archivo
      OR EXISTS (
        SELECT 1 FROM documentos_embarque de
        WHERE de.embarque_id = e.id AND de.deleted_at IS NULL
          AND (de.archivo IS NULL OR de.archivo = '')
      )
      -- Venta sin facturar
      OR (
        COALESCE((SELECT SUM(monto_total) FROM conceptos_venta WHERE embarque_id = e.id),0)
        > COALESCE((SELECT SUM(total) FROM facturas WHERE embarque_id = e.id AND deleted_at IS NULL AND estado <> 'Cancelada'),0) + 0.01
      )
    );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.embarques_admin_pendientes_count() TO authenticated;
