
-- Función para calcular demoras de un embarque
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
  v_fecha_descarga date;
  v_fecha_devolucion date;
  v_dias_puerto integer := 0;
  v_dias_libres integer := 0;
  v_dias_excedidos integer := 0;
  v_contenedor record;
  v_tipo_cont_id uuid;
  v_tarifa record;
  v_dia integer;
  v_monto_costo numeric := 0;
  v_monto_venta numeric := 0;
  v_total_costo numeric := 0;
  v_total_venta numeric := 0;
  v_resultado jsonb := '[]'::jsonb;
  v_contador integer := 0;
  v_sin_eventos boolean := false;
BEGIN
  SELECT * INTO v_embarque FROM public.embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','embarque no encontrado');
  END IF;
  v_org := v_embarque.organization_id;

  -- Permisos: usuario debe ser miembro de la org o super_admin
  IF NOT (
    EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = v_org AND user_id = auth.uid())
    OR has_role(auth.uid(),'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Naviera
  SELECT n.id INTO v_naviera_id FROM public.navieras n
  WHERE lower(n.name) = lower(v_embarque.naviera) LIMIT 1;

  -- Fechas del timeline
  SELECT min(fecha)::date INTO v_fecha_descarga FROM public.eventos_embarque
  WHERE embarque_id = p_embarque_id AND tipo = 'Descarga' AND deleted_at IS NULL;

  SELECT max(fecha)::date INTO v_fecha_devolucion FROM public.eventos_embarque
  WHERE embarque_id = p_embarque_id AND tipo = 'Entrega' AND deleted_at IS NULL;

  IF v_fecha_descarga IS NULL OR v_fecha_devolucion IS NULL THEN
    v_sin_eventos := true;
  ELSE
    v_dias_puerto := GREATEST(0, v_fecha_devolucion - v_fecha_descarga);
  END IF;

  -- Condiciones naviera
  IF v_naviera_id IS NOT NULL THEN
    SELECT * INTO v_cond FROM public.costeo_navieras_condiciones
    WHERE organization_id = v_org AND naviera_id = v_naviera_id LIMIT 1;
    IF FOUND THEN
      v_dias_libres := v_cond.dias_libres_demoras_default;
    END IF;
  END IF;

  v_dias_excedidos := GREATEST(0, v_dias_puerto - v_dias_libres);

  -- Borrar conceptos automáticos previos
  DELETE FROM public.conceptos_costo WHERE embarque_id = p_embarque_id AND origen = 'demoras_auto';
  DELETE FROM public.conceptos_venta WHERE embarque_id = p_embarque_id AND origen = 'demoras_auto';

  IF v_sin_eventos OR v_dias_excedidos = 0 THEN
    RETURN jsonb_build_object(
      'embarque_id', p_embarque_id,
      'sin_eventos', v_sin_eventos,
      'fecha_descarga', v_fecha_descarga,
      'fecha_devolucion', v_fecha_devolucion,
      'dias_en_puerto', v_dias_puerto,
      'dias_libres', v_dias_libres,
      'dias_excedidos', v_dias_excedidos,
      'total_costo_usd', 0,
      'total_venta_usd', 0,
      'contenedores', '[]'::jsonb
    );
  END IF;

  -- Iterar contenedores del embarque
  FOR v_contenedor IN
    SELECT * FROM public.embarque_contenedores
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
    ORDER BY orden
  LOOP
    v_contador := v_contador + 1;
    SELECT id INTO v_tipo_cont_id FROM public.tipos_contenedor
    WHERE lower(code) = lower(v_contenedor.tipo_contenedor) OR lower(name) = lower(v_contenedor.tipo_contenedor)
    LIMIT 1;

    v_monto_costo := 0;
    v_monto_venta := 0;

    -- Costo: sumar día por día contra tabulador de la naviera
    IF v_cond.id IS NOT NULL AND v_tipo_cont_id IS NOT NULL THEN
      FOR v_dia IN 1..v_dias_excedidos LOOP
        SELECT monto_por_dia INTO v_monto_costo
        FROM public.costeo_naviera_demoras_tarifa
        WHERE naviera_condicion_id = v_cond.id
          AND tipo_contenedor_id = v_tipo_cont_id
          AND v_dia >= desde_dia
          AND (hasta_dia IS NULL OR v_dia <= hasta_dia)
        ORDER BY desde_dia DESC LIMIT 1;
        IF v_monto_costo IS NOT NULL THEN
          v_total_costo := v_total_costo + v_monto_costo;
        END IF;
      END LOOP;

      -- Re-calcular total individual del contenedor (costo)
      SELECT COALESCE(SUM(
        CASE WHEN d >= t.desde_dia AND (t.hasta_dia IS NULL OR d <= t.hasta_dia) THEN t.monto_por_dia ELSE 0 END
      ),0) INTO v_monto_costo
      FROM generate_series(1, v_dias_excedidos) d
      LEFT JOIN LATERAL (
        SELECT monto_por_dia, desde_dia, hasta_dia
        FROM public.costeo_naviera_demoras_tarifa
        WHERE naviera_condicion_id = v_cond.id
          AND tipo_contenedor_id = v_tipo_cont_id
          AND d >= desde_dia
          AND (hasta_dia IS NULL OR d <= hasta_dia)
        ORDER BY desde_dia DESC LIMIT 1
      ) t ON true;
    END IF;

    -- Venta: tabulador propio
    IF v_tipo_cont_id IS NOT NULL THEN
      SELECT COALESCE(SUM(
        CASE WHEN d >= t.desde_dia AND (t.hasta_dia IS NULL OR d <= t.hasta_dia) THEN t.monto_por_dia_usd ELSE 0 END
      ),0) INTO v_monto_venta
      FROM generate_series(1, v_dias_excedidos) d
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

    -- Insertar costo (en USD, sin proveedor identificado)
    IF v_monto_costo > 0 THEN
      INSERT INTO public.conceptos_costo (
        embarque_id, organization_id, proveedor_nombre, concepto,
        monto, moneda, estado_liquidacion, contenedor_id, origen
      ) VALUES (
        p_embarque_id, v_org, COALESCE(v_embarque.naviera,'Naviera'),
        format('Demoras %s días — contenedor %s', v_dias_excedidos, v_contenedor.numero_contenedor),
        v_monto_costo, 'USD'::moneda, 'Pendiente'::estado_liquidacion, v_contenedor.id, 'demoras_auto'
      );
      v_total_costo := v_total_costo; -- ya acumulado
    END IF;

    -- Insertar venta
    IF v_monto_venta > 0 THEN
      INSERT INTO public.conceptos_venta (
        embarque_id, organization_id, descripcion, cantidad,
        precio_unitario, moneda, total, aplica_iva, contenedor_id, origen
      ) VALUES (
        p_embarque_id, v_org,
        format('Demoras %s días — contenedor %s', v_dias_excedidos, v_contenedor.numero_contenedor),
        1, v_monto_venta, 'USD'::moneda, v_monto_venta, true, v_contenedor.id, 'demoras_auto'
      );
      v_total_venta := v_total_venta + v_monto_venta;
    END IF;

    v_resultado := v_resultado || jsonb_build_object(
      'contenedor_id', v_contenedor.id,
      'numero_contenedor', v_contenedor.numero_contenedor,
      'tipo_contenedor', v_contenedor.tipo_contenedor,
      'monto_costo_usd', v_monto_costo,
      'monto_venta_usd', v_monto_venta
    );
  END LOOP;

  RETURN jsonb_build_object(
    'embarque_id', p_embarque_id,
    'sin_eventos', false,
    'fecha_descarga', v_fecha_descarga,
    'fecha_devolucion', v_fecha_devolucion,
    'dias_en_puerto', v_dias_puerto,
    'dias_libres', v_dias_libres,
    'dias_excedidos', v_dias_excedidos,
    'total_costo_usd', v_total_costo,
    'total_venta_usd', v_total_venta,
    'contenedores', v_resultado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_demoras_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_demoras_embarque(uuid) TO authenticated, service_role;

-- Fix de seguridad del trigger function previo
REVOKE ALL ON FUNCTION public.crear_garantia_contenedor() FROM PUBLIC, anon;

-- Trigger: al pasar embarque a Entregado, recalcular demoras
CREATE OR REPLACE FUNCTION public.trg_recalcular_demoras_al_entregar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'Entregado'::estado_embarque AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    PERFORM public.calcular_demoras_embarque(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recalcular_demoras_al_entregar() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_embarques_entregado_demoras ON public.embarques;
CREATE TRIGGER trg_embarques_entregado_demoras
  AFTER UPDATE OF estado ON public.embarques
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_demoras_al_entregar();
