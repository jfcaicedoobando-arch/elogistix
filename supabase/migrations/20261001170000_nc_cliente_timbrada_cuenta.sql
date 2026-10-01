-- AUD-ANALISIS-7: la NC de cliente cuenta desde 'Timbrada' (CFDI vigente ante el SAT); nada pasaba a 'Aplicada'.
CREATE OR REPLACE FUNCTION public._nc_aplicadas_moneda_factura(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(
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
    END), 0)
  FROM public.facturas f
  JOIN public.factura_notas_credito nc
    ON nc.factura_id = f.id
   AND nc.deleted_at IS NULL
   AND nc.estado IN ('Timbrada','Aplicada')
  WHERE f.id = p_factura_id;
$function$
;

CREATE OR REPLACE FUNCTION public._saldo_factura_calc(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_moneda text; v_tc numeric; v_estado estado_factura;
  v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT f.total, f.moneda::text, f.tipo_cambio, f.estado
    INTO v_total, v_moneda, v_tc, v_estado
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_estado IN ('Cancelada', 'Sustituida') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(p.monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura p
  WHERE p.factura_id = p_factura_id AND p.deleted_at IS NULL
    AND NOT public.pago_rep_anulado(p.estado_rep);

  SELECT COALESCE(SUM(public.nc_convertida_a_moneda_factura(
           nc.monto, nc.moneda::text, nc.tipo_cambio, v_moneda, v_tc)), 0)
    INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado IN ('Timbrada','Aplicada');

  RETURN COALESCE(v_total, 0) - COALESCE(v_pagos, 0) - COALESCE(v_ncs, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assert_nc_no_excede_saldo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fac record;
  v_saldo_doc numeric;
  v_saldo_mxn numeric;
  v_ncs_previas_mxn numeric;
  v_nc_nueva_mxn numeric;
  v_total_ncs_mxn numeric;
  v_tol_mxn numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.estado::text NOT IN ('Timbrada','Aplicada') THEN
    RETURN NEW;
  END IF;
  SELECT f.moneda::text AS moneda, f.tipo_cambio, f.fecha_emision
    INTO v_fac
  FROM public.facturas f
  WHERE f.id = NEW.factura_id
    AND f.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  v_saldo_doc := public.saldo_factura_bruto(NEW.factura_id);
  v_saldo_mxn := public.a_mxn_doc(v_saldo_doc, v_fac.moneda, v_fac.fecha_emision, v_fac.tipo_cambio, NULL);
  v_nc_nueva_mxn := public.a_mxn_doc(
    COALESCE(NEW.monto, 0),
    COALESCE(NEW.moneda::text, v_fac.moneda),
    COALESCE(NEW.fecha_emision, v_fac.fecha_emision),
    NEW.tipo_cambio,
    v_fac.tipo_cambio
  );
  IF v_saldo_mxn IS NULL OR v_nc_nueva_mxn IS NULL THEN
    RAISE EXCEPTION 'LC_NC_SIN_TC: no hay tipo de cambio para validar la nota de crédito contra el saldo de la factura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'moneda_factura', v_fac.moneda,
              'moneda_nota_credito', COALESCE(NEW.moneda::text, v_fac.moneda),
              'fecha_nota_credito', COALESCE(NEW.fecha_emision, v_fac.fecha_emision)
            )::text;
  END IF;
  SELECT COALESCE(SUM(
           public.a_mxn_doc(
             nc.monto,
             COALESCE(nc.moneda::text, v_fac.moneda),
             COALESCE(nc.fecha_emision, v_fac.fecha_emision),
             nc.tipo_cambio,
             v_fac.tipo_cambio
           )
         ), 0)
    INTO v_ncs_previas_mxn
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = NEW.factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado::text IN ('Timbrada','Aplicada')
    AND nc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_total_ncs_mxn := v_ncs_previas_mxn + v_nc_nueva_mxn;
  v_tol_mxn := GREATEST(
    0.01,
    COALESCE(public.a_mxn_doc(0.01, v_fac.moneda, v_fac.fecha_emision, v_fac.tipo_cambio, NULL), 0.01)
  );
  IF v_total_ncs_mxn > v_saldo_mxn + v_tol_mxn THEN
    RAISE EXCEPTION 'LC_NC_EXCEDE_SALDO: la nota de crédito excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'moneda_factura', v_fac.moneda,
              'saldo_disponible_mxn', round(v_saldo_mxn - v_ncs_previas_mxn, 2),
              'monto_intentado_mxn', round(v_nc_nueva_mxn, 2),
              'monto_intentado', NEW.monto,
              'moneda_nota_credito', COALESCE(NEW.moneda::text, v_fac.moneda)
            )::text;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cartera_pendiente()
 RETURNS TABLE(factura_id uuid, numero text, cliente_id uuid, cliente_nombre text, embarque_id uuid, expediente text, fecha_emision date, fecha_vencimiento date, dias_vencido integer, moneda text, total numeric, pagado numeric, saldo numeric, ultimo_contacto date, estado text, cancellation_status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre, f.tipo_cambio AS factura_tc,
      COALESCE(f.cancellation_status, 'none') AS cancellation_status,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL
                   AND NOT public.pago_rep_anulado(pf.estado_rep)),0) AS pagado,
      COALESCE((
        SELECT SUM(public.nc_convertida_a_moneda_factura(
                 nc.monto, nc.moneda::text, nc.tipo_cambio, f.moneda::text, f.tipo_cambio))
        FROM public.factura_notas_credito nc
        WHERE nc.factura_id = f.id
          AND nc.deleted_at IS NULL
          AND nc.estado IN ('Timbrada','Aplicada')
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
$function$
;

CREATE OR REPLACE FUNCTION public.cartera_pendiente_total()
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::bigint
  FROM public.facturas f
  WHERE f.deleted_at IS NULL
    AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
    AND (
      f.total
      - COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                   WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
                     AND NOT public.pago_rep_anulado(pf.estado_rep)), 0)
      - COALESCE((
          SELECT SUM(public.nc_convertida_a_moneda_factura(
                   nc.monto, nc.moneda::text, nc.tipo_cambio, f.moneda::text, f.tipo_cambio))
          FROM public.factura_notas_credito nc
          WHERE nc.factura_id = f.id
            AND nc.deleted_at IS NULL
            AND nc.estado IN ('Timbrada','Aplicada')
        ), 0)
    ) > 0.005
