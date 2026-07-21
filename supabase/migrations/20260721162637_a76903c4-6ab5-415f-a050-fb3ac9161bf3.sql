CREATE OR REPLACE FUNCTION public.get_exposicion_credito_cliente(
  p_cliente_id uuid
)
RETURNS TABLE (
  cliente_id        uuid,
  organization_id   uuid,
  dias_credito      integer,
  limite_mxn        numeric,
  en_uso_mxn        numeric,
  disponible_mxn    numeric,
  excedido          boolean,
  facturas_vivas    integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_dias integer;
  v_limite numeric;
  v_en_uso numeric := 0;
  v_facturas integer := 0;
BEGIN
  SELECT c.organization_id, c.dias_credito, c.limite_credito_mxn
    INTO v_org, v_dias, v_limite
  FROM public.clientes c
  WHERE c.id = p_cliente_id
    AND c.deleted_at IS NULL
    AND (
      c.organization_id = public.current_user_org_id()
      OR public.has_role(auth.uid(), 'owner'::app_role)
    );

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado o sin acceso'
      USING ERRCODE = '42501';
  END IF;

  WITH facturas_cliente AS (
    SELECT
      f.id,
      f.total,
      f.moneda,
      COALESCE(NULLIF(f.tipo_cambio, 0), 1) AS tc
    FROM public.facturas f
    WHERE f.cliente_id = p_cliente_id
      AND f.estado IN ('Emitida','Vencida','Parcialmente pagada','Pagada')
      AND f.deleted_at IS NULL
  ),
  pagos_por_factura AS (
    SELECT p.factura_id, COALESCE(SUM(p.monto_aplicado_factura), 0) AS pagado
    FROM public.pagos_factura p
    WHERE p.deleted_at IS NULL
      AND p.factura_id IN (SELECT id FROM facturas_cliente)
    GROUP BY p.factura_id
  ),
  nc_por_factura AS (
    SELECT n.factura_id, COALESCE(SUM(n.monto), 0) AS nc_aplicada
    FROM public.factura_notas_credito n
    WHERE n.deleted_at IS NULL
      AND n.estado = 'Aplicada'
      AND n.factura_id IN (SELECT id FROM facturas_cliente)
    GROUP BY n.factura_id
  )
  SELECT
    COALESCE(SUM(
      GREATEST(
        0,
        COALESCE(fc.total, 0)
        - COALESCE(pf.pagado, 0)
        - COALESCE(nc.nc_aplicada, 0)
      ) * CASE WHEN fc.moneda = 'MXN' THEN 1 ELSE fc.tc END
    ), 0),
    COUNT(*)
  INTO v_en_uso, v_facturas
  FROM facturas_cliente fc
  LEFT JOIN pagos_por_factura pf ON pf.factura_id = fc.id
  LEFT JOIN nc_por_factura nc ON nc.factura_id = fc.id;

  cliente_id      := p_cliente_id;
  organization_id := v_org;
  dias_credito    := v_dias;
  limite_mxn      := v_limite;
  en_uso_mxn      := ROUND(v_en_uso, 2);
  disponible_mxn  := CASE WHEN v_limite IS NULL THEN NULL ELSE ROUND(v_limite - v_en_uso, 2) END;
  excedido        := CASE WHEN v_limite IS NULL THEN false ELSE v_en_uso > v_limite END;
  facturas_vivas  := v_facturas;
  RETURN NEXT;
END;
$$;
