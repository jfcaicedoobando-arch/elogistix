-- Endurecer autorización en RPCs SECURITY DEFINER:
--   1) crear_proforma_atomica: validar writer + filtrar overrides por org.
--   2) sincronizar_contenedores_embarque: validar writer del embarque.
--   3) generar_liquidacion_comision: forzar org del caller (no super_admin).

-- 1) crear_proforma_atomica
CREATE OR REPLACE FUNCTION public.crear_proforma_atomica(
  p_organization_id uuid,
  p_embarque_id uuid,
  p_cliente_id uuid,
  p_cliente_nombre text,
  p_expediente text,
  p_bl_master text,
  p_concepto_ids uuid[],
  p_subtotal_usd numeric,
  p_iva_usd numeric,
  p_total_usd numeric,
  p_subtotal_mxn numeric,
  p_iva_mxn numeric,
  p_total_mxn numeric,
  p_notas text,
  p_operador text,
  p_dias_credito integer,
  p_tasa_iva numeric,
  p_iva_overrides jsonb DEFAULT '{}'::jsonb
) RETURNS public.proformas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero text;
  v_proforma public.proformas;
  v_override record;
  v_org uuid;
BEGIN
  IF p_concepto_ids IS NULL OR array_length(p_concepto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un concepto';
  END IF;

  -- Forzar org del caller (excepto super_admin) y validar permisos de escritura.
  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;
  PERFORM public._assert_writer(v_org);

  -- 1) Aplicar overrides de IVA por concepto (filtrando por org)
  IF p_iva_overrides IS NOT NULL AND p_iva_overrides <> '{}'::jsonb THEN
    FOR v_override IN
      SELECT key AS concepto_id, (value)::text::boolean AS aplica
      FROM jsonb_each(p_iva_overrides)
    LOOP
      UPDATE public.conceptos_venta
      SET aplica_iva = v_override.aplica
      WHERE id = v_override.concepto_id::uuid
        AND organization_id = v_org;
    END LOOP;
  END IF;

  v_numero := public.generar_numero_proforma(v_org);

  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    p_subtotal_usd, p_iva_usd, p_total_usd, p_subtotal_mxn, p_iva_mxn, p_total_mxn,
    p_notas, p_operador, p_dias_credito, v_org, p_tasa_iva
  )
  RETURNING * INTO v_proforma;

  UPDATE public.conceptos_venta
  SET estado_facturacion = 'en_proforma', proforma_id = v_proforma.id
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org;

  RETURN v_proforma;
END;
$$;

-- 2) sincronizar_contenedores_embarque
CREATE OR REPLACE FUNCTION public.sincronizar_contenedores_embarque(
  p_embarque_id uuid,
  p_contenedores jsonb
) RETURNS SETOF public.embarque_contenedores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_input record;
  v_ids_conservados uuid[];
  v_orden integer := 0;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.embarques
  WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado: %', p_embarque_id;
  END IF;

  PERFORM public._assert_writer(v_org_id);

  SELECT COALESCE(array_agg((elem->>'id')::uuid), ARRAY[]::uuid[]) INTO v_ids_conservados
  FROM jsonb_array_elements(p_contenedores) AS elem
  WHERE elem ? 'id' AND elem->>'id' IS NOT NULL AND elem->>'id' <> '';

  UPDATE public.embarque_contenedores
  SET deleted_at = now()
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND NOT (id = ANY(v_ids_conservados));

  FOR v_input IN
    SELECT
      (elem->>'id') AS id_str,
      (elem->>'numero_contenedor') AS numero_contenedor,
      (elem->>'tipo_contenedor') AS tipo_contenedor,
      NULLIF(elem->>'bl_house', '') AS bl_house,
      NULLIF(elem->>'peso_kg', '')::numeric AS peso_kg,
      NULLIF(elem->>'volumen_m3', '')::numeric AS volumen_m3,
      NULLIF(elem->>'piezas', '')::integer AS piezas,
      COALESCE(NULLIF(elem->>'orden', '')::integer, 0) AS orden,
      ord.rn AS pos
    FROM jsonb_array_elements(p_contenedores) WITH ORDINALITY AS ord(elem, rn)
    ORDER BY ord.rn
  LOOP
    v_orden := COALESCE(NULLIF(v_input.orden, 0), v_input.pos::integer);

    IF v_input.id_str IS NOT NULL AND v_input.id_str <> '' THEN
      UPDATE public.embarque_contenedores
      SET numero_contenedor = v_input.numero_contenedor,
          tipo_contenedor = v_input.tipo_contenedor,
          bl_house = v_input.bl_house,
          peso_kg = v_input.peso_kg,
          volumen_m3 = v_input.volumen_m3,
          piezas = v_input.piezas,
          orden = v_orden
      WHERE id = v_input.id_str::uuid
        AND embarque_id = p_embarque_id;
    ELSE
      INSERT INTO public.embarque_contenedores (
        embarque_id, numero_contenedor, tipo_contenedor, bl_house,
        peso_kg, volumen_m3, piezas, orden
      ) VALUES (
        p_embarque_id, v_input.numero_contenedor, v_input.tipo_contenedor, v_input.bl_house,
        v_input.peso_kg, v_input.volumen_m3, v_input.piezas, v_orden
      );
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT *
  FROM public.embarque_contenedores
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
  ORDER BY orden ASC, created_at ASC;
END;
$$;

-- 3) generar_liquidacion_comision
CREATE OR REPLACE FUNCTION public.generar_liquidacion_comision(
  p_vendedora_id uuid, p_periodo text, p_organization_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric(14,2);
  v_liq_id uuid;
  v_org uuid;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;
  PERFORM public._assert_writer(v_org);

  SELECT COALESCE(SUM(comision_mxn), 0) INTO v_total
    FROM comisiones_devengadas
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Sin comisiones devengadas para liquidar';
  END IF;

  INSERT INTO liquidaciones_comision (organization_id, vendedora_id, periodo, total_mxn, creada_por)
  VALUES (v_org, p_vendedora_id, p_periodo, v_total, auth.uid())
  RETURNING id INTO v_liq_id;

  UPDATE comisiones_devengadas
     SET estado = 'Liquidada', liquidacion_id = v_liq_id, updated_at = now()
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  RETURN v_liq_id;
END;
$$;