$function$
;

CREATE OR REPLACE FUNCTION public.clientes_listado(p_organization_id uuid DEFAULT NULL::uuid, p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, nombre text, rfc text, ciudad text, estado text, contacto text, telefono text, email text, dias_credito integer, limite_credito_mxn numeric, total_embarques bigint, total_cotizaciones bigint, deuda_pendiente numeric, saldo_pendiente_mxn numeric, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT c.*
    FROM clientes c
    WHERE c.deleted_at IS NULL
      AND ( p_organization_id IS NULL OR c.organization_id = p_organization_id )
      AND ( p_search IS NULL OR p_search = '' OR
            c.nombre ILIKE '%' || p_search || '%' OR
            c.rfc    ILIKE '%' || p_search || '%' )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_count
    FROM filtered f
    ORDER BY f.nombre ASC
    OFFSET p_offset LIMIT p_limit
  ),
  emb_agg AS (
    SELECT e.cliente_id, count(*)::bigint AS total_embarques
    FROM embarques e
    WHERE e.cliente_id IN (SELECT id FROM counted)
    GROUP BY e.cliente_id
  ),
  cot_agg AS (
    SELECT c.cliente_id, count(*)::bigint AS total_cotizaciones
    FROM cotizaciones c
    WHERE c.cliente_id IN (SELECT id FROM counted)
      AND c.deleted_at IS NULL
    GROUP BY c.cliente_id
  ),
  facturas_vivas AS (
    SELECT
      f.id,
      f.cliente_id,
      f.total,
      f.moneda,
      COALESCE(NULLIF(f.tipo_cambio, 0), 1) AS tc
    FROM facturas f
    WHERE f.cliente_id IN (SELECT id FROM counted)
      AND f.deleted_at IS NULL
      AND f.estado IN ('Emitida'::estado_factura, 'Vencida'::estado_factura, 'Parcialmente pagada'::estado_factura, 'Pagada'::estado_factura)
  ),
  pagos_agg AS (
    SELECT p.factura_id, COALESCE(SUM(p.monto_aplicado_factura),0) AS pagado
    FROM pagos_factura p
    WHERE p.deleted_at IS NULL
      AND p.factura_id IN (SELECT id FROM facturas_vivas)
    GROUP BY p.factura_id
  ),
  nc_agg AS (
    SELECT n.factura_id, COALESCE(SUM(n.monto),0) AS nc_aplicada
    FROM factura_notas_credito n
    WHERE n.deleted_at IS NULL
      AND n.estado IN ('Timbrada','Aplicada')
      AND n.factura_id IN (SELECT id FROM facturas_vivas)
    GROUP BY n.factura_id
  ),
  saldo_agg AS (
    SELECT
      fv.cliente_id,
      SUM(
        GREATEST(0, COALESCE(fv.total,0) - COALESCE(pa.pagado,0) - COALESCE(na.nc_aplicada,0))
        * CASE WHEN fv.moneda = 'MXN' THEN 1 ELSE fv.tc END
      ) AS saldo_pendiente_mxn
    FROM facturas_vivas fv
    LEFT JOIN pagos_agg pa ON pa.factura_id = fv.id
    LEFT JOIN nc_agg   na ON na.factura_id = fv.id
    GROUP BY fv.cliente_id
  ),
  deuda_agg AS (
    SELECT f.cliente_id, COALESCE(sum(f.total),0)::numeric AS deuda_pendiente
    FROM facturas f
    WHERE f.cliente_id IN (SELECT id FROM counted)
      AND f.estado IN ('Emitida'::estado_factura, 'Vencida'::estado_factura)
    GROUP BY f.cliente_id
  )
  SELECT
    c.id, c.nombre, c.rfc, c.ciudad, c.estado, c.contacto, c.telefono, c.email,
    c.dias_credito,
    c.limite_credito_mxn,
    COALESCE(ea.total_embarques, 0),
    COALESCE(ca.total_cotizaciones, 0),
    COALESCE(da.deuda_pendiente, 0),
    ROUND(COALESCE(sa.saldo_pendiente_mxn, 0), 2),
    c.total_count
  FROM counted c
  LEFT JOIN emb_agg   ea ON ea.cliente_id = c.id
  LEFT JOIN cot_agg   ca ON ca.cliente_id = c.id
  LEFT JOIN deuda_agg da ON da.cliente_id = c.id
  LEFT JOIN saldo_agg sa ON sa.cliente_id = c.id
  ORDER BY c.nombre ASC;
