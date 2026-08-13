-- Ola 12 · Sprint 07 · R3BD-03
CREATE OR REPLACE FUNCTION public.registrar_pago_proveedor_lote(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_autorizado boolean;
  v_proveedor_id uuid := (p_payload->>'proveedor_id')::uuid;
  v_fecha date := COALESCE((p_payload->>'fecha_pago')::date, CURRENT_DATE);
  v_moneda public.moneda := (p_payload->>'moneda')::public.moneda;
  v_tc numeric := NULLIF(p_payload->>'tipo_cambio_usd','')::numeric;
  v_importe numeric := NULLIF(p_payload->>'importe_recibido','')::numeric;
  v_metodo text := COALESCE(NULLIF(TRIM(p_payload->>'metodo_pago'), ''), 'Transferencia');
  v_referencia text := COALESCE(NULLIF(TRIM(p_payload->>'referencia'), ''), '');
  v_cuenta_id uuid := NULLIF(p_payload->>'cuenta_bancaria_id','')::uuid;
  v_notas text := COALESCE(p_payload->>'notas','');
  v_cuenta public.cuentas_bancarias;
  v_proveedor_nombre text;
  v_total numeric := 0;
  v_lote_id uuid;
  v_renglon jsonb;
  v_fecha_emision date;
  -- Ola 12 · R3BD-03: moneda de la factura para el guard de paridad.
  v_moneda_factura public.moneda;
  v_n int := 0;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_LOTE_SIN_ROL: Sólo administración, contabilidad o tesorería pueden registrar pagos en lote.'
      USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, nombre INTO v_org, v_proveedor_nombre
  FROM public.proveedores WHERE id = v_proveedor_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_LOTE_PROVEEDOR_NO_EXISTE: El proveedor no existe.';
  END IF;

  IF v_org <> public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_LOTE_PROVEEDOR_OTRA_ORG: El proveedor pertenece a otra organización.';
  END IF;

  IF v_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_LOTE_FECHA_FUTURA: La fecha del pago no puede ser futura.'
      USING ERRCODE = '42501';
  END IF;

  IF v_cuenta_id IS NULL AND v_metodo <> 'Efectivo' THEN
    RAISE EXCEPTION 'LC_LOTE_CUENTA_REQUERIDA: Selecciona la cuenta bancaria de donde sale el pago (sólo Efectivo puede omitirla).';
  END IF;

  IF v_cuenta_id IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM public.cuentas_bancarias
    WHERE id = v_cuenta_id AND deleted_at IS NULL;

    IF v_cuenta.id IS NULL THEN
      RAISE EXCEPTION 'LC_LOTE_CUENTA_INVALIDA: La cuenta bancaria no existe o está dada de baja.';
    END IF;
    IF v_cuenta.organization_id <> v_org THEN
      RAISE EXCEPTION 'LC_LOTE_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.';
    END IF;
    IF v_cuenta.moneda <> v_moneda THEN
      RAISE EXCEPTION 'LC_LOTE_CUENTA_DIVISA: La cuenta está en % y el pago en %.', v_cuenta.moneda, v_moneda;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) AS r
    GROUP BY (r->>'factura_id')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'LC_LOTE_FACTURA_DUPLICADA: Hay facturas repetidas en el lote; cada factura sólo puede aparecer una vez.'
      USING ERRCODE = '42501';
  END IF;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    IF COALESCE((v_renglon->>'monto')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_LOTE_MONTO_INVALIDO: Cada factura del lote debe tener un importe mayor a cero.';
    END IF;

    -- Ola 12 · R3BD-03: también trae la moneda para el guard de paridad.
    SELECT pf.fecha_emision, pf.moneda INTO v_fecha_emision, v_moneda_factura
    FROM public.proveedor_facturas pf
    WHERE pf.id = (v_renglon->>'factura_id')::uuid
      AND pf.deleted_at IS NULL
      AND pf.organization_id = v_org
      AND pf.proveedor_id = v_proveedor_id;

    IF v_fecha_emision IS NULL THEN
      RAISE EXCEPTION 'LC_LOTE_FACTURA_INVALIDA: Una de las facturas no existe o no pertenece al proveedor seleccionado.';
    END IF;

    -- Ola 12 · R3BD-03 (paridad CxC): la factura debe ser de la moneda del
    -- lote. Excepción: cruce de monedas permitido sólo con TC válido, porque
    -- el trigger convertir_monto_pago_a_factura convierte con ese TC.
    IF v_moneda_factura <> v_moneda AND (v_tc IS NULL OR v_tc <= 0) THEN
      RAISE EXCEPTION 'LC_LOTE_FACTURA_MONEDA: La factura está en % y el lote en %; captura el tipo de cambio o retira la factura del lote.', v_moneda_factura, v_moneda
        USING ERRCODE = '42501';
    END IF;

    IF v_fecha < v_fecha_emision THEN
      RAISE EXCEPTION 'LC_LOTE_FECHA_PREVIA_EMISION: La fecha del pago es anterior a la emisión de una de las facturas del lote.'
        USING ERRCODE = '42501';
    END IF;

    v_total := v_total + ROUND((v_renglon->>'monto')::numeric, 2);
    v_n := v_n + 1;
  END LOOP;

  IF v_n < 2 THEN
    RAISE EXCEPTION 'LC_LOTE_MINIMO_FACTURAS: Un pago en lote requiere al menos dos facturas.';
  END IF;

  IF v_importe IS NULL OR v_importe <= 0 THEN
    RAISE EXCEPTION 'LC_LOTE_IMPORTE_REQUERIDO: Captura el importe total de la transferencia.'
      USING ERRCODE = '42501';
  END IF;
  IF ROUND(v_importe, 2) IS DISTINCT FROM ROUND(v_total, 2) THEN
    RAISE EXCEPTION 'LC_LOTE_IMPORTE_NO_CUADRA: El reparto (%) no cuadra con el importe de la transferencia (%); no se permite sobrante sin asignar.', v_total, v_importe
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pagos_proveedor_lote
    (organization_id, proveedor_id, fecha_pago, moneda, monto_total, tipo_cambio_usd,
     metodo_pago, referencia, cuenta_bancaria_id, notas, created_by)
  VALUES
    (v_org, v_proveedor_id, v_fecha, v_moneda, v_total, v_tc,
     v_metodo, v_referencia, v_cuenta_id, v_notas, v_uid)
  RETURNING id INTO v_lote_id;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    INSERT INTO public.pagos_proveedor
      (organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd,
       metodo_pago, referencia, cuenta_bancaria_id, notas, created_by, lote_id)
    VALUES
      (v_org, (v_renglon->>'factura_id')::uuid, v_fecha,
       ROUND((v_renglon->>'monto')::numeric, 2), v_moneda, v_tc,
       v_metodo, v_referencia, v_cuenta_id, v_notas, v_uid, v_lote_id);
  END LOOP;

  IF v_cuenta_id IS NOT NULL THEN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
       cargo, abono, hash_dedupe, estado_conciliacion,
       pago_proveedor_lote_id, conciliado_por, conciliado_at, importado_por)
    VALUES
      (v_org, v_cuenta_id, v_fecha,
       'Pago en lote (' || v_n || ' facturas) — ' || COALESCE(v_proveedor_nombre, 'proveedor'),
       v_referencia, v_total, 0, 'lote-' || v_lote_id::text, 'Conciliado',
       v_lote_id, v_uid, now(), v_uid);
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_org, v_uid, COALESCE(v_email,''), 'registrar_pago_proveedor_lote', 'cxp',
            v_lote_id, 'Pago en lote ' || v_lote_id::text,
            jsonb_build_object('proveedor_id', v_proveedor_id, 'monto_total', v_total,
                               'importe_recibido', v_importe,
                               'moneda', v_moneda, 'facturas', v_n,
                               'cuenta_bancaria_id', v_cuenta_id, 'referencia', v_referencia));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_pago_proveedor_lote: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_lote_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) TO service_role;

