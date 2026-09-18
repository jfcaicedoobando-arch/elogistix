-- P1 · Auditoría IVA — consolidar_proformas: tasa canónica por tratamiento.
--
-- Antes la tasa faltante (`tasa_iva_aplicada IS NULL`) se rellenaba con la tasa
-- general `p_tasa_iva` incluso cuando el renglón declaraba `gravado_8` o
-- `tasa_0`, así que una línea al 8% se consolidaba (y se cobraba) al 16% y
-- quedaba incoherente para el timbrado. Ahora el tratamiento explícito manda:
--   gravado_16 → tasa general de la organización (p_tasa_iva)
--   gravado_8  → 8% (estímulo de región fronteriza)
--   tasa_0 / exento / no_objeto → 0 (no_objeto además guarda tasa NULL)
-- Sólo los renglones legacy SIN tipo_iva conservan el comportamiento anterior.
-- No se alteran filas históricas: la función sólo afecta consolidaciones nuevas.

CREATE OR REPLACE FUNCTION public.consolidar_proformas(p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_operador text, p_dias_credito integer, p_organization_id uuid, p_proforma_ids uuid[], p_tasa_iva numeric DEFAULT 0.16, p_request_id uuid DEFAULT NULL::uuid) RETURNS public.proformas
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
  -- A-1: cantidad SIN ::int (BL-1 permite decimales); IVA por LÍNEA con la tasa
  -- propia de cada concepto y redondeo por línea (BL-12). La tasa efectiva y el
  -- tratamiento fiscal explícito entran al GROUP BY: 'no_objeto', 'exento' y
  -- 'tasa_0' quedan en líneas distintas aunque su IVA sea 0.
  INSERT INTO public.proforma_conceptos_consolidados (
    proforma_id, embarque_id, contenedor, tipo_contenedor,
    descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, iva,
    organization_id, tasa_iva_aplicada, tipo_iva
  )
  SELECT
    v_nueva.id, cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, SUM(cv.cantidad), cv.precio_unitario,
    ROUND(SUM(cv.cantidad * cv.precio_unitario), 2), cv.moneda,
    CASE WHEN cv.tipo_iva IN ('no_objeto', 'exento') THEN false ELSE cv.aplica_iva END,
    ROUND(SUM(cv.cantidad * cv.precio_unitario) * CASE
            WHEN cv.tipo_iva = 'gravado_16' THEN p_tasa_iva
            WHEN cv.tipo_iva = 'gravado_8'  THEN 0.08
            WHEN cv.tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
            ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
          END, 2),
    v_org_efectiva,
    CASE WHEN cv.tipo_iva = 'no_objeto' THEN NULL
         ELSE CASE
            WHEN cv.tipo_iva = 'gravado_16' THEN p_tasa_iva
            WHEN cv.tipo_iva = 'gravado_8'  THEN 0.08
            WHEN cv.tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
            ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
          END
    END,
    cv.tipo_iva
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
    cv.descripcion, cv.precio_unitario, cv.moneda, cv.aplica_iva, cv.tipo_iva,
    CASE
            WHEN cv.tipo_iva = 'gravado_16' THEN p_tasa_iva
            WHEN cv.tipo_iva = 'gravado_8'  THEN 0.08
            WHEN cv.tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
            ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
          END;
  -- Encabezado = Σ del detalle recién generado.
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
  -- para que sync_conceptos_venta_facturado propague al facturar/cancelar.
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
$_$;
