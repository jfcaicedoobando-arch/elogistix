-- Fuente canónica de public.sincronizar_contenedores_embarque.
-- C23/C24 (v13.823.380): validación de los IDs del payload antes de mutar y
-- candado contra el soft-delete de un contenedor con conceptos vivos.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.sincronizar_contenedores_embarque(p_embarque_id uuid, p_contenedores jsonb)
 RETURNS SETOF embarque_contenedores
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_input record;
  v_ids_conservados uuid[];
  v_orden integer := 0;
  v_ajenos integer;
  v_dups integer;
  v_bloqueados text;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.embarques
  WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado: %', p_embarque_id;
  END IF;

  PERFORM public._assert_writer(v_org_id);

  SELECT COALESCE(array_agg((elem->>'id')::uuid), ARRAY[]::uuid[]) INTO v_ids_conservados
  FROM jsonb_array_elements(p_contenedores) AS elem
  WHERE elem ? 'id' AND elem->>'id' IS NOT NULL AND elem->>'id' <> '';

  -- C23: un id repetido o que no sea hijo VIVO de este embarque hacía que el
  -- borrado lógico barriera todos los contenedores activos y el UPDATE
  -- posterior no afectara ninguna fila, sin error. Se valida ANTES de mutar.
  SELECT count(*) INTO v_dups
  FROM (SELECT t.id FROM unnest(v_ids_conservados) AS t(id) GROUP BY t.id HAVING count(*) > 1) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'LC_CONTENEDOR_ID_DUPLICADO: la lista de contenedores repite el mismo registro; revisa la captura'
      USING ERRCODE='P0001';
  END IF;

  SELECT count(*) INTO v_ajenos
  FROM unnest(v_ids_conservados) AS t(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.embarque_contenedores c
     WHERE c.id = t.id AND c.embarque_id = p_embarque_id AND c.deleted_at IS NULL
  );
  IF v_ajenos > 0 THEN
    RAISE EXCEPTION 'LC_CONTENEDOR_ID_INVALIDO: uno o más contenedores de la lista no pertenecen a este embarque o ya fueron eliminados; recarga el embarque e intenta de nuevo'
      USING ERRCODE='P0001';
  END IF;

  -- C24: quitar un contenedor con costos o ventas vivos dejaba conceptos
  -- apuntando a un contenedor eliminado. Se bloquea toda la operación
  -- (atómica) y se nombra el contenedor a resolver primero.
  SELECT string_agg(DISTINCT COALESCE(NULLIF(btrim(c.numero_contenedor), ''), 'sin número'), ', ')
    INTO v_bloqueados
  FROM public.embarque_contenedores c
  WHERE c.embarque_id = p_embarque_id
    AND c.deleted_at IS NULL
    AND NOT (c.id = ANY(v_ids_conservados))
    AND (
      EXISTS (SELECT 1 FROM public.conceptos_costo cc
               WHERE cc.contenedor_id = c.id AND cc.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.conceptos_venta cv
                  WHERE cv.contenedor_id = c.id AND cv.deleted_at IS NULL)
    );
  IF v_bloqueados IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CONTENEDOR_CON_CONCEPTOS: el contenedor % tiene costos o ventas activos; reasigna o elimina esos conceptos antes de quitarlo', v_bloqueados
      USING ERRCODE='P0001';
  END IF;

  UPDATE public.embarque_contenedores
  SET deleted_at = now()
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND NOT (id = ANY(v_ids_conservados));

  FOR v_input IN
    SELECT
      (elem->>'id') AS id_str,
      (elem->>'numero_contenedor') AS numero_contenedor,
      (elem->>'tipo_contenedor') AS tipo_contenedor,
      NULLIF(elem->>'bl_house', '') AS bl_house,
      NULLIF(elem->>'peso_kg', '')::numeric AS peso_kg,
      NULLIF(elem->>'volumen_m3', '')::numeric AS volumen_m3,
      NULLIF(elem->>'piezas', '')::integer AS piezas,
      COALESCE(NULLIF(elem->>'orden', '')::integer, 0) AS orden,
      ord.rn AS pos
    FROM jsonb_array_elements(p_contenedores) WITH ORDINALITY AS ord(elem, rn)
    ORDER BY ord.rn
  LOOP
    v_orden := COALESCE(NULLIF(v_input.orden, 0), v_input.pos::integer);

    IF v_input.id_str IS NOT NULL AND v_input.id_str <> '' THEN
      UPDATE public.embarque_contenedores
      SET numero_contenedor = v_input.numero_contenedor,
          tipo_contenedor = v_input.tipo_contenedor,
          bl_house = v_input.bl_house,
          peso_kg = v_input.peso_kg,
          volumen_m3 = v_input.volumen_m3,
          piezas = v_input.piezas,
          orden = v_orden
      WHERE id = v_input.id_str::uuid
        AND embarque_id = p_embarque_id;
    ELSE
      INSERT INTO public.embarque_contenedores (
        embarque_id, numero_contenedor, tipo_contenedor, bl_house,
        peso_kg, volumen_m3, piezas, orden
      ) VALUES (
        p_embarque_id, v_input.numero_contenedor, v_input.tipo_contenedor, v_input.bl_house,
        v_input.peso_kg, v_input.volumen_m3, v_input.piezas, v_orden
      );
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT *
  FROM public.embarque_contenedores
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
  ORDER BY orden ASC, created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.sincronizar_contenedores_embarque(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_contenedores_embarque(uuid, jsonb) TO authenticated, service_role;