-- Ola 12 · Sprint 07 · R3BD-04 (acumulativa sobre Sprint 04/05).
CREATE OR REPLACE FUNCTION public.proveedor_estado_cuenta_movimientos(
  p_proveedor_id uuid,
  p_desde date DEFAULT NULL::date,
  p_hasta date DEFAULT NULL::date,
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
    LEFT JOIN public.embarques e ON e.id = pf.embarque_id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  notas AS (
    SELECT nc.id, nc.folio_nc, nc.fecha, nc.monto, nc.moneda::text AS moneda,
           nc.proveedor_factura_id, f.folio_interno, f.expediente, f.embarque_id
    FROM public.proveedor_notas_credito nc
    JOIN facturas f ON f.id = nc.proveedor_factura_id
    WHERE nc.organization_id = v_oid
      AND nc.deleted_at IS NULL
      AND nc.estado IN ('Aprobada', 'Aplicada')
  ),
  pagos AS (
    SELECT pp.id, pp.fecha_pago, pp.monto, pp.moneda::text AS moneda,
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
    LEFT JOIN public.embarques e ON e.id = a.embarque_id
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
           COALESCE(p.expediente, ''), p.embarque_id, p.moneda,
           0::numeric, COALESCE(p.monto, 0), p.metodo_pago
    FROM pagos p
    UNION ALL
    SELECT a.fecha_anticipo, 'Anticipo', a.id, 'Anticipo', a.referencia,
           COALESCE(a.expediente, ''), a.embarque_id, a.moneda,
           0::numeric, 0::numeric, a.metodo_pago
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

  -- Aging global con fecha de corte CDMX (R3P-10).
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
                  - COALESCE((SELECT SUM(pp.monto) FROM public.pagos_proveedor pp
                              WHERE pp.proveedor_factura_id = f.id AND pp.deleted_at IS NULL), 0)
                  - COALESCE((SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
                              WHERE nc.proveedor_factura_id = f.id AND nc.deleted_at IS NULL
                                AND nc.estado IN ('Aprobada','Aplicada')), 0)
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
    'aging', v_aging,
    'saldos', v_saldos,
    'total_movimientos', v_total,
    'hay_mas', v_offset_efectivo > 0 OR (v_offset_efectivo + v_limite) < v_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO service_role;

-- Ola 12 · Sprint 07 · R3BD-05 + R3BD-06 (acumulativa sobre Sprint 06).
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
  -- Ola 12 · R3BD-06: TC DOF vigente (patrón proveedor_inteligencia).
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
    LEFT JOIN public.embarques e ON e.id = c.embarque_id
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
    SELECT pp.proveedor_factura_id, SUM(pp.monto) AS pagado
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

REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta(uuid) TO service_role;