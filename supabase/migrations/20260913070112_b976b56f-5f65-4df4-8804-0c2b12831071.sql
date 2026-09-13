CREATE OR REPLACE FUNCTION public.tg_pfc_validar_vinculo_costo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cc_moneda   text;
  v_cc_monto    numeric;
  v_cc_prov     uuid;
  v_cc_org      uuid;
  v_expediente  text;
  v_fac_folio   text;
  v_fac_moneda  text;
  v_fac_prov    uuid;
  v_fac_org     uuid;
  v_asignado    numeric;
BEGIN
  IF NEW.concepto_costo_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.concepto_costo_id IS NOT DISTINCT FROM OLD.concepto_costo_id
     AND NEW.proveedor_factura_id IS NOT DISTINCT FROM OLD.proveedor_factura_id
     AND NEW.monto IS NOT DISTINCT FROM OLD.monto THEN
    RETURN NEW;
  END IF;

  SELECT cc.moneda, cc.monto, cc.proveedor_id, cc.organization_id
    INTO v_cc_moneda, v_cc_monto, v_cc_prov, v_cc_org
    FROM public.conceptos_costo cc
   WHERE cc.id = NEW.concepto_costo_id
     AND cc.deleted_at IS NULL
   FOR UPDATE;

  IF v_cc_org IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_COSTO_INEXISTENTE: el concepto de costo no existe o fue eliminado'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT e.expediente INTO v_expediente
    FROM public.conceptos_costo cc
    JOIN public.embarques e ON e.id = cc.embarque_id
   WHERE cc.id = NEW.concepto_costo_id;

  SELECT pf.folio, pf.moneda, pf.proveedor_id, pf.organization_id
    INTO v_fac_folio, v_fac_moneda, v_fac_prov, v_fac_org
    FROM public.proveedor_facturas pf
   WHERE pf.id = NEW.proveedor_factura_id;

  IF v_fac_org IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_FACTURA_NO_EXISTE: la factura de proveedor no existe'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_fac_org IS DISTINCT FROM v_cc_org THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_ORG: la factura % y el costo del expediente % pertenecen a organizaciones distintas',
      COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_expediente, '(sin expediente)')
      USING ERRCODE = '42501';
  END IF;

  IF v_cc_prov IS NOT NULL AND v_fac_prov IS NOT NULL AND v_cc_prov IS DISTINCT FROM v_fac_prov THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_PROVEEDOR: la factura % es de otro proveedor que el costo del expediente %',
      COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_expediente, '(sin expediente)')
      USING ERRCODE = 'P0001';
  END IF;

  IF upper(btrim(COALESCE(v_fac_moneda, ''))) IS DISTINCT FROM upper(btrim(COALESCE(v_cc_moneda, ''))) THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_MONEDA: la factura % está en % y el costo del expediente % en %; no se pueden mezclar monedas sin tipo de cambio explícito',
      COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_fac_moneda, '(sin moneda)'),
      COALESCE(v_expediente, '(sin expediente)'), COALESCE(v_cc_moneda, '(sin moneda)')
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(sum(pfc.monto), 0)
    INTO v_asignado
    FROM public.proveedor_facturas_conceptos pfc
   WHERE pfc.concepto_costo_id = NEW.concepto_costo_id
     AND (TG_OP = 'INSERT' OR pfc.id <> NEW.id);

  IF COALESCE(v_cc_monto, 0) > 0
     AND round(v_asignado + COALESCE(NEW.monto, 0), 2) > round(v_cc_monto * 1.05, 2) THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_SOBREASIGNADO: el costo del expediente % es de % % y ya tiene % asignado; la factura % excede el monto restante',
      COALESCE(v_expediente, '(sin expediente)'), v_cc_monto, COALESCE(v_cc_moneda, ''),
      v_asignado, COALESCE(v_fac_folio, '(sin folio)')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pfc_validar_vinculo_costo ON public.proveedor_facturas_conceptos;
