
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
  nuevo_id uuid := gen_random_uuid();
  cv jsonb;
  cc jsonb;
  doc jsonb;
BEGIN
  -- 1. Insertar embarque con campos explícitos
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
    tipo_carga, msds_archivo, operador
  ) VALUES (
    nuevo_id,
    p_embarque->>'expediente',
    (p_embarque->>'cliente_id')::uuid,
    COALESCE(p_embarque->>'cliente_nombre', ''),
    (p_embarque->>'modo')::modo_transporte,
    (p_embarque->>'tipo')::tipo_operacion,
    COALESCE(p_embarque->>'shipper', ''),
    COALESCE(p_embarque->>'consignatario', ''),
    COALESCE((p_embarque->>'incoterm')::incoterm, 'FOB'),
    COALESCE(p_embarque->>'descripcion_mercancia', ''),
    COALESCE((p_embarque->>'peso_kg')::numeric, 0),
    COALESCE((p_embarque->>'volumen_m3')::numeric, 0),
    COALESCE((p_embarque->>'piezas')::int, 0),
    p_embarque->>'puerto_origen',
    p_embarque->>'puerto_destino',
    p_embarque->>'naviera',
    p_embarque->>'agente',
    p_embarque->>'bl_master',
    p_embarque->>'bl_house',
    CASE WHEN p_embarque->>'tipo_servicio' IS NOT NULL THEN (p_embarque->>'tipo_servicio')::tipo_servicio_maritimo ELSE NULL END,
    p_embarque->>'contenedor',
    p_embarque->>'tipo_contenedor',
    p_embarque->>'aeropuerto_origen',
    p_embarque->>'aeropuerto_destino',
    p_embarque->>'aerolinea',
    p_embarque->>'mawb',
    p_embarque->>'hawb',
    p_embarque->>'ciudad_origen',
    p_embarque->>'ciudad_destino',
    p_embarque->>'transportista',
    p_embarque->>'carta_porte',
    CASE WHEN p_embarque->>'etd' IS NOT NULL THEN (p_embarque->>'etd')::date ELSE NULL END,
    CASE WHEN p_embarque->>'eta' IS NOT NULL THEN (p_embarque->>'eta')::date ELSE NULL END,
    COALESCE((p_embarque->>'tipo_cambio_usd')::numeric, 17.5),
    COALESCE((p_embarque->>'tipo_cambio_eur')::numeric, 19.0),
    COALESCE(p_embarque->>'tipo_carga', 'Carga General'),
    p_embarque->>'msds_archivo',
    COALESCE(p_embarque->>'operador', '')
  );

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
