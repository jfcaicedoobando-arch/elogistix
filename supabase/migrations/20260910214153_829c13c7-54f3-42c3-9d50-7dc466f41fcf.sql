CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_estado estado_factura; v_org uuid;
  v_caller_org uuid; v_uid uuid; v_pagos numeric; v_ncs numeric;
  v_moneda text; v_tc numeric; v_cliente uuid;
BEGIN
  SELECT total, estado, organization_id, moneda::text, tipo_cambio, cliente_id
    INTO v_total, v_estado, v_org, v_moneda, v_tc, v_cliente
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      -- Portal: el usuario cliente sí puede consultar el saldo de SU factura.
      IF v_cliente IS NULL
         OR v_cliente NOT IN (SELECT public.current_user_client_ids()) THEN
        RETURN 0;
      END IF;
    END IF;
  END IF;

  -- BUG-2026-08-25: 'Pagada' también es terminal (facturas legacy sin pagos
  -- capturados generaban adeudo fantasma en el estado de cuenta).
  -- v13.823.145: 'Borrador' NO es terminal — una factura sin timbrar debe
  -- reportar saldo por cobrar (antes mostraba "cobrado = total" sin pagos).
  IF v_estado IN ('Cancelada', 'Sustituida', 'Pagada') THEN RETURN 0; END IF;

  -- v13.823.287: un pago cuyo REP fue cancelado ante el SAT queda ANULADO:
  -- conserva su historia fiscal pero deja de contar para el saldo.
  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL
    AND COALESCE(estado_rep, '') <> 'Cancelado';

  -- BUG-04 (auditoría 2026-08-18): misma conversión que `cartera_pendiente`.
  SELECT COALESCE(SUM(
      CASE
        WHEN nc.moneda::text = v_moneda THEN nc.monto
        WHEN v_moneda = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
          THEN nc.monto * nc.tipo_cambio
        WHEN v_moneda <> 'MXN' AND nc.moneda::text = 'MXN' AND v_tc > 1
          THEN nc.monto / v_tc
        WHEN v_moneda <> 'MXN' AND nc.moneda::text <> 'MXN'
             AND v_moneda <> nc.moneda::text
             AND nc.tipo_cambio > 1 AND v_tc > 1
          THEN (nc.monto * nc.tipo_cambio) / v_tc
        ELSE 0
      END), 0) INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id AND nc.deleted_at IS NULL AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid; v_total numeric; v_pagado numeric; v_saldo numeric;
  v_vencimiento date; v_estado_actual estado_factura; v_nuevo_estado estado_factura;
  v_prev_flag text;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT total, fecha_vencimiento, estado INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas WHERE id = v_factura_id;

  IF v_estado_actual IN ('Cancelada', 'Borrador', 'Sustituida') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_saldo := public.saldo_factura(v_factura_id);

  -- v13.823.287: los pagos con REP cancelado estan anulados y no cuentan.
  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM pagos_factura
  WHERE factura_id = v_factura_id AND deleted_at IS NULL
    AND COALESCE(estado_rep, '') <> 'Cancelado';

  IF v_saldo <= 0.01 THEN
    v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN
    v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'Vencida';
  ELSE
    v_nuevo_estado := 'Emitida';
  END IF;

  -- v13.308.3 — Marcar recálculo autorizado para que guard_estado_factura
  -- permita fijar Pagada / Parcialmente pagada / Vencida. Se usa
  -- is_local=true (SET LOCAL) para restringir el efecto a esta
  -- transacción/función.
  v_prev_flag := current_setting('app.recalc_estado_factura', true);
  PERFORM set_config('app.recalc_estado_factura', '1', true);

  UPDATE facturas
  SET estado = v_nuevo_estado, updated_at = now()
  WHERE id = v_factura_id AND estado IS DISTINCT FROM v_nuevo_estado;

  PERFORM set_config('app.recalc_estado_factura', COALESCE(v_prev_flag, ''), true);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE(factura_id uuid, numero text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  ultimo_contacto date, estado text, cancellation_status text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre, f.tipo_cambio AS factura_tc,
      COALESCE(f.cancellation_status, 'none') AS cancellation_status,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL
                   AND COALESCE(pf.estado_rep, '') <> 'Cancelado'),0) AS pagado,
      COALESCE((
        SELECT SUM(
          CASE
            WHEN nc.moneda::text = f.moneda::text THEN nc.monto
            WHEN f.moneda::text = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
              THEN nc.monto * nc.tipo_cambio
            WHEN f.moneda::text <> 'MXN' AND nc.moneda::text = 'MXN' AND f.tipo_cambio > 1
              THEN nc.monto / f.tipo_cambio
            WHEN f.moneda::text <> 'MXN' AND nc.moneda::text <> 'MXN'
                 AND f.moneda::text <> nc.moneda::text
                 AND nc.tipo_cambio > 1 AND f.tipo_cambio > 1
              THEN (nc.monto * nc.tipo_cambio) / f.tipo_cambio
            ELSE 0
          END)
        FROM public.factura_notas_credito nc
        WHERE nc.factura_id = f.id
          AND nc.deleted_at IS NULL
          AND nc.estado = 'Aplicada'
      ), 0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    ((now() AT TIME ZONE 'America/Mexico_City')::date - b.fecha_vencimiento)::int,
    b.moneda, b.total, b.pagado,
    (b.total - b.pagado - b.nc_aplicadas),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id=b.id),
    b.estado, b.cancellation_status
  FROM base b
  LEFT JOIN public.clientes c ON c.id = b.cliente_id
  LEFT JOIN public.embarques e ON e.id = b.embarque_id AND e.deleted_at IS NULL
  WHERE (b.total - b.pagado - b.nc_aplicadas) > 0.005
  ORDER BY b.fecha_vencimiento ASC NULLS LAST
  LIMIT 500
