-- Ola 14 · Filtros estrictos de borrado logico (deleted_at) en reportes financieros y de antiguedad

CREATE OR REPLACE FUNCTION public.libro_pagos(p_desde date, p_hasta date, p_org uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid;
  v_super     boolean;
  v_pagos     jsonb := '[]'::jsonb;
BEGIN
  IF p_desde IS NULL OR p_hasta IS NULL THEN
    RAISE EXCEPTION 'LC_LIBRO_PAGOS_PARAMS: el periodo es obligatorio';
  END IF;
  IF p_hasta < p_desde THEN
    RAISE EXCEPTION 'LC_LIBRO_PAGOS_RANGO: la fecha final no puede ser anterior a la inicial';
  END IF;

  v_org := current_user_org_id();
  v_super := has_role(auth.uid(), 'super_admin');
  IF v_super THEN
    IF p_org IS NULL THEN
      RAISE EXCEPTION 'LC_ORG_REQUERIDA: selecciona una organización para ver el libro de pagos' USING ERRCODE='42501';
    END IF;
    v_org := p_org;
    v_super := false;
  ELSIF p_org IS NOT NULL AND p_org IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_ORG_AJENA: no puedes consultar el libro de pagos de otra organización' USING ERRCODE='42501';
  END IF;

  IF v_org IS NULL AND NOT v_super THEN
    RAISE EXCEPTION 'LC_LIBRO_PAGOS_SIN_ORG: no se pudo determinar tu organización';
  END IF;

  WITH cobros AS (
    SELECT
      pf.id,
      'cobro'::text                             AS tipo,
      pf.fecha_pago                             AS fecha,
      c.nombre                                  AS contraparte,
      f.cliente_id                              AS contraparte_id,
      f.id                                      AS documento_id,
      NULLIF(TRIM(COALESCE(f.serie, '') || COALESCE(f.numero::text, '')), '') AS documento_folio,
      pf.moneda::text                           AS moneda,
      COALESCE(pf.monto, 0)                     AS monto,
      COALESCE(pf.tipo_cambio, 1)               AS tipo_cambio,
      CASE WHEN pf.moneda::text = 'MXN'
           THEN COALESCE(pf.monto, 0)
           ELSE COALESCE(pf.monto, 0) * COALESCE(pf.tipo_cambio, 1) END AS monto_mxn,
      pf.forma_pago                             AS metodo_pago,
      pf.referencia,
      pf.cuenta_bancaria_id,
      pf.notas,
      pf.embarque_id,
      COALESCE(pf.diferencia_cambiaria_mxn, 0)  AS diferencia_cambiaria_mxn,
      pf.estado_rep,
      NULLIF(TRIM(COALESCE(pf.serie_rep, '') || COALESCE(pf.folio_rep::text, '')), '') AS folio_rep,
      false                                     AS es_ajuste,
      false                                     AS es_anticipo_aplicado,
      NULL::uuid                                AS lote_id,
      pf.created_by,
      pf.created_at
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id AND f.deleted_at IS NULL
    LEFT JOIN public.clientes c ON c.id = f.cliente_id
    WHERE pf.deleted_at IS NULL
      AND pf.fecha_pago BETWEEN p_desde AND p_hasta
      AND (v_super OR pf.organization_id = v_org)
  ),
  pagos AS (
    SELECT
      pp.id,
      'pago'::text                              AS tipo,
      pp.fecha_pago                             AS fecha,
      pr.nombre                                 AS contraparte,
      pfa.proveedor_id                          AS contraparte_id,
      pfa.id                                    AS documento_id,
      COALESCE(pfa.folio_interno, pfa.folio_proveedor) AS documento_folio,
      pp.moneda::text                           AS moneda,
      COALESCE(pp.monto, 0)                     AS monto,
      COALESCE(pp.tipo_cambio_usd, 1)           AS tipo_cambio,
      CASE WHEN pp.moneda::text = 'MXN'
           THEN COALESCE(pp.monto, 0)
           ELSE COALESCE(pp.monto, 0) * COALESCE(pp.tipo_cambio_usd, 1) END AS monto_mxn,
      pp.metodo_pago,
      pp.referencia,
      pp.cuenta_bancaria_id,
      pp.notas,
      pfa.embarque_id,
      COALESCE(pp.diferencia_cambiaria_mxn, 0)  AS diferencia_cambiaria_mxn,
      NULL::text                                AS estado_rep,
      NULL::text                                AS folio_rep,
      COALESCE(pp.es_ajuste, false)             AS es_ajuste,
      COALESCE(pp.es_anticipo_aplicado, false)  AS es_anticipo_aplicado,
      pp.lote_id,
      pp.created_by,
      pp.created_at
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pfa ON pfa.id = pp.proveedor_factura_id AND pfa.deleted_at IS NULL
    LEFT JOIN public.proveedores pr ON pr.id = pfa.proveedor_id
    WHERE pp.deleted_at IS NULL
      AND pp.fecha_pago BETWEEN p_desde AND p_hasta
      AND (v_super OR pp.organization_id = v_org)
  ),
  anticipos AS (
    SELECT
      ap.id,
      'anticipo'::text                          AS tipo,
      ap.fecha_anticipo                         AS fecha,
      pr.nombre                                 AS contraparte,
      ap.proveedor_id                           AS contraparte_id,
      NULL::uuid                                AS documento_id,
      NULL::text                                AS documento_folio,
      ap.moneda::text                           AS moneda,
      COALESCE(ap.monto, 0)                     AS monto,
      COALESCE(ap.tipo_cambio_usd, 1)           AS tipo_cambio,
      CASE WHEN ap.moneda::text = 'MXN'
           THEN COALESCE(ap.monto, 0)
           ELSE COALESCE(ap.monto, 0) * COALESCE(ap.tipo_cambio_usd, 1) END AS monto_mxn,
      ap.metodo_pago,
      ap.referencia,
      ap.cuenta_bancaria_id,
      ap.notas,
      ap.embarque_id,
      0::numeric                                AS diferencia_cambiaria_mxn,
      NULL::text                                AS estado_rep,
      NULL::text                                AS folio_rep,
      false                                     AS es_ajuste,
      false                                     AS es_anticipo_aplicado,
      NULL::uuid                                AS lote_id,
      ap.created_by,
      ap.created_at
    FROM public.anticipos_proveedor ap
    LEFT JOIN public.proveedores pr ON pr.id = ap.proveedor_id
    WHERE ap.deleted_at IS NULL
      AND COALESCE(ap.estado, 'Vigente') <> 'Cancelado'
      AND ap.fecha_anticipo BETWEEN p_desde AND p_hasta
      AND (v_super OR ap.organization_id = v_org)
  ),
  unidos AS (
    SELECT * FROM cobros
    UNION ALL SELECT * FROM pagos
    UNION ALL SELECT * FROM anticipos
  ),
  enriquecidos AS (
    SELECT
      u.*,
      cb.alias                                  AS cuenta_alias,
      cb.banco                                  AS cuenta_banco,
      mov.id                                    AS movimiento_id,
      (mov.id IS NOT NULL)                      AS conciliado
    FROM unidos u
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = u.cuenta_bancaria_id AND cb.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT m.id
      FROM public.bbva_movimientos m
      WHERE m.deleted_at IS NULL
        AND m.estado_conciliacion = 'Conciliado'::estado_conciliacion
        AND (
          (u.tipo = 'cobro'    AND m.pago_factura_id = u.id)
          OR (u.tipo = 'pago'  AND (m.pago_proveedor_id = u.id
                                    OR (u.lote_id IS NOT NULL AND m.pago_proveedor_lote_id = u.lote_id)))
          OR (u.tipo = 'anticipo' AND m.anticipo_proveedor_id = u.id)
        )
      LIMIT 1
    ) mov ON true
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.fecha DESC, e.created_at DESC), '[]'::jsonb)
    INTO v_pagos
  FROM enriquecidos e;

  RETURN jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'pagos', v_pagos
  );
