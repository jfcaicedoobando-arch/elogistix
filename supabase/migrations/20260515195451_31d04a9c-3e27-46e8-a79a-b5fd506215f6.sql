
-- 1) Harden shipment RPCs with ownership checks

CREATE OR REPLACE FUNCTION public.actualizar_embarque_completo(p_embarque_id uuid, p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_caller_org uuid;
  cv jsonb;
  cc jsonb;
BEGIN
  SELECT organization_id INTO v_org_id FROM embarques WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;
  v_caller_org := current_user_org_id();
  IF v_org_id <> v_caller_org AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: cross-organization access denied';
  END IF;

  UPDATE embarques SET
    cliente_id = COALESCE((p_embarque->>'cliente_id')::uuid, cliente_id),
    cliente_nombre = COALESCE(p_embarque->>'cliente_nombre', cliente_nombre),
    modo = COALESCE((p_embarque->>'modo')::modo_transporte, modo),
    tipo = COALESCE((p_embarque->>'tipo')::tipo_operacion, tipo),
    incoterm = COALESCE((p_embarque->>'incoterm')::incoterm, incoterm),
    bl_master = CASE WHEN p_embarque ? 'bl_master' THEN p_embarque->>'bl_master' ELSE bl_master END,
    bl_house = CASE WHEN p_embarque ? 'bl_house' THEN p_embarque->>'bl_house' ELSE bl_house END,
    naviera = CASE WHEN p_embarque ? 'naviera' THEN p_embarque->>'naviera' ELSE naviera END,
    puerto_origen = CASE WHEN p_embarque ? 'puerto_origen' THEN p_embarque->>'puerto_origen' ELSE puerto_origen END,
    puerto_destino = CASE WHEN p_embarque ? 'puerto_destino' THEN p_embarque->>'puerto_destino' ELSE puerto_destino END,
    aeropuerto_origen = CASE WHEN p_embarque ? 'aeropuerto_origen' THEN p_embarque->>'aeropuerto_origen' ELSE aeropuerto_origen END,
    aeropuerto_destino = CASE WHEN p_embarque ? 'aeropuerto_destino' THEN p_embarque->>'aeropuerto_destino' ELSE aeropuerto_destino END,
    ciudad_origen = CASE WHEN p_embarque ? 'ciudad_origen' THEN p_embarque->>'ciudad_origen' ELSE ciudad_origen END,
    ciudad_destino = CASE WHEN p_embarque ? 'ciudad_destino' THEN p_embarque->>'ciudad_destino' ELSE ciudad_destino END,
    aerolinea = CASE WHEN p_embarque ? 'aerolinea' THEN p_embarque->>'aerolinea' ELSE aerolinea END,
    transportista = CASE WHEN p_embarque ? 'transportista' THEN p_embarque->>'transportista' ELSE transportista END,
    agente = CASE WHEN p_embarque ? 'agente' THEN p_embarque->>'agente' ELSE agente END,
    shipper = COALESCE(p_embarque->>'shipper', shipper),
    consignatario = COALESCE(p_embarque->>'consignatario', consignatario),
    descripcion_mercancia = COALESCE(p_embarque->>'descripcion_mercancia', descripcion_mercancia),
    tipo_carga = COALESCE(p_embarque->>'tipo_carga', tipo_carga),
    tipo_servicio = CASE WHEN p_embarque ? 'tipo_servicio' THEN (p_embarque->>'tipo_servicio')::tipo_servicio_maritimo ELSE tipo_servicio END,
    operador = COALESCE(p_embarque->>'operador', operador),
    contenedor = CASE WHEN p_embarque ? 'contenedor' THEN p_embarque->>'contenedor' ELSE contenedor END,
    tipo_contenedor = CASE WHEN p_embarque ? 'tipo_contenedor' THEN p_embarque->>'tipo_contenedor' ELSE tipo_contenedor END,
    peso_kg = COALESCE((p_embarque->>'peso_kg')::numeric, peso_kg),
    volumen_m3 = COALESCE((p_embarque->>'volumen_m3')::numeric, volumen_m3),
    piezas = COALESCE((p_embarque->>'piezas')::int, piezas),
    mawb = CASE WHEN p_embarque ? 'mawb' THEN p_embarque->>'mawb' ELSE mawb END,
    hawb = CASE WHEN p_embarque ? 'hawb' THEN p_embarque->>'hawb' ELSE hawb END,
    carta_porte = CASE WHEN p_embarque ? 'carta_porte' THEN p_embarque->>'carta_porte' ELSE carta_porte END,
    etd = CASE WHEN p_embarque ? 'etd' THEN (p_embarque->>'etd')::date ELSE etd END,
    eta = CASE WHEN p_embarque ? 'eta' THEN (p_embarque->>'eta')::date ELSE eta END,
    tipo_cambio_usd = COALESCE((p_embarque->>'tipo_cambio_usd')::numeric, tipo_cambio_usd),
    tipo_cambio_eur = COALESCE((p_embarque->>'tipo_cambio_eur')::numeric, tipo_cambio_eur),
    msds_archivo = CASE WHEN p_embarque ? 'msds_archivo' THEN p_embarque->>'msds_archivo' ELSE msds_archivo END,
    updated_at = now()
  WHERE id = p_embarque_id;

  DELETE FROM conceptos_venta WHERE embarque_id = p_embarque_id;
  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta)
  LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    VALUES (p_embarque_id, cv->>'descripcion', (cv->>'cantidad')::int, (cv->>'precio_unitario')::numeric, (cv->>'moneda')::moneda, (cv->>'total')::numeric, v_org_id);
  END LOOP;

  DELETE FROM conceptos_costo WHERE embarque_id = p_embarque_id;
  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo)
  LOOP
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id)
    VALUES (p_embarque_id, cc->>'concepto', COALESCE(cc->>'proveedor_nombre', ''),
      CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' != '' THEN (cc->>'proveedor_id')::uuid ELSE NULL END,
      (cc->>'moneda')::moneda, (cc->>'monto')::numeric, v_org_id);
  END LOOP;
