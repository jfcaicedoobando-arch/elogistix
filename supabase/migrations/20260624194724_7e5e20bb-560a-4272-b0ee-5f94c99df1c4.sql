CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cot           public.cotizaciones%ROWTYPE;
  v_caller_org    uuid := current_user_org_id();
  v_is_super      boolean := has_role(auth.uid(), 'super_admin'::app_role);
  v_can_write     boolean;
  v_expediente    text;
  v_embarque_id   uuid;
  v_num           integer;
  v_peso_each     numeric;
  v_vol_each      numeric;
  v_piezas_base   integer;
  v_piezas_rest   integer;
  v_piezas_este   integer;
  v_first_hijo_id uuid;
  v_user_email    text;
  i               integer;
  v_costo         public.cotizacion_costos%ROWTYPE;
  v_target_ids    uuid[];
  v_cid           uuid;
  v_venta         jsonb;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_is_super AND v_cot.organization_id <> v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  v_can_write := v_is_super
                 OR has_role(auth.uid(), 'admin'::app_role)
                 OR has_role(auth.uid(), 'operador'::app_role);
  IF NOT v_can_write THEN
    RAISE EXCEPTION 'Solo admin u operador pueden crear el borrador' USING ERRCODE = '42501';
  END IF;

  IF v_cot.estado <> 'Aceptada'::estado_cotizacion THEN
    RAISE EXCEPTION 'La cotización debe estar en estado Aceptada (actual: %)', v_cot.estado USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.cliente_id IS NULL OR v_cot.es_prospecto THEN
    RAISE EXCEPTION 'Convierte el prospecto a cliente antes de crear el borrador' USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.embarque_id IS NOT NULL THEN
    RETURN v_cot.embarque_id;
  END IF;

  v_expediente := public.generar_expediente(v_cot.tipo::text);

  INSERT INTO public.embarques (
    cotizacion_id, expediente, cliente_id, cliente_nombre,
    estado, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, operador, tipo_carga, tipo_contenedor,
    organization_id
  )
  VALUES (
    v_cot.id, v_expediente, v_cot.cliente_id, v_cot.cliente_nombre,
    'Borrador'::estado_embarque, v_cot.modo, v_cot.tipo, v_cot.incoterm, v_cot.descripcion_mercancia,
    COALESCE(v_cot.peso_kg, 0), COALESCE(v_cot.volumen_m3, 0), COALESCE(v_cot.piezas, 0),
    v_cot.operador, v_cot.tipo_carga, v_cot.tipo_contenedor,
    v_cot.organization_id
  )
  RETURNING id INTO v_embarque_id;

  v_num := GREATEST(1, COALESCE(v_cot.num_contenedores, 1));
  v_peso_each := COALESCE(v_cot.peso_kg, 0) / v_num;
  v_vol_each := COALESCE(v_cot.volumen_m3, 0) / v_num;
  v_piezas_base := COALESCE(v_cot.piezas, 0) / v_num;
  v_piezas_rest := COALESCE(v_cot.piezas, 0);

  v_target_ids := ARRAY[]::uuid[];
  FOR i IN 1..v_num LOOP
    IF i = v_num THEN
      v_piezas_este := v_piezas_rest;
    ELSE
      v_piezas_este := v_piezas_base;
    END IF;
    v_piezas_rest := v_piezas_rest - v_piezas_este;

    INSERT INTO public.embarque_contenedores (
      embarque_id, numero_contenedor, tipo_contenedor, bl_house,
      peso_kg, volumen_m3, piezas, orden
    )
    VALUES (
      v_embarque_id, '', COALESCE(v_cot.tipo_contenedor, ''), '',
      v_peso_each, v_vol_each, v_piezas_este, i
    )
    RETURNING id INTO v_cid;

    v_target_ids := array_append(v_target_ids, v_cid);
    IF i = 1 THEN
      v_first_hijo_id := v_cid;
    END IF;
  END LOOP;

  FOR v_costo IN
    SELECT * FROM public.cotizacion_costos
    WHERE cotizacion_id = v_cot.id AND deleted_at IS NULL
  LOOP
    IF COALESCE(v_costo.unidad_medida, 'Contenedor') = 'BL' THEN
      INSERT INTO public.conceptos_costo (
        embarque_id, contenedor_id, concepto, monto, moneda,
        proveedor_nombre, organization_id
      )
      VALUES (
        v_embarque_id, NULL, v_costo.concepto, COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
        CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
        COALESCE(v_costo.proveedor, ''), v_cot.organization_id
      );
    ELSE
      FOREACH v_cid IN ARRAY v_target_ids LOOP
        INSERT INTO public.conceptos_costo (
          embarque_id, contenedor_id, concepto, monto, moneda,
          proveedor_nombre, organization_id
        )
        VALUES (
          v_embarque_id, v_cid, v_costo.concepto, COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
          CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE(v_costo.proveedor, ''), v_cot.organization_id
        );
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_typeof(v_cot.conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(v_cot.conceptos_venta)
    LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        INSERT INTO public.conceptos_venta (
          embarque_id, descripcion, cantidad, precio_unitario, moneda, aplica_iva, total, organization_id
        )
        VALUES (
          v_embarque_id,
          v_venta->>'descripcion',
          COALESCE((v_venta->>'cantidad')::integer, 1),
          COALESCE((v_venta->>'precio_unitario')::numeric, 0),
          CASE WHEN v_venta->>'moneda' = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE((v_venta->>'aplica_iva')::boolean, false),
          COALESCE((v_venta->>'total')::numeric, 0),
          v_cot.organization_id
        );
      END IF;
    END LOOP;
  END IF;

  UPDATE public.cotizaciones
  SET embarque_id = v_embarque_id, updated_at = now()
  WHERE id = v_cot.id;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, modulo, accion,
    entidad_id, entidad_nombre, detalles
  )
  VALUES (
    v_cot.organization_id, auth.uid(), COALESCE(v_user_email, ''),
    'Cotizaciones', 'Borrador de embarque creado',
    v_cot.id, v_cot.folio,
    jsonb_build_object('embarque_id', v_embarque_id, 'expediente', v_expediente)
  );

  -- FIX 13.135.30: columnas reales son usuario_id y enlace (no user_id/link)
  INSERT INTO public.notificaciones_internas (
    organization_id, usuario_id, tipo, titulo, mensaje, enlace
  )
  SELECT
    v_cot.organization_id,
    om.user_id,
    'cotizacion_borrador_embarque',
    'Borrador de embarque creado',
    'Se generó el borrador ' || v_expediente || ' desde la cotización ' || v_cot.folio,
    '/embarques/' || v_embarque_id::text
  FROM public.organization_members om
  WHERE om.organization_id = v_cot.organization_id
    AND om.role IN ('admin'::app_role, 'operador'::app_role)
    AND om.user_id <> auth.uid();

  RETURN v_embarque_id;
END;
$function$;