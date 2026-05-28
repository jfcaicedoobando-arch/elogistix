
-- ============================================================
-- Fase 5 (v12.13.0) — Atomicidad de proformas y contenedores
-- ============================================================

-- ----------------------------------------------------------------
-- B-2: columna factura_secundaria_id en proformas
-- ----------------------------------------------------------------
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS factura_secundaria_id uuid REFERENCES public.facturas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.proformas.factura_secundaria_id IS
  'ID de la segunda factura cuando la proforma genera dos (USD + MXN). NULL en proformas single-currency.';

-- ----------------------------------------------------------------
-- B-1: crear_proforma_atomica
-- Combina update aplica_iva + insert proforma + update conceptos en una sola tx.
-- ----------------------------------------------------------------
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
BEGIN
  IF p_concepto_ids IS NULL OR array_length(p_concepto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un concepto';
  END IF;

  -- 1) Aplicar overrides de IVA por concepto (si los hay)
  IF p_iva_overrides IS NOT NULL AND p_iva_overrides <> '{}'::jsonb THEN
    FOR v_override IN
      SELECT key AS concepto_id, (value)::text::boolean AS aplica
      FROM jsonb_each(p_iva_overrides)
    LOOP
      UPDATE public.conceptos_venta
      SET aplica_iva = v_override.aplica
      WHERE id = v_override.concepto_id::uuid;
    END LOOP;
  END IF;

  -- 2) Generar número
  v_numero := public.generar_numero_proforma(p_organization_id);

  -- 3) Insert proforma
  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    p_subtotal_usd, p_iva_usd, p_total_usd, p_subtotal_mxn, p_iva_mxn, p_total_mxn,
    p_notas, p_operador, p_dias_credito, p_organization_id, p_tasa_iva
  )
  RETURNING * INTO v_proforma;

  -- 4) Vincular conceptos
  UPDATE public.conceptos_venta
  SET estado_facturacion = 'en_proforma', proforma_id = v_proforma.id
  WHERE id = ANY(p_concepto_ids);

  RETURN v_proforma;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_proforma_atomica(uuid, uuid, uuid, text, text, text, uuid[], numeric, numeric, numeric, numeric, numeric, numeric, text, text, integer, numeric, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.crear_proforma_atomica IS
  'Crea una proforma de forma atómica: aplica overrides de IVA, inserta proforma y vincula conceptos en una sola transacción.';

-- ----------------------------------------------------------------
-- C-4: sincronizar_contenedores_embarque
-- Sincroniza la lista de hijos en una sola transacción.
-- ----------------------------------------------------------------
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
  -- Validar tenancy: el embarque debe existir y pertenecer a una org accesible
  SELECT organization_id INTO v_org_id
  FROM public.embarques
  WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado: %', p_embarque_id;
  END IF;

  -- 1) Recolectar IDs que deben conservarse (los que vienen con id en el payload)
  SELECT COALESCE(array_agg((elem->>'id')::uuid), ARRAY[]::uuid[]) INTO v_ids_conservados
  FROM jsonb_array_elements(p_contenedores) AS elem
  WHERE elem ? 'id' AND elem->>'id' IS NOT NULL AND elem->>'id' <> '';

  -- 2) Soft-delete de los hijos actuales que no están en la lista nueva
  UPDATE public.embarque_contenedores
  SET deleted_at = now()
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND NOT (id = ANY(v_ids_conservados));

  -- 3) Procesar cada entrada del payload (UPDATE existente o INSERT nuevo)
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
      WHERE id = v_input.id_str::uuid;
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

  -- 4) Retornar la lista resultante
  RETURN QUERY
  SELECT *
  FROM public.embarque_contenedores
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
  ORDER BY orden ASC, created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_contenedores_embarque(uuid, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.sincronizar_contenedores_embarque IS
  'Sincroniza la lista de contenedores hijos de un embarque en una sola transacción, preservando IDs para no romper FKs.';
