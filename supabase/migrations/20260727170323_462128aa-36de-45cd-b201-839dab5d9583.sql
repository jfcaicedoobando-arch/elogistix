CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_core(p_cotizacion_id uuid)
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
  v_embarque_id   uuid;
  v_orphan_id     uuid;
  v_num           integer;
  v_peso_each     numeric;
  v_vol_each      numeric;
  v_piezas_base   integer;
  v_piezas_rest   integer;
  v_piezas_este   integer;
  v_first_hijo_id uuid;
  v_user_email    text;
  i               integer;
  v_target_ids    uuid[];
  v_cid           uuid;
  v_origen_code   text;
  v_destino_code  text;
  v_puerto_o      text;
  v_puerto_d      text;
  v_aero_o        text;
  v_aero_d        text;
  v_ciudad_o      text;
  v_ciudad_d      text;
  v_tipo_cont_code text;
  v_agente_id     uuid;
  v_naviera_id    uuid;
  v_agente_nombre text;
  v_naviera_nombre text;
  v_doc_nombre    text;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: cotización % no existe', p_cotizacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_cot.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: la cotización % está eliminada', p_cotizacion_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_super AND v_cot.organization_id <> v_caller_org THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE = '42501';
  END IF;

  v_can_write := v_is_super
                 OR has_role(auth.uid(), 'admin'::app_role)
                 OR has_role(auth.uid(), 'operador'::app_role);
  IF NOT v_can_write THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: solo admin u operador pueden crear el borrador' USING ERRCODE = '42501';
  END IF;

  IF v_cot.estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO: la cotización debe estar Aceptada o En operación (actual: %)', v_cot.estado USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.cliente_id IS NULL OR v_cot.es_prospecto THEN
    RAISE EXCEPTION 'LC_COT_SIN_CLIENTE: convierte el prospecto a cliente antes de crear el borrador' USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.embarque_id IS NOT NULL THEN
    SELECT id INTO v_orphan_id
    FROM public.embarques
    WHERE id = v_cot.embarque_id
      AND cotizacion_id = v_cot.id
      AND estado = 'Borrador'::estado_embarque
      AND expediente IS NULL
      AND bl_master IS NULL
      AND bl_house IS NULL
      AND deleted_at IS NULL;
    IF v_orphan_id IS NOT NULL THEN
      RETURN v_orphan_id;
    END IF;
    UPDATE public.cotizaciones SET embarque_id = NULL WHERE id = v_cot.id;
  END IF;

  v_origen_code := v_cot.origen;
  v_destino_code := v_cot.destino;

  IF v_origen_code IS NOT NULL THEN
    SELECT p.name INTO v_puerto_o FROM public.puertos p WHERE p.code = v_origen_code LIMIT 1;
  END IF;
  IF v_destino_code IS NOT NULL THEN
    SELECT p.name INTO v_puerto_d FROM public.puertos p WHERE p.code = v_destino_code LIMIT 1;
  END IF;
  IF v_cot.modo = 'Aéreo'::modo_transporte THEN
    v_aero_o := COALESCE(v_puerto_o, v_origen_code);
    v_aero_d := COALESCE(v_puerto_d, v_destino_code);
    v_puerto_o := NULL; v_puerto_d := NULL;
  ELSIF v_cot.modo = 'Terrestre'::modo_transporte THEN
    v_ciudad_o := COALESCE(v_puerto_o, v_origen_code);
    v_ciudad_d := COALESCE(v_puerto_d, v_destino_code);
    v_puerto_o := NULL; v_puerto_d := NULL;
  ELSE
    v_puerto_o := COALESCE(v_puerto_o, v_origen_code);
    v_puerto_d := COALESCE(v_puerto_d, v_destino_code);
  END IF;

  IF v_cot.tipo_contenedor_id IS NOT NULL THEN
    SELECT tc.codigo INTO v_tipo_cont_code FROM public.tipos_contenedor tc WHERE tc.id = v_cot.tipo_contenedor_id;
  END IF;
  v_tipo_cont_code := COALESCE(v_tipo_cont_code, v_cot.tipo_contenedor);

  v_agente_id  := v_cot.agente_id;
  v_naviera_id := v_cot.naviera_id;
  IF (v_agente_id IS NULL OR v_naviera_id IS NULL) AND v_cot.tarifa_id IS NOT NULL THEN
    SELECT COALESCE(v_agente_id, t.agente_id), COALESCE(v_naviera_id, t.naviera_id)
      INTO v_agente_id, v_naviera_id
    FROM public.costeo_tarifas t WHERE t.id = v_cot.tarifa_id;
  END IF;

  IF v_agente_id  IS NOT NULL THEN SELECT nombre INTO v_agente_nombre  FROM public.costeo_agentes WHERE id = v_agente_id; END IF;
  IF v_naviera_id IS NOT NULL THEN SELECT name   INTO v_naviera_nombre FROM public.navieras       WHERE id = v_naviera_id; END IF;

  INSERT INTO public.embarques (
    cotizacion_id, expediente, cliente_id, cliente_nombre,
    estado, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, operador, tipo_carga, tipo_contenedor,
    organization_id,
    puerto_origen, puerto_destino,
    aeropuerto_origen, aeropuerto_destino,
    ciudad_origen, ciudad_destino,
    tarifa_id, tarifa_id_original, tarifa_id_aplicada,
    carta_garantia, dias_libres_destino,
    seguro, valor_seguro_usd,
    agente_id, naviera_id, agente, naviera
  )
  VALUES (
    v_cot.id, NULL, v_cot.cliente_id, v_cot.cliente_nombre,
    'Borrador'::estado_embarque, v_cot.modo, v_cot.tipo, v_cot.incoterm, v_cot.descripcion_mercancia,
    COALESCE(v_cot.peso_kg, 0), COALESCE(v_cot.volumen_m3, 0), COALESCE(v_cot.piezas, 0),
    v_cot.operador, v_cot.tipo_carga, v_tipo_cont_code,
    v_cot.organization_id,
    v_puerto_o, v_puerto_d,
    v_aero_o, v_aero_d,
    v_ciudad_o, v_ciudad_d,
    v_cot.tarifa_id, v_cot.tarifa_id, v_cot.tarifa_id,
    v_cot.carta_garantia, v_cot.dias_libres_destino,
    v_cot.seguro, v_cot.valor_seguro_usd,
    v_agente_id, v_naviera_id, v_agente_nombre, v_naviera_nombre
  )
  RETURNING id INTO v_embarque_id;

  FOR v_doc_nombre IN
    SELECT unnest(
      CASE
        WHEN v_cot.modo = 'Aéreo'::modo_transporte THEN ARRAY['Air Waybill (AWB)', 'Packing List', 'Factura Comercial']::text[]
        WHEN v_cot.modo = 'Terrestre'::modo_transporte THEN ARRAY['Carta Porte', 'Factura', 'Lista de Empaque']::text[]
        ELSE ARRAY['Bill of Lading (BL Master)', 'Bill of Lading (BL House)', 'Packing List', 'Factura Comercial', 'Certificado de Origen', 'Ficha Técnica', 'Otros']::text[]
      END
    )
  LOOP
    INSERT INTO public.documentos_embarque (embarque_id, nombre, estado, organization_id)
    VALUES (v_embarque_id, v_doc_nombre, 'Pendiente'::estado_documento, v_cot.organization_id)
    ON CONFLICT (embarque_id, nombre) WHERE deleted_at IS NULL DO NOTHING;
  END LOOP;

  v_num := GREATEST(1, COALESCE(v_cot.num_contenedores, 1));
  v_peso_each := COALESCE(v_cot.peso_kg, 0) / v_num;
  v_vol_each := COALESCE(v_cot.volumen_m3, 0) / v_num;
  v_piezas_base := COALESCE(v_cot.piezas, 0) / v_num;
  v_piezas_rest := COALESCE(v_cot.piezas, 0);

  v_target_ids := ARRAY[]::uuid[];
  FOR i IN 1..v_num LOOP
    IF i = v_num THEN v_piezas_este := v_piezas_rest;
    ELSE v_piezas_este := v_piezas_base; END IF;
    v_piezas_rest := v_piezas_rest - v_piezas_este;

    INSERT INTO public.embarque_contenedores (
      embarque_id, numero_contenedor, tipo_contenedor, bl_house,
      peso_kg, volumen_m3, piezas, orden
    )
    VALUES (
      v_embarque_id, '', COALESCE(v_tipo_cont_code, ''), '',
      v_peso_each, v_vol_each, v_piezas_este, i
    )
    RETURNING id INTO v_cid;

    v_target_ids := array_append(v_target_ids, v_cid);
    IF i = 1 THEN v_first_hijo_id := v_cid; END IF;
  END LOOP;

  PERFORM public._crear_embarque_replicar_conceptos(
    v_cot.id, v_embarque_id, v_cot.organization_id, v_target_ids, v_cot.conceptos_venta
  );

  UPDATE public.cotizaciones
  SET embarque_id = v_embarque_id, estado = 'En operación'::estado_cotizacion, updated_at = now()
  WHERE id = v_cot.id;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
  VALUES (v_cot.organization_id, auth.uid(), COALESCE(v_user_email, ''),
          'Cotizaciones', 'Borrador de embarque creado', v_cot.id, v_cot.folio,
          jsonb_build_object('embarque_id', v_embarque_id, 'expediente', NULL));

  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace)
  SELECT v_cot.organization_id, om.user_id, 'cotizacion_borrador_embarque',
         'Borrador de embarque creado',
         'Se generó un borrador de embarque desde la cotización ' || v_cot.folio,
         '/embarques/' || v_embarque_id::text
  FROM public.organization_members om
  WHERE om.organization_id = v_cot.organization_id
    AND om.role IN ('admin'::app_role, 'operador'::app_role)
    AND om.user_id <> auth.uid();

  RETURN v_embarque_id;
END;
$function$;