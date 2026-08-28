-- Fuente canónica de public._cxp_validar_aprobacion(uuid, text).
-- 1:1 con supabase/migrations/20260827224436_426fa39b-ab98-40b6-b31d-89ce1b2b660f.sql
-- (Ola 4 · H2 three-way match: exige justificación y respeta el umbral por organización).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public._cxp_validar_aprobacion(p_factura_id uuid, p_justificacion text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_conceptos_count integer;
  v_suma_conceptos numeric(18,4);
  v_suma_cantidades numeric(18,4);
  v_tolerancia numeric(18,4);
  v_diferencia numeric(18,4);
  v_emb_estado text;
  v_emb_org uuid;
  v_origen text;
  v_tiene_xml_lineas boolean;
  v_suma_vinculada numeric(18,4);
  v_comprometido numeric(18,4);
  v_sobrecosto numeric(18,4);
  v_total_mxn numeric(18,4);
  v_umbral numeric;
BEGIN
  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_factura_id;
  IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: La factura no existe.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.proveedor_facturas_conceptos
    WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NULL
  ) INTO v_tiene_xml_lineas;

  IF v_tiene_xml_lineas THEN
    SELECT COUNT(*),
           COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0),
           COALESCE(SUM(COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos, v_suma_cantidades
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id
        AND concepto_costo_id IS NULL;
  ELSE
    SELECT COUNT(*),
           COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0),
           COALESCE(SUM(COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos, v_suma_cantidades
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id;
  END IF;

  IF v_conceptos_count = 0 THEN
    RAISE EXCEPTION 'LC_CXP_SIN_CONCEPTOS: Captura los conceptos de la factura antes de aprobar.';
  END IF;

  -- Tolerancia de redondeo: medio centavo por unidad de cantidad (el precio
  -- unitario del CFDI viene redondeado a 2 decimales y el error se multiplica
  -- por la cantidad). Mínimo 1 centavo. Un error real de captura sigue fallando.
  v_tolerancia := GREATEST(0.01, 0.005 * COALESCE(v_suma_cantidades,0));

  v_diferencia := ABS(COALESCE(v_row.subtotal,0) - v_suma_conceptos);
  IF v_diferencia > v_tolerancia THEN
    RAISE EXCEPTION 'LC_CXP_DESCUADRE: Los conceptos (%) no cuadran con el subtotal (%) de la factura. Diferencia: % (tolerancia: %)',
      to_char(v_suma_conceptos,          'FM999,999,999,990.00'),
      to_char(COALESCE(v_row.subtotal,0),'FM999,999,999,990.00'),
      to_char(v_diferencia,              'FM999,999,999,990.00'),
      to_char(v_tolerancia,              'FM999,999,999,990.00');
  END IF;

  -- QA B-15: lo facturado en conceptos vinculados no debe exceder lo
  -- comprometido en conceptos_costo (tolerancia 0.02; umbral duro 5%).
  SELECT COALESCE(SUM(pfc.monto * COALESCE(NULLIF(pfc.cantidad,0),1)), 0),
         COALESCE(SUM(cc.monto), 0)
    INTO v_suma_vinculada, v_comprometido
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.conceptos_costo cc
      ON cc.id = pfc.concepto_costo_id AND cc.deleted_at IS NULL
   WHERE pfc.proveedor_factura_id = p_factura_id
     AND pfc.concepto_costo_id IS NOT NULL;

  v_sobrecosto := v_suma_vinculada - v_comprometido;
  IF v_sobrecosto > 0.02 THEN
    IF v_comprometido > 0 AND v_sobrecosto > v_comprometido * 0.05 THEN
      RAISE EXCEPTION 'LC_CXP_SOBRECOSTO: Lo facturado (%) excede lo comprometido (%) en %; revisa los conceptos vinculados antes de aprobar.',
        to_char(v_suma_vinculada, 'FM999,999,999,990.00'),
        to_char(v_comprometido,   'FM999,999,999,990.00'),
        to_char(v_sobrecosto,     'FM999,999,999,990.00');
    ELSE
      RAISE WARNING 'LC_CXP_SOBRECOSTO: lo facturado (%) excede lo comprometido (%) en % (<= 5%%, se aprueba con advertencia).',
        to_char(v_suma_vinculada, 'FM999,999,999,990.00'),
        to_char(v_comprometido,   'FM999,999,999,990.00'),
        to_char(v_sobrecosto,     'FM999,999,999,990.00');
    END IF;
  END IF;

  -- Ola 4 (H2): three-way match mínimo. Sin embarque ni un solo concepto ligado
  -- a costo acordado no hay nada contra qué contrastar: se exige justificación
  -- escrita y, por arriba del umbral de la organización, se rechaza.
  IF v_row.embarque_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.proveedor_facturas_conceptos
        WHERE proveedor_factura_id = p_factura_id
          AND concepto_costo_id IS NOT NULL
     )
  THEN
    v_total_mxn := COALESCE(v_row.total,0) * CASE
      WHEN v_row.moneda = 'MXN'::public.moneda THEN 1
      ELSE COALESCE(NULLIF(v_row.tipo_cambio_usd,0), 1)
    END;
    v_umbral := public.cxp_umbral_sin_vinculo(v_row.organization_id);

    IF v_total_mxn > v_umbral THEN
      RAISE EXCEPTION 'LC_CXP_SIN_RESPALDO_MONTO: La factura por % MXN no está ligada a un embarque ni a costos acordados y excede el umbral autorizado (%). Vincúlala al embarque o a sus conceptos de costo antes de aprobar.',
        to_char(v_total_mxn, 'FM999,999,999,990.00'),
        to_char(v_umbral,    'FM999,999,999,990.00');
    END IF;

    IF length(COALESCE(btrim(p_justificacion), '')) < 10 THEN
      RAISE EXCEPTION 'LC_CXP_SIN_RESPALDO: Esta factura no está ligada a un embarque ni a costos acordados. Escribe la justificación del gasto (mínimo 10 caracteres) para aprobarla.';
    END IF;
  END IF;

  IF v_row.embarque_id IS NOT NULL THEN
    SELECT estado, organization_id INTO v_emb_estado, v_emb_org
      FROM public.embarques WHERE id = v_row.embarque_id;
    IF v_emb_estado IS NULL THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_NO_EXISTE: El embarque asociado no existe.';
    END IF;
    IF v_emb_estado = 'Cancelado' THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_CANCELADO: El embarque asociado está cancelado.';
    END IF;
    IF v_emb_org IS DISTINCT FROM v_row.organization_id THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_ORG_MISMATCH: El embarque pertenece a otra organización.';
    END IF;
  END IF;

  SELECT origen_proveedor::text INTO v_origen
    FROM public.proveedores WHERE id = v_row.proveedor_id;

  IF COALESCE(v_origen,'Nacional') = 'Nacional'
     AND v_row.uuid_fiscal IS NOT NULL
     AND COALESCE(v_row.uuid_verificado,false) = false THEN
    RAISE EXCEPTION 'LC_CXP_UUID_NO_VERIFICADO: Verifica el UUID en el SAT antes de aprobar.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cxp_validar_aprobacion(uuid, text) TO authenticated, service_role;
