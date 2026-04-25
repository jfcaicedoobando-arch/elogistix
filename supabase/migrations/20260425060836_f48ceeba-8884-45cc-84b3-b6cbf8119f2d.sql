-- RPC atómica para consolidar proformas. Toda la operación corre en una sola
-- transacción, eliminando los rollbacks manuales del cliente y garantizando
-- consistencia incluso si algún paso intermedio falla.
CREATE OR REPLACE FUNCTION public.consolidar_proformas(
  p_organization_id uuid,
  p_proforma_ids uuid[],
  p_embarque_id uuid,
  p_cliente_id uuid,
  p_cliente_nombre text,
  p_expediente text,
  p_bl_master text,
  p_operador text,
  p_dias_credito int,
  p_tasa_iva numeric
)
RETURNS public.proformas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
  v_numero text;
  v_nueva public.proformas%ROWTYPE;
  v_subtotal_usd numeric := 0;
  v_iva_usd numeric := 0;
  v_total_usd numeric := 0;
  v_subtotal_mxn numeric := 0;
  v_iva_mxn numeric := 0;
  v_total_mxn numeric := 0;
BEGIN
  -- Validaciones básicas
  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL OR array_length(p_proforma_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Selecciona al menos 2 proformas para consolidar';
  END IF;

  -- Verificar que todas las proformas existen y pertenecen a la organización
  SELECT count(*) INTO v_count
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids)
    AND organization_id = p_organization_id;

  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o no pertenecen a la organización';
  END IF;

  -- 1. Sumar totales desde las originales
  SELECT
    COALESCE(SUM(subtotal_usd), 0),
    COALESCE(SUM(iva_usd), 0),
    COALESCE(SUM(total_usd), 0),
    COALESCE(SUM(subtotal_mxn), 0),
    COALESCE(SUM(iva_mxn), 0),
    COALESCE(SUM(total_mxn), 0)
  INTO
    v_subtotal_usd, v_iva_usd, v_total_usd,
    v_subtotal_mxn, v_iva_mxn, v_total_mxn
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids);

  -- 2. Generar número consecutivo
  v_numero := public.generar_numero_proforma(p_organization_id);

  -- 3. Insertar la proforma consolidada
  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id,
    estado_revision, es_consolidada, proformas_origen
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn,
    'Consolidación de ' || array_length(p_proforma_ids, 1) || ' proformas',
    p_operador, p_dias_credito, p_organization_id,
    'aprobada', true, p_proforma_ids
  )
  RETURNING * INTO v_nueva;

  -- 4. Snapshot de conceptos consolidados, agrupados por (embarque, descripción,
  -- moneda, aplica_iva, precio_unitario). Hereda contenedor/tipo del embarque.
  INSERT INTO public.proforma_conceptos_consolidados (
    proforma_id, embarque_id, contenedor, tipo_contenedor,
    descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, iva,
    organization_id
  )
  SELECT
    v_nueva.id,
    cv.embarque_id,
    e.contenedor,
    e.tipo_contenedor,
    cv.descripcion,
    SUM(cv.cantidad)::int AS cantidad,
    cv.precio_unitario,
    SUM(cv.cantidad * cv.precio_unitario) AS total,
    cv.moneda,
    cv.aplica_iva,
    CASE
      WHEN cv.aplica_iva THEN ROUND(SUM(cv.cantidad * cv.precio_unitario) * p_tasa_iva, 2)
      ELSE 0
    END AS iva,
    p_organization_id
  FROM public.conceptos_venta cv
  LEFT JOIN public.embarques e ON e.id = cv.embarque_id
  WHERE cv.proforma_id = ANY(p_proforma_ids)
  GROUP BY cv.embarque_id, e.contenedor, e.tipo_contenedor,
           cv.descripcion, cv.precio_unitario, cv.moneda, cv.aplica_iva;

  -- 5. Marcar las originales como consolidadas
  UPDATE public.proformas
  SET estado_revision = 'consolidada',
      consolidada_en = v_nueva.id
  WHERE id = ANY(p_proforma_ids);

  RETURN v_nueva;
END;
$$;