$function$
;

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
      AND NOT public.pago_rep_anulado(pf.estado_rep)
      AND (v_org IS NULL OR f.organization_id = v_org)
    GROUP BY pf.factura_id
  ),
  nc AS (
    SELECT ncf.factura_id,
           COALESCE(SUM(public.nc_convertida_a_moneda_factura(
             ncf.monto, ncf.moneda::text, ncf.tipo_cambio, f.moneda::text, f.tipo_cambio)), 0) AS aplicado
    FROM public.factura_notas_credito ncf
    JOIN public.facturas f ON f.id = ncf.factura_id AND f.deleted_at IS NULL
    WHERE ncf.estado IN ('Timbrada','Aplicada') AND ncf.deleted_at IS NULL
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
$function$
;

CREATE OR REPLACE FUNCTION public.eerr_resumen_anual(p_year integer, p_fuente text DEFAULT 'embarques'::text)
 RETURNS TABLE(mes integer, ingresos_mxn numeric, costos_mxn numeric, excluidos_sin_tc integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.org_scope();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organizacion activa' USING ERRCODE='42501';
  END IF;

  IF p_fuente = 'embarques' THEN
    RETURN QUERY
    WITH meses AS (
      SELECT generate_series(1,12) AS mes
    ),
    emb AS (
      SELECT
        e.id,
        EXTRACT(month FROM e.eta)::int AS mes,
        (SELECT t.tc FROM public.tc_para_documento(e.eta, 'USD', e.tipo_cambio_usd, NULL) t) AS tc_usd,
        (SELECT t.tc FROM public.tc_para_documento(e.eta, 'EUR', e.tipo_cambio_eur, NULL) t) AS tc_eur
      FROM public.embarques e
      WHERE e.deleted_at IS NULL
        AND e.organization_id = v_org
        AND e.estado <> 'Cancelado'
        AND e.eta IS NOT NULL
        AND EXTRACT(year FROM e.eta) = p_year
    ),
    ing AS (
      SELECT em.mes,
        SUM(
          CASE UPPER(COALESCE(cv.moneda::text, 'MXN'))
            WHEN 'USD' THEN CASE WHEN em.tc_usd IS NOT NULL THEN COALESCE(cv.total, 0) * em.tc_usd END
            WHEN 'EUR' THEN CASE WHEN em.tc_eur IS NOT NULL THEN COALESCE(cv.total, 0) * em.tc_eur END
            ELSE COALESCE(cv.total, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(cv.moneda::text, 'MXN')) = 'USD' AND em.tc_usd IS NULL)
             OR (UPPER(COALESCE(cv.moneda::text, 'MXN')) = 'EUR' AND em.tc_eur IS NULL)
        ) AS sin_tc
      FROM public.conceptos_venta cv
      JOIN emb em ON em.id = cv.embarque_id
      WHERE cv.deleted_at IS NULL
      GROUP BY em.mes
    ),
    cst AS (
      SELECT em.mes,
        SUM(
          CASE UPPER(COALESCE(cc.moneda::text, 'MXN'))
            WHEN 'USD' THEN CASE WHEN em.tc_usd IS NOT NULL THEN COALESCE(cc.monto, 0) * em.tc_usd END
            WHEN 'EUR' THEN CASE WHEN em.tc_eur IS NOT NULL THEN COALESCE(cc.monto, 0) * em.tc_eur END
            ELSE COALESCE(cc.monto, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(cc.moneda::text, 'MXN')) = 'USD' AND em.tc_usd IS NULL)
             OR (UPPER(COALESCE(cc.moneda::text, 'MXN')) = 'EUR' AND em.tc_eur IS NULL)
        ) AS sin_tc
      FROM public.conceptos_costo cc
      JOIN emb em ON em.id = cc.embarque_id
      WHERE cc.deleted_at IS NULL
      GROUP BY em.mes
    )
    SELECT m.mes,
           COALESCE(i.total, 0)::numeric AS ingresos_mxn,
           COALESCE(c.total, 0)::numeric AS costos_mxn,
           (COALESCE(i.sin_tc, 0) + COALESCE(c.sin_tc, 0))::integer AS excluidos_sin_tc
    FROM meses m
    LEFT JOIN ing i ON i.mes = m.mes
    LEFT JOIN cst c ON c.mes = m.mes
    ORDER BY m.mes;

  ELSIF p_fuente = 'facturas' THEN
    RETURN QUERY
    WITH meses AS (
      SELECT generate_series(1,12) AS mes
    ),
    fact_src AS (
      SELECT
        f.fecha_emision, f.moneda::text AS moneda, f.total,
        (SELECT t.tc FROM public.tc_para_documento(f.fecha_emision, 'USD', f.tipo_cambio, e.tipo_cambio_usd) t) AS tc_usd,
        (SELECT t.tc FROM public.tc_para_documento(f.fecha_emision, 'EUR', f.tipo_cambio, e.tipo_cambio_eur) t) AS tc_eur
      FROM public.facturas f
      LEFT JOIN public.embarques e ON e.expediente = f.expediente
                                    AND e.organization_id = v_org
                                    AND e.deleted_at IS NULL
      WHERE f.deleted_at IS NULL
        AND f.organization_id = v_org
        AND f.estado IN ('Emitida', 'Pagada', 'Vencida', 'Parcialmente pagada')
        AND f.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM f.fecha_emision) = p_year
    ),
    fact AS (
      SELECT
        EXTRACT(month FROM fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(moneda, 'MXN'))
            WHEN 'USD' THEN CASE WHEN tc_usd IS NOT NULL THEN COALESCE(total, 0) * tc_usd END
            WHEN 'EUR' THEN CASE WHEN tc_eur IS NOT NULL THEN COALESCE(total, 0) * tc_eur END
            ELSE COALESCE(total, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(moneda, 'MXN')) = 'USD' AND tc_usd IS NULL)
             OR (UPPER(COALESCE(moneda, 'MXN')) = 'EUR' AND tc_eur IS NULL)
        ) AS sin_tc
      FROM fact_src
      GROUP BY EXTRACT(month FROM fecha_emision)
    ),
    ncs AS (
      SELECT
        EXTRACT(month FROM ncf.fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(ncf.moneda::text, 'MXN'))
            WHEN 'USD' THEN ABS(COALESCE(ncf.monto, 0)) * (SELECT t.tc FROM public.tc_para_documento(ncf.fecha_emision, 'USD', ncf.tipo_cambio, NULL) t)
            WHEN 'EUR' THEN ABS(COALESCE(ncf.monto, 0)) * (SELECT t.tc FROM public.tc_para_documento(ncf.fecha_emision, 'EUR', ncf.tipo_cambio, NULL) t)
            ELSE ABS(COALESCE(ncf.monto, 0))
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(ncf.moneda::text, 'MXN')) IN ('USD','EUR')
            AND (SELECT t.tc FROM public.tc_para_documento(ncf.fecha_emision, ncf.moneda::text, ncf.tipo_cambio, NULL) t) IS NULL
        ) AS sin_tc
      FROM public.factura_notas_credito ncf
      WHERE ncf.deleted_at IS NULL
        AND ncf.organization_id = v_org
        AND ncf.estado IN ('Timbrada','Aplicada')
        AND ncf.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM ncf.fecha_emision) = p_year
        -- Ola 14 · borrado logico estricto: la NC de una factura eliminada no
        -- puede seguir reduciendo el ingreso del mes.
        AND EXISTS (
          SELECT 1 FROM public.facturas f
          WHERE f.id = ncf.factura_id AND f.deleted_at IS NULL
        )
      GROUP BY EXTRACT(month FROM ncf.fecha_emision)
    ),
    pfact_src AS (
      SELECT
        pf.fecha_emision, pf.moneda::text AS moneda, pf.total,
        (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'USD', pf.tipo_cambio_usd, e.tipo_cambio_usd) t) AS tc_usd,
        (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'EUR', NULL, e.tipo_cambio_eur) t) AS tc_eur
      FROM public.proveedor_facturas pf
      LEFT JOIN public.embarques e ON e.id = pf.embarque_id
                                    AND e.organization_id = v_org
                                    AND e.deleted_at IS NULL
      WHERE pf.deleted_at IS NULL
        AND pf.organization_id = v_org
        AND pf.estado <> 'Cancelada'
        AND pf.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM pf.fecha_emision) = p_year
    ),
    pfact AS (
      SELECT
        EXTRACT(month FROM fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(moneda, 'MXN'))
            WHEN 'USD' THEN CASE WHEN tc_usd IS NOT NULL THEN COALESCE(total, 0) * tc_usd END
            WHEN 'EUR' THEN CASE WHEN tc_eur IS NOT NULL THEN COALESCE(total, 0) * tc_eur END
            ELSE COALESCE(total, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(moneda, 'MXN')) = 'USD' AND tc_usd IS NULL)
             OR (UPPER(COALESCE(moneda, 'MXN')) = 'EUR' AND tc_eur IS NULL)
        ) AS sin_tc
      FROM pfact_src
      GROUP BY EXTRACT(month FROM fecha_emision)
    ),
    ncp AS (
      SELECT
        EXTRACT(month FROM n.updated_at)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(n.moneda::text, 'MXN'))
            WHEN 'USD' THEN CASE WHEN tc.tc_usd IS NOT NULL THEN ABS(COALESCE(n.monto, 0)) * tc.tc_usd END
            WHEN 'EUR' THEN CASE WHEN tc.tc_eur IS NOT NULL THEN ABS(COALESCE(n.monto, 0)) * tc.tc_eur END
            ELSE ABS(COALESCE(n.monto, 0))
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(n.moneda::text, 'MXN')) = 'USD' AND tc.tc_usd IS NULL)
             OR (UPPER(COALESCE(n.moneda::text, 'MXN')) = 'EUR' AND tc.tc_eur IS NULL)
        ) AS sin_tc
      FROM public.proveedor_notas_credito n
      -- Ola 14 · borrado logico estricto: si la factura de proveedor fue
      -- eliminada, su NC ya no descuenta el costo del mes.
      JOIN public.proveedor_facturas pf ON pf.id = n.proveedor_factura_id AND pf.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT
          (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'USD', pf.tipo_cambio_usd, e.tipo_cambio_usd) t) AS tc_usd,
          (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'EUR', NULL, e.tipo_cambio_eur) t) AS tc_eur
        FROM public.embarques e
        WHERE e.id = pf.embarque_id AND e.organization_id = v_org AND e.deleted_at IS NULL
      ) tc ON true
      WHERE n.deleted_at IS NULL
        AND n.organization_id = v_org
        AND n.estado = 'Aplicada'
        AND n.updated_at IS NOT NULL
        AND EXTRACT(year FROM n.updated_at) = p_year
      GROUP BY EXTRACT(month FROM n.updated_at)
    )
    SELECT m.mes,
           (COALESCE(f.total, 0) - COALESCE(n.total, 0))::numeric AS ingresos_mxn,
           (COALESCE(p.total, 0) - COALESCE(np.total, 0))::numeric AS costos_mxn,
           (COALESCE(f.sin_tc, 0) + COALESCE(n.sin_tc, 0) + COALESCE(p.sin_tc, 0) + COALESCE(np.sin_tc, 0))::integer AS excluidos_sin_tc
    FROM meses m
    LEFT JOIN fact f ON f.mes = m.mes
    LEFT JOIN ncs  n ON n.mes = m.mes
    LEFT JOIN pfact p ON p.mes = m.mes
    LEFT JOIN ncp np ON np.mes = m.mes
    ORDER BY m.mes;

  ELSE
    RAISE EXCEPTION 'LC_EERR_FUENTE_INVALIDA: fuente=% no reconocida (usa embarques|facturas)', p_fuente USING ERRCODE='22023';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.estado_cuenta_agregados(p_cliente_ids uuid[], p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_org uuid := public.org_scope();
  v_es_cliente boolean;
BEGIN
  -- M-9 (v14): los usuarios con rol cliente no son miembros de organización
  -- (org_scope() = NULL) y los KPIs salían en $0. El alcance se deriva de los
  -- clientes ligados al usuario.
  IF v_org IS NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = auth.uid()) INTO v_es_cliente;
    IF NOT v_es_cliente THEN
      RAISE EXCEPTION 'LC_ESTADO_CUENTA_SIN_ACCESO: sin organización activa ni cliente ligado';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(COALESCE(p_cliente_ids, ARRAY[]::uuid[])) AS x(id)
      WHERE x.id NOT IN (SELECT public.current_user_client_ids())
    ) THEN
      RAISE EXCEPTION 'LC_ESTADO_CUENTA_SIN_ACCESO: cliente fuera de tu alcance';
    END IF;
  END IF;
  WITH cartera AS (
    SELECT
      f.id,
      f.moneda::text AS moneda,
      CASE
        WHEN f.estado::text = 'Pagada' THEN 0
        ELSE GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0))
      END AS saldo,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento) AS dias_vencido
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(pf.monto_aplicado_factura) AS pagado
      FROM pagos_factura pf
      WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
    ) pg ON true
    LEFT JOIN LATERAL (
      SELECT SUM(n.monto) AS notas
      FROM factura_notas_credito n
      WHERE n.factura_id = f.id AND n.deleted_at IS NULL AND n.estado IN ('Timbrada','Aplicada')
    ) nc ON true
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (v_org IS NULL OR f.organization_id = v_org)
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  ),
  anticipos AS (
    SELECT
      f.moneda::text AS moneda,
      GREATEST(0,
        pf.monto * CASE
          WHEN pf.moneda = f.moneda THEN 1
          WHEN pf.tipo_cambio IS NOT NULL AND pf.tipo_cambio > 0 THEN pf.tipo_cambio
          ELSE 0
        END - pf.monto_aplicado_factura
      ) AS no_aplicado
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (v_org IS NULL OR f.organization_id = v_org)
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  )
  SELECT jsonb_build_object(
    'adeudado_mxn',      COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'MXN' AND saldo > 0), 0),
    'adeudado_usd',      COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'USD' AND saldo > 0), 0),
    'vencido_mxn',       COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'MXN' AND saldo > 0 AND dias_vencido > 0), 0),
    'vencido_usd',       COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'USD' AND saldo > 0 AND dias_vencido > 0), 0),
    'a_favor_mxn',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'MXN'), 0),
    'a_favor_usd',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'USD'), 0),
    'facturas_vencidas', (SELECT COUNT(*) FROM cartera WHERE saldo > 0 AND dias_vencido > 0),
    'facturas_adeudadas',(SELECT COUNT(*) FROM cartera WHERE saldo > 0)
  ) INTO v_result;
  RETURN v_result;
