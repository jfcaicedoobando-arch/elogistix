-- Auditoría86/94/98/99/100: lecturas financieras; sin backfill ni cambios de permisos.

-- Espejo canónico de public.estado_cuenta_bancario.
-- Base: definición vigente extraída de supabase/schema/baseline.sql.
-- Auditoría 86: no atribuir saldos futuros a periodos sin cobertura histórica.
-- La migración posterior aplica este cuerpo; firma, ámbito y grants se conservan.

CREATE OR REPLACE FUNCTION public.estado_cuenta_bancario(p_cuenta_bancaria_id uuid, p_desde date, p_hasta date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
      'desde', p_desde,
      'desde_solicitado', p_desde,
      'cobertura_historica', 'sin_cobertura',
      'hasta', p_hasta,
      'fecha_saldo_inicial', v_cuenta.corte,
      -- No se conoce el saldo anterior al arranque: NULL no significa cero.
      'saldo_inicial', NULL::numeric,
      'total_entradas', NULL::numeric,
      'total_salidas', NULL::numeric,
      'saldo_final', NULL::numeric,
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
    'desde_solicitado', p_desde,
    'cobertura_historica', CASE WHEN p_desde < v_cuenta.corte THEN 'parcial' ELSE 'completa' END,
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
$$;

REVOKE ALL ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) TO service_role;


