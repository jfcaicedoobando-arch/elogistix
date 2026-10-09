-- Audit147: una moneda por tabulador; totales de embarque por moneda.
-- Sin conversión implícita, backfill ni recálculo de registros existentes.


-- Helper privado: calcula monto de costo (naviera) y venta (org) para un contenedor
-- según el número de días excedidos, aplicando el tabulador escalonado.
-- Consumido por public.calcular_demoras_embarque.
CREATE OR REPLACE FUNCTION public._calcular_demoras_montos_contenedor(
  p_cond_id uuid,
  p_org uuid,
  p_tipo_cont_id uuid,
  p_dias_excedidos integer,
  p_moneda_default text
) RETURNS TABLE(monto_costo numeric, moneda_costo text, monto_venta numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_monedas integer;
BEGIN
  monto_costo := 0;
  monto_venta := 0;
  moneda_costo := COALESCE(p_moneda_default, 'USD');

  IF p_dias_excedidos IS NULL OR p_dias_excedidos <= 0 OR p_tipo_cont_id IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_cond_id IS NOT NULL THEN
    -- El contrato devuelve un importe y una moneda, sin TC ni fecha de conversión.
    -- Revisar todo el tabulador, incluso tramos futuros o de importe cero.
    SELECT COUNT(DISTINCT moneda) INTO v_monedas
    FROM public.costeo_naviera_demoras_tarifa
    WHERE naviera_condicion_id = p_cond_id
      AND tipo_contenedor_id = p_tipo_cont_id;
    IF v_monedas > 1 THEN
      RAISE EXCEPTION 'LC_DEMORAS_MONEDAS_MIXTAS: el tabulador de este tipo de contenedor mezcla monedas. Usa una sola moneda por tabulador; no hay conversión automática.';
    END IF;

    SELECT
      COALESCE(SUM(
        CASE WHEN d >= t.desde_dia AND (t.hasta_dia IS NULL OR d <= t.hasta_dia) THEN t.monto_por_dia ELSE 0 END
      ),0),
      COALESCE(MAX(t.moneda), COALESCE(p_moneda_default,'USD'))
    INTO monto_costo, moneda_costo
    FROM generate_series(1, p_dias_excedidos) d
    LEFT JOIN LATERAL (
      SELECT monto_por_dia, moneda, desde_dia, hasta_dia
      FROM public.costeo_naviera_demoras_tarifa
      WHERE naviera_condicion_id = p_cond_id
        AND tipo_contenedor_id = p_tipo_cont_id
        AND d >= desde_dia
        AND (hasta_dia IS NULL OR d <= hasta_dia)
      ORDER BY desde_dia DESC LIMIT 1
    ) t ON true;
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN d >= t.desde_dia AND (t.hasta_dia IS NULL OR d <= t.hasta_dia) THEN t.monto_por_dia_usd ELSE 0 END
  ),0)
  INTO monto_venta
  FROM generate_series(1, p_dias_excedidos) d
  LEFT JOIN LATERAL (
    SELECT monto_por_dia_usd, desde_dia, hasta_dia
    FROM public.costeo_demoras_venta_tarifa
    WHERE organization_id = p_org
      AND tipo_contenedor_id = p_tipo_cont_id
      AND (vigente_desde IS NULL OR vigente_desde <= CURRENT_DATE)
      AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
      AND d >= desde_dia
      AND (hasta_dia IS NULL OR d <= hasta_dia)
    ORDER BY desde_dia DESC LIMIT 1
  ) t ON true;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._calcular_demoras_montos_contenedor(uuid, uuid, uuid, integer, text) FROM PUBLIC, anon;