END;
$function$
;

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
  -- C29 (v13.823.381): una factura fusionada puede cubrir VARIOS embarques
  -- (`factura_embarques` + `conceptos_factura.embarque_id`). Antes se filtraba
  -- por `facturas.embarque_id`, así que el total completo caía en el embarque
  -- del header y los demás quedaban en cero.
  f_cand AS (
    SELECT fa.id, coalesce(fa.subtotal,0)::numeric AS subtotal, fa.moneda::text AS moneda,
           fa.estado::text AS estado, fa.total::numeric AS total,
           fa.tipo_cambio::numeric AS tc_factura,
           (SELECT t.tc FROM public.tc_para_documento(fa.fecha_emision, fa.moneda::text, fa.tipo_cambio, CASE WHEN UPPER(fa.moneda::text) = 'EUR' THEN _tc_eur ELSE _tc_usd END) t) AS tc_doc,
           coalesce((SELECT sum(coalesce(cf.total,0)) FROM public.conceptos_factura cf
                      WHERE cf.factura_id = fa.id AND cf.deleted_at IS NULL
                        AND cf.embarque_id IS NOT NULL), 0)::numeric AS lineas_etiquetadas,
           coalesce((SELECT sum(coalesce(cf.total,0)) FROM public.conceptos_factura cf
                      WHERE cf.factura_id = fa.id AND cf.deleted_at IS NULL
                        AND cf.embarque_id = _embarque_id), 0)::numeric AS lineas_embarque,
           (fa.embarque_id = _embarque_id) AS es_header
    FROM public.facturas fa
    WHERE fa.deleted_at IS NULL
      AND fa.estado::text NOT IN ('Borrador','Cancelada','Sustituida')
      AND (
        fa.embarque_id = _embarque_id
        OR EXISTS (SELECT 1 FROM public.conceptos_factura cf
                     WHERE cf.factura_id = fa.id AND cf.deleted_at IS NULL
                       AND cf.embarque_id = _embarque_id)
      )
  ),
  f AS (
    SELECT id, moneda, estado, total, tc_doc, tc_factura,
           factor,
           round(subtotal * factor, 2) AS subtotal
    FROM (
      SELECT c.*,
             CASE
               WHEN c.lineas_etiquetadas > 0 THEN c.lineas_embarque / c.lineas_etiquetadas
               WHEN c.es_header THEN 1::numeric
               ELSE 0::numeric
             END AS factor
      FROM f_cand c
    ) z
    WHERE z.factor > 0
  ),
  fnc AS (
    -- D1: primero a la moneda de la factura (mismo canon que saldo_factura),
    -- después el factor de atribución multiembarque.
    SELECT n.factura_id,
           public.nc_convertida_a_moneda_factura(
             coalesce(n.monto,0)::numeric, n.moneda::text, n.tipo_cambio,
             f.moneda, f.tc_factura) * f.factor AS monto,
           f.moneda AS moneda
    FROM public.factura_notas_credito n
    JOIN f ON f.id = n.factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text IN ('Timbrada','Aplicada')
  ),
  f_neto AS (
    SELECT f.id, f.moneda, f.estado, f.tc_doc,
           f.subtotal - coalesce((SELECT sum(monto) FROM fnc WHERE factura_id = f.id),0) AS monto
    FROM f
  ),
  f_saldo AS (
    SELECT f.id, f.moneda, f.estado, f.tc_doc,
           public.saldo_factura(f.id) * f.factor AS saldo FROM f
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
    -- D1: mismo canon que saldo_factura_proveedor / la vista de saldos. Si la
    -- NC no se puede convertir (falta T/C) devuelve NULL y `sum` la excluye:
    -- preferimos un costo mayor a dar por acreditada una NC no valuable.
    SELECT n.proveedor_factura_id,
           public.monto_pago_en_moneda_factura(
             coalesce(n.monto,0)::numeric, n.moneda::text, n.tipo_cambio, pf.moneda) AS monto,
           pf.moneda AS moneda
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
          -- C29: sólo las líneas de ESTE embarque a valor pleno; las líneas sin
          -- embarque asignado se reparten con el factor de atribución.
          SELECT lower(trim(coalesce(NULLIF(fc.descripcion,''), '(sin concepto)'))),
                 0::numeric,
                 public.a_mxn(
                   coalesce(fc.total,0) * CASE WHEN fc.embarque_id = _embarque_id THEN 1::numeric ELSE f.factor END,
                   f.moneda, f.tc_doc, f.tc_doc)
          FROM public.conceptos_factura fc
          JOIN f ON f.id = fc.factura_id
          WHERE fc.deleted_at IS NULL
            AND (fc.embarque_id = _embarque_id OR fc.embarque_id IS NULL)
          UNION ALL
          -- M1 (v13.823.384): la nota de crédito ya restada en `f_neto` se
          -- muestra como AJUSTE NEGATIVO visible, con el MISMO canon `fnc`
          -- (conversión a la moneda de la factura ANTES del factor
          -- multiembarque). Sin esta línea el desglose no reconciliaba con
          -- venta.real_mxn en cuanto había una NC aplicada.
          SELECT '(nota de crédito)'::text,
                 0::numeric,
                 -public.a_mxn(fnc.monto, fnc.moneda, f.tc_doc, f.tc_doc)
          FROM fnc JOIN f ON f.id = fnc.factura_id
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
          -- M2 (v13.823.384): ajuste negativo por nota de crédito de proveedor,
          -- con el monto YA convertido (`pnc`) y la MISMA proporción
          -- base_gravable/total que usa `pf_neto`. Sólo aplica a facturas con
          -- conceptos: las que no los tienen ya entran por `(factura completa)`,
          -- que parte de `pf_neto` (neto de NC) y restarlo otra vez duplicaría.
          SELECT '(nota de crédito proveedor)'::text,
                 0::numeric,
                 -public.a_mxn(
                    pnc.monto * CASE WHEN pf.total > 0 THEN pf.base_gravable / pf.total ELSE 1 END,
                    pf.moneda, pf.tc_doc, pf.tc_doc)
          FROM pnc JOIN pf ON pf.id = pnc.proveedor_factura_id
          WHERE EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos pfc
                          WHERE pfc.proveedor_factura_id = pf.id)
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
$function$
;