END;
$function$;


CREATE OR REPLACE FUNCTION public.duplicar_embarque_completo(p_embarque_origen_id uuid, p_copias jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  origen embarques%ROWTYPE;
  copia jsonb;
  nuevo_id uuid;
  creados jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO origen FROM embarques WHERE id = p_embarque_origen_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque origen no encontrado'; END IF;

  IF origen.organization_id <> current_user_org_id() AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: cross-organization access denied';
  END IF;

  FOR copia IN SELECT * FROM jsonb_array_elements(p_copias)
  LOOP
    INSERT INTO embarques (
      expediente, estado, cliente_id, cliente_nombre, modo, tipo, incoterm,
      bl_master, bl_house, naviera, puerto_origen, puerto_destino,
      aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino,
      aerolinea, transportista, agente, shipper, consignatario,
      descripcion_mercancia, tipo_carga, tipo_servicio, operador,
      mawb, hawb, carta_porte, etd, eta,
      tipo_cambio_usd, tipo_cambio_eur,
      contenedor, tipo_contenedor, peso_kg, volumen_m3, piezas, organization_id
    ) VALUES (
      origen.expediente, 'Confirmado', origen.cliente_id, origen.cliente_nombre,
      origen.modo, origen.tipo, origen.incoterm,
      origen.bl_master, origen.bl_house, origen.naviera,
      origen.puerto_origen, origen.puerto_destino,
      origen.aeropuerto_origen, origen.aeropuerto_destino,
      origen.ciudad_origen, origen.ciudad_destino,
      origen.aerolinea, origen.transportista, origen.agente,
      origen.shipper, origen.consignatario,
      origen.descripcion_mercancia, origen.tipo_carga, origen.tipo_servicio,
      origen.operador, origen.mawb, origen.hawb, origen.carta_porte,
      origen.etd, origen.eta,
      origen.tipo_cambio_usd, origen.tipo_cambio_eur,
      NULLIF(copia->>'num_contenedor', ''), NULLIF(copia->>'tipo_contenedor', ''),
      (copia->>'peso_kg')::numeric, (copia->>'volumen_m3')::numeric, (copia->>'piezas')::int,
      origen.organization_id
    ) RETURNING id INTO nuevo_id;

    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    SELECT nuevo_id, descripcion, cantidad, precio_unitario, moneda, total, origen.organization_id
    FROM conceptos_venta WHERE embarque_id = p_embarque_origen_id;

    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id)
    SELECT nuevo_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, origen.organization_id
    FROM conceptos_costo WHERE embarque_id = p_embarque_origen_id;

    INSERT INTO notas_embarque (embarque_id, contenido, tipo, organization_id)
    VALUES (nuevo_id, 'Embarque duplicado desde ' || origen.expediente, 'sistema', origen.organization_id);

    creados := creados || jsonb_build_object('id', nuevo_id, 'expediente', origen.expediente);
  END LOOP;

  RETURN creados;
END;
$function$;


