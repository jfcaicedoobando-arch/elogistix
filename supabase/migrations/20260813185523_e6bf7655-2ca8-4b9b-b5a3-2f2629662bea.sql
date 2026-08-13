-- ============================================================
-- Ola 12 · Sprint 09 · R3BD-01: las policies de proveedor_documentos y del
-- bucket 'documentos' (carpeta proveedores/) sólo verificaban organization_id.
-- Se recrean exigiendo la matriz de escritura de catálogo de proveedores.
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE POLICY.
-- ============================================================

DROP POLICY IF EXISTS "Compras puede insertar documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Compras puede insertar documentos de proveedor"
ON public.proveedor_documentos FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id = proveedor_id
      AND p.organization_id = public.current_user_org_id()
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Compras puede actualizar documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Compras puede actualizar documentos de proveedor"
ON public.proveedor_documentos FOR UPDATE TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Compras puede borrar documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Compras puede borrar documentos de proveedor"
ON public.proveedor_documentos FOR DELETE TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Proveedor docs upload" ON storage.objects;
CREATE POLICY "Proveedor docs upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = 'proveedores'
  AND EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.organization_id = public.current_user_org_id()
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Proveedor docs delete" ON storage.objects;
CREATE POLICY "Proveedor docs delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = 'proveedores'
  AND EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.organization_id = public.current_user_org_id()
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- ============================================================
-- Ola 12 · Sprint 09 · R3BD-02: registrar_pago_proveedor_lote aceptaba lotes
-- USD/EUR con tipo_cambio_usd NULL vía API directa. Se añade el guard
-- LC_LOTE_TC_REQUERIDO. ACUMULATIVA sobre la versión del Sprint 07 (conserva
-- R3BD-03 LC_LOTE_FACTURA_MONEDA y los guards de Ola 11). Sin cambio de firma.
-- Espejo 1:1: supabase/schema/cxp/registrar_pago_proveedor_lote.sql
-- ============================================================

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
  -- Ola 11 · RNF-05: importe real de la transferencia (nuevo en el payload).
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

  -- Ola 11 · RFE-02/RNF-03: misma regla que el pago individual.
  IF v_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_LOTE_FECHA_FUTURA: La fecha del pago no puede ser futura.'
      USING ERRCODE = '42501';
  END IF;

  -- Ola 12 · R3BD-02 (espejo del guard CxC LC_COBRO_LOTE_TC_REQUERIDO): un
  -- lote en USD/EUR sin tipo de cambio NO se registra. Antes el payload con
  -- tipo_cambio_usd NULL pasaba y la reportería MXN hacía
  -- COALESCE(pp.tipo_cambio_usd, 1) => 1:1 silencioso.
  IF v_moneda <> 'MXN'::public.moneda AND (v_tc IS NULL OR v_tc <= 0) THEN
    RAISE EXCEPTION 'LC_LOTE_TC_REQUERIDO: No hay tipo de cambio disponible para un pago en lote en %; reintenta cuando el servicio de tipos de cambio responda.', v_moneda
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

  -- Ola 11 · RNF-06 (espejo RG4-6): una misma factura no puede aparecer dos veces.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) AS r
    GROUP BY (r->>'factura_id')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'LC_LOTE_FACTURA_DUPLICADA: Hay facturas repetidas en el lote; cada factura sólo puede aparecer una vez.'
      USING ERRCODE = '42501';
  END IF;

  -- Validar renglones y calcular total.
  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    IF COALESCE((v_renglon->>'monto')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_LOTE_MONTO_INVALIDO: Cada factura del lote debe tener un importe mayor a cero.';
    END IF;

    -- Ola 11 · RFE-02/RNF-03: el SELECT sirve doble — valida que la factura
    -- exista/sea del proveedor y trae fecha_emision para el guard de fecha.
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

  -- Ola 11 · RNF-05 (espejo RG4-5): el reparto debe cuadrar EXACTAMENTE con
  -- la transferencia. Canon RNF-02: comparación exacta tras ROUND a 2
  -- decimales (sin tolerancia), igual que promete el mensaje.
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

-- ============================================================
-- Ola 12 · Sprint 09 · R3P-07 + R3P-08 (proveedor_estado_cuenta_movimientos).
-- ACUMULATIVA sobre la versión del Sprint 08: conserva R3FE-04 (paginación),
-- R3P-09 (saldos globales), R3P-10 (fecha CDMX), R3BD-04 ('Pagada' => 0) y
-- R3FE-03 (saldo_apertura).
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
           0::numeric,
           -- R3P-07: la aplicación de un anticipo es informativa (0/0); el
           -- abono ya se contó en la fila "Anticipo" al entregarlo.
           CASE WHEN p.es_anticipo_aplicado THEN 0::numeric ELSE COALESCE(p.monto, 0) END,
           CASE WHEN p.es_anticipo_aplicado
                 THEN COALESCE(p.metodo_pago, '') || ' · anticipo ya contado al entregarse'
                 ELSE p.metodo_pago END
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
           CASE WHEN f.estado = 'Pagada' THEN 0::numeric
                ELSE f.total
                  - COALESCE((SELECT SUM(pp.monto) FROM public.pagos_proveedor pp
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

REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO service_role;

-- ============================================================
-- Ola 12 · Sprint 09 · R3P-15 + R3P-14 (proveedor_inteligencia).
-- ACUMULATIVA sobre la versión del Sprint 05 (R3P-17).
-- ============================================================

CREATE OR REPLACE FUNCTION public.proveedor_inteligencia(p_proveedor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_usd numeric;
  v_eur numeric;
  v_tipo text;
  v_scorecard jsonb;
  v_tendencia jsonb;
  v_comparativo jsonb;
  v_alertas jsonb;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur FROM public.tc_dof_vigente(CURRENT_DATE) t;

  SELECT p.tipo::text INTO v_tipo
  FROM public.proveedores p
  WHERE p.id = p_proveedor_id AND p.organization_id = v_oid AND p.deleted_at IS NULL;

  IF v_tipo IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id = p_proveedor_id AND p.organization_id = v_oid AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_PROVEEDOR_INEXISTENTE: el proveedor no existe en tu organización' USING ERRCODE = '42501';
  END IF;

  WITH cc AS (
    SELECT c.id, c.concepto, c.monto, c.moneda::text AS moneda, c.created_at,
           c.monto * COALESCE(CASE c.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0) AS monto_mxn,
           e.expediente,
           COALESCE(NULLIF(e.puerto_origen, ''), NULLIF(e.aeropuerto_origen, ''), NULLIF(e.ciudad_origen, ''), '—') AS origen,
           COALESCE(NULLIF(e.puerto_destino, ''), NULLIF(e.aeropuerto_destino, ''), NULLIF(e.ciudad_destino, ''), '—') AS destino
    FROM public.conceptos_costo c
    LEFT JOIN public.embarques e ON e.id = c.embarque_id
    WHERE c.proveedor_id = p_proveedor_id AND c.organization_id = v_oid AND c.deleted_at IS NULL
  ),
  fact AS (
    SELECT pfc.concepto_costo_id,
           SUM(pfc.monto) AS facturado,
           MIN(COALESCE(pf.fecha_emision, pf.created_at::date)) AS primera_emision,
           MIN(pf.moneda::text) AS moneda_factura
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
      AND pfc.concepto_costo_id IS NOT NULL
    GROUP BY pfc.concepto_costo_id
  ),
  part AS (
    SELECT cc.*, f.facturado, f.primera_emision,
           COALESCE(f.facturado, 0) * COALESCE(CASE COALESCE(f.moneda_factura, cc.moneda) WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0) AS facturado_mxn
    FROM cc LEFT JOIN fact f ON f.concepto_costo_id = cc.id
  ),
  facs AS (
    SELECT COUNT(*)::int AS n,
           SUM(pf.total * COALESCE(CASE pf.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)) AS total_mxn
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
  ),
  tops AS (
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'monto_mxn')::numeric DESC), '[]'::jsonb) AS top_conceptos
    FROM (
      SELECT jsonb_build_object('concepto', concepto, 'monto_mxn', ROUND(SUM(monto_mxn), 2), 'partidas', COUNT(*)::int) AS x,
             SUM(monto_mxn) AS ord
      FROM part GROUP BY concepto ORDER BY ord DESC LIMIT 5
    ) s
  ),
  rutas AS (
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'monto_mxn')::numeric DESC), '[]'::jsonb) AS top_rutas
    FROM (
      SELECT jsonb_build_object('ruta', origen || ' → ' || destino, 'monto_mxn', ROUND(SUM(monto_mxn), 2),
                                'embarques', COUNT(DISTINCT expediente)::int) AS x,
             SUM(monto_mxn) AS ord
      FROM part WHERE expediente IS NOT NULL GROUP BY origen, destino ORDER BY ord DESC LIMIT 5
    ) s
  )
  SELECT jsonb_build_object(
    'partidas_total', (SELECT COUNT(*)::int FROM part),
    'partidas_facturadas', (SELECT COUNT(*)::int FROM part WHERE facturado IS NOT NULL),
    'comprometido_mxn', (SELECT ROUND(COALESCE(SUM(monto_mxn), 0), 2) FROM part),
    'facturado_mxn', (SELECT ROUND(COALESCE(SUM(facturado_mxn), 0), 2) FROM part WHERE facturado IS NOT NULL),
    'comprometido_ligado_mxn', (SELECT ROUND(COALESCE(SUM(monto_mxn), 0), 2) FROM part WHERE facturado IS NOT NULL),
    'dias_facturacion_prom', (
      SELECT ROUND(AVG(primera_emision - created_at::date)::numeric, 1)
      FROM part
      WHERE primera_emision IS NOT NULL
        AND primera_emision >= created_at::date
    ),
    'facturas_count', (SELECT n FROM facs),
    'ticket_promedio_mxn', (SELECT CASE WHEN n > 0 THEN ROUND(COALESCE(total_mxn, 0) / n, 2) ELSE NULL END FROM facs),
    'top_conceptos', (SELECT top_conceptos FROM tops),
    'top_rutas', (SELECT top_rutas FROM rutas)
  ) INTO v_scorecard;

  WITH meses AS (
    SELECT to_char(d, 'YYYY-MM') AS mes, d::date AS ini, (d + interval '1 month')::date AS fin
    FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '11 months', date_trunc('month', CURRENT_DATE), interval '1 month') d
  ),
  comp AS (
    SELECT to_char(c.created_at, 'YYYY-MM') AS mes,
           SUM(c.monto * COALESCE(CASE c.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)) AS monto
    FROM public.conceptos_costo c
    WHERE c.proveedor_id = p_proveedor_id AND c.organization_id = v_oid AND c.deleted_at IS NULL
    GROUP BY 1
  ),
  fac AS (
    SELECT to_char(pf.fecha_emision, 'YYYY-MM') AS mes,
           SUM(pf.total * COALESCE(CASE pf.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)) AS monto
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
    GROUP BY 1
  ),
  pag AS (
    SELECT to_char(pp.fecha_pago, 'YYYY-MM') AS mes,
           SUM(pp.monto * COALESCE(CASE pp.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)) AS monto
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada' AND pp.deleted_at IS NULL
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'mes', m.mes,
           'comprometido', ROUND(COALESCE(c.monto, 0), 2),
           'facturado', ROUND(COALESCE(f.monto, 0), 2),
           'pagado', ROUND(COALESCE(p.monto, 0), 2)
         ) ORDER BY m.mes), '[]'::jsonb)
  INTO v_tendencia
  FROM meses m
  LEFT JOIN comp c ON c.mes = m.mes
  LEFT JOIN fac f ON f.mes = m.mes
  LEFT JOIN pag p ON p.mes = m.mes;

  WITH base AS (
    SELECT lower(btrim(c.concepto)) AS concepto_norm,
           c.concepto,
           c.moneda::text AS moneda,
           c.proveedor_id,
           c.monto
    FROM public.conceptos_costo c
    JOIN public.proveedores p ON p.id = c.proveedor_id
    WHERE c.organization_id = v_oid AND c.deleted_at IS NULL
      AND c.created_at >= CURRENT_DATE - interval '12 months'
      AND c.monto > 0
      AND p.deleted_at IS NULL
      AND p.tipo::text IS NOT DISTINCT FROM v_tipo
  ),
  propios AS (
    SELECT concepto_norm, MIN(concepto) AS concepto, moneda,
           AVG(monto) AS unitario, COUNT(*)::int AS ops
    FROM base WHERE proveedor_id = p_proveedor_id
    GROUP BY concepto_norm, moneda
  ),
  otros AS (
    SELECT concepto_norm, moneda, AVG(monto) AS unitario, COUNT(*)::int AS ops,
           COUNT(DISTINCT proveedor_id)::int AS proveedores
    FROM base WHERE proveedor_id <> p_proveedor_id
    GROUP BY concepto_norm, moneda
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'concepto', pr.concepto,
           'moneda', pr.moneda,
           'unitario_propio', ROUND(pr.unitario, 2),
           'ops_propias', pr.ops,
           'unitario_otros', ROUND(o.unitario, 2),
           'ops_otros', o.ops,
           'proveedores_comparados', o.proveedores
         ) ORDER BY pr.ops DESC), '[]'::jsonb)
  INTO v_comparativo
  FROM propios pr
  JOIN otros o ON o.concepto_norm = pr.concepto_norm AND o.moneda = pr.moneda
  WHERE pr.ops >= 1;

  WITH cerrados_sin_factura AS (
    SELECT COUNT(*)::int AS n,
           ROUND(COALESCE(SUM(c.monto * COALESCE(CASE c.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)), 0), 2) AS monto_mxn
    FROM public.conceptos_costo c
    JOIN public.embarques e ON e.id = c.embarque_id
    WHERE c.proveedor_id = p_proveedor_id AND c.organization_id = v_oid AND c.deleted_at IS NULL
      AND e.estado IN ('Cerrado', 'Entregado', 'Por liquidar')
      AND NOT EXISTS (
        SELECT 1 FROM public.proveedor_facturas_conceptos pfc
        JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
        WHERE pfc.concepto_costo_id = c.id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
      )
  ),
  saldos AS (
    -- R3P-15: pagos convertidos a la moneda de la factura con el TC del
    -- pago (sin TC => el pago NO se descuenta) y NC sólo 'Aplicada'.
    SELECT pf.id, pf.fecha_vencimiento,
           (pf.total - COALESCE((
             SELECT SUM(
               CASE
                 WHEN pp.moneda::text = pf.moneda::text THEN pp.monto
                 WHEN COALESCE(pp.tipo_cambio_usd, 0) <= 0 THEN 0
                 WHEN pp.moneda::text = 'MXN' THEN pp.monto / pp.tipo_cambio_usd
                 WHEN pf.moneda::text = 'MXN' THEN pp.monto * pp.tipo_cambio_usd
                 ELSE 0
               END
             )
             FROM public.pagos_proveedor pp
             WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
           ), 0)
           - COALESCE((
             SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
             WHERE nc.proveedor_factura_id = pf.id AND nc.deleted_at IS NULL
               AND nc.estado = 'Aplicada'
           ), 0)) * COALESCE(CASE pf.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0) AS saldo_mxn
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado NOT IN ('Cancelada', 'Pagada')
  ),
  docs AS (
    SELECT
      COUNT(*) FILTER (WHERE d.fecha_vencimiento < CURRENT_DATE)::int AS vencidos,
      COUNT(*) FILTER (WHERE d.fecha_vencimiento >= CURRENT_DATE AND d.fecha_vencimiento <= CURRENT_DATE + 30)::int AS por_vencer
    FROM public.proveedor_documentos d
    WHERE d.proveedor_id = p_proveedor_id AND d.organization_id = v_oid
      AND d.deleted_at IS NULL AND d.fecha_vencimiento IS NOT NULL
  ),
  banco AS (
    SELECT p.origen_proveedor::text AS origen,
           (COALESCE(NULLIF(btrim(p.banco), ''), NULL) IS NULL) AS sin_banco,
           (COALESCE(NULLIF(btrim(p.clabe), ''), NULL) IS NULL) AS sin_clabe,
           (COALESCE(NULLIF(btrim(p.swift_bic), ''), NULLIF(btrim(p.iban), ''), NULLIF(btrim(p.aba_routing), '')) IS NULL) AS sin_ruta_intl,
           (COALESCE(NULLIF(btrim(p.beneficiario), ''), NULL) IS NULL) AS sin_beneficiario
    FROM public.proveedores p
    WHERE p.id = p_proveedor_id AND p.organization_id = v_oid
  )
  SELECT jsonb_build_object(
    'cerrados_sin_factura', jsonb_build_object('count', (SELECT n FROM cerrados_sin_factura), 'monto_mxn', (SELECT monto_mxn FROM cerrados_sin_factura)),
    'facturas_por_vencer', jsonb_build_object(
      'count', (SELECT COUNT(*)::int FROM saldos WHERE saldo_mxn > 0.005 AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),
      'monto_mxn', (SELECT ROUND(COALESCE(SUM(saldo_mxn), 0), 2) FROM saldos WHERE saldo_mxn > 0.005 AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)
    ),
    'facturas_vencidas', jsonb_build_object(
      'count', (SELECT COUNT(*)::int FROM saldos WHERE saldo_mxn > 0.005 AND fecha_vencimiento < CURRENT_DATE),
      'monto_mxn', (SELECT ROUND(COALESCE(SUM(saldo_mxn), 0), 2) FROM saldos WHERE saldo_mxn > 0.005 AND fecha_vencimiento < CURRENT_DATE)
    ),
    'saldo_pendiente_mxn', (SELECT ROUND(COALESCE(SUM(saldo_mxn), 0), 2) FROM saldos WHERE saldo_mxn > 0.005),
    'bancarios_incompletos', (
      -- R3P-14: una sola fuente de verdad — NULL = Nacional hasta que se
      -- capture lo contrario (idéntico criterio en la UI).
      SELECT CASE WHEN COALESCE(b.origen, 'Nacional') = 'Extranjero' THEN (b.sin_ruta_intl OR b.sin_beneficiario)
                  ELSE (b.sin_banco OR b.sin_clabe) END
      FROM banco b
    ),
    'documentos_vencidos', (SELECT vencidos FROM docs),
    'documentos_por_vencer', (SELECT por_vencer FROM docs)
  ) INTO v_alertas;

  RETURN jsonb_build_object(
    'tc', jsonb_build_object('usd_mxn', v_usd, 'eur_mxn', v_eur, 'faltante', (v_usd IS NULL OR v_eur IS NULL)),
    'tipo_proveedor', v_tipo,
    'scorecard', COALESCE(v_scorecard, '{}'::jsonb),
    'tendencia', COALESCE(v_tendencia, '[]'::jsonb),
    'comparativo', COALESCE(v_comparativo, '[]'::jsonb),
    'alertas', COALESCE(v_alertas, '{}'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_inteligencia(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_inteligencia(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_inteligencia(uuid) TO authenticated, service_role;