CREATE OR REPLACE FUNCTION public.portal_factura_resumen_saldo(p_factura_id uuid)
 RETURNS TABLE(total numeric, pagado numeric, notas_credito numeric, saldo numeric, num_pagos integer, num_notas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente uuid; v_moneda text; v_tc numeric; v_total numeric; v_estado estado_factura;
BEGIN
  SELECT f.cliente_id, f.moneda::text, f.tipo_cambio, f.total, f.estado
    INTO v_cliente, v_moneda, v_tc, v_total, v_estado
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
      AND NOT public.pago_rep_anulado(pf.estado_rep)
  ), nc AS (
    SELECT COALESCE(SUM(public.nc_convertida_a_moneda_factura(
             n.monto, n.moneda::text, n.tipo_cambio, v_moneda, v_tc)), 0) AS monto,
           COUNT(*)::int AS n
    FROM public.factura_notas_credito n
    WHERE n.factura_id = p_factura_id AND n.deleted_at IS NULL AND n.estado IN ('Timbrada','Aplicada')
  )
  SELECT COALESCE(v_total, 0), p.monto, nc.monto,
         CASE WHEN v_estado IN ('Cancelada','Sustituida') THEN 0
              ELSE COALESCE(v_total, 0) - p.monto - nc.monto END,
         p.n, nc.n
  FROM p, nc;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb; v_puede boolean := true; v_ok boolean;
  v_cxc_saldo numeric := 0; v_cxc_por_moneda jsonb := '[]'::jsonb;
  v_cxc_pagadas_sin_pago int := 0;
  v_cxp_saldo numeric := 0; v_cxp_por_moneda jsonb := '[]'::jsonb;
  v_docs_faltantes int;
  v_utilidad_mxn numeric; v_venta_mxn numeric; v_margen_min numeric; v_margen_pct numeric;
  v_pnl jsonb; v_com_count int; v_sin_comision boolean := false;
  v_cont_incompletos int := 0; v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_cont_sin_fechas int := 0; v_cont_fechas_ids uuid[] := ARRAY[]::uuid[];
  v_tiene_contenedores boolean := false;
  v_venta_pendientes int; v_venta_en_proforma int; v_venta_sin_emitir int := 0;
  v_costos_sin_factura int;
  v_rep_pendientes int := 0; v_rep_ids uuid[] := ARRAY[]::uuid[];
  v_ent_pendientes int := 0; v_ent_dias_max int := 0;
  v_ent_total int := 0; v_ent_vacio boolean := false;
  v_prov_sin_evidencia int := 0; v_prov_nombres text[] := ARRAY[]::text[];
  v_caller_org uuid; v_uid uuid; v_is_service boolean;
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id=p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();
  v_is_service := (COALESCE(auth.role()::text,'') = 'service_role');
  IF NOT v_is_service AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_emb.organization_id <> v_caller_org THEN
      RAISE EXCEPTION 'LC_ORG_FORBIDDEN: sin acceso al embarque' USING ERRCODE='42501';
    END IF;
  END IF;
  IF v_emb.modo='Marítimo' AND COALESCE(v_emb.tipo_carga,'') ILIKE 'FCL%' THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cont_incompletos, v_cont_ids
    FROM embarque_contenedores WHERE embarque_id=p_embarque_id AND deleted_at IS NULL
      AND (peso_kg IS NULL OR peso_kg<=0 OR volumen_m3 IS NULL OR volumen_m3<=0);
    v_ok := (v_cont_incompletos=0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_datos_completos','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_incompletos', v_cont_incompletos, 'ids', v_cont_ids)));
  END IF;
  SELECT EXISTS (SELECT 1 FROM embarque_contenedores
    WHERE embarque_id=p_embarque_id AND deleted_at IS NULL) INTO v_tiene_contenedores;
  IF v_tiene_contenedores AND v_emb.modo='Marítimo' AND COALESCE(v_emb.tipo_carga,'') ILIKE 'FCL%' THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cont_sin_fechas, v_cont_fechas_ids
    FROM embarque_contenedores WHERE embarque_id=p_embarque_id AND deleted_at IS NULL
      AND (fecha_descarga IS NULL OR fecha_devolucion IS NULL);
    v_ok := (v_cont_sin_fechas=0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_fechas_completas','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_sin_fechas', v_cont_sin_fechas, 'ids', v_cont_fechas_ids)));
  END IF;
  SELECT COUNT(*) INTO v_docs_faltantes FROM documentos_embarque de
   WHERE de.embarque_id=p_embarque_id AND de.deleted_at IS NULL
     AND (de.archivo IS NULL OR de.archivo='') AND de.estado<>'No aplica';
  v_ok := (v_docs_faltantes=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)));
  SELECT COUNT(*) INTO v_costos_sin_factura FROM conceptos_costo cc
   WHERE cc.embarque_id=p_embarque_id AND cc.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM proveedor_facturas_conceptos pfc
       JOIN proveedor_facturas pf2 ON pf2.id=pfc.proveedor_factura_id
       WHERE pfc.concepto_costo_id=cc.id AND pf2.deleted_at IS NULL AND pf2.estado<>'Cancelada');
  v_ok := (v_costos_sin_factura=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','costo_conceptos_con_factura','ok',v_ok,
    'detalle', jsonb_build_object('sin_factura', v_costos_sin_factura)));
  SELECT COUNT(*),
         COALESCE(MAX(GREATEST(0, (now()::date - efe.created_at::date))), 0)
    INTO v_ent_pendientes, v_ent_dias_max
    FROM embarque_facturas_entrantes efe
   WHERE efe.embarque_id=p_embarque_id AND efe.deleted_at IS NULL
     AND COALESCE(efe.estado,'por_capturar')='por_capturar';
  SELECT COUNT(*) INTO v_ent_total
    FROM embarque_facturas_entrantes efe
   WHERE efe.embarque_id=p_embarque_id AND efe.deleted_at IS NULL
     AND COALESCE(efe.estado,'por_capturar')<>'rechazada';
  v_ent_vacio := (v_ent_total=0 AND v_costos_sin_factura>0);
  v_ok := (v_ent_pendientes=0 AND NOT v_ent_vacio); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','facturas_entrantes_capturadas','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_ent_pendientes, 'dias_max', v_ent_dias_max,
      'buzon_vacio', v_ent_vacio, 'costos_sin_factura', v_costos_sin_factura)));
  SELECT COUNT(*), COALESCE(array_agg(nombre ORDER BY nombre), ARRAY[]::text[])
    INTO v_prov_sin_evidencia, v_prov_nombres
    FROM (
      SELECT DISTINCT COALESCE(NULLIF(cc.proveedor_nombre,''), 'Proveedor sin nombre') AS nombre
        FROM conceptos_costo cc
       WHERE cc.embarque_id=p_embarque_id AND cc.deleted_at IS NULL
         AND cc.proveedor_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM embarque_facturas_entrantes efe
            WHERE efe.embarque_id=p_embarque_id AND efe.deleted_at IS NULL
              AND efe.proveedor_id=cc.proveedor_id
              AND COALESCE(efe.estado,'por_capturar')<>'rechazada')
         AND NOT EXISTS (
           SELECT 1 FROM proveedor_facturas_conceptos pfc
           JOIN proveedor_facturas pf3 ON pf3.id=pfc.proveedor_factura_id
            WHERE pfc.concepto_costo_id=cc.id
              AND pf3.deleted_at IS NULL AND pf3.estado<>'Cancelada')
      UNION
      SELECT 'Costos sin proveedor asignado' AS nombre
       WHERE EXISTS (
         SELECT 1 FROM conceptos_costo cc2
          WHERE cc2.embarque_id=p_embarque_id AND cc2.deleted_at IS NULL
            AND cc2.proveedor_id IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM proveedor_facturas_conceptos pfc2
              JOIN proveedor_facturas pf4 ON pf4.id=pfc2.proveedor_factura_id
               WHERE pfc2.concepto_costo_id=cc2.id
                 AND pf4.deleted_at IS NULL AND pf4.estado<>'Cancelada'))
    ) faltantes;
  v_ok := (v_prov_sin_evidencia=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','facturas_entrantes_evidencia','ok',v_ok,
    'detalle', jsonb_build_object('proveedores_sin_evidencia', v_prov_sin_evidencia, 'proveedores', v_prov_nombres)));
  WITH agg AS (
    SELECT COALESCE(pf.moneda,'MXN') AS moneda, COALESCE(SUM(pf.total),0) AS total,
      COALESCE(SUM((SELECT COALESCE(SUM(public.monto_pago_en_moneda_factura(
          pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)),0)
        FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL)),0) AS pagado,
      COUNT(*) FILTER (WHERE pf.total > COALESCE((
        SELECT SUM(public.monto_pago_en_moneda_factura(
          pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text))
        FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL),0) + 0.01) AS facturas_pendientes,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL
          AND pp.moneda::text <> COALESCE(pf.moneda::text,'MXN')
          AND COALESCE(pp.tipo_cambio_usd, 0) <= 0)) AS pagos_sin_tipo_cambio
    FROM proveedor_facturas pf
    WHERE pf.embarque_id=p_embarque_id AND pf.deleted_at IS NULL AND pf.estado<>'Cancelada'
    GROUP BY COALESCE(pf.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,
      'saldo',GREATEST(total-pagado,0),'facturas_pendientes',facturas_pendientes,
      'pagos_sin_tipo_cambio',pagos_sin_tipo_cambio
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(total-pagado,0)),0)
  INTO v_cxp_por_moneda, v_cxp_saldo FROM agg;
  v_ok := NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_cxp_por_moneda) m
    WHERE (m->>'saldo')::numeric > 0.01);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('por_moneda', v_cxp_por_moneda, 'saldo_total', v_cxp_saldo)));
  -- P1 (v13.824.x): el vínculo concepto↔factura exige MISMA MONEDA
  -- (conceptos_venta.moneda ↔ facturas.moneda), porque la facturación genera una
  -- factura por moneda desde total_usd/total_mxn: una proforma mixta con la USD
  -- Emitida y la MXN Cancelada dejaba el concepto MXN sin cubrir y daba OK.
  WITH cv AS (
    SELECT cv.id, cv.estado_facturacion, cv.proforma_id,
           COALESCE(cv.moneda::text,'MXN') AS moneda
      FROM conceptos_venta cv
     WHERE cv.embarque_id=p_embarque_id AND cv.deleted_at IS NULL),
  lig AS (
    SELECT c.id AS cv_id, f.estado::text AS estado
      FROM cv c
      JOIN facturas f
        ON f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
       AND COALESCE(f.moneda::text,'MXN') = c.moneda
       AND (c.proforma_id IS NULL
            OR f.proforma_id = c.proforma_id
            OR EXISTS (SELECT 1 FROM proformas pr
                        WHERE pr.id=c.proforma_id AND pr.deleted_at IS NULL
                          AND f.id IN (pr.factura_id, pr.factura_secundaria_id))
            OR EXISTS (SELECT 1 FROM conceptos_factura cf
                        WHERE cf.factura_id=f.id AND cf.deleted_at IS NULL
                          AND cf.proforma_id_origen = c.proforma_id)))
  SELECT COUNT(*) FILTER (WHERE c.estado_facturacion='pendiente'),
         COUNT(*) FILTER (WHERE c.estado_facturacion='en_proforma'),
         COUNT(*) FILTER (WHERE c.estado_facturacion='facturado' AND (
           NOT EXISTS (SELECT 1 FROM lig l WHERE l.cv_id=c.id
                        AND l.estado IN ('Emitida','Pagada','Parcialmente pagada','Vencida'))
           OR EXISTS (SELECT 1 FROM lig l WHERE l.cv_id=c.id
                       AND l.estado NOT IN ('Emitida','Pagada','Parcialmente pagada',
                                            'Vencida','Cancelada','Sustituida'))))
    INTO v_venta_pendientes, v_venta_en_proforma, v_venta_sin_emitir
    FROM cv c;

  v_ok := (v_venta_pendientes=0 AND v_venta_en_proforma=0 AND v_venta_sin_emitir=0);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','venta_conceptos_facturados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_venta_pendientes,
      'en_proforma', v_venta_en_proforma, 'facturados_sin_emitir', v_venta_sin_emitir)));
  SELECT COUNT(*) INTO v_cxc_pagadas_sin_pago
    FROM facturas f
   WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL AND f.estado='Pagada'
     AND public.saldo_factura(f.id) > 0.01;
  WITH agg AS (
    SELECT COALESCE(f.moneda,'MXN') AS moneda, COALESCE(SUM(f.total),0) AS total,
      COALESCE(SUM(CASE WHEN f.estado='Pagada' THEN 0
                        ELSE public.saldo_factura(f.id) END),0) AS saldo,
      COALESCE(SUM((SELECT COALESCE(SUM(pf.monto_aplicado_factura),0) FROM pagos_factura pf
        WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL)),0) AS pagado,
      COALESCE(SUM((SELECT COALESCE(SUM(nc.monto),0) FROM factura_notas_credito nc
        WHERE nc.factura_id=f.id AND nc.deleted_at IS NULL AND nc.estado IN ('Timbrada','Aplicada'))),0) AS notas_credito,
      COUNT(*) FILTER (WHERE f.estado<>'Pagada' AND public.saldo_factura(f.id) > 0.01) AS facturas_pendientes
    FROM facturas f
    WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
      AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')
    GROUP BY COALESCE(f.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,'notas_credito',notas_credito,
      'saldo',GREATEST(saldo,0),'facturas_pendientes',facturas_pendientes
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(saldo,0)),0)
  INTO v_cxc_por_moneda, v_cxc_saldo FROM agg;
  v_ok := NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_cxc_por_moneda) m
    WHERE (m->>'saldo')::numeric > 0.01);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('por_moneda', v_cxc_por_moneda, 'saldo_total', v_cxc_saldo,
      'pagadas_sin_pago_registrado', v_cxc_pagadas_sin_pago)));
  SELECT COUNT(*), COALESCE(array_agg(pf.id), ARRAY[]::uuid[]) INTO v_rep_pendientes, v_rep_ids
    FROM pagos_factura pf JOIN facturas f ON f.id=pf.factura_id
   WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')
     AND pf.deleted_at IS NULL AND f.metodo_pago='PPD'
     AND COALESCE(pf.estado_rep,'Pendiente') NOT IN ('Timbrado','No aplica');
  v_ok := (v_rep_pendientes=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','rep_timbrados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_rep_pendientes, 'ids', v_rep_ids)));
  v_sin_comision := public.resolver_sin_comision(p_embarque_id);
  IF v_sin_comision THEN
    v_com_count := 0;
  ELSE
    SELECT COUNT(*) INTO v_com_count FROM comisiones_devengadas cd
     WHERE cd.embarque_id=p_embarque_id
       AND cd.estado='Devengada' AND cd.deleted_at IS NULL
       AND cd.nota IS NOT NULL;
    IF EXISTS (SELECT 1 FROM comisiones_recalculo_pendiente crp
                 JOIN pagos_factura pf2 ON pf2.id = crp.pago_factura_id
                 JOIN facturas f2 ON f2.id = pf2.factura_id
                WHERE f2.embarque_id = p_embarque_id
                  AND crp.resuelto_at IS NULL) THEN
      v_com_count := v_com_count + 1;
    END IF;
  END IF;
  v_ok := (v_com_count=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comisiones_definitivas','ok',v_ok,
    'detalle', jsonb_build_object('no_definitivas', v_com_count,
      'sin_comision', v_sin_comision)));

  BEGIN
    v_pnl := public.pnl_financiero_embarque(p_embarque_id);
    v_utilidad_mxn := COALESCE((v_pnl->>'utilidad_mxn')::numeric, 0);
    v_venta_mxn := COALESCE(
      (v_pnl->'venta'->>'real_mxn')::numeric,
      (v_pnl->>'venta_mxn')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    v_utilidad_mxn := 0; v_venta_mxn := 0;
  END;
  SELECT COALESCE((SELECT valor::numeric FROM configuracion_global
     WHERE categoria='fiscal' AND clave='pnl_margen_minimo_cierre' LIMIT 1), 0) INTO v_margen_min;
  v_margen_pct := CASE WHEN v_venta_mxn>0 THEN ROUND(v_utilidad_mxn/v_venta_mxn*100.0,2) ELSE NULL END;
  v_ok := (v_margen_pct IS NOT NULL) AND (v_margen_pct >= v_margen_min);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object(
      'utilidad_mxn', v_utilidad_mxn, 'venta_mxn', v_venta_mxn,
      'margen_pct', v_margen_pct, 'minimo_pct', v_margen_min)));
  RETURN jsonb_build_object('puede_cerrar', v_puede, 'checks', v_checks);