END;
$function$;

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
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
      COALESCE((SELECT SUM(
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
                   ELSE NULL
                 END)
                FROM public.factura_notas_credito nc
                 WHERE nc.factura_id=f.id AND nc.estado='Aplicada' AND nc.deleted_at IS NULL),0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    (CURRENT_DATE - b.fecha_vencimiento)::int,
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

CREATE OR REPLACE FUNCTION public.estado_cuenta_bancario(p_cuenta_bancaria_id uuid, p_desde date, p_hasta date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cuenta      record;
  v_desde       date;
  v_saldo_ini   numeric := 0;
  v_entradas    numeric := 0;
  v_salidas     numeric := 0;
  v_previos     integer := 0;
  v_movs        jsonb   := '[]'::jsonb;
BEGIN
  IF p_cuenta_bancaria_id IS NULL OR p_desde IS NULL OR p_hasta IS NULL THEN
    RAISE EXCEPTION 'LC_ESTADO_CUENTA_PARAMS: cuenta y periodo son obligatorios';
  END IF;
  IF p_hasta < p_desde THEN
    RAISE EXCEPTION 'LC_ESTADO_CUENTA_RANGO: la fecha final no puede ser anterior a la inicial';
  END IF;

  SELECT cb.id, cb.alias, cb.banco, cb.moneda,
         COALESCE(cb.saldo_inicial, 0) AS saldo_apertura,
         cb.fecha_saldo_inicial AS corte
    INTO v_cuenta
  FROM public.cuentas_bancarias cb
  WHERE cb.id = p_cuenta_bancaria_id
    AND cb.deleted_at IS NULL
    AND (cb.organization_id = public.org_scope());

  IF v_cuenta.id IS NULL THEN
    RAISE EXCEPTION 'LC_ESTADO_CUENTA_SIN_ACCESO: la cuenta no existe o no pertenece a tu organización';
  END IF;

  -- El periodo nunca puede empezar antes del corte del saldo inicial.
  v_desde := GREATEST(p_desde, v_cuenta.corte);

  IF p_hasta < v_desde THEN
    RETURN jsonb_build_object(
      'cuenta_id', v_cuenta.id,
      'alias', v_cuenta.alias,
      'banco', v_cuenta.banco,
      'moneda', v_cuenta.moneda,
      'desde', v_desde,
      'hasta', p_hasta,
      'fecha_saldo_inicial', v_cuenta.corte,
      'saldo_inicial', v_cuenta.saldo_apertura,
      'total_entradas', 0,
      'total_salidas', 0,
      'saldo_final', v_cuenta.saldo_apertura,
      'movimientos_previos_corte', 0,
      'movimientos', '[]'::jsonb
    );
  END IF;

  -- Saldo inicial del periodo = apertura + neto entre el corte y el inicio del periodo
  SELECT v_cuenta.saldo_apertura + COALESCE(SUM(m.abono - m.cargo), 0)
    INTO v_saldo_ini
  FROM public.bbva_movimientos m
  WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
    AND m.deleted_at IS NULL
    AND m.fecha >= v_cuenta.corte
    AND m.fecha < v_desde;

  SELECT COUNT(*)
    INTO v_previos
  FROM public.bbva_movimientos m
  WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
    AND m.deleted_at IS NULL
    AND m.fecha < v_cuenta.corte;

  WITH movs AS (
    SELECT
      m.id, m.fecha, m.concepto, m.referencia,
      COALESCE(m.cargo, 0) AS cargo,
      COALESCE(m.abono, 0) AS abono,
      m.estado_conciliacion::text AS estado_conciliacion,
      m.pago_factura_id, m.pago_proveedor_id,
      m.anticipo_proveedor_id, m.pago_proveedor_lote_id,
      v_saldo_ini + SUM(COALESCE(m.abono, 0) - COALESCE(m.cargo, 0))
        OVER (ORDER BY m.fecha, m.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS saldo_corrido
    FROM public.bbva_movimientos m
    WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
      AND m.deleted_at IS NULL
      AND m.fecha >= v_desde
      AND m.fecha <= p_hasta
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(movs) ORDER BY movs.fecha, movs.id), '[]'::jsonb),
    COALESCE(SUM(movs.abono), 0),
    COALESCE(SUM(movs.cargo), 0)
  INTO v_movs, v_entradas, v_salidas
  FROM movs;

  RETURN jsonb_build_object(
    'cuenta_id',      v_cuenta.id,
    'alias',          v_cuenta.alias,
    'banco',          v_cuenta.banco,
    'moneda',         v_cuenta.moneda,
    'desde',          v_desde,
    'hasta',          p_hasta,
    'fecha_saldo_inicial', v_cuenta.corte,
    'saldo_inicial',  v_saldo_ini,
    'total_entradas', v_entradas,
    'total_salidas',  v_salidas,
    'saldo_final',    v_saldo_ini + v_entradas - v_salidas,
    'movimientos_previos_corte', v_previos,
    'movimientos',    v_movs
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.conciliacion_resumen(p_cuenta_bancaria_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_movimientos',  COUNT(*),
    'pendientes',         COUNT(*) FILTER (WHERE m.estado_conciliacion = 'Pendiente'),
    'conciliados',        COUNT(*) FILTER (WHERE m.estado_conciliacion = 'Conciliado'),
    'ignorados',          COUNT(*) FILTER (WHERE m.estado_conciliacion = 'Ignorado'),
    'cargos_pendientes',  COALESCE(SUM(m.cargo) FILTER (WHERE m.estado_conciliacion = 'Pendiente'), 0),
    'abonos_pendientes',  COALESCE(SUM(m.abono) FILTER (WHERE m.estado_conciliacion = 'Pendiente'), 0)
  ) INTO v_result
  FROM public.bbva_movimientos m
  JOIN public.cuentas_bancarias cb ON cb.id = m.cuenta_bancaria_id AND cb.deleted_at IS NULL
  WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
    AND m.deleted_at IS NULL
    AND m.fecha >= cb.fecha_saldo_inicial
    AND (m.organization_id = public.org_scope());
  RETURN v_result;
END;
$function$;

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
    SELECT id, proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           coalesce(NULLIF(total,0), subtotal, 0)::numeric AS total,
           -- Base gravable (sin IVA): subtotal si existe; si no, total menos
           -- impuestos capturados. Nunca negativa.
           GREATEST(
             coalesce(
               NULLIF(subtotal,0),
               coalesce(NULLIF(total,0),0) - coalesce(iva,0) + coalesce(retenciones,0),
               0
             )::numeric, 0)::numeric AS base_gravable,
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
    -- Costo real = base gravable menos notas de crédito prorrateadas a esa base.
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado,
           pf.base_gravable
             - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0)
               * CASE WHEN pf.total > 0 THEN pf.base_gravable / pf.total ELSE 1 END AS monto
    FROM pf
  ),
  pf_saldo AS (
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
    'por_concepto', (
      SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY (x.presupuestada_mxn + x.real_mxn) DESC), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup),0) AS presupuestada_mxn,
               coalesce(sum(real),0) AS real_mxn
        FROM (
          SELECT concepto,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup,
                 0::numeric AS real FROM cv
          UNION ALL
          SELECT lower(trim(coalesce(NULLIF(fc.descripcion,''), '(sin concepto)'))),
                 0::numeric,
                 public.convertir_a_mxn(coalesce(fc.total,0), f.moneda, _tc_usd, _tc_eur)
          FROM public.conceptos_factura fc
          JOIN f ON f.id = fc.factura_id
          WHERE fc.deleted_at IS NULL
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
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup,
                 0::numeric AS real FROM cc
          UNION ALL
          SELECT lower(trim(coalesce(NULLIF(pfc.descripcion,''), '(sin concepto)'))),
                 0::numeric,
                 public.convertir_a_mxn(coalesce(pfc.monto, 0), pf.moneda, _tc_usd, _tc_eur)
          FROM public.proveedor_facturas_conceptos pfc
          JOIN pf ON pf.id = pfc.proveedor_factura_id
          UNION ALL
          SELECT '(factura completa)'::text,
                 0::numeric,
                 public.convertir_a_mxn(pf_neto.monto, pf_neto.moneda, _tc_usd, _tc_eur)
          FROM pf_neto
          WHERE NOT EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos pfc
                              WHERE pfc.proveedor_factura_id = pf_neto.id)
          UNION ALL
          SELECT concepto, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)
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
$function$;

