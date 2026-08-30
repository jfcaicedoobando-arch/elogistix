-- Ola 2 · A (YAGNI): EUR NO soportado en conceptos de VENTA.
-- Los conceptos en EUR terminaban facturándose en $0 porque ni
-- crear_proforma_atomica ni consolidar_proformas tienen rama EUR. Datos vivos
-- verificados: 0 conceptos de venta en EUR (893 USD, 30 MXN) -> la constraint
-- entra validada sin backfill. Costos/CxP/pagos NO se tocan.

ALTER TABLE public.conceptos_venta
  ADD CONSTRAINT conceptos_venta_moneda_soportada
  CHECK (moneda IN ('MXN', 'USD'));

CREATE OR REPLACE FUNCTION public.crear_proforma_atomica(p_organization_id uuid, p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_concepto_ids uuid[], p_subtotal_usd numeric, p_iva_usd numeric, p_total_usd numeric, p_subtotal_mxn numeric, p_iva_mxn numeric, p_total_mxn numeric, p_notas text, p_operador text, p_dias_credito integer, p_tasa_iva numeric, p_iva_overrides jsonb DEFAULT '{}'::jsonb)
 RETURNS proformas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero text;
  v_proforma public.proformas;
  v_override record;
  v_org uuid;
  v_sub_usd numeric := 0;
  v_iva_usd numeric := 0;
  v_sub_mxn numeric := 0;
  v_iva_mxn numeric := 0;
  v_tc numeric;
  v_ocupados int;
  v_actualizados int;
  v_ajenos int;
  v_no_soportados int;
