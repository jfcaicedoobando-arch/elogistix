-- 1) Blindaje: el guard de tenant sólo aplica cuando hay usuario autenticado.
CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric; v_estado estado_factura; v_org uuid;
  v_caller_org uuid; v_uid uuid; v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT total, estado, organization_id INTO v_total, v_estado, v_org
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  -- Fail-closed SÓLO para usuarios finales autenticados de otra organización.
  -- Sin usuario (migración / cron / service_role) se devuelve el saldo real.
  IF v_uid IS NOT NULL
     AND COALESCE(auth.role()::text, '') <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN 0;
    END IF;
  END IF;

  IF v_estado IN ('Cancelada', 'Sustituida', 'Borrador') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = p_factura_id AND deleted_at IS NULL AND estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$$;

REVOKE ALL ON FUNCTION public.saldo_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura(uuid) TO authenticated, service_role;

-- 2) Recálculo idempotente del estado real (aritmética directa, sin funciones con guard).
DO $fix$
DECLARE
  v_afectadas int := 0;
BEGIN
  PERFORM set_config('app.recalc_estado_factura', '1', true);

  WITH base AS (
    SELECT f.id,
           COALESCE(f.total, 0) AS total,
           f.fecha_vencimiento,
           f.estado,
           COALESCE((SELECT SUM(p.monto_aplicado_factura) FROM public.pagos_factura p
                      WHERE p.factura_id = f.id AND p.deleted_at IS NULL), 0) AS pagado,
           COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                      WHERE nc.factura_id = f.id AND nc.deleted_at IS NULL
                        AND nc.estado = 'Aplicada'), 0) AS ncs
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador')
  ), calc AS (
    SELECT b.id, b.estado,
      CASE
        WHEN (b.total - b.pagado - b.ncs) <= 0.01 THEN 'Pagada'::estado_factura
        WHEN b.pagado > 0 THEN 'Parcialmente pagada'::estado_factura
        WHEN b.fecha_vencimiento IS NOT NULL AND b.fecha_vencimiento < CURRENT_DATE THEN 'Vencida'::estado_factura
        ELSE 'Emitida'::estado_factura
      END AS nuevo_estado
    FROM base b
  )
  UPDATE public.facturas f
     SET estado = c.nuevo_estado, updated_at = now()
    FROM calc c
   WHERE f.id = c.id AND f.estado IS DISTINCT FROM c.nuevo_estado;

  GET DIAGNOSTICS v_afectadas = ROW_COUNT;
  PERFORM set_config('app.recalc_estado_factura', '', true);

  RAISE NOTICE 'FIX estado facturas: % facturas recalculadas', v_afectadas;
END;
$fix$;