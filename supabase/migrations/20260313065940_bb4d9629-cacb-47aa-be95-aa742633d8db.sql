
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
  embarque_data jsonb;
BEGIN
  -- Inject the id into the embarque payload
  embarque_data := p_embarque || jsonb_build_object('id', nuevo_id);

  -- 1. Insertar embarque
  INSERT INTO embarques
  SELECT * FROM jsonb_populate_record(null::embarques, embarque_data);

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