-- Preservar ACL efectiva del historial: este helper no otorga EXECUTE a service_role.
GRANT EXECUTE ON FUNCTION public._calcular_demoras_montos_contenedor(uuid, uuid, uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.calcular_costo_demoras(
  p_naviera_condicion_id uuid,
  p_tipo_contenedor_id uuid,
  p_dias_excedidos integer
) RETURNS TABLE (total numeric, moneda text, desglose jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_total numeric := 0;
  v_moneda text := 'USD';
  v_desglose jsonb := '[]'::jsonb;
  v_dias_en_tramo integer;
  v_top integer;
  v_monedas integer;
BEGIN
  IF p_dias_excedidos IS NULL OR p_dias_excedidos < 1 THEN
    RETURN QUERY SELECT 0::numeric, v_moneda, v_desglose;
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT t.moneda) INTO v_monedas
  FROM public.costeo_naviera_demoras_tarifa t
  WHERE t.naviera_condicion_id = p_naviera_condicion_id
    AND t.tipo_contenedor_id = p_tipo_contenedor_id;
  IF v_monedas > 1 THEN
    RAISE EXCEPTION 'LC_DEMORAS_MONEDAS_MIXTAS: el tabulador de este tipo de contenedor mezcla monedas. Usa una sola moneda por tabulador; no hay conversión automática.';
  END IF;

  FOR r IN
    SELECT t.desde_dia, t.hasta_dia, t.monto_por_dia, t.moneda
    FROM public.costeo_naviera_demoras_tarifa t
    WHERE naviera_condicion_id = p_naviera_condicion_id
      AND tipo_contenedor_id = p_tipo_contenedor_id
      AND desde_dia <= p_dias_excedidos
    ORDER BY desde_dia
  LOOP
    v_top := LEAST(COALESCE(r.hasta_dia, p_dias_excedidos), p_dias_excedidos);
    v_dias_en_tramo := v_top - r.desde_dia + 1;
    IF v_dias_en_tramo > 0 THEN
      v_total := v_total + (v_dias_en_tramo * r.monto_por_dia);
      v_moneda := r.moneda;
      v_desglose := v_desglose || jsonb_build_object(
        'desde_dia', r.desde_dia,
        'hasta_dia', v_top,
        'dias', v_dias_en_tramo,
        'monto_por_dia', r.monto_por_dia,
        'subtotal', v_dias_en_tramo * r.monto_por_dia,
        'moneda', r.moneda
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total, v_moneda, v_desglose;
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_costo_demoras(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_costo_demoras(uuid, uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reemplazar_demoras_tramos_rpc(
  p_naviera_condicion_id uuid, p_tipo_contenedor_id uuid, p_tramos jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_count integer;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.costeo_navieras_condiciones
  WHERE id = p_naviera_condicion_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CONDICION_NAVIERA_NO_ENCONTRADA';
  END IF;

  -- Validar antes de borrar: conservar íntegro el tabulador anterior ante error.
  IF (SELECT COUNT(DISTINCT COALESCE(NULLIF(t->>'moneda', ''), 'USD'))
      FROM jsonb_array_elements(COALESCE(p_tramos, '[]'::jsonb)) AS t) > 1 THEN
    RAISE EXCEPTION 'LC_DEMORAS_MONEDAS_MIXTAS: el tabulador de este tipo de contenedor mezcla monedas. Usa una sola moneda por tabulador; no hay conversión automática.';
  END IF;

  DELETE FROM public.costeo_naviera_demoras_tarifa
  WHERE naviera_condicion_id = p_naviera_condicion_id
    AND tipo_contenedor_id = p_tipo_contenedor_id;

  INSERT INTO public.costeo_naviera_demoras_tarifa (
    naviera_condicion_id, organization_id, tipo_contenedor_id,
    desde_dia, hasta_dia, monto_por_dia, moneda
  )
  SELECT
    p_naviera_condicion_id,
    v_org,
    p_tipo_contenedor_id,
    (t->>'desde_dia')::integer,
    NULLIF(t->>'hasta_dia', '')::integer,
    (t->>'monto_por_dia')::numeric,
    COALESCE(NULLIF(t->>'moneda', ''), 'USD')
  FROM jsonb_array_elements(COALESCE(p_tramos, '[]'::jsonb)) AS t;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.reemplazar_demoras_tramos_rpc(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reemplazar_demoras_tramos_rpc(uuid, uuid, jsonb) TO authenticated, service_role;

-- Recalcula conceptos de demoras (costo + venta) para un embarque a partir del
-- tabulador escalonado por naviera y por org. Delega el cálculo de montos por
-- contenedor al helper privado public._calcular_demoras_montos_contenedor.
CREATE OR REPLACE FUNCTION public.calcular_demoras_embarque(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_embarque record;
  v_org uuid;
  v_naviera_id uuid;
  v_cond record;
  v_cond_found boolean := false;
  v_cond_id uuid;
  v_moneda_costo text := 'USD';
  v_fecha_descarga_emb date;
  v_fecha_devolucion_emb date;
  v_dias_libres_default integer := 0;
  v_contenedor record;
  v_tipo_cont_id uuid;
  v_monto_costo numeric := 0;
  v_monto_venta numeric := 0;
  v_total_costo numeric := 0;
  v_totales_costo jsonb := '{}'::jsonb;
  v_monedas_costo integer;
  v_total_venta numeric := 0;
  v_resultado jsonb := '[]'::jsonb;
  v_fecha_desc_c date;
  v_fecha_dev_c date;
  v_dias_libres_c integer;
  v_dias_puerto_c integer;
  v_dias_excedidos_c integer;
  v_bloqueados_venta jsonb;
  v_bloqueados_costo jsonb;
  v_moneda_tier text;
BEGIN
  SELECT * INTO v_embarque FROM public.embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','embarque no encontrado');
  END IF;
  v_org := v_embarque.organization_id;

  IF NOT (
    EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = v_org AND user_id = auth.uid())
    OR has_role(auth.uid(),'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_embarque_id::text));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cv.id, 'descripcion', cv.descripcion,
    'estado_facturacion', cv.estado_facturacion,
    'proforma_id', cv.proforma_id
  )), '[]'::jsonb)
  INTO v_bloqueados_venta
  FROM public.conceptos_venta cv
  WHERE cv.embarque_id = p_embarque_id
    AND cv.origen = 'demoras_auto'
    AND cv.deleted_at IS NULL
    AND COALESCE(cv.estado_facturacion, 'pendiente') IN ('en_proforma','facturado');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cc.id, 'concepto', cc.concepto,
    'estado_liquidacion', cc.estado_liquidacion
  )), '[]'::jsonb)
  INTO v_bloqueados_costo
  FROM public.conceptos_costo cc
  WHERE cc.embarque_id = p_embarque_id
    AND cc.origen = 'demoras_auto'
    AND cc.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.proveedor_facturas_conceptos pfc
      WHERE pfc.concepto_costo_id = cc.id
    );

  IF jsonb_array_length(v_bloqueados_venta) > 0 OR jsonb_array_length(v_bloqueados_costo) > 0 THEN
    RAISE EXCEPTION 'LC_DEMORAS_BLOQUEADAS: hay conceptos de demoras ya en proforma/factura/CxP'
      USING HINT = jsonb_build_object(
        'embarque_id', p_embarque_id,
        'expediente', v_embarque.expediente,
        'conceptos_venta_bloqueados', v_bloqueados_venta,
        'conceptos_costo_bloqueados', v_bloqueados_costo
      )::text;
  END IF;

  SELECT n.id INTO v_naviera_id FROM public.navieras n
  WHERE lower(n.name) = lower(v_embarque.naviera) LIMIT 1;

  SELECT min(fecha)::date INTO v_fecha_descarga_emb FROM public.eventos_embarque
  WHERE embarque_id = p_embarque_id AND tipo = 'Descarga' AND deleted_at IS NULL;

  SELECT max(fecha)::date INTO v_fecha_devolucion_emb FROM public.eventos_embarque
  WHERE embarque_id = p_embarque_id AND tipo = 'Entrega' AND deleted_at IS NULL;

  IF v_naviera_id IS NOT NULL THEN
    SELECT * INTO v_cond FROM public.costeo_navieras_condiciones
    WHERE organization_id = v_org AND naviera_id = v_naviera_id LIMIT 1;
    IF FOUND THEN
      v_cond_found := true;
      v_cond_id := v_cond.id;
      v_dias_libres_default := COALESCE(v_cond.dias_libres_demoras_default, 0);
      v_moneda_costo := COALESCE(v_cond.moneda_demoras, 'USD');
    END IF;
  END IF;

  UPDATE public.conceptos_costo
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE embarque_id = p_embarque_id AND origen = 'demoras_auto' AND deleted_at IS NULL;
  UPDATE public.conceptos_venta
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE embarque_id = p_embarque_id AND origen = 'demoras_auto' AND deleted_at IS NULL;

  FOR v_contenedor IN
    SELECT * FROM public.embarque_contenedores
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
    ORDER BY orden
  LOOP
    SELECT id INTO v_tipo_cont_id FROM public.tipos_contenedor
    WHERE lower(code) = lower(v_contenedor.tipo_contenedor) OR lower(name) = lower(v_contenedor.tipo_contenedor)
    LIMIT 1;

    v_fecha_desc_c := COALESCE(v_contenedor.fecha_descarga, v_fecha_descarga_emb);
    v_fecha_dev_c := COALESCE(v_contenedor.fecha_devolucion, v_fecha_devolucion_emb);
    v_dias_libres_c := COALESCE(v_contenedor.dias_libres_override, v_dias_libres_default);

    v_dias_puerto_c := 0;
    v_dias_excedidos_c := 0;
    IF v_fecha_desc_c IS NOT NULL AND v_fecha_dev_c IS NOT NULL THEN
      v_dias_puerto_c := GREATEST(0, v_fecha_dev_c - v_fecha_desc_c);
      v_dias_excedidos_c := GREATEST(0, v_dias_puerto_c - v_dias_libres_c);
    END IF;

    -- Delegar cálculo de montos al helper privado.
    SELECT m.monto_costo, m.moneda_costo, m.monto_venta
      INTO v_monto_costo, v_moneda_tier, v_monto_venta
    FROM public._calcular_demoras_montos_contenedor(
      CASE WHEN v_cond_found THEN v_cond_id ELSE NULL END,
      v_org,
      v_tipo_cont_id,
      v_dias_excedidos_c,
      v_moneda_costo
    ) m;

    IF v_monto_costo > 0 THEN
      INSERT INTO public.conceptos_costo (
        embarque_id, organization_id, proveedor_nombre, concepto,
        monto, moneda, estado_liquidacion, contenedor_id, origen
      ) VALUES (
        p_embarque_id, v_org, COALESCE(v_embarque.naviera,'Naviera'),
        format('Demoras %s días — contenedor %s', v_dias_excedidos_c, COALESCE(NULLIF(v_contenedor.numero_contenedor,''), v_contenedor.orden::text)),
        v_monto_costo, COALESCE(v_moneda_tier,'USD')::moneda, 'Pendiente'::estado_liquidacion, v_contenedor.id, 'demoras_auto'
      );
      v_totales_costo := jsonb_set(v_totales_costo, ARRAY[v_moneda_tier],
        to_jsonb(COALESCE((v_totales_costo->>v_moneda_tier)::numeric, 0) + v_monto_costo));
    END IF;

    IF v_monto_venta > 0 THEN
      INSERT INTO public.conceptos_venta (
        embarque_id, organization_id, descripcion, cantidad,
        precio_unitario, moneda, total, aplica_iva, contenedor_id, origen
      ) VALUES (
        p_embarque_id, v_org,
        format('Demoras %s días — contenedor %s', v_dias_excedidos_c, COALESCE(NULLIF(v_contenedor.numero_contenedor,''), v_contenedor.orden::text)),
        1, v_monto_venta, 'USD'::moneda, v_monto_venta, true, v_contenedor.id, 'demoras_auto'
      );
      v_total_venta := v_total_venta + v_monto_venta;
    END IF;

    v_resultado := v_resultado || jsonb_build_object(
      'contenedor_id', v_contenedor.id,
      'numero_contenedor', v_contenedor.numero_contenedor,
      'tipo_contenedor', v_contenedor.tipo_contenedor,
      'fecha_descarga', v_fecha_desc_c,
      'fecha_devolucion', v_fecha_dev_c,
      'dias_libres', v_dias_libres_c,
      'dias_en_puerto', v_dias_puerto_c,
      'dias_excedidos', v_dias_excedidos_c,
      'monto_costo', v_monto_costo,
      'moneda_costo', COALESCE(v_moneda_tier,'USD'),
      'monto_venta_usd', v_monto_venta
    );
  END LOOP;

  -- El total escalar sólo existe si todos los cargos tienen la misma moneda.
  -- Tabuladores independientes siguen siendo válidos, sin sumar sus nominales.
  SELECT COUNT(*) INTO v_monedas_costo FROM jsonb_each(v_totales_costo);
  IF v_monedas_costo = 1 THEN
    SELECT key, value::numeric INTO v_moneda_costo, v_total_costo
    FROM jsonb_each_text(v_totales_costo);
  ELSIF v_monedas_costo > 1 THEN
    v_moneda_costo := NULL;
    v_total_costo := NULL;
  END IF;

  RETURN jsonb_build_object(
    'embarque_id', p_embarque_id,
    'fecha_descarga_embarque', v_fecha_descarga_emb,
    'fecha_devolucion_embarque', v_fecha_devolucion_emb,
    'dias_libres_default', v_dias_libres_default,
    'total_costo', v_total_costo,
    'totales_costo_por_moneda', v_totales_costo,
    'moneda_costo', v_moneda_costo,
    'total_venta_usd', v_total_venta,
    'contenedores', v_resultado
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.calcular_demoras_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_demoras_embarque(uuid) TO authenticated, service_role;
