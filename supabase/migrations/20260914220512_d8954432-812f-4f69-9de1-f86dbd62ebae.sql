CREATE OR REPLACE FUNCTION public.cotizacion_tiene_costos(p_cotizacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.cotizacion_costos cc
      JOIN public.cotizaciones c ON c.id = cc.cotizacion_id
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
       AND c.organization_id = public.current_user_org_id()
  );
$$;

REVOKE ALL ON FUNCTION public.cotizacion_tiene_costos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cotizacion_tiene_costos(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._assert_cotizacion_venta_valida(p_cotizacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_folio      text;
  v_tipo_doc   text;
  v_ventas     jsonb;
  v_positiva   boolean;
  v_moneda_mala text;
  v_sin_reflejo text;
  v_mal_formadas text;
BEGIN
  IF p_cotizacion_id IS NULL THEN RETURN; END IF;

  SELECT folio, COALESCE(tipo_documento, 'transaccional'),
         CASE WHEN jsonb_typeof(COALESCE(conceptos_venta, '[]'::jsonb)) = 'array'
              THEN COALESCE(conceptos_venta, '[]'::jsonb) ELSE '[]'::jsonb END
    INTO v_folio, v_tipo_doc, v_ventas
    FROM public.cotizaciones
   WHERE id = p_cotizacion_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_tipo_doc = 'informativa' THEN
    RAISE EXCEPTION 'LC_COT_INFORMATIVA: la cotización % es informativa (tarifario) y no puede convertirse en embarque', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cotizacion_costos cc
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_COT_SIN_COSTOS: la cotización % no tiene costos cargados; captura el desglose de costos en la cotización antes de crear el embarque', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  -- v13.823.392 · Auditoría cotización→embarque #5: se validan TODAS las líneas
  -- con descripción; antes una línea legacy con cantidad='dos' reventaba después
  -- con "invalid input syntax for type numeric".
  SELECT string_agg(DISTINCT c.desc_txt, '; ')
    INTO v_mal_formadas
    FROM (
      SELECT btrim(x->>'descripcion')       AS desc_txt,
             btrim(COALESCE(x->>'cantidad', ''))            AS cant,
             btrim(COALESCE(x->>'precio_unitario', ''))     AS pu,
             btrim(COALESCE(x->>'total', ''))               AS tot,
             btrim(COALESCE(x->>'tasa_iva_aplicada', ''))   AS tasa
        FROM jsonb_array_elements(v_ventas) x
       WHERE COALESCE(btrim(x->>'descripcion'), '') <> ''
    ) c
   WHERE (c.cant <> '' AND c.cant !~ '^-?[0-9]+(\.[0-9]+)?$')
      OR (c.pu   <> '' AND c.pu   !~ '^-?[0-9]+(\.[0-9]+)?$')
      OR (c.tot  <> '' AND c.tot  !~ '^-?[0-9]+(\.[0-9]+)?$')
      OR (c.tasa <> '' AND c.tasa !~ '^-?[0-9]+(\.[0-9]+)?$');

  IF v_mal_formadas IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_VENTA_IMPORTE_INVALIDO: el concepto de venta "%" tiene cantidad, precio, total o tasa de IVA con un valor que no es numérico; corrígelo en la cotización antes de crear el embarque', v_mal_formadas
      USING ERRCODE = 'P0001';
  END IF;

  WITH v AS (
    SELECT upper(btrim(COALESCE(c->>'moneda', 'MXN'))) AS moneda,
           CASE WHEN COALESCE(NULLIF(c->>'cantidad', ''), '1') ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN (c->>'cantidad')::numeric ELSE 0 END AS cant,
           CASE WHEN COALESCE(NULLIF(c->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN (c->>'precio_unitario')::numeric ELSE 0 END AS pu
      FROM jsonb_array_elements(v_ventas) c
     WHERE COALESCE(btrim(c->>'descripcion'), '') <> ''
  )
  SELECT EXISTS (SELECT 1 FROM v WHERE cant > 0 AND pu > 0),
         (SELECT string_agg(DISTINCT moneda, ', ') FROM v WHERE moneda NOT IN ('MXN', 'USD'))
    INTO v_positiva, v_moneda_mala;

  IF v_moneda_mala IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_MONEDA_NO_SOPORTADA: la cotización % tiene conceptos de venta en una moneda no soportada (%); sólo MXN y USD están habilitados', COALESCE(v_folio, p_cotizacion_id::text), v_moneda_mala
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_positiva, false) THEN
    RAISE EXCEPTION 'LC_COT_SIN_VENTA: la cotización % no tiene ningún concepto de venta con cantidad y precio mayores a cero', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  SELECT string_agg(DISTINCT c.m, ', ')
    INTO v_sin_reflejo
    FROM (
      SELECT upper(btrim(cc.moneda)) AS m
        FROM public.cotizacion_costos cc
       WHERE cc.cotizacion_id = p_cotizacion_id
         AND cc.deleted_at IS NULL
         AND COALESCE(cc.precio_venta, 0) > 0
    ) c
   WHERE NOT EXISTS (
     SELECT 1
       FROM jsonb_array_elements(v_ventas) x
      WHERE upper(btrim(COALESCE(x->>'moneda', 'MXN'))) = c.m
        AND COALESCE(btrim(x->>'descripcion'), '') <> ''
        AND CASE WHEN COALESCE(NULLIF(x->>'cantidad', ''), '1') ~ '^-?[0-9]+(\.[0-9]+)?$'
                 THEN (x->>'cantidad')::numeric ELSE 0 END > 0
        AND CASE WHEN COALESCE(NULLIF(x->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                 THEN (x->>'precio_unitario')::numeric ELSE 0 END > 0
   );

  IF v_sin_reflejo IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_VENTA_NO_REFLEJADA: la cotización % tiene precio de venta capturado en % que no llegó a los conceptos de venta; vuelve a guardar el paso 3 antes de convertir', COALESCE(v_folio, p_cotizacion_id::text), v_sin_reflejo
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_cotizacion_venta_valida(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_cotizacion_venta_valida(uuid) TO service_role;

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
  v_tipo_servicio text;
  v_monedas       integer;
  v_es_fcl        boolean;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: cotización % no existe', p_cotizacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_cot.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: la cotización % está eliminada', p_cotizacion_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE = '42501';
  END IF;

  v_can_write := v_is_super
                 OR has_role(auth.uid(), 'admin_org'::app_role)
                 OR has_role(auth.uid(), 'admin'::app_role)
                 OR has_role(auth.uid(), 'gerente_operaciones'::app_role)
                 OR has_role(auth.uid(), 'coordinador_logistico'::app_role)
                 OR has_role(auth.uid(), 'operador'::app_role);
  IF NOT v_can_write THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: solo administración u operación pueden crear el borrador' USING ERRCODE = '42501';
  END IF;

  IF v_cot.estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO: la cotización debe estar Aceptada o En operación (actual: %)', v_cot.estado USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.cliente_id IS NULL OR v_cot.es_prospecto THEN
    RAISE EXCEPTION 'LC_COT_SIN_CLIENTE: convierte el prospecto a cliente antes de crear el borrador' USING ERRCODE = 'P0001';
  END IF;

  -- v13.823.392 · Auditoría cotización→embarque #2: UNIÓN de monedas efectivas
  -- de conceptos_venta y de cotizacion_costos vivos. Antes una venta USD con
  -- costos MXN se convertía sin tipo de cambio sellado.
  SELECT count(*)
    INTO v_monedas
    FROM (
      SELECT upper(btrim(COALESCE(c->>'moneda', 'MXN'))) AS m
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(COALESCE(v_cot.conceptos_venta, '[]'::jsonb)) = 'array'
                    THEN v_cot.conceptos_venta ELSE '[]'::jsonb END) c
       WHERE COALESCE(
               NULLIF(
                 CASE WHEN COALESCE(NULLIF(c->>'total', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                      THEN (c->>'total')::numeric ELSE 0 END, 0),
               CASE WHEN COALESCE(NULLIF(c->>'cantidad', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                     AND COALESCE(NULLIF(c->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN (c->>'cantidad')::numeric * (c->>'precio_unitario')::numeric
                    ELSE 0 END
             ) <> 0
      UNION
      SELECT upper(btrim(COALESCE(cc.moneda, 'MXN')))
        FROM public.cotizacion_costos cc
       WHERE cc.cotizacion_id = v_cot.id
         AND cc.deleted_at IS NULL
         AND COALESCE(NULLIF(cc.costo_total, 0),
                      NULLIF(COALESCE(cc.costo_unitario, 0) * COALESCE(cc.cantidad, 0), 0),
                      0) <> 0
    ) u;

  IF COALESCE(v_monedas, 0) > 1 AND COALESCE(v_cot.tipo_cambio_usd, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_COT_TC_REQUERIDO: la cotización % tiene importes en más de una moneda y no tiene tipo de cambio; captúralo antes de crear el embarque', COALESCE(v_cot.folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  v_es_fcl := v_cot.modo = 'Marítimo'::modo_transporte
    AND upper(btrim(COALESCE(NULLIF(btrim(v_cot.tipo_embarque), ''), v_cot.tipo_carga, ''))) = 'FCL';
  IF v_es_fcl AND COALESCE(v_cot.num_contenedores, 0) < 1 THEN
    RAISE EXCEPTION 'LC_COT_CONTENEDORES_REQUERIDOS: la cotización % es marítima FCL y no indica cuántos contenedores; captura el número de contenedores (1 o más) antes de crear el embarque', COALESCE(v_cot.folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public._assert_cotizacion_venta_valida(v_cot.id);

  IF v_cot.embarque_id IS NOT NULL THEN
    SELECT id INTO v_orphan_id FROM public.embarques WHERE id = v_cot.embarque_id AND deleted_at IS NULL;
    IF FOUND THEN
      RETURN v_orphan_id;
    END IF;
    UPDATE public.cotizaciones SET embarque_id = NULL WHERE id = v_cot.id;
  END IF;

  SELECT id INTO v_orphan_id
  FROM public.embarques
  WHERE cotizacion_id = v_cot.id AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;
  IF v_orphan_id IS NOT NULL THEN
    RETURN v_orphan_id;
  END IF;

  v_origen_code := COALESCE(
    NULLIF(substring(v_cot.origen  FROM '\(([^)]+)\)'), ''),
    NULLIF(trim(v_cot.origen),  ''),
    NULL
  );
  v_destino_code := COALESCE(
    NULLIF(substring(v_cot.destino FROM '\(([^)]+)\)'), ''),
    NULLIF(trim(v_cot.destino), ''),
    NULL
  );

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

  v_tipo_cont_code := v_cot.tipo_contenedor;
  IF v_tipo_cont_code IS NOT NULL AND v_tipo_cont_code ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    SELECT code INTO v_tipo_cont_code FROM public.tipos_contenedor WHERE id = v_cot.tipo_contenedor::uuid;
    v_tipo_cont_code := COALESCE(v_tipo_cont_code, v_cot.tipo_contenedor);
  END IF;

  IF v_cot.modo = 'Marítimo'::modo_transporte THEN
    v_tipo_servicio := upper(btrim(COALESCE(NULLIF(btrim(v_cot.tipo_embarque), ''), v_cot.tipo_carga, '')));
    IF v_tipo_servicio NOT IN ('FCL', 'LCL') THEN
      v_tipo_servicio := NULL;
    END IF;
  ELSE
    v_tipo_servicio := NULL;
  END IF;

  v_agente_id  := v_cot.agente_id;
  v_naviera_id := v_cot.naviera_id;
  IF (v_agente_id IS NULL OR v_naviera_id IS NULL) AND v_cot.tarifa_id IS NOT NULL THEN
    SELECT COALESCE(v_agente_id, t.agente_id), COALESCE(v_naviera_id, t.naviera_id)
      INTO v_agente_id, v_naviera_id
    FROM public.costeo_tarifas t
     WHERE t.id = v_cot.tarifa_id AND t.organization_id = v_cot.organization_id;
  END IF;

  IF v_agente_id IS NOT NULL THEN
    SELECT nombre INTO v_agente_nombre
      FROM public.costeo_agentes
     WHERE id = v_agente_id AND organization_id = v_cot.organization_id;
    IF v_agente_nombre IS NULL THEN
      RAISE EXCEPTION 'LC_AGENTE_ORG_INVALIDA: el agente % no pertenece a la organización de la cotización', v_agente_id
        USING ERRCODE='P0001';
    END IF;
  END IF;
  IF v_naviera_id IS NOT NULL THEN SELECT name   INTO v_naviera_nombre FROM public.navieras       WHERE id = v_naviera_id; END IF;

  INSERT INTO public.embarques (
    cotizacion_id, expediente, cliente_id, cliente_nombre,
    estado, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, operador, tipo_carga, tipo_contenedor,
    msds_archivo,
    organization_id,
    puerto_origen, puerto_destino,
    aeropuerto_origen, aeropuerto_destino,
    ciudad_origen, ciudad_destino,
    tarifa_id, tarifa_id_original, tarifa_id_aplicada,
    carta_garantia, dias_libres_destino,
    seguro, valor_seguro_usd,
    agente_id, naviera_id, agente, naviera,
    tipo_servicio,
    tipo_cambio_usd
  )
  VALUES (
    v_cot.id, NULL, v_cot.cliente_id, v_cot.cliente_nombre,
    'Borrador'::estado_embarque, v_cot.modo, v_cot.tipo, v_cot.incoterm, v_cot.descripcion_mercancia,
    COALESCE(v_cot.peso_kg, 0), COALESCE(v_cot.volumen_m3, 0), COALESCE(v_cot.piezas, 0),
    v_cot.operador, v_cot.tipo_carga, v_tipo_cont_code,
    v_cot.msds_archivo,
    v_cot.organization_id,
    v_puerto_o, v_puerto_d,
    v_aero_o, v_aero_d,
    v_ciudad_o, v_ciudad_d,
    v_cot.tarifa_id, v_cot.tarifa_id, v_cot.tarifa_id,
    v_cot.carta_garantia, v_cot.dias_libres_destino,
    v_cot.seguro, v_cot.valor_seguro_usd,
    v_agente_id, v_naviera_id, v_agente_nombre, v_naviera_nombre,
    v_tipo_servicio::tipo_servicio_maritimo,
    NULLIF(GREATEST(COALESCE(v_cot.tipo_cambio_usd, 0), 0), 0)
  )
  RETURNING id INTO v_embarque_id;

  v_target_ids := ARRAY[]::uuid[];
  IF v_cot.modo = 'Marítimo'::modo_transporte THEN
    IF v_tipo_servicio = 'LCL' THEN
      v_num := 1;
    ELSE
      v_num := GREATEST(1, COALESCE(v_cot.num_contenedores, 1));
    END IF;
    v_peso_each := COALESCE(v_cot.peso_kg, 0) / v_num;
    v_vol_each := COALESCE(v_cot.volumen_m3, 0) / v_num;
    v_piezas_base := COALESCE(v_cot.piezas, 0) / v_num;
    v_piezas_rest := COALESCE(v_cot.piezas, 0);

    FOR i IN 1..v_num LOOP
      IF i = v_num THEN v_piezas_este := v_piezas_rest;
      ELSE v_piezas_este := v_piezas_base; END IF;
      v_piezas_rest := v_piezas_rest - v_piezas_este;

      INSERT INTO public.embarque_contenedores (
        embarque_id, numero_contenedor, tipo_contenedor, bl_house,
        peso_kg, volumen_m3, piezas, orden
      )
      VALUES (
        v_embarque_id, '',
        CASE WHEN v_tipo_servicio = 'LCL' THEN 'LCL' ELSE COALESCE(v_tipo_cont_code, '') END,
        '',
        v_peso_each, v_vol_each, v_piezas_este, i
      )
      RETURNING id INTO v_cid;

      v_target_ids := array_append(v_target_ids, v_cid);
      IF i = 1 THEN v_first_hijo_id := v_cid; END IF;
    END LOOP;
  END IF;

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
    AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'operador'::app_role,
                    'gerente_operaciones'::app_role, 'coordinador_logistico'::app_role)
    AND om.user_id <> auth.uid();

  RETURN v_embarque_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_embarque_borrador_core(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_core(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._embarque_aplicar_tarifa_decidida(
  p_embarque_id uuid,
  p_cotizacion_id uuid,
  p_tarifa_id_aplicada uuid
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org            uuid;
  v_costo          RECORD;
  v_fila           RECORD;
  v_unit           numeric;
  v_base           numeric;
  v_n              integer;
  v_cent           bigint;
  v_piso           bigint;
  v_resto          bigint;
  v_equivalentes   integer;
  v_moneda_match   text;
  v_tarifa_origen  uuid;
  v_es_sustitucion boolean;
  v_ag_origen      uuid;
  v_ag_nueva       uuid;
  v_mon_origen     text;
  v_mon_nueva      text;
  v_ruta_origen    uuid;
  v_ruta_nueva     uuid;
  v_cont_origen    uuid;
  v_cont_nueva     uuid;
  v_nav_nueva      uuid;
  v_nav_nombre     text;
  v_actualizados   integer := 0;
BEGIN
  IF p_embarque_id IS NULL OR p_cotizacion_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT c.tarifa_id, c.organization_id INTO v_tarifa_origen, v_org
    FROM public.cotizaciones c
   WHERE c.id = p_cotizacion_id;

  v_es_sustitucion := p_tarifa_id_aplicada IS NOT NULL
                  AND p_tarifa_id_aplicada IS DISTINCT FROM v_tarifa_origen;

  IF v_es_sustitucion THEN
    SELECT t.agente_id, t.moneda, t.ruta_id, t.tipo_contenedor_id, t.naviera_id
      INTO v_ag_nueva, v_mon_nueva, v_ruta_nueva, v_cont_nueva, v_nav_nueva
      FROM public.costeo_tarifas t
     WHERE t.id = p_tarifa_id_aplicada AND t.organization_id = v_org;
    SELECT t.agente_id, t.moneda, t.ruta_id, t.tipo_contenedor_id
      INTO v_ag_origen, v_mon_origen, v_ruta_origen, v_cont_origen
      FROM public.costeo_tarifas t
     WHERE t.id = v_tarifa_origen AND t.organization_id = v_org;

    IF v_ag_nueva IS NULL THEN
      RAISE EXCEPTION 'La tarifa sustituta no existe o no tiene agente asignado. Revisa y selecciona otra tarifa.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_tarifa_origen IS NOT NULL AND v_ag_nueva IS DISTINCT FROM v_ag_origen THEN
      RAISE EXCEPTION 'La tarifa sustituta pertenece a otro proveedor/agente: no se puede aplicar sin recotizar. Revisa y selecciona una tarifa del mismo proveedor.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_tarifa_origen IS NOT NULL AND upper(btrim(COALESCE(v_mon_nueva, ''))) IS DISTINCT FROM upper(btrim(COALESCE(v_mon_origen, ''))) THEN
      RAISE EXCEPTION 'La tarifa sustituta está en otra moneda (% vs %): no se puede aplicar sin recotizar. Revisa y selecciona una tarifa en la misma moneda.',
        v_mon_nueva, v_mon_origen USING ERRCODE = 'P0001';
    END IF;
    -- v13.823.392 · Auditoría cotización→embarque #3: la sustituta debe ser de
    -- la MISMA ruta y el MISMO tipo de contenedor/servicio que la cotización.
    IF v_tarifa_origen IS NOT NULL AND v_ruta_nueva IS DISTINCT FROM v_ruta_origen THEN
      RAISE EXCEPTION 'LC_TARIFA_RUTA_INCOMPATIBLE: la tarifa sustituta es de otra ruta que la cotización; selecciona una tarifa de la misma ruta o recotiza.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_tarifa_origen IS NOT NULL AND v_cont_nueva IS DISTINCT FROM v_cont_origen THEN
      RAISE EXCEPTION 'LC_TARIFA_TIPO_INCOMPATIBLE: la tarifa sustituta es de otro tipo de contenedor/servicio que la cotización; selecciona una tarifa del mismo tipo o recotiza.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  FOR v_costo IN
    SELECT cc.id, cc.concepto, cc.moneda,
           COALESCE(NULLIF(cc.cantidad, 0), 1) AS cantidad,
           cc.costo_unitario, cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id,
           r.concepto AS recargo_concepto, r.lado AS recargo_lado,
           r.monto AS recargo_monto_vigente, r.moneda AS recargo_moneda_vigente,
           r.id AS recargo_vigente_id
      FROM public.cotizacion_costos cc
      LEFT JOIN public.costeo_tarifa_recargos r
             ON r.id = cc.costeo_tarifa_recargo_id AND r.organization_id = v_org
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
       AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL)
  LOOP
    v_unit := NULL;

    IF v_costo.costeo_tarifa_recargo_id IS NOT NULL THEN
      IF v_es_sustitucion THEN
        SELECT count(*), min(r.monto), min(r.moneda)
          INTO v_equivalentes, v_unit, v_moneda_match
          FROM public.costeo_tarifa_recargos r
         WHERE r.tarifa_id = p_tarifa_id_aplicada
           AND r.organization_id = v_org
           AND lower(btrim(r.concepto)) = lower(btrim(COALESCE(v_costo.recargo_concepto, v_costo.concepto)))
           AND r.lado IS NOT DISTINCT FROM v_costo.recargo_lado
           AND upper(btrim(r.moneda)) = upper(btrim(v_costo.moneda));

        IF COALESCE(v_equivalentes, 0) = 0 THEN
          RAISE EXCEPTION 'La tarifa sustituta no tiene un cargo equivalente a "%" (%). Revisa y selecciona otra tarifa: no se aplicará conservando el cargo anterior.',
            COALESCE(v_costo.recargo_concepto, v_costo.concepto), v_costo.moneda
            USING ERRCODE = 'P0001';
        END IF;
        IF v_equivalentes > 1 THEN
          RAISE EXCEPTION 'La tarifa sustituta tiene % cargos llamados "%" (%): la equivalencia es ambigua. Revisa y selecciona otra tarifa.',
            v_equivalentes, COALESCE(v_costo.recargo_concepto, v_costo.concepto), v_costo.moneda
            USING ERRCODE = 'P0001';
        END IF;
        IF upper(btrim(COALESCE(v_moneda_match, ''))) IS DISTINCT FROM upper(btrim(v_costo.moneda)) THEN
          RAISE EXCEPTION 'El cargo equivalente a "%" está en otra moneda. Revisa y selecciona otra tarifa.',
            COALESCE(v_costo.recargo_concepto, v_costo.concepto) USING ERRCODE = 'P0001';
        END IF;
      ELSE
        IF v_costo.recargo_vigente_id IS NULL THEN
          RAISE EXCEPTION 'El cargo "%" de la tarifa ya no existe: no se puede refrescar. Revisa y selecciona una tarifa vigente.',
            v_costo.concepto USING ERRCODE = 'P0001';
        END IF;
        IF upper(btrim(COALESCE(v_costo.recargo_moneda_vigente, ''))) IS DISTINCT FROM upper(btrim(v_costo.moneda)) THEN
          RAISE EXCEPTION 'El cargo "%" cambió de moneda en la tarifa: no se puede refrescar sin recotizar.',
            COALESCE(v_costo.recargo_concepto, v_costo.concepto) USING ERRCODE = 'P0001';
        END IF;
        v_unit := v_costo.recargo_monto_vigente;
      END IF;
    ELSE
      SELECT t.flete_base, t.moneda INTO v_unit, v_moneda_match
        FROM public.costeo_tarifas t
       WHERE t.id = COALESCE(p_tarifa_id_aplicada, v_costo.costeo_tarifa_id)
         AND t.organization_id = v_org;

      IF v_unit IS NOT NULL
         AND upper(btrim(COALESCE(v_moneda_match, ''))) IS DISTINCT FROM upper(btrim(v_costo.moneda)) THEN
        RAISE EXCEPTION 'El flete de la tarifa aplicada está en % y el costo aceptado en %: no se puede aplicar sin recotizar.',
          v_moneda_match, v_costo.moneda USING ERRCODE = 'P0001';
      END IF;
    END IF;

    CONTINUE WHEN v_unit IS NULL;

    v_base := ROUND(v_unit * v_costo.cantidad, 2);

    SELECT count(*) INTO v_n
      FROM public.conceptos_costo c
     WHERE c.embarque_id = p_embarque_id
       AND c.deleted_at IS NULL
       AND c.estado_liquidacion = 'Pendiente'::estado_liquidacion
       AND c.origen IN ('cotizacion','costeo_tarifa')
       AND c.cotizacion_costo_origen_id = v_costo.id;

    CONTINUE WHEN COALESCE(v_n, 0) = 0;

    v_cent := ROUND(GREATEST(v_base, 0) * 100)::bigint;
    v_piso := v_cent / v_n::bigint;
    v_resto := v_cent - (v_piso * v_n::bigint);

    FOR v_fila IN
      SELECT c.id, row_number() OVER (ORDER BY c.contenedor_id NULLS FIRST, c.created_at, c.id) AS rn
        FROM public.conceptos_costo c
       WHERE c.embarque_id = p_embarque_id
         AND c.deleted_at IS NULL
         AND c.estado_liquidacion = 'Pendiente'::estado_liquidacion
         AND c.origen IN ('cotizacion','costeo_tarifa')
         AND c.cotizacion_costo_origen_id = v_costo.id
    LOOP
      UPDATE public.conceptos_costo
         SET monto = (v_piso + CASE WHEN v_fila.rn <= v_resto THEN 1 ELSE 0 END)::numeric / 100,
             origen = 'costeo_tarifa',
             updated_at = now()
       WHERE id = v_fila.id;
      v_actualizados := v_actualizados + 1;
    END LOOP;
  END LOOP;

  -- v13.823.392 · #3 (cont.): la cabecera del embarque sigue a los precios
  -- aplicados en la MISMA transacción cuando la sustitución cambia de naviera.
  IF v_es_sustitucion THEN
    SELECT n.name INTO v_nav_nombre
      FROM public.navieras n WHERE n.id = v_nav_nueva;
    UPDATE public.embarques e
       SET tarifa_id  = p_tarifa_id_aplicada,
           naviera_id = COALESCE(v_nav_nueva, e.naviera_id),
           naviera    = COALESCE(v_nav_nombre, e.naviera),
           updated_at = now()
     WHERE e.id = p_embarque_id;
  END IF;

  IF v_actualizados > 0 THEN
    PERFORM public._recompute_totales_embarque(p_embarque_id);
  END IF;

  RETURN v_actualizados;
END;
$function$;

REVOKE ALL ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._embarque_delta_tarifa_sustituida(
  p_cotizacion_id uuid,
  p_tarifa_id_aplicada uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_org     uuid;
  v_origen  uuid;
  v_cambios jsonb;
BEGIN
  IF p_cotizacion_id IS NULL OR p_tarifa_id_aplicada IS NULL THEN
    RETURN jsonb_build_object('origen', 'servidor', 'decision', 'sustituida', 'cambios', '[]'::jsonb);
  END IF;

  SELECT c.organization_id, c.tarifa_id INTO v_org, v_origen
    FROM public.cotizaciones c
   WHERE c.id = p_cotizacion_id;

  WITH conceptos AS (
    SELECT t.id AS tarifa_id, 'Flete base'::text AS concepto,
           upper(btrim(t.moneda)) AS moneda, COALESCE(t.flete_base, 0) AS monto
      FROM public.costeo_tarifas t
     WHERE t.organization_id = v_org
       AND t.id IN (v_origen, p_tarifa_id_aplicada)
    UNION ALL
    SELECT r.tarifa_id, r.concepto || ' (' || r.lado || ')',
           upper(btrim(r.moneda)), COALESCE(r.monto, 0)
      FROM public.costeo_tarifa_recargos r
      JOIN public.costeo_tarifas t ON t.id = r.tarifa_id
     WHERE t.organization_id = v_org
       AND r.tarifa_id IN (v_origen, p_tarifa_id_aplicada)
       AND r.incluido_en_total
  ),
  antes AS (
    SELECT concepto, moneda, sum(monto) AS monto
      FROM conceptos WHERE tarifa_id = v_origen GROUP BY 1, 2
  ),
  ahora AS (
    SELECT concepto, moneda, sum(monto) AS monto
      FROM conceptos WHERE tarifa_id = p_tarifa_id_aplicada GROUP BY 1, 2
  ),
  union_conceptos AS (
    SELECT COALESCE(a.concepto, b.concepto) AS concepto,
           COALESCE(a.moneda, b.moneda)     AS moneda,
           a.monto AS monto_anterior,
           b.monto AS monto_actual
      FROM antes a
      FULL JOIN ahora b ON b.concepto = a.concepto AND b.moneda = a.moneda
  )
  SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'concepto',       u.concepto,
           'moneda',         u.moneda,
           'monto_anterior', COALESCE(u.monto_anterior, 0),
           'monto_actual',   u.monto_actual,
           'delta_abs',      CASE WHEN u.monto_actual IS NULL THEN NULL
                                  ELSE round(u.monto_actual - COALESCE(u.monto_anterior, 0), 2) END,
           'delta_pct',      CASE WHEN u.monto_actual IS NULL OR COALESCE(u.monto_anterior, 0) = 0 THEN NULL
                                  ELSE round((u.monto_actual - u.monto_anterior) / u.monto_anterior * 100, 2) END,
           'motivo',         CASE WHEN u.monto_actual IS NULL THEN 'eliminado' ELSE NULL END
         )) ORDER BY u.concepto), '[]'::jsonb)
    INTO v_cambios
    FROM union_conceptos u
   WHERE u.monto_actual IS DISTINCT FROM u.monto_anterior;

  RETURN jsonb_build_object(
    'origen', 'servidor',
    'decision', 'sustituida',
    'calculado_en', now(),
    'tarifa_id_original', v_origen,
    'tarifa_id_aplicada', p_tarifa_id_aplicada,
    'cambios', COALESCE(v_cambios, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._embarque_delta_tarifa_sustituida(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._embarque_delta_tarifa_sustituida(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid, p_decision text DEFAULT 'sin_cambios'::text, p_tarifa_id_aplicada uuid DEFAULT NULL::uuid, p_delta_jsonb jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_embarque_id UUID; v_cot public.cotizaciones%ROWTYPE; v_ya_decidido BOOLEAN; v_rev jsonb; v_delta jsonb;
        v_existente UUID; v_caller_org UUID; v_is_super BOOLEAN;
BEGIN
  IF p_decision NOT IN ('sin_cambios','mantenida_por_operaciones','refrescada','sustituida','reaprobada_ventas') THEN
    RAISE EXCEPTION 'Decisión de tarifa inválida: %', p_decision USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;

  SELECT e.id INTO v_existente
    FROM public.embarques e
   WHERE e.deleted_at IS NULL
     AND (e.id = v_cot.embarque_id OR e.cotizacion_id = v_cot.id)
   ORDER BY e.created_at ASC
   LIMIT 1;

  IF v_existente IS NOT NULL THEN
    v_caller_org := public.current_user_org_id();
    v_is_super := public.has_role(auth.uid(), 'super_admin'::app_role);
    IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
      RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE='42501';
    END IF;
    IF NOT (v_is_super
            OR public.has_role(auth.uid(), 'admin_org'::app_role)
            OR public.has_role(auth.uid(), 'admin'::app_role)
            OR public.has_role(auth.uid(), 'gerente_operaciones'::app_role)
            OR public.has_role(auth.uid(), 'coordinador_logistico'::app_role)
            OR public.has_role(auth.uid(), 'operador'::app_role)) THEN
      RAISE EXCEPTION 'LC_NO_AUTORIZADO: solo administración u operación pueden crear el borrador' USING ERRCODE='42501';
    END IF;
    RETURN v_existente;
  END IF;

  IF v_cot.estado NOT IN ('Aceptada'::public.estado_cotizacion, 'En operación'::public.estado_cotizacion) THEN
    PERFORM public.enforce_cotizacion_vigente(p_cotizacion_id);
  END IF;

  v_rev := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  IF p_decision IN ('sin_cambios','mantenida_por_operaciones') THEN
    IF v_rev->>'severidad' = 'bloqueante' THEN
      RAISE EXCEPTION 'LC_TARIFA_REQUIERE_REVALIDACION: la tarifa cambió antes de crear el embarque' USING ERRCODE='P0001';
    END IF;

  ELSIF p_decision='reaprobada_ventas' THEN
    IF COALESCE((v_rev->>'reaprobacion_vigente')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_REAPROBACION_NO_VIGENTE: la aprobación de ventas no corresponde al estado económico actual' USING ERRCODE='P0001';
    END IF;
  ELSIF p_decision IN ('refrescada','sustituida') THEN
    IF p_tarifa_id_aplicada IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.costeo_tarifas t
       WHERE t.id=p_tarifa_id_aplicada
         AND t.organization_id=v_cot.organization_id
         AND (
           p_decision='refrescada' AND t.id=v_cot.tarifa_id
           OR p_decision='sustituida' AND t.id IS DISTINCT FROM v_cot.tarifa_id
         )
    ) THEN
      RAISE EXCEPTION 'LC_TARIFA_APLICADA_INVALIDA: selecciona una tarifa válida de la organización' USING ERRCODE='P0001';
    END IF;
  END IF;
  v_embarque_id := public.crear_embarque_borrador_core(p_cotizacion_id);

  SELECT tarifa_decision IS NOT NULL INTO v_ya_decidido
    FROM public.embarques WHERE id = v_embarque_id;

  IF NOT COALESCE(v_ya_decidido, false) THEN
    -- v13.823.392 · Auditoría cotización→embarque #4: para 'sustituida' el delta
    -- económico se calcula EN SERVIDOR contra la tarifa realmente elegida.
    IF p_decision = 'sustituida' THEN
      v_delta := public._embarque_delta_tarifa_sustituida(
        p_cotizacion_id, COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id));
    ELSE
      v_delta := p_delta_jsonb;
    END IF;

    UPDATE public.embarques
       SET tarifa_id_original=v_cot.tarifa_id,
           tarifa_id_aplicada=COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
           tarifa_delta_jsonb=v_delta,
           tarifa_decision=p_decision,
           tarifa_revalidada_en=now(),
           tarifa_revalidada_por=auth.uid()
     WHERE id=v_embarque_id;

    IF p_decision IN ('refrescada','sustituida') THEN
      PERFORM public._embarque_aplicar_tarifa_decidida(
        v_embarque_id, p_cotizacion_id, COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id));
    END IF;

    IF p_decision IN ('reaprobada_ventas','refrescada','sustituida')
       AND v_cot.estado_revalidacion='pendiente_reaprobacion' THEN
      UPDATE public.cotizaciones
         SET estado_revalidacion='reaprobada', revalidacion_resuelta_en=now(), updated_at=now()
       WHERE id=p_cotizacion_id;
    END IF;

    INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
      SELECT v_cot.organization_id, auth.uid(),
        COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
        'Embarques','tarifa_decision_aplicada', v_embarque_id, v_cot.folio,
        jsonb_build_object('decision',p_decision,
          'tarifa_id_original',v_cot.tarifa_id,
          'tarifa_id_aplicada',COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
          'delta',v_delta);
  END IF;

  RETURN v_embarque_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_embarque_borrador_desde_cotizacion(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_desde_cotizacion(uuid, text, uuid, jsonb) TO authenticated, service_role;