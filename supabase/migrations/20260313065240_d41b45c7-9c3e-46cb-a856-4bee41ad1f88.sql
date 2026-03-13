
-- ══════════════════════════════════════════════════════════
-- RPC: crear_embarque_completo
-- Inserta embarque + conceptos venta + conceptos costo + documentos + nota sistema
-- en una sola transacción atómica
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.crear_embarque_completo(
  p_embarque jsonb,
  p_conceptos_venta jsonb DEFAULT '[]'::jsonb,
  p_conceptos_costo jsonb DEFAULT '[]'::jsonb,
  p_documentos jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  nuevo_id uuid;
  cv jsonb;
  cc jsonb;
  doc jsonb;
BEGIN
  -- 1. Insertar embarque
  INSERT INTO embarques
  SELECT * FROM jsonb_populate_record(null::embarques, p_embarque)
  RETURNING id INTO nuevo_id;

  -- 2. Conceptos de venta
  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta)
  LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total)
    VALUES (
      nuevo_id,
      cv->>'descripcion',
      (cv->>'cantidad')::int,
      (cv->>'precio_unitario')::numeric,
      (cv->>'moneda')::moneda,
      (cv->>'total')::numeric
    );
  END LOOP;

  -- 3. Conceptos de costo
  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo)
  LOOP
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto)
    VALUES (
      nuevo_id,
      cc->>'concepto',
      COALESCE(cc->>'proveedor_nombre', ''),
      CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' != '' THEN (cc->>'proveedor_id')::uuid ELSE NULL END,
      (cc->>'moneda')::moneda,
      (cc->>'monto')::numeric
    );
  END LOOP;

  -- 4. Documentos
  FOR doc IN SELECT * FROM jsonb_array_elements(p_documentos)
  LOOP
    INSERT INTO documentos_embarque (embarque_id, nombre, archivo)
    VALUES (
      nuevo_id,
      doc->>'nombre',
      NULLIF(doc->>'archivo', '')
    );
  END LOOP;

  -- 5. Nota de sistema
  INSERT INTO notas_embarque (embarque_id, contenido, tipo)
  VALUES (nuevo_id, 'Embarque creado', 'sistema');

  RETURN jsonb_build_object('id', nuevo_id);
END;
$$;

-- ══════════════════════════════════════════════════════════
-- RPC: actualizar_embarque_completo
-- Actualiza embarque + reemplaza conceptos venta y costo atómicamente
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.actualizar_embarque_completo(
  p_embarque_id uuid,
  p_embarque jsonb,
  p_conceptos_venta jsonb DEFAULT '[]'::jsonb,
  p_conceptos_costo jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cv jsonb;
  cc jsonb;
BEGIN
  -- 1. Actualizar embarque (solo campos presentes en el JSON)
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

  -- 2. Reemplazar conceptos de venta
  DELETE FROM conceptos_venta WHERE embarque_id = p_embarque_id;
  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta)
  LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total)
    VALUES (
      p_embarque_id,
      cv->>'descripcion',
      (cv->>'cantidad')::int,
      (cv->>'precio_unitario')::numeric,
      (cv->>'moneda')::moneda,
      (cv->>'total')::numeric
    );
  END LOOP;

  -- 3. Reemplazar conceptos de costo
  DELETE FROM conceptos_costo WHERE embarque_id = p_embarque_id;
  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo)
  LOOP
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto)
    VALUES (
      p_embarque_id,
      cc->>'concepto',
      COALESCE(cc->>'proveedor_nombre', ''),
      CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' != '' THEN (cc->>'proveedor_id')::uuid ELSE NULL END,
      (cc->>'moneda')::moneda,
      (cc->>'monto')::numeric
    );
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════════════════════
-- RPC: duplicar_embarque_completo
-- Duplica un embarque N veces con sus conceptos, atómicamente
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.duplicar_embarque_completo(
  p_embarque_origen_id uuid,
  p_copias jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  origen embarques%ROWTYPE;
  copia jsonb;
  nuevo_id uuid;
  creados jsonb := '[]'::jsonb;
  cv conceptos_venta%ROWTYPE;
  cc conceptos_costo%ROWTYPE;
BEGIN
  -- Leer embarque origen
  SELECT * INTO origen FROM embarques WHERE id = p_embarque_origen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque origen no encontrado';
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
      contenedor, tipo_contenedor, peso_kg, volumen_m3, piezas
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
      NULLIF(copia->>'num_contenedor', ''),
      NULLIF(copia->>'tipo_contenedor', ''),
      (copia->>'peso_kg')::numeric,
      (copia->>'volumen_m3')::numeric,
      (copia->>'piezas')::int
    ) RETURNING id INTO nuevo_id;

    -- Copiar conceptos de venta
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total)
    SELECT nuevo_id, descripcion, cantidad, precio_unitario, moneda, total
    FROM conceptos_venta WHERE embarque_id = p_embarque_origen_id;

    -- Copiar conceptos de costo
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto)
    SELECT nuevo_id, concepto, proveedor_nombre, proveedor_id, moneda, monto
    FROM conceptos_costo WHERE embarque_id = p_embarque_origen_id;

    -- Nota de sistema
    INSERT INTO notas_embarque (embarque_id, contenido, tipo)
    VALUES (nuevo_id, 'Embarque duplicado desde ' || origen.expediente, 'sistema');

    creados := creados || jsonb_build_object('id', nuevo_id, 'expediente', origen.expediente);
  END LOOP;

  RETURN creados;
END;
$$;

-- ══════════════════════════════════════════════════════════
-- RPC: eliminar_embarque_completo
-- Elimina embarque + hijos + revierte cotización si aplica
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.eliminar_embarque_completo(
  p_embarque_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cotizacion_id uuid;
  v_remaining int;
BEGIN
  -- 1. Leer cotizacion_id
  SELECT cotizacion_id INTO v_cotizacion_id FROM embarques WHERE id = p_embarque_id;

  -- 2. Eliminar hijos
  DELETE FROM conceptos_venta WHERE embarque_id = p_embarque_id;
  DELETE FROM conceptos_costo WHERE embarque_id = p_embarque_id;
  DELETE FROM documentos_embarque WHERE embarque_id = p_embarque_id;
  DELETE FROM notas_embarque WHERE embarque_id = p_embarque_id;
  DELETE FROM facturas WHERE embarque_id = p_embarque_id;

  -- 3. Eliminar embarque
  DELETE FROM embarques WHERE id = p_embarque_id;

  -- 4. Revertir cotización si no quedan embarques vinculados
  IF v_cotizacion_id IS NOT NULL THEN
    SELECT count(*) INTO v_remaining FROM embarques WHERE cotizacion_id = v_cotizacion_id;
    IF v_remaining = 0 THEN
      UPDATE cotizaciones SET estado = 'Aceptada' WHERE id = v_cotizacion_id;
    END IF;
  END IF;
END;
$$;