CREATE OR REPLACE FUNCTION public.proveedor_estado_cuenta(p_proveedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_partidas jsonb;
  v_huerfanas jsonb;
  v_usd numeric;
  v_eur numeric;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur FROM public.tc_dof_vigente(CURRENT_DATE) t;

  WITH cc AS (
    SELECT c.id, c.concepto, c.monto, c.moneda::text AS moneda,
           c.estado_liquidacion::text AS estado_liquidacion,
           c.fecha_vencimiento, c.created_at,
           e.id AS embarque_id, e.expediente, e.cliente_nombre
    FROM public.conceptos_costo c
    LEFT JOIN public.embarques e ON e.id = c.embarque_id AND e.deleted_at IS NULL
    WHERE c.proveedor_id = p_proveedor_id
      AND c.organization_id = v_oid
      AND c.deleted_at IS NULL
  ),
  pfc_conv AS (
    SELECT pfc.concepto_costo_id,
           pfc.monto,
           pf.id AS factura_id, pf.folio_interno, pf.folio_proveedor,
           pf.estado::text AS estado, pf.estado_aprobacion::text AS estado_aprobacion,
           pf.fecha_emision, pf.fecha_vencimiento, pf.moneda::text AS moneda,
           pf.total,
           cc2.moneda::text AS moneda_concepto,
           CASE pf.moneda::text
             WHEN 'MXN' THEN 1::numeric
             WHEN 'USD' THEN COALESCE(NULLIF(pf.tipo_cambio_usd, 0), v_usd)
             WHEN 'EUR' THEN v_eur
             ELSE NULL
           END AS tc_factura,
           CASE cc2.moneda::text
             WHEN 'MXN' THEN 1::numeric
             WHEN 'USD' THEN v_usd
             WHEN 'EUR' THEN v_eur
             ELSE NULL
           END AS tc_concepto
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    JOIN public.conceptos_costo cc2
      ON cc2.id = pfc.concepto_costo_id AND cc2.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  fact AS (
    SELECT c.concepto_costo_id,
           SUM(CASE
                 WHEN c.moneda = c.moneda_concepto THEN c.monto
                 WHEN c.tc_factura IS NOT NULL AND c.tc_concepto IS NOT NULL
                      AND c.tc_concepto > 0
                   THEN c.monto * c.tc_factura / c.tc_concepto
                 ELSE NULL
               END) AS monto_facturado,
           COALESCE(bool_or(
             c.moneda <> c.moneda_concepto
             AND (c.tc_factura IS NULL OR c.tc_concepto IS NULL OR c.tc_concepto <= 0)
           ), false) AS moneda_mixta_sin_tc,
           SUM(CASE
                 WHEN c.moneda <> c.moneda_concepto
                      AND (c.tc_factura IS NULL OR c.tc_concepto IS NULL OR c.tc_concepto <= 0)
                 THEN c.monto
               END) AS monto_sin_tc,
           jsonb_agg(DISTINCT jsonb_build_object(
             'factura_id', c.factura_id,
             'folio_interno', c.folio_interno,
             'folio_proveedor', c.folio_proveedor,
             'estado', c.estado,
             'estado_aprobacion', c.estado_aprobacion,
             'fecha_emision', c.fecha_emision,
             'fecha_vencimiento', c.fecha_vencimiento,
             'moneda', c.moneda,
             'total', c.total
           )) AS facturas
    FROM pfc_conv c
    GROUP BY c.concepto_costo_id
  ),
  pagos_por_factura AS (
    -- Ola 12 · R3P-01: pagos convertidos a la moneda de la factura con el TC
    -- del pago; los cross-moneda sin TC quedan fuera (SUM ignora NULL).
    SELECT pp.proveedor_factura_id,
           SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)) AS pagado
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND pp.deleted_at IS NULL
    GROUP BY pp.proveedor_factura_id
  ),
  pag AS (
    SELECT pfc.concepto_costo_id,
           SUM(
             COALESCE(ppf.pagado, 0)
             * CASE
                 WHEN COALESCE(pf.subtotal, 0) > 0
                   THEN LEAST(COALESCE(pfc.monto, 0) / pf.subtotal, 1)
                 WHEN COALESCE(pf.total, 0) > 0
                   THEN LEAST(COALESCE(pfc.monto, 0) / pf.total, 1)
                 ELSE 0
               END
           ) AS pagado_factura
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    LEFT JOIN pagos_por_factura ppf ON ppf.proveedor_factura_id = pf.id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
    GROUP BY pfc.concepto_costo_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_partidas
  FROM (
    SELECT cc.id AS concepto_costo_id,
           cc.embarque_id, COALESCE(cc.expediente,'') AS expediente,
           COALESCE(cc.cliente_nombre,'') AS cliente_nombre,
           cc.concepto, cc.monto AS comprometido, cc.moneda,
           cc.estado_liquidacion, cc.fecha_vencimiento, cc.created_at,
           COALESCE(f.monto_facturado, 0) AS facturado,
           COALESCE(f.facturas, '[]'::jsonb) AS facturas,
           ROUND(COALESCE(p.pagado_factura, 0), 2) AS pagado,
           CASE
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado'
               THEN 0::numeric
             ELSE GREATEST(cc.monto - COALESCE(f.monto_facturado,0), 0)
           END AS por_facturar,
           COALESCE(f.moneda_mixta_sin_tc, false) AS moneda_mixta_sin_tc,
           ROUND(COALESCE(f.monto_sin_tc, 0), 2) AS monto_sin_tc,
           CASE
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado' THEN 'Pagado'
             WHEN COALESCE(f.moneda_mixta_sin_tc, false) THEN 'Moneda mixta'
             WHEN COALESCE(f.monto_facturado,0) <= 0 THEN 'Por facturar'
             WHEN COALESCE(f.monto_facturado,0) > cc.monto * 1.01 THEN 'Sobrefacturado'
             WHEN COALESCE(f.monto_facturado,0) < cc.monto * 0.99 THEN 'Facturado parcial'
             WHEN cc.estado_liquidacion = 'Pagado' THEN 'Pagado'
             ELSE 'Facturado'
           END AS estado_conciliacion
    FROM cc
    LEFT JOIN fact f ON f.concepto_costo_id = cc.id
    LEFT JOIN pag p ON p.concepto_costo_id = cc.id
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(h) ORDER BY h.fecha_emision DESC), '[]'::jsonb)
  INTO v_huerfanas
  FROM (
    SELECT pf.id AS factura_id, pf.folio_interno, pf.folio_proveedor,
           pf.fecha_emision, pf.moneda::text AS moneda,
           SUM(pfc.monto) AS monto_sin_vincular,
           COUNT(*) AS partidas
    FROM public.proveedor_facturas pf
    JOIN public.proveedor_facturas_conceptos pfc ON pfc.proveedor_factura_id = pf.id
    LEFT JOIN public.conceptos_costo cc
      ON cc.id = pfc.concepto_costo_id AND cc.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND cc.id IS NULL
    GROUP BY pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_emision, pf.moneda
  ) h;

  RETURN jsonb_build_object(
    'partidas', v_partidas,
    'facturas_huerfanas', v_huerfanas
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.proveedor_estado_cuenta_movimientos(p_proveedor_id uuid, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date, p_limite integer DEFAULT 1000, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_todos jsonb;
  v_movs_full jsonb;
  v_movs jsonb;
  v_apertura jsonb;
  v_aging jsonb;
  v_saldos jsonb;
  v_total integer;
  v_offset_efectivo integer;
  v_desde date := COALESCE(p_desde, '1900-01-01'::date);
  v_hasta date := COALESCE(p_hasta, '2999-12-31'::date);
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 1000), 1), 5000);
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  WITH facturas AS (
    SELECT pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_emision,
           pf.fecha_vencimiento, pf.moneda::text AS moneda, pf.total,
           pf.estado::text AS estado, pf.embarque_id, e.expediente
    FROM public.proveedor_facturas pf
    LEFT JOIN public.embarques e ON e.id = pf.embarque_id AND e.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  notas AS (
    -- R3P-08: sólo NC aplicadas descuentan el estado de cuenta (regla única).
    SELECT nc.id, nc.folio_nc, nc.fecha, nc.monto, nc.moneda::text AS moneda,
           nc.proveedor_factura_id, f.folio_interno, f.expediente, f.embarque_id
    FROM public.proveedor_notas_credito nc
    JOIN facturas f ON f.id = nc.proveedor_factura_id
    WHERE nc.organization_id = v_oid
      AND nc.deleted_at IS NULL
      AND nc.estado = 'Aplicada'
  ),
  pagos AS (
    -- Ola 12 · R3P-06: el abono se convierte a la moneda de la factura; NULL = sin TC.
    SELECT pp.id, pp.fecha_pago,
           pp.monto AS monto_pago, pp.moneda::text AS moneda_pago,
           public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, f.moneda) AS monto_factura,
           f.moneda AS moneda_factura,
           pp.referencia, pp.metodo_pago, pp.es_anticipo_aplicado,
           pp.proveedor_factura_id, f.folio_interno, f.expediente, f.embarque_id
    FROM public.pagos_proveedor pp
    JOIN facturas f ON f.id = pp.proveedor_factura_id
    WHERE pp.organization_id = v_oid
      AND pp.deleted_at IS NULL
  ),
  anticipos AS (
    SELECT a.id, a.fecha_anticipo, a.monto, a.moneda::text AS moneda,
           a.referencia, a.metodo_pago, a.embarque_id, e.expediente
    FROM public.anticipos_proveedor a
    LEFT JOIN public.embarques e ON e.id = a.embarque_id AND e.deleted_at IS NULL
    WHERE a.proveedor_id = p_proveedor_id
      AND a.organization_id = v_oid
      AND a.deleted_at IS NULL
      AND a.estado <> 'Cancelado'
  ),
  movs AS (
    SELECT f.fecha_emision AS fecha, 'Factura'::text AS tipo, f.id AS ref_id,
           COALESCE(f.folio_interno, f.folio_proveedor, 'Sin folio') AS folio,
           f.folio_proveedor AS referencia, COALESCE(f.expediente, '') AS expediente,
           f.embarque_id, f.moneda, COALESCE(f.total, 0) AS cargo, 0::numeric AS abono,
           f.estado AS detalle
    FROM facturas f
    UNION ALL
    SELECT n.fecha, 'Nota de crédito', n.id,
           COALESCE(n.folio_nc, 'NC'), n.folio_interno, COALESCE(n.expediente, ''),
           n.embarque_id, n.moneda, 0::numeric, COALESCE(n.monto, 0), NULL::text
    FROM notas n
    UNION ALL
    SELECT p.fecha_pago,
           CASE WHEN p.es_anticipo_aplicado THEN 'Anticipo aplicado' ELSE 'Pago' END,
           p.id, COALESCE(p.folio_interno, 'Pago'), p.referencia,
           COALESCE(p.expediente, ''), p.embarque_id,
           -- R3P-06: el abono se expresa en la moneda del cargo (factura).
           p.moneda_factura AS moneda,
           0::numeric,
           -- R3P-07: la aplicación de un anticipo es informativa (0/0); el
           -- abono ya se contó en la fila "Anticipo" al entregarlo.
           CASE WHEN p.es_anticipo_aplicado THEN 0::numeric ELSE COALESCE(p.monto_factura, 0) END,
           CASE
             WHEN p.es_anticipo_aplicado
               THEN COALESCE(p.metodo_pago, '') || ' · anticipo ya contado al entregarse'
             WHEN p.moneda_pago <> p.moneda_factura AND p.monto_factura IS NULL
               THEN COALESCE(p.metodo_pago, '') || ' · pagado en ' || p.moneda_pago || ' SIN TC (excluido del saldo)'
             WHEN p.moneda_pago <> p.moneda_factura
               THEN COALESCE(p.metodo_pago, '') || ' · pagado en ' || p.moneda_pago
             ELSE p.metodo_pago
           END
    FROM pagos p
    UNION ALL
    SELECT a.fecha_anticipo, 'Anticipo', a.id, 'Anticipo', a.referencia,
           COALESCE(a.expediente, ''), a.embarque_id, a.moneda,
           -- R3P-07: el anticipo entregado ES un abono (dinero al proveedor).
           0::numeric, COALESCE(a.monto, 0), a.metodo_pago
    FROM anticipos a
  )
  SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.fecha, m.tipo, m.folio), '[]'::jsonb)
  INTO v_todos
  FROM movs m;

  SELECT COALESCE(jsonb_agg(m ORDER BY m->>'fecha', m->>'tipo', m->>'folio'), '[]'::jsonb)
  INTO v_movs_full
  FROM jsonb_array_elements(v_todos) m
  WHERE (m->>'fecha')::date BETWEEN v_desde AND v_hasta;

  v_total := COALESCE(jsonb_array_length(v_movs_full), 0);
  v_offset_efectivo := GREATEST(v_total - v_limite, 0) + GREATEST(COALESCE(p_offset, 0), 0);

  SELECT COALESCE(jsonb_agg(pag.value ORDER BY pag.ord), '[]'::jsonb)
  INTO v_movs
  FROM (
    SELECT t.value, t.ord
    FROM jsonb_array_elements(v_movs_full) WITH ORDINALITY AS t(value, ord)
    ORDER BY t.ord
    OFFSET v_offset_efectivo
    LIMIT v_limite
  ) pag;

  SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.moneda), '[]'::jsonb)
  INTO v_apertura
  FROM (
    SELECT m->>'moneda' AS moneda,
           SUM((m->>'cargo')::numeric) - SUM((m->>'abono')::numeric) AS saldo
    FROM jsonb_array_elements(v_todos) m
    WHERE (m->>'fecha')::date < v_desde
      AND m->>'moneda' IS NOT NULL
    GROUP BY m->>'moneda'
  ) a;

  WITH facturas AS (
    SELECT pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_vencimiento,
           pf.moneda::text AS moneda, COALESCE(pf.total, 0) AS total,
           pf.estado::text AS estado
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  saldo_factura AS (
    SELECT f.id, f.moneda, f.fecha_vencimiento,
           -- Ola 12 · R3BD-04: factura marcada 'Pagada' (legacy, sin pagos
           -- capturados) => saldo 0. Misma regla que proveedor_inteligencia.
           CASE WHEN f.estado = 'Pagada' THEN 0::numeric
                ELSE f.total
                  -- R3P-06: pagos convertidos a la moneda de la factura.
                  - COALESCE((SELECT SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, f.moneda))
                              FROM public.pagos_proveedor pp
                              WHERE pp.proveedor_factura_id = f.id AND pp.deleted_at IS NULL), 0)
                  -- R3P-08: sólo NC 'Aplicada' (regla única del módulo).
                  - COALESCE((SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
                              WHERE nc.proveedor_factura_id = f.id AND nc.deleted_at IS NULL
                                AND nc.estado = 'Aplicada'), 0)
           END AS saldo
    FROM facturas f
  ),
  clasificado AS (
    SELECT s.moneda, s.saldo,
           CASE
             WHEN s.fecha_vencimiento IS NULL OR s.fecha_vencimiento >= v_hoy_mx THEN 'Vigente'
             WHEN v_hoy_mx - s.fecha_vencimiento <= 30 THEN '1-30'
             WHEN v_hoy_mx - s.fecha_vencimiento <= 60 THEN '31-60'
             WHEN v_hoy_mx - s.fecha_vencimiento <= 90 THEN '61-90'
             ELSE '90+'
           END AS bucket
    FROM saldo_factura s
    WHERE s.saldo > 0.01
  )
  SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.moneda, a.bucket), '[]'::jsonb)
  INTO v_aging
  FROM (
    SELECT c.moneda, c.bucket, SUM(c.saldo) AS saldo, COUNT(*) AS conteo
    FROM clasificado c
    GROUP BY c.moneda, c.bucket
  ) a;

  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.moneda), '[]'::jsonb)
  INTO v_saldos
  FROM (
    SELECT m->>'moneda' AS moneda,
           SUM((m->>'cargo')::numeric) AS cargos,
           SUM((m->>'abono')::numeric) AS abonos,
           SUM((m->>'cargo')::numeric) - SUM((m->>'abono')::numeric) AS saldo
    FROM jsonb_array_elements(v_todos) m
    WHERE m->>'moneda' IS NOT NULL
    GROUP BY m->>'moneda'
  ) s;

  RETURN jsonb_build_object(
    'movimientos', v_movs,
    'saldo_apertura', v_apertura,
    'aging', v_aging,
    'saldos', v_saldos,
    'total_movimientos', v_total,
    'hay_mas', v_offset_efectivo > 0 OR (v_offset_efectivo + v_limite) < v_total
  );
