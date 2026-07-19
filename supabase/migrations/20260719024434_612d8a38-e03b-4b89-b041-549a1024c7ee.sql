
-- ============================================================================
-- Fase H (v13.301.79) — calcular_demoras_embarque: candado, guard de bloqueo,
-- soft-delete, moneda dinámica.
-- ============================================================================
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
  v_moneda_costo text := 'USD';
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

  -- Candado por embarque: evita recálculos concurrentes duplicando conceptos.
  PERFORM pg_advisory_xact_lock(hashtext(p_embarque_id::text));

  -- Guard de bloqueo: no destruir conceptos ya facturados / en proforma / con CxP.
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

  -- Soft-delete de conceptos vigentes no bloqueados.
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

    v_monto_costo := 0;
    v_monto_venta := 0;
    v_dias_puerto_c := 0;
    v_dias_excedidos_c := 0;
    v_moneda_tier := v_moneda_costo;

    IF v_fecha_desc_c IS NOT NULL AND v_fecha_dev_c IS NOT NULL THEN
      v_dias_puerto_c := GREATEST(0, v_fecha_dev_c - v_fecha_desc_c);
      v_dias_excedidos_c := GREATEST(0, v_dias_puerto_c - v_dias_libres_c);
    END IF;

    IF v_dias_excedidos_c > 0 THEN
      IF v_cond_found AND v_tipo_cont_id IS NOT NULL THEN
        SELECT
          COALESCE(SUM(
            CASE WHEN d >= t.desde_dia AND (t.hasta_dia IS NULL OR d <= t.hasta_dia) THEN t.monto_por_dia ELSE 0 END
          ),0),
          MAX(t.moneda)
        INTO v_monto_costo, v_moneda_tier
        FROM generate_series(1, v_dias_excedidos_c) d
        LEFT JOIN LATERAL (
          SELECT monto_por_dia, moneda, desde_dia, hasta_dia
          FROM public.costeo_naviera_demoras_tarifa
          WHERE naviera_condicion_id = v_cond_id
            AND tipo_contenedor_id = v_tipo_cont_id
            AND d >= desde_dia
            AND (hasta_dia IS NULL OR d <= hasta_dia)
          ORDER BY desde_dia DESC LIMIT 1
        ) t ON true;
        v_moneda_tier := COALESCE(v_moneda_tier, v_moneda_costo);
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
        v_monto_costo, COALESCE(v_moneda_tier,'USD')::moneda, 'Pendiente'::estado_liquidacion, v_contenedor.id, 'demoras_auto'
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
      'monto_costo', v_monto_costo,
      'moneda_costo', COALESCE(v_moneda_tier,'USD'),
      'monto_venta_usd', v_monto_venta
    );
  END LOOP;

  RETURN jsonb_build_object(
    'embarque_id', p_embarque_id,
    'fecha_descarga_embarque', v_fecha_descarga_emb,
    'fecha_devolucion_embarque', v_fecha_devolucion_emb,
    'dias_libres_default', v_dias_libres_default,
    'total_costo', v_total_costo,
    'moneda_costo', v_moneda_costo,
    'total_venta_usd', v_total_venta,
    'contenedores', v_resultado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_demoras_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_demoras_embarque(uuid) TO authenticated, service_role;

-- ============================================================================
-- Fase I (v13.301.80) — TC obligatorio en facturas Borrador en moneda extranjera.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_factura_tc_extranjera_obligatorio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.moneda IS NOT NULL
     AND NEW.moneda <> 'MXN'::public.moneda
     AND NEW.estado = 'Borrador'::estado_factura
     AND NEW.tipo_cambio IS NOT NULL
     AND NEW.tipo_cambio = 1 THEN
    NEW.tipo_cambio := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_factura_tc_extranjera_obligatorio ON public.facturas;
CREATE TRIGGER trg_factura_tc_extranjera_obligatorio
  BEFORE INSERT ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_factura_tc_extranjera_obligatorio();

-- Backfill defensivo: borradores en moneda extranjera con TC=1 → NULL.
UPDATE public.facturas
   SET tipo_cambio = NULL
 WHERE moneda <> 'MXN'::public.moneda
   AND estado = 'Borrador'::estado_factura
   AND tipo_cambio = 1
   AND uuid_fiscal IS NULL;

-- ============================================================================
-- Fase J (v13.301.81) — aceptar_cotizacion_version valida estado + valor_real
-- incondicional.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INT;
  v_org UUID;
  v_folio TEXT;
  v_estado_actual TEXT;
BEGIN
  SELECT version, organization_id, folio, estado::text
    INTO v_version, v_org, v_folio, v_estado_actual
    FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_org AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;

  IF v_estado_actual NOT IN ('Borrador','Enviada') THEN
    RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar una cotización en Borrador o Enviada (actual: %)', v_estado_actual
      USING HINT = jsonb_build_object(
        'estado_actual', v_estado_actual,
        'estados_permitidos', jsonb_build_array('Borrador','Enviada')
      )::text;
  END IF;

  UPDATE cotizaciones
     SET version_aceptada=v_version, aceptada_en=now(), aceptada_por=auth.uid(),
         estado='Aceptada', updated_at=now()
   WHERE id=p_cotizacion_id;

  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (
    v_org, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'cotizacion.aceptada_version_fijada',
    'cotizaciones',
    p_cotizacion_id,
    COALESCE(v_folio, ''),
    jsonb_build_object('version_aceptada', v_version, 'estado_previo', v_estado_actual)
  );
  RETURN jsonb_build_object('cotizacion_id', p_cotizacion_id, 'version_aceptada', v_version);
END $$;

CREATE OR REPLACE FUNCTION public.crm_set_valor_real_on_aceptada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previo numeric;
BEGIN
  IF NEW.oportunidad_id IS NOT NULL
     AND NEW.estado = 'Aceptada'::estado_cotizacion
     AND (OLD.estado IS DISTINCT FROM NEW.estado) THEN
    SELECT valor_real INTO v_previo FROM public.crm_oportunidades WHERE id = NEW.oportunidad_id;
    UPDATE public.crm_oportunidades
       SET valor_real = NEW.subtotal,
           fecha_cierre_real = CURRENT_DATE,
           updated_at = now()
     WHERE id = NEW.oportunidad_id;
    IF v_previo IS DISTINCT FROM NEW.subtotal THEN
      INSERT INTO public.bitacora_actividad (
        organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
      ) VALUES (
        NEW.organization_id, auth.uid(),
        COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
        'crm.oportunidad.valor_real_actualizado',
        'crm_oportunidades',
        NEW.oportunidad_id,
        '',
        jsonb_build_object('valor_previo', v_previo, 'valor_nuevo', NEW.subtotal,
                          'cotizacion_id', NEW.id, 'version', NEW.version)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Fase K (v13.301.82) — agente_aprobar_tarifa: remover rol operador.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.agente_aprobar_tarifa(
  _tarifa_id uuid, _estado text, _motivo text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_agente_id uuid;
  v_ruta_id uuid;
  v_agente_user uuid;
  v_ruta_txt text;
BEGIN
  IF _estado NOT IN ('vigente','rechazada','borrador') THEN
    RAISE EXCEPTION 'estado inválido: %', _estado;
  END IF;

  SELECT organization_id, agente_id, ruta_id
    INTO v_org, v_agente_id, v_ruta_id
    FROM public.costeo_tarifas WHERE id = _tarifa_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'tarifa no encontrada';
  END IF;

  -- Fase K: se remueve 'operador' de la lista autorizada.
  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = v_org
        AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing'))
  ) THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  IF _estado = 'rechazada' AND (coalesce(btrim(_motivo), '') = '' OR length(btrim(_motivo)) < 5) THEN
    RAISE EXCEPTION 'el motivo de rechazo es obligatorio (mínimo 5 caracteres)';
  END IF;

  IF _estado = 'vigente' THEN
    UPDATE public.costeo_tarifas
       SET estado_aprobacion = 'vigente',
           motivo_rechazo = NULL,
           aprobada_por = auth.uid(),
           aprobada_en = now(),
           updated_at = now()
     WHERE id = _tarifa_id;
  ELSIF _estado = 'rechazada' THEN
    UPDATE public.costeo_tarifas
       SET estado_aprobacion = 'rechazada',
           motivo_rechazo = btrim(_motivo),
           updated_at = now()
     WHERE id = _tarifa_id;
  ELSE
    UPDATE public.costeo_tarifas
       SET estado_aprobacion = 'borrador',
           motivo_rechazo = NULL,
           updated_at = now()
     WHERE id = _tarifa_id;
  END IF;

  SELECT user_id INTO v_agente_user
    FROM public.agente_users
   WHERE agente_id = v_agente_id
   LIMIT 1;

  IF v_agente_user IS NOT NULL AND _estado IN ('vigente','rechazada') THEN
    SELECT (po.name || ' → ' || pd.name)
      INTO v_ruta_txt
      FROM public.costeo_rutas r
      JOIN public.puertos po ON po.id = r.puerto_origen_id
      JOIN public.puertos pd ON pd.id = r.puerto_destino_id
     WHERE r.id = v_ruta_id;

    INSERT INTO public.notificaciones_internas (
      organization_id, user_id, tipo, titulo, mensaje, leida
    ) VALUES (
      v_org, v_agente_user,
      CASE WHEN _estado = 'vigente' THEN 'tarifa_aprobada' ELSE 'tarifa_rechazada' END,
      CASE WHEN _estado = 'vigente' THEN 'Tarifa aprobada' ELSE 'Tarifa rechazada' END,
      CASE WHEN _estado = 'vigente'
           THEN 'Tu tarifa ' || coalesce(v_ruta_txt,'') || ' fue aprobada y ya está vigente.'
           ELSE 'Tu tarifa ' || coalesce(v_ruta_txt,'') || ' fue rechazada. Motivo: ' || btrim(_motivo)
      END,
      false
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.agente_aprobar_tarifa(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_aprobar_tarifa(uuid, text, text) TO authenticated;