CREATE OR REPLACE FUNCTION public.crear_embarque_completo(p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb, p_documentos jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_id uuid := gen_random_uuid();
  v_org_id uuid;
  cv jsonb;
  cc jsonb;
  doc jsonb;
BEGIN
  -- Always trust the caller's organization, never the payload
  v_org_id := current_user_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization context for caller';
  END IF;

  INSERT INTO embarques (
    id, expediente, cliente_id, cliente_nombre, modo, tipo,
    shipper, consignatario, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas,
    puerto_origen, puerto_destino, naviera, agente,
    bl_master, bl_house, tipo_servicio,
    contenedor, tipo_contenedor,
    aeropuerto_origen, aeropuerto_destino, aerolinea,
    mawb, hawb, ciudad_origen, ciudad_destino,
    transportista, carta_porte, etd, eta,
    tipo_cambio_usd, tipo_cambio_eur,
    tipo_carga, msds_archivo, operador, organization_id
  ) VALUES (
    nuevo_id, p_embarque->>'expediente', (p_embarque->>'cliente_id')::uuid,
    COALESCE(p_embarque->>'cliente_nombre', ''),
    (p_embarque->>'modo')::modo_transporte, (p_embarque->>'tipo')::tipo_operacion,
    COALESCE(p_embarque->>'shipper', ''), COALESCE(p_embarque->>'consignatario', ''),
    COALESCE((p_embarque->>'incoterm')::incoterm, 'FOB'),
    COALESCE(p_embarque->>'descripcion_mercancia', ''),
    COALESCE((p_embarque->>'peso_kg')::numeric, 0),
    COALESCE((p_embarque->>'volumen_m3')::numeric, 0),
    COALESCE((p_embarque->>'piezas')::int, 0),
    p_embarque->>'puerto_origen', p_embarque->>'puerto_destino',
    p_embarque->>'naviera', p_embarque->>'agente',
    p_embarque->>'bl_master', p_embarque->>'bl_house',
    CASE WHEN p_embarque->>'tipo_servicio' IS NOT NULL THEN (p_embarque->>'tipo_servicio')::tipo_servicio_maritimo ELSE NULL END,
    p_embarque->>'contenedor', p_embarque->>'tipo_contenedor',
    p_embarque->>'aeropuerto_origen', p_embarque->>'aeropuerto_destino',
    p_embarque->>'aerolinea', p_embarque->>'mawb', p_embarque->>'hawb',
    p_embarque->>'ciudad_origen', p_embarque->>'ciudad_destino',
    p_embarque->>'transportista', p_embarque->>'carta_porte',
    CASE WHEN p_embarque->>'etd' IS NOT NULL THEN (p_embarque->>'etd')::date ELSE NULL END,
    CASE WHEN p_embarque->>'eta' IS NOT NULL THEN (p_embarque->>'eta')::date ELSE NULL END,
    COALESCE((p_embarque->>'tipo_cambio_usd')::numeric, 17.5),
    COALESCE((p_embarque->>'tipo_cambio_eur')::numeric, 19.0),
    COALESCE(p_embarque->>'tipo_carga', 'Carga General'),
    p_embarque->>'msds_archivo', COALESCE(p_embarque->>'operador', ''),
    v_org_id
  );

  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta)
  LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    VALUES (nuevo_id, cv->>'descripcion', (cv->>'cantidad')::int, (cv->>'precio_unitario')::numeric, (cv->>'moneda')::moneda, (cv->>'total')::numeric, v_org_id);
  END LOOP;

  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo)
  LOOP
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id)
    VALUES (nuevo_id, cc->>'concepto', COALESCE(cc->>'proveedor_nombre', ''),
      CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' != '' THEN (cc->>'proveedor_id')::uuid ELSE NULL END,
      (cc->>'moneda')::moneda, (cc->>'monto')::numeric, v_org_id);
  END LOOP;

  FOR doc IN SELECT * FROM jsonb_array_elements(p_documentos)
  LOOP
    INSERT INTO documentos_embarque (embarque_id, nombre, archivo, estado, organization_id)
    VALUES (
      nuevo_id, doc->>'nombre', NULLIF(doc->>'archivo', ''),
      CASE WHEN NULLIF(doc->>'archivo', '') IS NOT NULL THEN 'Recibido'::estado_documento ELSE 'Pendiente'::estado_documento END,
      v_org_id
    );
  END LOOP;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, organization_id)
  VALUES (nuevo_id, 'Embarque creado', 'sistema', v_org_id);

  RETURN jsonb_build_object('id', nuevo_id);
END;
$function$;


-- 2) user_roles: only super admins can manage the global roles table
DROP POLICY IF EXISTS "Admins manage non-super-admin roles" ON public.user_roles;


-- 3) Storage: scope SELECT on 'documentos' bucket to user's organization
DROP POLICY IF EXISTS "Authenticated users can view documentos" ON storage.objects;

CREATE POLICY "Tenant scoped read documentos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.documentos_embarque d
      WHERE d.archivo = storage.objects.name
        AND d.organization_id = current_user_org_id()
    )
    OR EXISTS (
      SELECT 1
      FROM public.documentos_embarque d
      JOIN public.embarques e ON e.id = d.embarque_id
      WHERE d.archivo = storage.objects.name
        AND has_role(auth.uid(), 'cliente'::app_role)
        AND e.cliente_id IN (SELECT current_user_client_ids())
    )
  )
);