END;
$function$;

-- Vistas: mismo criterio estricto de borrado logico.

CREATE OR REPLACE VIEW public.v_pagos_rep_pendientes
WITH (security_invoker = on) AS
 SELECT pf.id AS pago_id,
    pf.factura_id,
    pf.organization_id,
    pf.fecha_pago,
    pf.monto_aplicado_factura,
    pf.moneda,
    pf.tipo_cambio,
    f.numero AS factura_numero,
    f.serie AS factura_serie,
    f.uuid_fiscal AS factura_uuid,
    f.cliente_id,
    f.embarque_id,
    (date_trunc('month'::text, pf.fecha_pago::timestamp with time zone) + '1 mon'::interval + '4 days'::interval)::date AS fecha_limite_rep,
    (date_trunc('month'::text, pf.fecha_pago::timestamp with time zone) + '1 mon'::interval + '4 days'::interval)::date - CURRENT_DATE AS dias_restantes
   FROM pagos_factura pf
     JOIN facturas f ON f.id = pf.factura_id AND f.deleted_at IS NULL
  WHERE pf.estado_rep = 'Pendiente'::text AND pf.deleted_at IS NULL AND f.metodo_pago = 'PPD'::text;

CREATE OR REPLACE VIEW public.v_proforma_factura_link
WITH (security_invoker = on) AS
 SELECT p.id AS proforma_id,
    p.numero AS proforma_numero,
    p.organization_id,
    p.cliente_id,
    p.estado_proforma,
    p.estado_revision,
    p.factura_id,
    f.numero AS factura_numero,
    f.estado AS factura_estado,
    f.uuid_fiscal,
    f.timbrado_en,
    p.es_consolidada,
    p.proformas_origen
   FROM proformas p
     LEFT JOIN facturas f ON f.id = p.factura_id AND f.deleted_at IS NULL
  WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_saldos_cuentas_bancarias
WITH (security_invoker = on) AS
 SELECT m.cuenta_bancaria_id,
    COALESCE(sum(m.abono), 0::numeric) AS total_abonos,
    COALESCE(sum(m.cargo), 0::numeric) AS total_cargos
   FROM bbva_movimientos m
     JOIN cuentas_bancarias cb ON cb.id = m.cuenta_bancaria_id AND cb.deleted_at IS NULL
  WHERE m.deleted_at IS NULL AND m.fecha >= cb.fecha_saldo_inicial
  GROUP BY m.cuenta_bancaria_id;