$function$;

CREATE OR REPLACE FUNCTION public.cxc_aging_clientes(p_org uuid DEFAULT NULL::uuid, p_fecha date DEFAULT CURRENT_DATE)
 RETURNS TABLE(cliente_id uuid, cliente_nombre text, moneda text, saldo_total numeric, vigente numeric, d_1_30 numeric, d_31_60 numeric, d_61_90 numeric, mas_90 numeric, num_facturas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_org uuid;
  v_is_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  IF v_caller_org IS NULL AND NOT v_is_super THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organización activa' USING ERRCODE='42501';
  END IF;
  IF v_is_super THEN
    IF p_org IS NULL THEN
      RAISE EXCEPTION 'LC_ORG_REQUERIDA: selecciona una organización para ver este reporte' USING ERRCODE='42501';
    END IF;
    v_org := p_org;
  ELSIF p_org IS NOT NULL AND p_org IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: no puedes consultar el aging de otra organización' USING ERRCODE='42501';
  ELSE
    v_org := v_caller_org;
  END IF;

  RETURN QUERY
  WITH pagado AS (
    SELECT pf.factura_id, COALESCE(SUM(pf.monto_aplicado_factura), 0) AS pagado
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id AND f.deleted_at IS NULL
    WHERE pf.deleted_at IS NULL
      AND COALESCE(pf.estado_rep, '') <> 'Cancelado'
      AND (v_org IS NULL OR f.organization_id = v_org)
    GROUP BY pf.factura_id
  ),
  nc AS (
    SELECT ncf.factura_id, COALESCE(SUM(ncf.monto), 0) AS aplicado
    FROM public.factura_notas_credito ncf
    JOIN public.facturas f ON f.id = ncf.factura_id AND f.deleted_at IS NULL
    WHERE ncf.estado = 'Aplicada' AND ncf.deleted_at IS NULL
      AND (v_org IS NULL OR f.organization_id = v_org)
    GROUP BY ncf.factura_id
  ),
  saldos AS (
    SELECT
      f.cliente_id,
      f.cliente_nombre,
      UPPER(COALESCE(f.moneda::text, 'MXN')) AS moneda,
      f.id AS factura_id,
      GREATEST(f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.aplicado, 0), 0) AS saldo,
      (p_fecha - COALESCE(f.fecha_vencimiento, f.fecha_emision))::int AS dias_vencido
    FROM public.facturas f
    LEFT JOIN pagado pg ON pg.factura_id = f.id
    LEFT JOIN nc ON nc.factura_id = f.id
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      AND COALESCE(f.cancellation_status, 'none') NOT IN ('pending','verifying','accepted')
      AND f.sustituida_por IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.refacturaciones r
        WHERE r.factura_original_id = f.id AND r.estado = 'completado'
      )
      AND (v_org IS NULL OR f.organization_id = v_org)
  )
  SELECT
    s.cliente_id,
    MAX(s.cliente_nombre),
    s.moneda,
    SUM(s.saldo),
    SUM(CASE WHEN s.dias_vencido <= 0 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 1 AND 30 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido > 90 THEN s.saldo ELSE 0 END),
    COUNT(*)::int
  FROM saldos s
  WHERE s.saldo > 0.005
  GROUP BY s.cliente_id, s.moneda
  ORDER BY SUM(s.saldo) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.direccion_totales(
  p_desde date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH emb AS (
    SELECT e.id
    FROM embarques e
    WHERE e.deleted_at IS NULL
      -- Ola 5 · N23: excluir Cancelado, alineado con el loader cliente
      -- del dashboard de Dirección.
      AND e.estado <> 'Cancelado'
      AND (e.cerrado_at >= p_desde OR e.eta >= p_desde)
      AND e.organization_id = public.org_scope()
  ),
  ventas AS (
    SELECT cv.moneda::text AS moneda, SUM(cv.total) AS total
    FROM conceptos_venta cv
    WHERE cv.deleted_at IS NULL AND cv.embarque_id IN (SELECT id FROM emb)
    GROUP BY cv.moneda
  ),
  costos AS (
    SELECT cc.moneda::text AS moneda, SUM(cc.monto) AS total
    FROM conceptos_costo cc
    WHERE cc.deleted_at IS NULL AND cc.embarque_id IN (SELECT id FROM emb)
    GROUP BY cc.moneda
  ),
  facturado AS (
    SELECT f.moneda::text AS moneda, SUM(f.total) AS total
    FROM facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.fecha_emision >= p_desde
      AND f.organization_id = public.org_scope()
    GROUP BY f.moneda
  ),
  cobrado AS (
    SELECT f.moneda::text AS moneda, SUM(pf.monto_aplicado_factura) AS total
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND COALESCE(pf.estado_rep, '') <> 'Cancelado'
      AND pf.fecha_pago >= p_desde
      AND pf.organization_id = public.org_scope()
    GROUP BY f.moneda
  )
  SELECT jsonb_build_object(
    'embarques',  (SELECT COUNT(*) FROM emb),
    'ventas',     COALESCE((SELECT jsonb_object_agg(moneda, total) FROM ventas), '{}'::jsonb),
    'costos',     COALESCE((SELECT jsonb_object_agg(moneda, total) FROM costos), '{}'::jsonb),
    'facturado',  COALESCE((SELECT jsonb_object_agg(moneda, total) FROM facturado), '{}'::jsonb),
    'cobrado',    COALESCE((SELECT jsonb_object_agg(moneda, total) FROM cobrado), '{}'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_factura_resumen_saldo(p_factura_id uuid)
 RETURNS TABLE(total numeric, pagado numeric, notas_credito numeric, saldo numeric,
               num_pagos integer, num_notas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente uuid; v_moneda text; v_tc numeric; v_total numeric;
BEGIN
  SELECT f.cliente_id, f.moneda::text, f.tipo_cambio, f.total
    INTO v_cliente, v_moneda, v_tc, v_total
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_cliente IS NULL
     OR v_cliente NOT IN (SELECT public.current_user_client_ids()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH p AS (
    SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) AS monto, COUNT(*)::int AS n
    FROM public.pagos_factura pf
    WHERE pf.factura_id = p_factura_id AND pf.deleted_at IS NULL
      AND COALESCE(pf.estado_rep, '') <> 'Cancelado'
  ), nc AS (
    SELECT COALESCE(SUM(
      CASE
        WHEN n.moneda::text = v_moneda THEN n.monto
        WHEN v_moneda = 'MXN' AND n.moneda::text <> 'MXN' AND n.tipo_cambio > 1
          THEN n.monto * n.tipo_cambio
        WHEN v_moneda <> 'MXN' AND n.moneda::text = 'MXN' AND v_tc > 1
          THEN n.monto / v_tc
        WHEN v_moneda <> 'MXN' AND n.moneda::text <> 'MXN'
             AND v_moneda <> n.moneda::text
             AND n.tipo_cambio > 1 AND v_tc > 1
          THEN (n.monto * n.tipo_cambio) / v_tc
        ELSE 0
      END), 0) AS monto, COUNT(*)::int AS n
    FROM public.factura_notas_credito n
    WHERE n.factura_id = p_factura_id AND n.deleted_at IS NULL AND n.estado = 'Aplicada'
  )
  SELECT COALESCE(v_total, 0), p.monto, nc.monto,
         public.saldo_factura(p_factura_id), p.n, nc.n
  FROM p, nc;
END;
$function$;

CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_org uuid; v_uid uuid; v_caller_org uuid;
  v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT f.total, f.organization_id INTO v_total, v_org
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador');
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();
  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN 0;
    END IF;
  END IF;

  -- v13.823.287: los pagos con REP cancelado estan anulados y no bloquean
  -- el registro del cobro de reemplazo.
  SELECT COALESCE(SUM(p.monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura p
  WHERE p.factura_id = p_factura_id AND p.deleted_at IS NULL
    AND COALESCE(p.estado_rep, '') <> 'Cancelado';

  v_ncs := public._nc_aplicadas_moneda_factura(p_factura_id);

  RETURN COALESCE(v_total, 0) - v_pagos - COALESCE(v_ncs, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public._assert_pago_pue_exhibicion_unica()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_metodo text;
  v_total  numeric;
  v_otros  integer;
BEGIN
  SELECT f.metodo_pago, f.total
    INTO v_metodo, v_total
    FROM public.facturas f
   WHERE f.id = NEW.factura_id;

  IF NOT FOUND OR v_metodo IS DISTINCT FROM 'PUE' THEN
    RETURN NEW;
  END IF;

  -- v13.823.287: un pago con REP cancelado esta anulado y no ocupa la
  -- unica exhibicion de una factura PUE.
  SELECT count(*) INTO v_otros
    FROM public.pagos_factura p
   WHERE p.factura_id = NEW.factura_id
     AND p.deleted_at IS NULL
     AND COALESCE(p.estado_rep, '') <> 'Cancelado'
     AND p.id IS DISTINCT FROM NEW.id;
  IF v_otros > 0 THEN
    RAISE EXCEPTION 'LC_PAGO_PUE_EXHIBICION_UNICA: la factura es PUE y ya tiene un pago registrado; PUE exige liquidar en una sola exhibición. Cancela el pago previo si fue un error.'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(NEW.monto_aplicado_factura, NEW.monto) < v_total - 0.05 THEN
    RAISE EXCEPTION 'LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL: la factura es PUE; registra el cobro por el total (%) en una sola exhibición. Si el cliente abona, cambia la factura a PPD.', v_total
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END
$function$;