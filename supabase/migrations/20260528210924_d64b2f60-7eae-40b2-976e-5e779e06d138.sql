-- Fase 1.2: consolidar_proformas ahora obtiene contenedor/tipo desde embarque_contenedores
-- vía conceptos_venta.contenedor_id (con fallback a embarques.contenedor legacy si el
-- concepto es general / no tiene contenedor asignado).
CREATE OR REPLACE FUNCTION public.consolidar_proformas(
  p_embarque_id uuid,
  p_cliente_id uuid,
  p_cliente_nombre text,
  p_expediente text,
  p_bl_master text,
  p_operador text,
  p_dias_credito integer,
  p_organization_id uuid,
  p_proforma_ids uuid[],
  p_tasa_iva numeric DEFAULT 0.16,
  p_request_id uuid DEFAULT NULL
)
RETURNS public.proformas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_nueva           public.proformas;
  v_cached          jsonb;
  v_numero          text;
  v_count           int;
  v_subtotal_usd    numeric;
  v_iva_usd         numeric;
  v_total_usd       numeric;
  v_subtotal_mxn    numeric;
  v_iva_mxn         numeric;
  v_total_mxn       numeric;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'consolidar_proformas');
  IF v_cached IS NOT NULL THEN
    SELECT * INTO v_nueva FROM public.proformas WHERE id = (v_cached->>'id')::uuid;
    IF FOUND THEN
      RETURN v_nueva;
    END IF;
  END IF;

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL OR array_length(p_proforma_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Selecciona al menos 2 proformas para consolidar';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND organization_id = p_organization_id;
  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o no pertenecen a la organización';
  END IF;

  SELECT
    COALESCE(SUM(subtotal_usd), 0), COALESCE(SUM(iva_usd), 0), COALESCE(SUM(total_usd), 0),
    COALESCE(SUM(subtotal_mxn), 0), COALESCE(SUM(iva_mxn), 0), COALESCE(SUM(total_mxn), 0)
  INTO v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn
  FROM public.proformas WHERE id = ANY(p_proforma_ids);

  v_numero := public.generar_numero_proforma(p_organization_id);

  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id,
    estado_revision, es_consolidada, proformas_origen, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn,
    'Consolidación de ' || array_length(p_proforma_ids, 1) || ' proformas',
    p_operador, p_dias_credito, p_organization_id,
    'aprobada', true, p_proforma_ids, p_tasa_iva
  ) RETURNING * INTO v_nueva;

  -- Insert agrupando por el contenedor REAL (numero_contenedor del hijo), con fallback
  -- al campo legacy `embarques.contenedor` cuando el concepto no tiene contenedor_id.
  INSERT INTO public.proforma_conceptos_consolidados (
    proforma_id, embarque_id, contenedor, tipo_contenedor,
    descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, iva,
    organization_id, tasa_iva_aplicada
  )
  SELECT
    v_nueva.id,
    cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, SUM(cv.cantidad)::int, cv.precio_unitario,
    SUM(cv.cantidad * cv.precio_unitario), cv.moneda, cv.aplica_iva,
    CASE WHEN cv.aplica_iva THEN ROUND(SUM(cv.cantidad * cv.precio_unitario) * p_tasa_iva, 2) ELSE 0 END,
    p_organization_id, p_tasa_iva
  FROM public.conceptos_venta cv
  LEFT JOIN public.embarques e ON e.id = cv.embarque_id
  LEFT JOIN public.embarque_contenedores ec ON ec.id = cv.contenedor_id
  WHERE cv.proforma_id = ANY(p_proforma_ids)
  GROUP BY
    cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, cv.precio_unitario, cv.moneda, cv.aplica_iva;

  UPDATE public.proformas
  SET estado_revision = 'consolidada', consolidada_en = v_nueva.id
  WHERE id = ANY(p_proforma_ids);

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_nueva.id));
  RETURN v_nueva;
END;
$function$;