END $function$
;


CREATE OR REPLACE FUNCTION public._nc_cliente_recalcular_comisiones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD;
  v_contaba boolean;
  v_cuenta boolean;
BEGIN
  v_cuenta  := (NEW.estado::text IN ('Timbrada','Aplicada') AND NEW.deleted_at IS NULL);
  v_contaba := (TG_OP = 'UPDATE'
                AND OLD.estado::text IN ('Timbrada','Aplicada')
                AND OLD.deleted_at IS NULL);

  IF NOT v_cuenta AND NOT v_contaba THEN
    RETURN NEW;
  END IF;

  IF v_cuenta AND v_contaba
     AND COALESCE(OLD.monto, 0) = COALESCE(NEW.monto, 0) THEN
    RETURN NEW;
  END IF;

  FOR v_pago IN
    SELECT pf.id, pf.organization_id,
           EXISTS (
             SELECT 1 FROM public.comisiones_devengadas cd
              WHERE cd.pago_factura_id = pf.id
                AND cd.estado = 'Liquidada'
                AND cd.deleted_at IS NULL
           ) AS ya_liquidada
      FROM public.pagos_factura pf
     WHERE pf.factura_id = NEW.factura_id
       AND pf.deleted_at IS NULL
  LOOP
    IF v_pago.ya_liquidada THEN
      PERFORM public.registrar_comision_pendiente(
        v_pago.organization_id, v_pago.id, 'ajuste_nc_liquidada',
        CASE WHEN v_cuenta
          THEN 'Nota de crédito aplicada sobre comisión ya liquidada: descontar en la siguiente liquidación'
          ELSE 'Nota de crédito cancelada o en papelera sobre comisión ya liquidada: recalcular el ajuste en la siguiente liquidación'
        END,
        '', '');
    ELSE
      BEGIN
        PERFORM public.calcular_comision_pago(v_pago.id);
      EXCEPTION WHEN OTHERS THEN
        PERFORM public.registrar_comision_pendiente(
          v_pago.organization_id, v_pago.id, 'ajuste_nc',
          'No se pudo recalcular la comisión tras la nota de crédito',
          SQLSTATE, SQLERRM);
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$

;
