
CREATE OR REPLACE FUNCTION public.calcular_demoras_embarque(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_embarque record;
  v_org uuid;
  v_naviera_id uuid;
  v_cond record;
  v_cond_found boolean := false;
  v_cond_id uuid;
  v_fecha_descarga_emb date;
  v_fecha_devolucion_emb date;
  v_dias_libres_default integer := 0;
  v_contenedor record;
  v_tipo_cont_id uuid;
  v_monto_costo numeric := 0;
  v_monto_venta numeric := 0;
  v_total_costo numeric := 0;
  v_total_venta numeric := 0;
  v_resultado jsonb := '[]'::jsonb;
  v_fecha_desc_c date;
  v_fecha_dev_c date;
  v_dias_libres_c integer;
  v_dias_puerto_c integer;
  v_dias_excedidos_c integer;
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
    END IF;
  END IF;

  DELETE FROM public.conceptos_costo WHERE embarque_id = p_embarque_id AND origen = 'demoras_auto';
  DELETE FROM public.conceptos_venta WHERE embarque_id = p_embarque_id AND origen = 'demoras_auto';

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

    v_monto_costo := 0;
    v_monto_venta := 0;
    v_dias_puerto_c := 0;
    v_dias_excedidos_c := 0;

    IF v_fecha_desc_c IS NOT NULL AND v_fecha_dev_c IS NOT NULL THEN
      v_dias_puerto_c := GREATEST(0, v_fecha_dev_c - v_fecha_desc_c);
      v_dias_excedidos_c := GREATEST(0, v_dias_puerto_c - v_dias_libres_c);
    END IF;

    IF v_dias_excedidos_c > 0 THEN
      IF v_cond_found AND v_tipo_cont_id IS NOT NULL THEN
        SELECT COALESCE(SUM(
          CASE WHEN d >= t.desde_dia AND (t.hasta_dia IS NULL OR d <= t.hasta_dia) THEN t.monto_por_dia ELSE 0 END
        ),0) INTO v_monto_costo
        FROM generate_series(1, v_dias_excedidos_c) d
        LEFT JOIN LATERAL (
          SELECT monto_por_dia, desde_dia, hasta_dia
          FROM public.costeo_naviera_demoras_tarifa
          WHERE naviera_condicion_id = v_cond_id
            AND tipo_contenedor_id = v_tipo_cont_id
            AND d >= desde_dia
            AND (hasta_dia IS NULL OR d <= hasta_dia)
          ORDER BY desde_dia DESC LIMIT 1
        ) t ON true;
      END IF;

      IF v_tipo_cont_id IS NOT NULL THEN
        SELECT COALESCE(SUM(
          CASE WHEN d >= t.desde_dia AND (t.hasta_dia IS NULL OR d <= t.hasta_dia) THEN t.monto_por_dia_usd ELSE 0 END
        ),0) INTO v_monto_venta
        FROM generate_series(1, v_dias_excedidos_c) d
        LEFT JOIN LATERAL (
          SELECT monto_por_dia_usd, desde_dia, hasta_dia
          FROM public.costeo_demoras_venta_tarifa
          WHERE organization_id = v_org
            AND tipo_contenedor_id = v_tipo_cont_id
            AND (vigente_desde IS NULL OR vigente_desde <= CURRENT_DATE)
            AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
            AND d >= desde_dia
            AND (hasta_dia IS NULL OR d <= hasta_dia)
          ORDER BY desde_dia DESC LIMIT 1
        ) t ON true;
      END IF;
    END IF;

    IF v_monto_costo > 0 THEN
      INSERT INTO public.conceptos_costo (
        embarque_id, organization_id, proveedor_nombre, concepto,
        monto, moneda, estado_liquidacion, contenedor_id, origen
      ) VALUES (
        p_embarque_id, v_org, COALESCE(v_embarque.naviera,'Naviera'),
        format('Demoras %s días — contenedor %s', v_dias_excedidos_c, COALESCE(NULLIF(v_contenedor.numero_contenedor,''), v_contenedor.orden::text)),
        v_monto_costo, 'USD'::moneda, 'Pendiente'::estado_liquidacion, v_contenedor.id, 'demoras_auto'
      );
      v_total_costo := v_total_costo + v_monto_costo;
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
      'monto_costo_usd', v_monto_costo,
      'monto_venta_usd', v_monto_venta
    );
  END LOOP;

  RETURN jsonb_build_object(
    'embarque_id', p_embarque_id,
    'fecha_descarga_embarque', v_fecha_descarga_emb,
    'fecha_devolucion_embarque', v_fecha_devolucion_emb,
    'dias_libres_default', v_dias_libres_default,
    'total_costo_usd', v_total_costo,
    'total_venta_usd', v_total_venta,
    'contenedores', v_resultado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_demoras_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_demoras_embarque(uuid) TO authenticated, service_role;