-- Auditoría94,99,100: folio canónico, efectivo sin conciliación y devolución explícita.
CREATE OR REPLACE FUNCTION public.libro_pagos(p_desde date, p_hasta date, p_org uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
      CASE WHEN NULLIF(TRIM(f.serie), '') IS NULL OR LEFT(TRIM(COALESCE(f.numero::text, '')), LENGTH(TRIM(f.serie))) = TRIM(f.serie) THEN NULLIF(TRIM(f.numero::text), '') ELSE NULLIF(TRIM(f.serie) || TRIM(COALESCE(f.numero::text, '')), '') END AS documento_folio,
      pf.moneda::text                           AS moneda,
      COALESCE(pf.monto, 0)                     AS monto,
      NULLIF(pf.tipo_cambio, 0)                 AS tipo_cambio,
      CASE WHEN pf.moneda::text = 'MXN' THEN COALESCE(pf.monto, 0)
           WHEN COALESCE(pf.tipo_cambio, 0) > 0 THEN COALESCE(pf.monto, 0) * pf.tipo_cambio
           ELSE NULL END                        AS monto_mxn,
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
      pf.lote_id,
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
      NULLIF(pp.tipo_cambio_usd, 0)             AS tipo_cambio,
      CASE WHEN pp.moneda::text = 'MXN' THEN COALESCE(pp.monto, 0)
           WHEN COALESCE(pp.tipo_cambio_usd, 0) > 0 THEN COALESCE(pp.monto, 0) * pp.tipo_cambio_usd
           ELSE NULL END                        AS monto_mxn,
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
      NULLIF(ap.tipo_cambio_usd, 0)             AS tipo_cambio,
      CASE WHEN ap.moneda::text = 'MXN' THEN COALESCE(ap.monto, 0)
           WHEN COALESCE(ap.tipo_cambio_usd, 0) > 0 THEN COALESCE(ap.monto, 0) * ap.tipo_cambio_usd
           ELSE NULL END                        AS monto_mxn,
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
      AND lower(COALESCE(ap.estado, 'vigente')) <> 'cancelado'
      AND ap.fecha_anticipo BETWEEN p_desde AND p_hasta
      AND (v_super OR ap.organization_id = v_org)
  ),
  devoluciones AS (
    -- AUD100: cada devolución es una entrada independiente. La salida original
    -- se conserva bruta; la fecha/cuenta/referencia proceden del asiento real.
    SELECT ap.id, 'devolucion_anticipo'::text AS tipo,
      COALESCE(d.fecha, (ap.devuelto_at AT TIME ZONE 'America/Mexico_City')::date) AS fecha,
      pr.nombre AS contraparte, ap.proveedor_id AS contraparte_id,
      NULL::uuid AS documento_id, NULL::text AS documento_folio,
      ap.moneda::text AS moneda, ap.monto_devuelto AS monto,
      NULLIF(ap.tipo_cambio_usd, 0) AS tipo_cambio,
      CASE WHEN ap.moneda::text = 'MXN' THEN ap.monto_devuelto
           WHEN ap.tipo_cambio_usd > 0 THEN ap.monto_devuelto * ap.tipo_cambio_usd
           ELSE NULL END AS monto_mxn,
      CASE WHEN d.id IS NOT NULL THEN 'Devolución bancaria' ELSE NULL END AS metodo_pago,
      COALESCE(d.referencia, ap.referencia) AS referencia,
      d.cuenta_bancaria_id,
      concat_ws(' · ', NULLIF(ap.motivo_devolucion, ''),
        CASE WHEN d.id IS NULL THEN 'Sin fecha bancaria de devolución; fecha de registro como referencia' END,
        CASE WHEN ap.moneda::text <> 'MXN' THEN 'Equivalente MXN al TC registrado del anticipo original' END) AS notas,
      ap.embarque_id, 0::numeric AS diferencia_cambiaria_mxn,
      NULL::text AS estado_rep, NULL::text AS folio_rep,
      false AS es_ajuste, false AS es_anticipo_aplicado, NULL::uuid AS lote_id,
      ap.devuelto_by AS created_by, ap.devuelto_at AS created_at
    FROM public.anticipos_proveedor ap
    LEFT JOIN public.proveedores pr ON pr.id = ap.proveedor_id
    LEFT JOIN LATERAL (
      SELECT m.id, m.fecha, m.referencia, m.cuenta_bancaria_id
      FROM public.bbva_movimientos m
      WHERE m.anticipo_proveedor_id = ap.id
        AND m.organization_id = ap.organization_id AND m.deleted_at IS NULL
        AND m.hash_dedupe = 'devolucion-' || ap.id::text AND m.abono > 0
      ORDER BY m.fecha, m.id LIMIT 1
    ) d ON true
    WHERE ap.deleted_at IS NULL AND lower(COALESCE(ap.estado, 'vigente')) <> 'cancelado'
      AND ap.monto_devuelto > 0 AND (v_super OR ap.organization_id = v_org)
      AND COALESCE(d.fecha, (ap.devuelto_at AT TIME ZONE 'America/Mexico_City')::date)
          BETWEEN p_desde AND p_hasta
  ),
  unidos AS (
    SELECT * FROM cobros
    UNION ALL SELECT * FROM pagos
    UNION ALL SELECT * FROM anticipos
    UNION ALL SELECT * FROM devoluciones
  ),
  enriquecidos AS (
    SELECT
      u.*,
      cb.alias                                  AS cuenta_alias,
      cb.banco                                  AS cuenta_banco,
      mov.id                                    AS movimiento_id,
      (mov.id IS NOT NULL)                      AS conciliado,
      CASE WHEN mov.id IS NOT NULL THEN 'Conciliado'
           WHEN u.cuenta_bancaria_id IS NULL AND lower(trim(COALESCE(u.metodo_pago, ''))) IN ('efectivo', '01')
             THEN 'No aplica' ELSE 'Pendiente' END AS estado_conciliacion
    FROM unidos u
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = u.cuenta_bancaria_id AND cb.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT m.id
      FROM public.bbva_movimientos m
      WHERE m.deleted_at IS NULL AND m.organization_id = v_org
        AND m.estado_conciliacion = 'Conciliado'::estado_conciliacion
        AND (
          (u.tipo = 'cobro'    AND (m.pago_factura_id = u.id
                                    OR (u.lote_id IS NOT NULL AND m.pago_factura_lote_id = u.lote_id)))
          OR (u.tipo = 'pago'  AND (m.pago_proveedor_id = u.id
                                    OR (u.lote_id IS NOT NULL AND m.pago_proveedor_lote_id = u.lote_id)))
          OR (u.tipo = 'anticipo' AND m.anticipo_proveedor_id = u.id AND m.cargo > 0)
          OR (u.tipo = 'devolucion_anticipo' AND m.anticipo_proveedor_id = u.id
              AND m.hash_dedupe = 'devolucion-' || u.id::text AND m.abono > 0)
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
$$;
REVOKE ALL ON FUNCTION public.libro_pagos(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.libro_pagos(date, date, uuid) TO authenticated, service_role;


-- MNY-P2.3 — sin T/C registrado ya no se inventa 1: `tipo_cambio` y
-- `monto_mxn` viajan como NULL (desconocido). Los pagos en pesos no cambian.
--
-- MNY-01 (v13.823.399) — `pago_detalle` acepta el tipo 'lote_cobro'.
--
-- `registrar_pago_cliente_lote` conecta el depósito con `bbva_movimientos
-- .pago_factura_lote_id`, pero la función sólo resolvía lotes de proveedor.
-- Un depósito conciliado que cubría varias facturas de cliente no podía abrir
-- su detalle desde la conciliación bancaria. Se agrega la rama del lote de
-- cobros (encabezado, movimiento y facturas aplicadas). Sin cambios de RLS:
-- la validación de organización sigue siendo la misma.

CREATE OR REPLACE FUNCTION public.pago_detalle(p_tipo text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org         uuid;
  v_super       boolean;
  v_pago        jsonb := NULL;
  v_mov         jsonb := NULL;
  v_aplic       jsonb := '[]'::jsonb;
  v_org_pago    uuid;
  v_lote        uuid := NULL;
  v_tipo        text;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_PARAMS: falta el identificador del pago';
  END IF;

  v_tipo := lower(coalesce(p_tipo, ''));
  IF v_tipo NOT IN ('cobro','pago','anticipo','devolucion_anticipo','lote','lote_cobro') THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_TIPO: tipo de pago no soportado (%)', p_tipo;
  END IF;

  v_org := current_user_org_id();
  v_super := has_role(auth.uid(), 'super_admin');
  IF v_org IS NULL AND NOT v_super THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_SIN_ORG: no se pudo determinar tu organización';
  END IF;

  IF v_tipo = 'cobro' THEN
    SELECT pf.organization_id,
           jsonb_build_object(
             'id', pf.id, 'tipo', 'cobro', 'fecha', pf.fecha_pago,
             'contraparte', c.nombre, 'contraparte_id', f.cliente_id,
             'moneda', pf.moneda::text, 'monto', COALESCE(pf.monto,0),
             'tipo_cambio', NULLIF(pf.tipo_cambio,0),
             'monto_mxn', CASE WHEN pf.moneda::text='MXN' THEN COALESCE(pf.monto,0)
                               WHEN COALESCE(pf.tipo_cambio,0) > 0 THEN COALESCE(pf.monto,0)*pf.tipo_cambio
                               ELSE NULL END,
             'metodo_pago', pf.forma_pago, 'referencia', pf.referencia,
             'cuenta_bancaria_id', pf.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', pf.notas, 'embarque_id', pf.embarque_id,
             'diferencia_cambiaria_mxn', COALESCE(pf.diferencia_cambiaria_mxn,0),
             'estado_rep', pf.estado_rep,
             'folio_rep', NULLIF(TRIM(COALESCE(pf.serie_rep,'')||COALESCE(pf.folio_rep::text,'')),''),
             'es_ajuste', false, 'lote_id', NULL::uuid,
             'created_by', pf.created_by, 'created_at', pf.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id
    LEFT JOIN public.clientes c ON c.id = f.cliente_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = pf.cuenta_bancaria_id
    WHERE pf.id = p_id AND pf.deleted_at IS NULL;

  ELSIF v_tipo = 'pago' THEN
    SELECT pp.organization_id, pp.lote_id,
           jsonb_build_object(
             'id', pp.id, 'tipo', 'pago', 'fecha', pp.fecha_pago,
             'contraparte', pr.nombre, 'contraparte_id', pfa.proveedor_id,
             'moneda', pp.moneda::text, 'monto', COALESCE(pp.monto,0),
             'tipo_cambio', NULLIF(pp.tipo_cambio_usd,0),
             'monto_mxn', CASE WHEN pp.moneda::text='MXN' THEN COALESCE(pp.monto,0)
                               WHEN COALESCE(pp.tipo_cambio_usd,0) > 0 THEN COALESCE(pp.monto,0)*pp.tipo_cambio_usd
                               ELSE NULL END,
             'metodo_pago', pp.metodo_pago, 'referencia', pp.referencia,
             'cuenta_bancaria_id', pp.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', pp.notas, 'embarque_id', pfa.embarque_id,
             'diferencia_cambiaria_mxn', COALESCE(pp.diferencia_cambiaria_mxn,0),
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', COALESCE(pp.es_ajuste,false), 'lote_id', pp.lote_id,
             'created_by', pp.created_by, 'created_at', pp.created_at
           )
      INTO v_org_pago, v_lote, v_pago
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pfa ON pfa.id = pp.proveedor_factura_id
    LEFT JOIN public.proveedores pr ON pr.id = pfa.proveedor_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = pp.cuenta_bancaria_id
    WHERE pp.id = p_id AND pp.deleted_at IS NULL;

  ELSIF v_tipo = 'lote' THEN
    v_lote := p_id;
    SELECT l.organization_id,
           jsonb_build_object(
             'id', l.id, 'tipo', 'lote', 'fecha', l.fecha_pago,
             'contraparte', pr.nombre, 'contraparte_id', l.proveedor_id,
             'moneda', l.moneda::text, 'monto', COALESCE(l.monto_total,0),
             'tipo_cambio', NULLIF(l.tipo_cambio_usd,0),
             'monto_mxn', CASE WHEN l.moneda::text='MXN' THEN COALESCE(l.monto_total,0)
                               WHEN COALESCE(l.tipo_cambio_usd,0) > 0 THEN COALESCE(l.monto_total,0)*l.tipo_cambio_usd
                               ELSE NULL END,
             'metodo_pago', l.metodo_pago, 'referencia', l.referencia,
             'cuenta_bancaria_id', l.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', l.notas, 'embarque_id', NULL::uuid,
             'diferencia_cambiaria_mxn', 0::numeric,
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', false, 'lote_id', l.id,
             'created_by', l.created_by, 'created_at', l.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.pagos_proveedor_lote l
    LEFT JOIN public.proveedores pr ON pr.id = l.proveedor_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = l.cuenta_bancaria_id
    WHERE l.id = p_id AND l.deleted_at IS NULL;

  ELSIF v_tipo = 'lote_cobro' THEN
    -- MNY-01: un depósito que cubre varias facturas de cliente se registra en
    -- `pagos_factura_lote` y el movimiento bancario guarda `pago_factura_lote_id`.
    -- Sin esta rama, el detalle del movimiento conciliado quedaba inaccesible.
    SELECT l.organization_id,
           jsonb_build_object(
             'id', l.id, 'tipo', 'lote_cobro', 'fecha', l.fecha_pago,
             'contraparte', c.nombre, 'contraparte_id', l.cliente_id,
             'moneda', l.moneda::text, 'monto', COALESCE(l.monto_total,0),
             'tipo_cambio', NULLIF(l.tipo_cambio_usd,0),
             'monto_mxn', CASE WHEN l.moneda::text='MXN' THEN COALESCE(l.monto_total,0)
                               WHEN COALESCE(l.tipo_cambio_usd,0) > 0 THEN COALESCE(l.monto_total,0)*l.tipo_cambio_usd
                               ELSE NULL END,
             'metodo_pago', l.forma_pago, 'referencia', l.referencia,
             'cuenta_bancaria_id', l.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', l.notas, 'embarque_id', NULL::uuid,
             'diferencia_cambiaria_mxn', 0::numeric,
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', false, 'lote_id', l.id,
             'created_by', l.created_by, 'created_at', l.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.pagos_factura_lote l
    LEFT JOIN public.clientes c ON c.id = l.cliente_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = l.cuenta_bancaria_id
    WHERE l.id = p_id AND l.deleted_at IS NULL;

  ELSIF v_tipo = 'devolucion_anticipo' THEN
    SELECT ap.organization_id, jsonb_build_object(
      'id', ap.id, 'tipo', v_tipo,
      'fecha', COALESCE(d.fecha, (ap.devuelto_at AT TIME ZONE 'America/Mexico_City')::date),
      'contraparte', pr.nombre, 'contraparte_id', ap.proveedor_id,
      'moneda', ap.moneda::text, 'monto', ap.monto_devuelto,
      'tipo_cambio', NULLIF(ap.tipo_cambio_usd, 0),
      'monto_mxn', CASE WHEN ap.moneda::text = 'MXN' THEN ap.monto_devuelto
        WHEN ap.tipo_cambio_usd > 0 THEN ap.monto_devuelto * ap.tipo_cambio_usd ELSE NULL END,
      'metodo_pago', CASE WHEN d.id IS NOT NULL THEN 'Devolución bancaria' ELSE NULL END,
      'referencia', COALESCE(d.referencia, ap.referencia),
      'cuenta_bancaria_id', d.cuenta_bancaria_id, 'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
      'notas', concat_ws(' · ', NULLIF(ap.motivo_devolucion, ''),
        CASE WHEN d.id IS NULL THEN 'Sin fecha bancaria de devolución; fecha de registro como referencia' END,
        CASE WHEN ap.moneda::text <> 'MXN' THEN 'Equivalente MXN al TC registrado del anticipo original' END),
      'embarque_id', ap.embarque_id, 'diferencia_cambiaria_mxn', 0,
      'es_ajuste', false, 'created_by', ap.devuelto_by, 'created_at', ap.devuelto_at)
    INTO v_org_pago, v_pago
    FROM public.anticipos_proveedor ap
    LEFT JOIN public.proveedores pr ON pr.id = ap.proveedor_id
    LEFT JOIN LATERAL (
      SELECT m.id, m.fecha, m.referencia, m.cuenta_bancaria_id
      FROM public.bbva_movimientos m
      WHERE m.anticipo_proveedor_id = ap.id AND m.organization_id = ap.organization_id
        AND m.deleted_at IS NULL AND m.hash_dedupe = 'devolucion-' || ap.id::text AND m.abono > 0
      ORDER BY m.fecha, m.id LIMIT 1
    ) d ON true
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = d.cuenta_bancaria_id
    WHERE ap.id = p_id AND ap.deleted_at IS NULL AND ap.monto_devuelto > 0
      AND lower(COALESCE(ap.estado, 'vigente')) <> 'cancelado';

  ELSE
    SELECT ap.organization_id,
           jsonb_build_object(
             'id', ap.id, 'tipo', 'anticipo', 'fecha', ap.fecha_anticipo,
             'contraparte', pr.nombre, 'contraparte_id', ap.proveedor_id,
             'moneda', ap.moneda::text, 'monto', COALESCE(ap.monto,0),
             'tipo_cambio', NULLIF(ap.tipo_cambio_usd,0),
             'monto_mxn', CASE WHEN ap.moneda::text='MXN' THEN COALESCE(ap.monto,0)
                               WHEN COALESCE(ap.tipo_cambio_usd,0) > 0 THEN COALESCE(ap.monto,0)*ap.tipo_cambio_usd
                               ELSE NULL END,
             'metodo_pago', ap.metodo_pago, 'referencia', ap.referencia,
             'cuenta_bancaria_id', ap.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', ap.notas, 'embarque_id', ap.embarque_id,
             'diferencia_cambiaria_mxn', 0::numeric,
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', false, 'lote_id', NULL::uuid,
             'estado', COALESCE(ap.estado,'Vigente'),
             'saldo_disponible', COALESCE(ap.saldo_disponible,0),
             'created_by', ap.created_by, 'created_at', ap.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.anticipos_proveedor ap
    LEFT JOIN public.proveedores pr ON pr.id = ap.proveedor_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = ap.cuenta_bancaria_id
    WHERE ap.id = p_id AND ap.deleted_at IS NULL;
  END IF;

  IF v_pago IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_NO_ENCONTRADO: el pago no existe o fue eliminado';
  END IF;

  IF NOT v_super AND v_org_pago IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_SIN_ACCESO: el pago pertenece a otra organización';
  END IF;

  SELECT jsonb_build_object(
           'id', m.id, 'fecha', m.fecha, 'concepto', m.concepto,
           'referencia', m.referencia, 'cargo', COALESCE(m.cargo,0), 'abono', COALESCE(m.abono,0),
           'saldo', m.saldo, 'estado_conciliacion', m.estado_conciliacion::text,
           'cuenta_bancaria_id', m.cuenta_bancaria_id,
           'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
           'conciliado_por', m.conciliado_por, 'conciliado_at', m.conciliado_at
         )
    INTO v_mov
  FROM public.bbva_movimientos m
  LEFT JOIN public.cuentas_bancarias cb ON cb.id = m.cuenta_bancaria_id
  WHERE m.deleted_at IS NULL
    AND (v_super OR m.organization_id = v_org)
    AND (
      (v_tipo = 'cobro'    AND m.pago_factura_id = p_id)
      OR (v_tipo = 'pago'  AND (m.pago_proveedor_id = p_id
                                OR (v_lote IS NOT NULL AND m.pago_proveedor_lote_id = v_lote)))
      OR (v_tipo = 'lote'  AND m.pago_proveedor_lote_id = p_id)
      OR (v_tipo = 'lote_cobro' AND m.pago_factura_lote_id = p_id)
      OR (v_tipo = 'anticipo' AND m.anticipo_proveedor_id = p_id AND m.cargo > 0)
      OR (v_tipo = 'devolucion_anticipo' AND m.anticipo_proveedor_id = p_id
          AND m.hash_dedupe = 'devolucion-' || p_id::text AND m.abono > 0)
    )
  ORDER BY m.fecha DESC
  LIMIT 1;

  IF v_tipo IN ('cobro','lote_cobro') THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_aplic
    FROM (
      SELECT jsonb_build_object(
               'documento_id', f.id, 'documento_tipo', 'cliente',
               'folio', CASE WHEN NULLIF(TRIM(f.serie), '') IS NULL OR LEFT(TRIM(COALESCE(f.numero::text, '')), LENGTH(TRIM(f.serie))) = TRIM(f.serie) THEN NULLIF(TRIM(f.numero::text), '') ELSE NULLIF(TRIM(f.serie) || TRIM(COALESCE(f.numero::text, '')), '') END,
               'embarque_id', pf.embarque_id,
               'moneda', f.moneda::text,
               'monto_aplicado', COALESCE(pf.monto_aplicado_factura, pf.monto, 0),
               'pago_id', pf.id,
               'total', COALESCE(f.total,0),
               'pagado', COALESCE((SELECT SUM(COALESCE(p2.monto_aplicado_factura, p2.monto, 0))
                                   FROM public.pagos_factura p2
                                   WHERE p2.factura_id = f.id AND p2.deleted_at IS NULL
                                     AND p2.estado_rep IS DISTINCT FROM 'Cancelado'), 0),
               'notas_credito_aplicadas', public._nc_aplicadas_moneda_factura(f.id)
             ) AS x
      FROM public.pagos_factura pf
      JOIN public.facturas f ON f.id = pf.factura_id
      WHERE pf.deleted_at IS NULL
        AND ((v_tipo = 'cobro' AND pf.id = p_id)
             OR (v_tipo = 'lote_cobro' AND pf.lote_id = p_id))
    ) s;

  ELSIF v_tipo IN ('pago','lote') THEN
    SELECT COALESCE(jsonb_agg(x ORDER BY folio), '[]'::jsonb) INTO v_aplic
    FROM (
      SELECT COALESCE(pfa.folio_interno, pfa.folio_proveedor) AS folio,
             jsonb_build_object(
               'documento_id', pfa.id, 'documento_tipo', 'proveedor',
               'folio', COALESCE(pfa.folio_interno, pfa.folio_proveedor),
               'folio_proveedor', pfa.folio_proveedor,
               'embarque_id', pfa.embarque_id,
               'moneda', pfa.moneda::text,
               'monto_aplicado', COALESCE(pp.monto_en_moneda_factura, pp.monto, 0),
               'pago_id', pp.id,
               'total', COALESCE(pfa.total,0),
               'pagado', COALESCE((SELECT SUM(p2.monto_en_moneda_factura)
                                   FROM public.pagos_proveedor p2
                                   WHERE p2.proveedor_factura_id = pfa.id AND p2.deleted_at IS NULL), 0),
               -- AUD98: saldo actual, con NC Aplicada en la moneda de factura.
               'notas_credito_aplicadas', COALESCE((SELECT SUM(public.monto_pago_en_moneda_factura(
                   nc.monto, nc.moneda::text, nc.tipo_cambio, pfa.moneda::text))
                 FROM public.proveedor_notas_credito nc
                 WHERE nc.proveedor_factura_id = pfa.id AND nc.organization_id = pfa.organization_id
                   AND nc.deleted_at IS NULL AND nc.estado = 'Aplicada'), 0)
             ) AS x
      FROM public.pagos_proveedor pp
      JOIN public.proveedor_facturas pfa ON pfa.id = pp.proveedor_factura_id
      WHERE pp.deleted_at IS NULL
        AND ((v_lote IS NOT NULL AND pp.lote_id = v_lote) OR (v_lote IS NULL AND pp.id = p_id))
    ) s;

  ELSIF v_tipo = 'anticipo' THEN
    SELECT COALESCE(jsonb_agg(x ORDER BY folio), '[]'::jsonb) INTO v_aplic
    FROM (
      SELECT COALESCE(pfa.folio_interno, pfa.folio_proveedor) AS folio,
             jsonb_build_object(
               'documento_id', pfa.id, 'documento_tipo', 'proveedor',
               'folio', COALESCE(pfa.folio_interno, pfa.folio_proveedor),
               'folio_proveedor', pfa.folio_proveedor,
               'embarque_id', pfa.embarque_id,
               'moneda', COALESCE(aa.moneda_aplicada::text, pfa.moneda::text),
               'monto_aplicado', COALESCE(aa.monto_aplicado,0),
               'fecha_aplicacion', aa.fecha_aplicacion,
               'total', COALESCE(pfa.total,0),
               'pagado', COALESCE((SELECT SUM(p2.monto_en_moneda_factura)
                                   FROM public.pagos_proveedor p2
                                   WHERE p2.proveedor_factura_id = pfa.id AND p2.deleted_at IS NULL), 0),
               -- AUD98: saldo actual, con NC Aplicada en la moneda de factura.
               'notas_credito_aplicadas', COALESCE((SELECT SUM(public.monto_pago_en_moneda_factura(
                   nc.monto, nc.moneda::text, nc.tipo_cambio, pfa.moneda::text))
                 FROM public.proveedor_notas_credito nc
                 WHERE nc.proveedor_factura_id = pfa.id AND nc.organization_id = pfa.organization_id
                   AND nc.deleted_at IS NULL AND nc.estado = 'Aplicada'), 0)
             ) AS x
      FROM public.anticipos_aplicaciones aa
      JOIN public.proveedor_facturas pfa ON pfa.id = aa.proveedor_factura_id
      WHERE aa.anticipo_id = p_id AND aa.deleted_at IS NULL
    ) s;
  END IF;

  RETURN jsonb_build_object(
    'tipo', v_tipo,
    'pago', v_pago,
    'movimiento', v_mov,
    'aplicaciones', v_aplic
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.pago_detalle(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pago_detalle(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pago_detalle(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pago_detalle(text, uuid) TO service_role;