BEGIN
  IF p_concepto_ids IS NULL OR array_length(p_concepto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un concepto';
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;
  PERFORM public._assert_writer(v_org);

  -- Ola E1 · C5: el embarque debe existir en la organización y coincidir con
  -- el cliente recibido; antes se confiaba en los argumentos del cliente.
  IF NOT EXISTS (
    SELECT 1 FROM public.embarques e
     WHERE e.id = p_embarque_id
       AND e.organization_id = v_org
       AND e.deleted_at IS NULL
       AND (p_cliente_id IS NULL OR e.cliente_id = p_cliente_id)
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_EMBARQUE_INVALIDO: el embarque no existe en tu organización o no corresponde al cliente indicado'
      USING ERRCODE = 'P0001';
  END IF;

  -- Bloquea los conceptos y valida que estén libres antes de crear la proforma.
  PERFORM 1 FROM public.conceptos_venta
   WHERE id = ANY(p_concepto_ids) AND organization_id = v_org
   FOR UPDATE;

  -- Ola E1 · C5: ningún concepto puede venir de otro embarque ni estar borrado.
  SELECT COUNT(*) INTO v_ajenos
  FROM unnest(p_concepto_ids) AS s(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.conceptos_venta cv
     WHERE cv.id = s.id
       AND cv.organization_id = v_org
       AND cv.embarque_id = p_embarque_id
       AND cv.deleted_at IS NULL
  );

  IF v_ajenos > 0 THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_AJENOS: % concepto(s) no pertenecen a este embarque o fueron eliminados; recarga la pantalla', v_ajenos
      USING ERRCODE = 'P0001';
  END IF;

  -- Ola 2 · A: EUR (o cualquier moneda fuera de MXN/USD) no es soportado en
  -- venta; antes se proformaba y facturaba en $0 en silencio.
  SELECT COUNT(*) INTO v_no_soportados
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org
    AND moneda NOT IN ('MXN', 'USD');

  IF v_no_soportados > 0 THEN
    RAISE EXCEPTION 'LC_MONEDA_VENTA_NO_SOPORTADA: % concepto(s) de venta tienen una moneda no soportada; sólo se puede facturar en MXN o USD', v_no_soportados
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_ocupados
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org
    AND (proforma_id IS NOT NULL OR COALESCE(estado_facturacion, 'pendiente') <> 'pendiente');

  IF v_ocupados > 0 THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_YA_ASIGNADOS: % concepto(s) ya están en otra proforma o facturados; recarga la pantalla', v_ocupados
      USING ERRCODE = 'P0001';
  END IF;

  IF p_iva_overrides IS NOT NULL AND p_iva_overrides <> '{}'::jsonb THEN
    FOR v_override IN
      SELECT key AS concepto_id, (value)::text::boolean AS aplica
      FROM jsonb_each(p_iva_overrides)
    LOOP
      UPDATE public.conceptos_venta
      SET aplica_iva = v_override.aplica
      WHERE id = v_override.concepto_id::uuid
        AND organization_id = v_org
        AND embarque_id = p_embarque_id;
    END LOOP;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN moneda='USD' THEN cantidad*precio_unitario ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='USD' AND aplica_iva
                      THEN cantidad*precio_unitario*COALESCE(tasa_iva_aplicada, p_tasa_iva)
                      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN' THEN cantidad*precio_unitario ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN' AND aplica_iva
                      THEN cantidad*precio_unitario*COALESCE(tasa_iva_aplicada, p_tasa_iva)
                      ELSE 0 END), 0)
  INTO v_sub_usd, v_iva_usd, v_sub_mxn, v_iva_mxn
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids) AND organization_id = v_org;

  IF v_sub_usd > 0 THEN
    SELECT tipo_cambio_usd INTO v_tc
    FROM public.embarques
    WHERE id = p_embarque_id AND organization_id = v_org;

    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PROFORMA_TC_REQUERIDO: el embarque no tiene tipo de cambio USD para convertir los conceptos en dólares'
        USING ERRCODE='P0001';
    END IF;

    v_sub_mxn := v_sub_mxn + round(v_sub_usd * v_tc, 2);
    v_iva_mxn := v_iva_mxn + round(v_iva_usd * v_tc, 2);
  END IF;

  IF ABS(COALESCE(p_iva_usd,0) - v_iva_usd) > 0.01
     OR ABS(COALESCE(p_iva_mxn,0) - v_iva_mxn) > 0.01 THEN
    RAISE NOTICE 'crear_proforma_atomica: desfase cliente vs server';
  END IF;

  v_numero := public.generar_numero_proforma(v_org);

  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_sub_usd, v_iva_usd, v_sub_usd + v_iva_usd,
    v_sub_mxn, v_iva_mxn, v_sub_mxn + v_iva_mxn,
    p_notas, p_operador, p_dias_credito, v_org, p_tasa_iva
  )
  RETURNING * INTO v_proforma;

  UPDATE public.conceptos_venta
  SET estado_facturacion = 'en_proforma', proforma_id = v_proforma.id
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org
    AND embarque_id = p_embarque_id
    AND proforma_id IS NULL
    AND COALESCE(estado_facturacion, 'pendiente') = 'pendiente';

  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  IF v_actualizados <> array_length(p_concepto_ids, 1) THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_YA_ASIGNADOS: los conceptos cambiaron de estado durante la operación; recarga la pantalla'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_proforma;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consolidar_proformas(p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_operador text, p_dias_credito integer, p_organization_id uuid, p_proforma_ids uuid[], p_tasa_iva numeric DEFAULT 0.16, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS proformas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nueva          public.proformas;
  v_cached         jsonb;
  v_caller_org     uuid;
  v_org_efectiva   uuid;
  v_count          int;
  v_numero         text;
  v_subtotal_usd   numeric := 0;
  v_iva_usd        numeric := 0;
  v_total_usd      numeric := 0;
  v_subtotal_mxn   numeric := 0;
  v_iva_mxn        numeric := 0;
  v_total_mxn      numeric := 0;
  v_no_soportados  int;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'consolidar_proformas');
  IF v_cached IS NOT NULL THEN
    SELECT * INTO v_nueva FROM public.proformas WHERE id = (v_cached->>'id')::uuid;
    IF FOUND THEN RETURN v_nueva; END IF;
  END IF;

  v_caller_org := public.current_user_org_id();
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org_efectiva := p_organization_id;
  ELSE
    v_org_efectiva := v_caller_org;
  END IF;
  PERFORM public._assert_writer(v_org_efectiva);

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL OR array_length(p_proforma_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Selecciona al menos 2 proformas para consolidar';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND organization_id = v_org_efectiva;
  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o no pertenecen a la organización';
  END IF;

  -- Ola 3: la consolidación no puede cruzar embarques.
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND embarque_id IS DISTINCT FROM p_embarque_id
  ) THEN
    RAISE EXCEPTION
      'LC_PROFORMA_EMBARQUE_AJENO: todas las proformas a consolidar deben pertenecer al mismo embarque'
      USING ERRCODE = 'P0001';
  END IF;

  -- Ola 2 · A: guard equivalente al de crear_proforma_atomica sobre los
  -- conceptos subyacentes (una moneda no soportada consolidaba en $0).
  SELECT COUNT(*) INTO v_no_soportados
  FROM public.conceptos_venta cv
  WHERE cv.proforma_id = ANY(p_proforma_ids)
    AND cv.organization_id = v_org_efectiva
    AND cv.deleted_at IS NULL
    AND cv.moneda NOT IN ('MXN', 'USD');

  IF v_no_soportados > 0 THEN
    RAISE EXCEPTION 'LC_MONEDA_VENTA_NO_SOPORTADA: % concepto(s) de venta tienen una moneda no soportada; sólo se puede facturar en MXN o USD', v_no_soportados
      USING ERRCODE = 'P0001';
  END IF;

  v_numero := public.generar_numero_proforma(v_org_efectiva);

  -- El encabezado nace en cero y se recalcula abajo como la suma EXACTA del
  -- detalle regenerado (A-1): copiar los totales persistidos de las proformas
  -- origen podía no cuadrar con el detalle.
  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id,
    estado_revision, es_consolidada, proformas_origen, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    0, 0, 0, 0, 0, 0,
    'Consolidación de ' || array_length(p_proforma_ids, 1) || ' proformas',
    p_operador, p_dias_credito, v_org_efectiva,
    'aprobada', true, p_proforma_ids, p_tasa_iva
  ) RETURNING * INTO v_nueva;

  -- A-1: cantidad SIN ::int (BL-1 permite decimales); IVA por LÍNEA con la
  -- tasa propia de cada concepto (canon resolverTasaConcepto: tasa explícita
  -- si existe; si no, la global cuando aplica_iva, y 0 en caso contrario) y
  -- redondeo por línea (BL-12). La tasa efectiva entra al GROUP BY para no
  -- mezclar líneas gravadas al 16% con líneas al 8% frontera.
  INSERT INTO public.proforma_conceptos_consolidados (
    proforma_id, embarque_id, contenedor, tipo_contenedor,
    descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, iva,
    organization_id, tasa_iva_aplicada
  )
  SELECT
    v_nueva.id, cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, SUM(cv.cantidad), cv.precio_unitario,
    ROUND(SUM(cv.cantidad * cv.precio_unitario), 2), cv.moneda, cv.aplica_iva,
    ROUND(SUM(cv.cantidad * cv.precio_unitario)
          * COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END), 2),
    v_org_efectiva,
    COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
  FROM public.conceptos_venta cv
  LEFT JOIN public.embarques e ON e.id = cv.embarque_id
  LEFT JOIN public.embarque_contenedores ec ON ec.id = cv.contenedor_id
  WHERE cv.proforma_id = ANY(p_proforma_ids)
    AND cv.organization_id = v_org_efectiva
    AND cv.embarque_id = p_embarque_id
    AND cv.deleted_at IS NULL
  GROUP BY cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, cv.precio_unitario, cv.moneda, cv.aplica_iva,
    COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END);

  -- Encabezado = Σ del detalle recién generado (alineado con
  -- calcularTotalesProforma: subtotal sin IVA, iva por línea, total = suma).
  SELECT
    COALESCE(SUM(pcc.total) FILTER (WHERE pcc.moneda = 'USD'), 0),
    COALESCE(SUM(pcc.iva)   FILTER (WHERE pcc.moneda = 'USD'), 0),
    COALESCE(SUM(pcc.total) FILTER (WHERE pcc.moneda = 'MXN'), 0),
    COALESCE(SUM(pcc.iva)   FILTER (WHERE pcc.moneda = 'MXN'), 0)
  INTO v_subtotal_usd, v_iva_usd, v_subtotal_mxn, v_iva_mxn
  FROM public.proforma_conceptos_consolidados pcc
  WHERE pcc.proforma_id = v_nueva.id;

  v_total_usd := v_subtotal_usd + v_iva_usd;
  v_total_mxn := v_subtotal_mxn + v_iva_mxn;

  UPDATE public.proformas
  SET subtotal_usd = v_subtotal_usd, iva_usd = v_iva_usd, total_usd = v_total_usd,
      subtotal_mxn = v_subtotal_mxn, iva_mxn = v_iva_mxn, total_mxn = v_total_mxn
  WHERE id = v_nueva.id
  RETURNING * INTO v_nueva;

  UPDATE public.proformas
  SET estado_revision = 'consolidada', consolidada_en = v_nueva.id
  WHERE id = ANY(p_proforma_ids);

  -- v13.301.69 FIX BUG 2: repuntar conceptos_venta a la proforma consolidada
  -- para que sync_conceptos_venta_facturado propague correctamente al
  -- facturar/cancelar. Bypass defensivo de los guards internos.
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.conceptos_venta
     SET proforma_id = v_nueva.id
   WHERE proforma_id = ANY(p_proforma_ids)
     AND organization_id = v_org_efectiva
     AND deleted_at IS NULL;
  PERFORM set_config('app.bypass_cierre', 'off', true);

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_nueva.id));
  RETURN v_nueva;
END;
$function$;