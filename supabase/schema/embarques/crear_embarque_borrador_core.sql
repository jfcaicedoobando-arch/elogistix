-- Fuente canónica de public.crear_embarque_borrador_core
-- Regenerada desde DB. Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.

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

  -- Texto capturado ÍNTEGRO (nunca se recorta): es lo que ve el usuario.
  v_origen_raw    text;
  v_destino_raw   text;
  -- Candidato a UN/LOCODE: sólo se usa para intentar una coincidencia exacta
  -- y única contra puertos.code. Jamás sustituye al texto de respaldo.
  v_origen_code   text;
  v_destino_code  text;
  v_puerto_o      text;
  v_puerto_d      text;
  v_puerto_o_id   uuid;
  v_puerto_d_id   uuid;
  v_ruta_o_id     uuid;
  v_ruta_d_id     uuid;

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
  v_tipo_cont_id  uuid;
  v_tarifa_tipo_cont uuid;
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

  -- v13.823.330 · Auditoría YAGNI #2: una cotización con dinero en más de una
  -- moneda no puede convertirse sin tipo de cambio sellado; convertir con TC
  -- implícito (o 1:1) deformaría el P&L del embarque.
  -- v13.823.392 · Auditoría cotización→embarque #2: el conteo cubría SÓLO las
  -- monedas efectivas de `conceptos_venta`. Una venta en USD con costos en MXN
  -- (caso real) generaba un embarque multi-moneda sin TC sellado. Ahora se
  -- evalúa la UNIÓN de monedas efectivas de ventas y de `cotizacion_costos`
  -- vivos; las filas con importe cero siguen sin contar.
  SELECT count(*)
    INTO v_monedas
    FROM (
      SELECT upper(btrim(COALESCE(c->>'moneda', 'MXN'))) AS m
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(COALESCE(v_cot.conceptos_venta, '[]'::jsonb)) = 'array'
                    THEN v_cot.conceptos_venta ELSE '[]'::jsonb END) c
       -- v13.823.347: el importe efectivo cae a cantidad x precio cuando el
       -- renglón legacy trae `total` nulo o 0; antes esas filas USD no contaban y
       -- una cotización mixta se convertía sin tipo de cambio.
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

  -- v13.823.330 · Auditoría YAGNI #4: FCL exige número de contenedores real.
  -- Antes `GREATEST(1, ...)` convertía 0 en 1 en silencio. LCL no cambia.
  v_es_fcl := v_cot.modo = 'Marítimo'::modo_transporte
    AND upper(btrim(COALESCE(NULLIF(btrim(v_cot.tipo_embarque), ''), v_cot.tipo_carga, ''))) = 'FCL';
  IF v_es_fcl AND COALESCE(v_cot.num_contenedores, 0) < 1 THEN
    RAISE EXCEPTION 'LC_COT_CONTENEDORES_REQUERIDOS: la cotización % es marítima FCL y no indica cuántos contenedores; captura el número de contenedores (1 o más) antes de crear el embarque', COALESCE(v_cot.folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  -- v13.823.396 · Q1: FCL exige TIPO de contenedor. El Paso 1 dejaba avanzar sin
  -- seleccionarlo y el hijo FCL nacía con `tipo_contenedor` vacío. No se acepta
  -- ni se inventa '' (cadena vacía).
  IF v_es_fcl AND NULLIF(btrim(COALESCE(v_cot.tipo_contenedor, '')), '') IS NULL THEN
    RAISE EXCEPTION 'LC_COT_TIPO_CONTENEDOR_REQUERIDO: la cotización % es marítima FCL y no indica el tipo de contenedor; selecciónalo en el Paso 1 antes de crear el embarque', COALESCE(v_cot.folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  -- v13.823.396 · Q3: falla cerrada si el tipo de contenedor quedó desalineado
  -- de la tarifa todavía vinculada (un 40' valuado con costos y recargos de una
  -- tarifa 20'). Se normaliza el valor legado (code/nombre) o el UUID directo.
  IF v_es_fcl AND v_cot.tarifa_id IS NOT NULL THEN
    SELECT t.tipo_contenedor_id INTO v_tarifa_tipo_cont
      FROM public.costeo_tarifas t
     WHERE t.id = v_cot.tarifa_id
       AND t.organization_id = v_cot.organization_id;

    IF v_cot.tipo_contenedor ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      v_tipo_cont_id := v_cot.tipo_contenedor::uuid;
    ELSE
      SELECT tc.id INTO v_tipo_cont_id
        FROM public.tipos_contenedor tc
       WHERE lower(btrim(tc.code)) = lower(btrim(v_cot.tipo_contenedor))
          OR lower(btrim(tc.name)) = lower(btrim(v_cot.tipo_contenedor))
       LIMIT 1;
    END IF;

    IF v_tarifa_tipo_cont IS NOT NULL
       AND v_tipo_cont_id IS NOT NULL
       AND v_tipo_cont_id <> v_tarifa_tipo_cont THEN
      RAISE EXCEPTION 'LC_COT_TIPO_CONTENEDOR_INCOMPATIBLE: la cotización % tiene tipo de contenedor distinto al de su tarifa vinculada; elige una tarifa del tipo correcto antes de crear el embarque', COALESCE(v_cot.folio, p_cotizacion_id::text)
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- v13.823.357 · Auditoría YAGNI P1 #1/#3 y P2 #7: sin venta positiva, con
  -- precio de venta capturado que no llegó a los conceptos, o con moneda no
  -- soportada, el embarque nacería en cero o con importes deformados.
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

  -- P1-A: el texto capturado se conserva COMPLETO. Antes se guardaba sólo el
  -- contenido entre paréntesis, así que "Puerto X (Terminal Norte)" terminaba
  -- como "Terminal Norte" y "Ciudad de México (MEX)" como "MEX".
  v_origen_raw  := NULLIF(btrim(v_cot.origen), '');
  v_destino_raw := NULLIF(btrim(v_cot.destino), '');
  v_origen_code := COALESCE(
    NULLIF(btrim(substring(v_cot.origen  FROM '\(([^)]+)\)')), ''),
    v_origen_raw
  );
  v_destino_code := COALESCE(
    NULLIF(btrim(substring(v_cot.destino FROM '\(([^)]+)\)')), ''),
    v_destino_raw
  );

  IF v_cot.modo = 'Aéreo'::modo_transporte THEN
    -- Etapa 3: Aéreo y Terrestre NO pasan por el catálogo de puertos.
    v_aero_o := v_origen_raw;
    v_aero_d := v_destino_raw;
    v_puerto_o := NULL; v_puerto_d := NULL;
    v_puerto_o_id := NULL; v_puerto_d_id := NULL;
  ELSIF v_cot.modo = 'Terrestre'::modo_transporte THEN
    v_ciudad_o := v_origen_raw;
    v_ciudad_d := v_destino_raw;
    v_puerto_o := NULL; v_puerto_d := NULL;
    v_puerto_o_id := NULL; v_puerto_d_id := NULL;
  ELSE
    -- Etapa 3: la identidad del puerto viaja por ID, no por texto. Antes se
    -- extraía un supuesto código con regex y se resolvía con `LIMIT 1`, así que
    -- con rutas globales dos puertos homónimos podían intercambiarse.
    v_puerto_o_id := v_cot.puerto_origen_id;
    v_puerto_d_id := v_cot.puerto_destino_id;

    IF v_cot.tarifa_id IS NOT NULL THEN
      SELECT r.puerto_origen_id, r.puerto_destino_id
        INTO v_ruta_o_id, v_ruta_d_id
        FROM public.costeo_tarifas t
        JOIN public.costeo_rutas r ON r.id = t.ruta_id
       WHERE t.id = v_cot.tarifa_id AND t.organization_id = v_cot.organization_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'LC_COT_TARIFA_ORG_INVALIDA: la tarifa % no pertenece a la organización de la cotización', v_cot.tarifa_id
          USING ERRCODE = 'P0001';
      END IF;
      v_puerto_o_id := v_ruta_o_id;
      v_puerto_d_id := v_ruta_d_id;
    END IF;

    -- Legacy sin IDs: sólo UN/LOCODE exacto y ÚNICO. Nunca por nombre/fragmento.
    IF v_puerto_o_id IS NULL AND v_origen_code IS NOT NULL THEN
      SELECT max(p.id) INTO v_puerto_o_id
        FROM public.puertos p
       WHERE upper(btrim(p.code)) = upper(btrim(v_origen_code))
      HAVING count(*) = 1;
    END IF;
    IF v_puerto_d_id IS NULL AND v_destino_code IS NOT NULL THEN
      SELECT max(p.id) INTO v_puerto_d_id
        FROM public.puertos p
       WHERE upper(btrim(p.code)) = upper(btrim(v_destino_code))
      HAVING count(*) = 1;
    END IF;
    -- P1-B: una ruta con el mismo puerto en ambos extremos es inválida. Antes se
    -- borraban ambos IDs para eludir el CHECK, ocultando el problema.
    IF v_puerto_o_id IS NOT NULL AND v_puerto_o_id = v_puerto_d_id THEN
      RAISE EXCEPTION 'LC_COT_PUERTOS_IGUALES: el puerto de origen y destino no pueden ser el mismo; corrige la ruta antes de crear el embarque'
        USING ERRCODE = 'P0001';
    END IF;

    -- Texto canónico desde el catálogo por ID; respaldo: el texto capturado
    -- ÍNTEGRO (nunca el fragmento entre paréntesis).
    IF v_puerto_o_id IS NOT NULL THEN
      SELECT p.name INTO v_puerto_o FROM public.puertos p WHERE p.id = v_puerto_o_id;
    END IF;
    IF v_puerto_d_id IS NOT NULL THEN
      SELECT p.name INTO v_puerto_d FROM public.puertos p WHERE p.id = v_puerto_d_id;
    END IF;
    v_puerto_o := COALESCE(v_puerto_o, v_origen_raw);
    v_puerto_d := COALESCE(v_puerto_d, v_destino_raw);
  END IF;


  -- v13.320.4: usar columna real cotizaciones.tipo_contenedor (text).
  -- La versión viva anterior referenciaba una columna fantasma con sufijo _id que
  -- nunca existió en la tabla y hacía fallar toda la revalidación de tarifa.
  v_tipo_cont_code := v_cot.tipo_contenedor;
  IF v_tipo_cont_code IS NOT NULL AND v_tipo_cont_code ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    SELECT code INTO v_tipo_cont_code FROM public.tipos_contenedor WHERE id = v_cot.tipo_contenedor::uuid;
    v_tipo_cont_code := COALESCE(v_tipo_cont_code, v_cot.tipo_contenedor);
  END IF;

  -- SMOKE-02 (R216-COT-01): sembrar el servicio marítimo (FCL/LCL) desde
  -- `tipo_embarque` (con respaldo en `tipo_carga`), exactamente la misma fuente
  -- de verdad que usa la hidratación del wizard. Antes el resumen del borrador
  -- creado por conversión directa mostraba "Servicio —".
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
    -- v13.823.351: la tarifa se lee SIEMPRE acotada a la organización de la
    -- cotización; un id de otro tenant no debe sembrar agente/naviera.
    FROM public.costeo_tarifas t
     WHERE t.id = v_cot.tarifa_id AND t.organization_id = v_cot.organization_id;
  END IF;

  -- v13.823.355 (YAGNI r2 · P1): el agente se lee acotado a la organización de
  -- la cotización. Una referencia cruzada copiaba el nombre del agente de otro
  -- tenant al embarque; ahora falla cerrado.
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
    puerto_origen_id, puerto_destino_id,

    aeropuerto_origen, aeropuerto_destino,
    ciudad_origen, ciudad_destino,
    tarifa_id, tarifa_id_original, tarifa_id_aplicada,
    carta_garantia, dias_libres_destino,
    seguro, valor_seguro_usd,
    agente_id, naviera_id, agente, naviera,
    tipo_servicio,
    -- v13.823.330 · Auditoría YAGNI #3: el TC sellado en la cotización se hereda
    -- al embarque; antes el borrador nacía sin tipo de cambio.
    tipo_cambio_usd
  )
  VALUES (
    v_cot.id, NULL, v_cot.cliente_id, v_cot.cliente_nombre,
    'Borrador'::estado_embarque, v_cot.modo, v_cot.tipo, v_cot.incoterm, v_cot.descripcion_mercancia,
    COALESCE(v_cot.peso_kg, 0), COALESCE(v_cot.volumen_m3, 0), COALESCE(v_cot.piezas, 0),
    v_cot.operador, v_cot.tipo_carga, v_tipo_cont_code,
    -- R201-COT-07: la hoja de seguridad (MSDS) capturada en la cotización se
    -- hereda al embarque; antes el borrador nacía sin el documento.
    v_cot.msds_archivo,
    v_cot.organization_id,
    v_puerto_o, v_puerto_d,
    v_puerto_o_id, v_puerto_d_id,

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

  -- v13.823.332 · BL-EMB-02: los contenedores hijos SÓLO existen en marítimo.
  -- Antes se insertaba al menos una fila para cualquier modo, así que Aéreo y
  -- Terrestre nacían con un hijo vacío (numero/tipo '') que además contaminaba
  -- el prorrateo de costos (FIN-EMB-03) y encendía el badge "Datos pendientes".
  -- LCL: una sola fila con tipo 'LCL'. FCL: N filas reales. Otros modos: ninguna.
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
