-- Audit131 reconstruction: persist the actual refund medium and civil date.
-- Historical records keep NULLs; do not infer cash from a missing bank link.
ALTER TABLE public.anticipos_proveedor
  ADD COLUMN fecha_devolucion date,
  ADD COLUMN medio_devolucion text CHECK (medio_devolucion IN ('Efectivo', 'Bancario')),
  ADD COLUMN referencia_devolucion text;
DROP FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text);
CREATE OR REPLACE FUNCTION public.devolver_anticipo_proveedor(p_id uuid, p_monto numeric, p_fecha date, p_cuenta_bancaria_id uuid, p_referencia text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text, p_medio text DEFAULT 'Bancario'::text) RETURNS public.anticipos_proveedor
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_cuenta_org uuid;
  v_hoy_mx date := public.fecha_negocio_mx();
  v_cierre date;
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
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden registrar devoluciones de anticipo.'
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE(trim(p_motivo),'') = '' OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOTIVO_REQUERIDO: Debes indicar el motivo de la devolución.';
  END IF;
  SELECT * INTO v_row FROM public.anticipos_proveedor
   WHERE id = p_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;
  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;
  IF v_row.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo está cancelado; no puede devolverse.';
  END IF;
  IF v_row.estado = 'devuelto' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_DEVUELTO: Este anticipo ya tiene una devolución registrada.';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto devuelto debe ser mayor a cero.';
  END IF;
  IF p_monto > COALESCE(v_row.saldo_disponible,0) + 0.01 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_EXCEDE_SALDO: La devolución (%) excede el saldo disponible (%).',
      p_monto, COALESCE(v_row.saldo_disponible,0);
  END IF;
  -- F2 (decisión 2026-08-29): sólo devolución TOTAL. Una parcial dejaba el
  -- remanente fuera del sistema (saldo forzado a 0 sin asiento contable).
  IF p_monto < COALESCE(v_row.saldo_disponible,0) - 0.01 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_DEVOLUCION_TOTAL: La devolución debe ser por el saldo completo (%); no se permiten devoluciones parciales.',
      COALESCE(v_row.saldo_disponible,0);
  END IF;
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_REQUERIDA: Indica la fecha de la devolución.';
  END IF;
  IF p_fecha < v_row.fecha_anticipo THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_INVALIDA: La devolución no puede ser anterior a la fecha del anticipo (%).',
      v_row.fecha_anticipo;
  END IF;
  -- MNY P1.2: fecha de negocio México, nunca futura, y periodo contable abierto.
  IF p_fecha > v_hoy_mx THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_FUTURA: la fecha de la devolución (%) no puede ser futura', p_fecha
      USING ERRCODE = '22023';
  END IF;
  IF current_setting('app.bypass_cierre_periodo', true) IS DISTINCT FROM '1' THEN
    v_cierre := public.cierre_periodo_fecha(v_row.organization_id);
    IF v_cierre IS NOT NULL AND p_fecha <= v_cierre THEN
      RAISE EXCEPTION 'LC_PERIODO_CERRADO: el periodo contable está cerrado hasta el %; la fecha % no es válida',
        v_cierre, p_fecha USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF p_medio IS NULL OR p_medio NOT IN ('Efectivo', 'Bancario') THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MEDIO_DEVOLUCION: Selecciona Efectivo o Bancario.' USING ERRCODE = '22023';
  END IF;
  IF p_medio = 'Efectivo' AND p_cuenta_bancaria_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_EFECTIVO_CON_CUENTA: Una devolución en efectivo no lleva cuenta bancaria.' USING ERRCODE = '22023';
  END IF;
  IF p_medio = 'Bancario' THEN
  SELECT cb.organization_id INTO v_cuenta_org
    FROM public.cuentas_bancarias cb
   WHERE cb.id = p_cuenta_bancaria_id AND cb.activa AND cb.deleted_at IS NULL
     AND cb.moneda = v_row.moneda;
  IF v_cuenta_org IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_REQUERIDA: Selecciona la cuenta bancaria donde entró el dinero.';
  END IF;
  IF v_cuenta_org IS DISTINCT FROM v_row.organization_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;
  END IF;
  UPDATE public.anticipos_proveedor
    SET estado = 'devuelto',
        saldo_disponible = 0,
        monto_devuelto = p_monto,
        fecha_devolucion = p_fecha,
        medio_devolucion = p_medio,
        referencia_devolucion = NULLIF(trim(COALESCE(p_referencia,'')),''),
        motivo_devolucion = trim(p_motivo),
        devuelto_at = now(),
        devuelto_by = v_uid,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;
  -- F1: hash_dedupe es NOT NULL; sin él el INSERT lanzaba 23502 y toda la
  -- devolución hacía rollback.
  IF p_medio = 'Bancario' THEN
  INSERT INTO public.bbva_movimientos
    (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
     cargo, abono, estado_conciliacion, anticipo_proveedor_id, importado_por, importado_en,
     hash_dedupe)
  VALUES
    (v_row.organization_id, p_cuenta_bancaria_id, p_fecha,
     'Devolución de anticipo ' || v_row.id::text, NULLIF(trim(COALESCE(p_referencia,'')),''),
     0, p_monto, 'Pendiente'::public.estado_conciliacion, v_row.id, v_uid, now(),
     'devolucion-' || v_row.id::text);
  END IF;
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'devolver_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('motivo', trim(p_motivo), 'monto_devuelto', p_monto,
                               'moneda', v_row.moneda, 'fecha', p_fecha, 'medio', p_medio,
                               'cuenta_bancaria_id', p_cuenta_bancaria_id,
                               'referencia', p_referencia));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en devolver_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text, text) TO authenticated, service_role;

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
      COALESCE(ap.fecha_devolucion, d.fecha, (ap.devuelto_at AT TIME ZONE 'America/Mexico_City')::date) AS fecha,
      pr.nombre AS contraparte, ap.proveedor_id AS contraparte_id,
      NULL::uuid AS documento_id, NULL::text AS documento_folio,
      ap.moneda::text AS moneda, ap.monto_devuelto AS monto,
      NULLIF(ap.tipo_cambio_usd, 0) AS tipo_cambio,
      CASE WHEN ap.moneda::text = 'MXN' THEN ap.monto_devuelto
           WHEN ap.tipo_cambio_usd > 0 THEN ap.monto_devuelto * ap.tipo_cambio_usd
           ELSE NULL END AS monto_mxn,
      CASE WHEN ap.medio_devolucion = 'Efectivo' THEN 'Efectivo' WHEN d.id IS NOT NULL THEN 'Devolución bancaria' ELSE NULL END AS metodo_pago,
      CASE WHEN ap.medio_devolucion IS NOT NULL THEN ap.referencia_devolucion ELSE COALESCE(d.referencia, ap.referencia) END AS referencia,
      d.cuenta_bancaria_id,
      concat_ws(' · ', NULLIF(ap.motivo_devolucion, ''),
        CASE WHEN ap.fecha_devolucion IS NULL AND d.id IS NULL THEN 'Sin fecha bancaria de devolución; fecha de registro como referencia' END,
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
      AND COALESCE(ap.fecha_devolucion, d.fecha, (ap.devuelto_at AT TIME ZONE 'America/Mexico_City')::date)
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
      'fecha', COALESCE(ap.fecha_devolucion, d.fecha, (ap.devuelto_at AT TIME ZONE 'America/Mexico_City')::date),
      'contraparte', pr.nombre, 'contraparte_id', ap.proveedor_id,
      'moneda', ap.moneda::text, 'monto', ap.monto_devuelto,
      'tipo_cambio', NULLIF(ap.tipo_cambio_usd, 0),
      'monto_mxn', CASE WHEN ap.moneda::text = 'MXN' THEN ap.monto_devuelto
        WHEN ap.tipo_cambio_usd > 0 THEN ap.monto_devuelto * ap.tipo_cambio_usd ELSE NULL END,
      'metodo_pago', CASE WHEN ap.medio_devolucion = 'Efectivo' THEN 'Efectivo' WHEN d.id IS NOT NULL THEN 'Devolución bancaria' ELSE NULL END,
      'referencia', CASE WHEN ap.medio_devolucion IS NOT NULL THEN ap.referencia_devolucion ELSE COALESCE(d.referencia, ap.referencia) END,
      'cuenta_bancaria_id', d.cuenta_bancaria_id, 'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
      'notas', concat_ws(' · ', NULLIF(ap.motivo_devolucion, ''),
        CASE WHEN ap.fecha_devolucion IS NULL AND d.id IS NULL THEN 'Sin fecha bancaria de devolución; fecha de registro como referencia' END,
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
-- ============================================================
-- Ola 13 · Sprint 04 · R4BD-05 (proveedor_estado_cuenta_movimientos):
-- p_offset se cuenta DESDE EL FINAL (antes empujaba la ventana hacia
-- adelante y los renglones viejos eran inalcanzables). 'hay_mas' = hay
-- renglones anteriores a la ventana.
-- Migración vigente: 20261005010200_audit70_71_proveedor_nc_devoluciones.sql,
-- acumulativa sobre la final de Ola 12 (20260813190546, Sprint 10) — conserva
-- R3FE-04, R3P-09, R3P-10, R3BD-04, R3FE-03, R3P-07/R3P-08 y R3P-06.
-- Auditoría70: NC y aging en moneda de factura con conversión canónica.
-- Auditoría71: contrapartida de devolución por el monto efectivamente devuelto.
-- Espejo 1:1 obligatorio (lo verifica audit:schema-functions).
-- ============================================================
CREATE OR REPLACE FUNCTION public.proveedor_estado_cuenta_movimientos(
  p_proveedor_id uuid,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL,
  p_limite integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
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
  -- Sprint 04 · R3FE-04: tope defensivo (nunca se devuelven > 5000).
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 1000), 1), 5000);
  -- R3P-10: fecha de negocio en America/Mexico_City. Antes CURRENT_DATE usaba
  -- la fecha UTC del servidor: entre las 18:00-23:59 CDMX los buckets del
  -- aging se calculaban "mañana".
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  -- Universo completo de movimientos del proveedor (SIN filtro de periodo):
  -- se materializa una sola vez y de él se derivan el detalle del periodo,
  -- la apertura (S08 · R3FE-03) y los saldos globales.
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
    SELECT nc.id, nc.folio_nc, nc.fecha,
           nc.monto AS monto_nota, nc.moneda::text AS moneda_nota,
           public.monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, f.moneda) AS monto_factura,
           f.moneda AS moneda_factura,
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
           a.referencia, a.metodo_pago, a.embarque_id, e.expediente,
           COALESCE(a.monto_devuelto, 0) AS monto_devuelto,
           -- La fecha bancaria conserva el periodo efectivo de la devolución.
           -- Legacy sin movimiento: usar la fecha de registro y explicitarlo.
           COALESCE(a.fecha_devolucion, d.fecha,
                    (a.devuelto_at AT TIME ZONE 'America/Mexico_City')::date,
                    (a.updated_at AT TIME ZONE 'America/Mexico_City')::date,
                    a.fecha_anticipo) AS fecha_devolucion,
           COALESCE(a.referencia_devolucion, d.referencia) AS referencia_devolucion,
           a.medio_devolucion,
           a.fecha_devolucion IS NULL AND d.fecha IS NULL AS devolucion_sin_fecha_bancaria
    FROM public.anticipos_proveedor a
    LEFT JOIN public.embarques e ON e.id = a.embarque_id AND e.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT b.fecha, b.referencia
      FROM public.bbva_movimientos b
      WHERE b.anticipo_proveedor_id = a.id
        AND b.organization_id = v_oid
        AND b.deleted_at IS NULL
        AND b.hash_dedupe = 'devolucion-' || a.id::text
        AND b.abono > 0
      ORDER BY b.fecha, b.id
      LIMIT 1
    ) d ON true
    WHERE a.proveedor_id = p_proveedor_id
      AND a.organization_id = v_oid
      AND a.deleted_at IS NULL
      AND a.estado <> 'cancelado'
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
           n.embarque_id, n.moneda_factura, 0::numeric, COALESCE(n.monto_factura, 0),
           CASE
             WHEN n.moneda_nota <> n.moneda_factura AND n.monto_factura IS NULL
               THEN 'NC en ' || n.moneda_nota || ' SIN TC (excluida del saldo)'
             WHEN n.moneda_nota <> n.moneda_factura
               THEN 'NC en ' || n.moneda_nota || ' ' || n.monto_nota::text || ' convertida a ' || n.moneda_factura
             ELSE NULL::text
           END
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
    UNION ALL
    SELECT a.fecha_devolucion, 'Devolución de anticipo', a.id, 'Devolución de anticipo',
           CASE WHEN a.medio_devolucion IS NOT NULL THEN a.referencia_devolucion ELSE COALESCE(a.referencia_devolucion, a.referencia) END, COALESCE(a.expediente, ''),
           a.embarque_id, a.moneda,
           -- Sólo el dinero devuelto revierte el abono original. Las aplicaciones
           -- siguen informativas 0/0: no se cuenta de nuevo el monto aplicado.
           a.monto_devuelto, 0::numeric,
           CASE WHEN a.devolucion_sin_fecha_bancaria
             THEN 'Sin fecha bancaria de devolución; fecha de registro como referencia'
             ELSE COALESCE(a.medio_devolucion, a.metodo_pago) END
    FROM anticipos a
    WHERE a.monto_devuelto > 0
  )
  SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.fecha, m.tipo, m.folio), '[]'::jsonb)
  INTO v_todos
  FROM movs m;

  -- Detalle del periodo (R3P-09): el filtro se aplica sobre el universo
  -- completo, en memoria, ANTES de paginar (R3FE-04). (Las fechas son
  -- columnas `date`; el casteo desde jsonb es seguro.)
  SELECT COALESCE(jsonb_agg(m ORDER BY m->>'fecha', m->>'tipo', m->>'folio'), '[]'::jsonb)
  INTO v_movs_full
  FROM jsonb_array_elements(v_todos) m
  WHERE (m->>'fecha')::date BETWEEN v_desde AND v_hasta;

  -- Sprint 04 · R3FE-04: paginación server-side. La lista es cronológica
  -- ascendente y el saldo corrido se arma en cliente sobre lo devuelto, así
  -- que el recorte por omisión conserva los movimientos MÁS RECIENTES del
  -- periodo.
  v_total := COALESCE(jsonb_array_length(v_movs_full), 0);
  -- Ola 13 · R4BD-05: p_offset se cuenta DESDE EL FINAL. Antes se SUMABA a la
  -- ventana por omisión y los renglones viejos quedaban inalcanzables.
  v_offset_efectivo := GREATEST(v_total - v_limite - GREATEST(COALESCE(p_offset, 0), 0), 0);

  SELECT COALESCE(jsonb_agg(pag.value ORDER BY pag.ord), '[]'::jsonb)
  INTO v_movs
  FROM (
    SELECT t.value, t.ord
    FROM jsonb_array_elements(v_movs_full) WITH ORDINALITY AS t(value, ord)
    ORDER BY t.ord
    OFFSET v_offset_efectivo
    LIMIT v_limite
  ) pag;

  -- Ola 12 · R3FE-03: saldo de apertura por moneda = movimientos anteriores
  -- al periodo. Mismo universo (v_todos) ⇒ cuadra con el corrido y con los
  -- saldos globales.
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

  -- Aging global (sin filtro de periodo; R3P-10: fecha de corte CDMX).
  WITH facturas AS (
    SELECT pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_vencimiento,
           pf.moneda::text AS moneda, COALESCE(pf.total, 0) AS total,
           -- Ola 12 · R3BD-04: se necesita el estado para la regla 'Pagada'.
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
                  - COALESCE((SELECT SUM(public.monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, f.moneda))
                              FROM public.proveedor_notas_credito nc
                              WHERE nc.proveedor_factura_id = f.id AND nc.deleted_at IS NULL
                                AND nc.organization_id = v_oid
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

  -- Saldos GLOBALES por moneda (R3P-09): mismo universo que el aging
  -- (v_todos), no el periodo filtrado ni la página recortada. La UI los
  -- etiqueta "Saldo global" (Paso 2 del sprint).
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
    -- R4BD-05: hay renglones ANTERIORES a la ventana (más viejos por ver).
    -- Con p_offset=0 el valor es idéntico al de la versión anterior.
    'hay_mas', v_offset_efectivo > 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO service_role;