CREATE TRIGGER trg_pfc_validar_vinculo_costo
BEFORE INSERT OR UPDATE ON public.proveedor_facturas_conceptos
FOR EACH ROW EXECUTE FUNCTION public.tg_pfc_validar_vinculo_costo();

REVOKE ALL ON FUNCTION public.tg_pfc_validar_vinculo_costo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tg_pfc_validar_vinculo_costo() TO authenticated, service_role;

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

  -- v13.823.330 · Auditoría YAGNI #2: una cotización con dinero en más de una
  -- moneda no puede convertirse sin tipo de cambio sellado; convertir con TC
  -- implícito (o 1:1) deformaría el P&L del embarque.
  SELECT count(DISTINCT upper(btrim(COALESCE(c->>'moneda', 'MXN'))))
    INTO v_monedas
    FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(COALESCE(v_cot.conceptos_venta, '[]'::jsonb)) = 'array'
                THEN v_cot.conceptos_venta ELSE '[]'::jsonb END) c
   WHERE COALESCE(NULLIF(c->>'total', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
     AND (c->>'total')::numeric <> 0;

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
    FROM public.costeo_tarifas t WHERE t.id = v_cot.tarifa_id;
  END IF;

  IF v_agente_id  IS NOT NULL THEN SELECT nombre INTO v_agente_nombre  FROM public.costeo_agentes WHERE id = v_agente_id; END IF;
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
    AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'operador'::app_role,
                    'gerente_operaciones'::app_role, 'coordinador_logistico'::app_role)
    AND om.user_id <> auth.uid();

  RETURN v_embarque_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_embarque_borrador_core(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_core(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INT; v_org UUID; v_folio TEXT;
  v_estado_actual TEXT; v_vigencia DATE;
  v_cliente_id UUID; v_requiere BOOLEAN; v_origen TEXT;
  v_creado_por UUID;
  v_uid UUID := auth.uid();
  v_admin BOOLEAN;
  v_oportunidad_id UUID;
  v_version_aceptada INT;
  v_op_existe BOOLEAN;
  v_ganadora UUID;
  v_tipo_documento TEXT;
  v_subtotal NUMERIC;
  v_conceptos JSONB;
  v_renglon_valido BOOLEAN;
BEGIN
  SELECT version, organization_id, folio, estado::text, fecha_vigencia, cliente_id,
         created_by, oportunidad_id, version_aceptada,
         tipo_documento, subtotal, conceptos_venta
    INTO v_version, v_org, v_folio, v_estado_actual, v_vigencia, v_cliente_id,
         v_creado_por, v_oportunidad_id, v_version_aceptada,
         v_tipo_documento, v_subtotal, v_conceptos
    FROM cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL
    FOR UPDATE;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;

  v_admin := public.has_role(v_uid, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_org AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['admin','admin_org'])
    );

  IF NOT (
    v_admin
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_org AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['gerente_comercial','vendedor','operador','gerente_operaciones'])
    )
  ) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: tu rol no puede aceptar cotizaciones en esta organización' USING ERRCODE='42501';
  END IF;

  IF v_creado_por IS NOT NULL AND v_uid IS NOT NULL AND v_creado_por = v_uid AND NOT v_admin THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: quien creó la cotización no puede aceptarla' USING ERRCODE='42501';
  END IF;

  v_requiere := public.cliente_requiere_autorizacion(v_cliente_id, 'cotizacion');
  v_origen := CASE WHEN v_requiere THEN 'autorizacion_cliente' ELSE 'interna_cliente_de_casa' END;

  IF v_estado_actual IN ('Aceptada','En operación') THEN
    IF v_oportunidad_id IS NOT NULL THEN
      SELECT true, o.cotizacion_ganadora_id
        INTO v_op_existe, v_ganadora
        FROM public.crm_oportunidades o
       WHERE o.id = v_oportunidad_id
         AND o.organization_id = v_org
         AND o.deleted_at IS NULL
       FOR UPDATE OF o;

      IF NOT COALESCE(v_op_existe, false) THEN
        RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: la cotización está aceptada pero su oportunidad no existe, está eliminada o es de otra organización (cotización %)', p_cotizacion_id
          USING ERRCODE='P0001';
      END IF;

      IF v_ganadora IS NULL THEN
        RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: la cotización está aceptada pero la oportunidad no registra cotización ganadora (cotización %); revisión manual requerida', p_cotizacion_id
          USING ERRCODE='P0001';
      END IF;

      IF v_ganadora <> p_cotizacion_id THEN
        RAISE EXCEPTION 'LC_COTIZACION_GANADORA_EXISTE: la oportunidad ya tiene una cotización ganadora'
          USING ERRCODE='P0001',
                HINT=format('ganadora_actual=%s; intentada=%s', v_ganadora, p_cotizacion_id);
      END IF;
    END IF;

    IF v_version_aceptada IS NULL THEN
      RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: la cotización está aceptada sin versión aceptada sellada (cotización %); revisión manual requerida', p_cotizacion_id
        USING ERRCODE='P0001';
    END IF;

    RETURN jsonb_build_object(
      'cotizacion_id', p_cotizacion_id,
      'version_aceptada', v_version_aceptada,
      'origen_aceptacion', v_origen,
      'sin_cambios', true);
  END IF;

  IF v_vigencia IS NOT NULL AND v_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COT_VENCIDA: la cotización venció el %, extienda la vigencia antes de aceptar', v_vigencia USING ERRCODE='P0001';
  END IF;

  IF v_requiere THEN
    IF v_estado_actual NOT IN ('Borrador','Enviada') THEN
      RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Enviada (actual: %, estados_permitidos: [Borrador, Enviada])', v_estado_actual
        USING ERRCODE='P0001', HINT='estados_permitidos=Borrador,Enviada';
    END IF;
  ELSE
    IF v_estado_actual NOT IN ('Borrador','Solicitada','Enviada') THEN
      RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Solicitada/Enviada (actual: %, estados_permitidos: [Borrador, Solicitada, Enviada])', v_estado_actual
        USING ERRCODE='P0001', HINT='estados_permitidos=Borrador,Solicitada,Enviada';
    END IF;
  END IF;

  -- v13.823.330 · Auditoría YAGNI #5: una cotización transaccional no puede
  -- aceptarse sin importe. Las informativas (tarifarios) quedan exentas.
  IF COALESCE(v_tipo_documento, 'transaccional') <> 'informativa' THEN
    SELECT EXISTS (
      SELECT 1
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(COALESCE(v_conceptos, '[]'::jsonb)) = 'array'
                    THEN v_conceptos ELSE '[]'::jsonb END) c
       WHERE COALESCE(NULLIF(c->>'cantidad', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
         AND COALESCE(NULLIF(c->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
         AND (c->>'cantidad')::numeric > 0
         AND (c->>'precio_unitario')::numeric > 0
    ) INTO v_renglon_valido;

    IF COALESCE(v_subtotal, 0) <= 0 OR NOT COALESCE(v_renglon_valido, false) THEN
      RAISE EXCEPTION 'LC_COT_IMPORTE_REQUERIDO: la cotización % no tiene importe; captura al menos un concepto con cantidad y precio mayores a cero antes de aceptarla', COALESCE(v_folio, p_cotizacion_id::text)
        USING ERRCODE='P0001';
    END IF;
  END IF;

  UPDATE cotizaciones
     SET version_aceptada=v_version, aceptada_en=now(), aceptada_por=auth.uid(),
         estado='Aceptada', updated_at=now()
   WHERE id = p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_org, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
    'cotizacion.aceptada_version_fijada','cotizaciones',
    p_cotizacion_id, COALESCE(v_folio,''),
    jsonb_build_object('version_aceptada',v_version,'estado_previo',v_estado_actual,'origen_aceptacion',v_origen));
  RETURN jsonb_build_object('cotizacion_id',p_cotizacion_id,'version_aceptada',v_version,
                            'origen_aceptacion',v_origen,'sin_cambios',false);
END;
$$;

REVOKE ALL ON FUNCTION public.aceptar_cotizacion_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aceptar_cotizacion_version(uuid) TO authenticated, service_role;