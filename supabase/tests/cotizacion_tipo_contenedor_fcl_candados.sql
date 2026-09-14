-- Guard v13.823.396 · Q1/Q3: coherencia del tipo de contenedor en la conversión
-- cotización marítima FCL → embarque.
--
-- Vigila que `crear_embarque_borrador_core`:
--   * exija tipo de contenedor no vacío en marítimo FCL
--     (LC_COT_TIPO_CONTENEDOR_REQUERIDO); antes el hijo FCL nacía con '';
--   * falle cerrada si el tipo quedó desalineado de la tarifa todavía vinculada
--     (LC_COT_TIPO_CONTENEDOR_INCOMPATIBLE), normalizando el valor legado
--     (code/name de tipos_contenedor) o el UUID directo, y leyendo la tarifa
--     acotada a la organización de la cotización;
--   * conserve el orden: los candados de tipo corren después del candado de
--     número de contenedores y antes del INSERT del embarque.
--
-- Sólo lectura sobre pg_get_functiondef: no inserta datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_core text;
BEGIN
  v_core := pg_get_functiondef('public.crear_embarque_borrador_core(uuid)'::regprocedure);

  IF v_core !~ 'LC_COT_TIPO_CONTENEDOR_REQUERIDO' THEN
    RAISE EXCEPTION 'la conversión dejó de exigir el tipo de contenedor en marítimo FCL';
  END IF;
  IF v_core !~ 'LC_COT_TIPO_CONTENEDOR_INCOMPATIBLE' THEN
    RAISE EXCEPTION 'la conversión dejó de rechazar el tipo de contenedor incompatible con la tarifa vinculada';
  END IF;

  -- No se acepta ni se inventa cadena vacía como tipo de contenedor.
  IF v_core !~ 'NULLIF\(btrim\(COALESCE\(v_cot\.tipo_contenedor' THEN
    RAISE EXCEPTION 'el candado de tipo de contenedor dejó de rechazar la cadena vacía';
  END IF;

  -- La tarifa se lee SIEMPRE acotada a la organización de la cotización.
  IF v_core !~ 'tipo_contenedor_id INTO v_tarifa_tipo_cont' THEN
    RAISE EXCEPTION 'la comparación dejó de leer el tipo de contenedor de la tarifa vinculada';
  END IF;

  -- Normalización del valor legado contra el catálogo tipos_contenedor.
  IF v_core !~ 'public\.tipos_contenedor tc' THEN
    RAISE EXCEPTION 'la normalización del tipo legado contra tipos_contenedor desapareció';
  END IF;

  IF position('LC_COT_CONTENEDORES_REQUERIDOS' in v_core)
     > position('LC_COT_TIPO_CONTENEDOR_REQUERIDO' in v_core) THEN
    RAISE EXCEPTION 'el candado de tipo de contenedor se movió antes del candado de número de contenedores';
  END IF;
  IF position('LC_COT_TIPO_CONTENEDOR_INCOMPATIBLE' in v_core)
     > position('INSERT INTO public.embarques' in v_core) THEN
    RAISE EXCEPTION 'el candado de tipo incompatible quedó después de insertar el embarque';
  END IF;

  RAISE NOTICE 'OK cotizacion_tipo_contenedor_fcl_candados';
END $$;
