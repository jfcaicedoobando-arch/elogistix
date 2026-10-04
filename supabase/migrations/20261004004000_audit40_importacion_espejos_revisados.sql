-- Fuente canónica de public.absorber_espejos_importacion(uuid, jsonb).
-- Auditoría40: ID y huella fijan el espejo revisado; firma/ACL conservadas.
-- JSON sin revisión mantiene legacy. Validar TODO el lote antes de escribir.
CREATE OR REPLACE FUNCTION public.absorber_espejos_importacion(
  p_cuenta_bancaria_id uuid,
  p_filas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_fila jsonb;
  v_plan jsonb;
  v_planes jsonb := '[]'::jsonb;
  v_huella jsonb;
  v_mov public.bbva_movimientos;
  v_cand uuid;
  v_esperado uuid;
  v_usados uuid[] := ARRAY[]::uuid[];
  v_hashes text[] := ARRAY[]::text[];
  v_hash text;
  v_cuantos int;
  v_total int;
  v_con_revision int;
  v_revisado boolean;
  v_actualizados int;
  v_absorbidos int := 0;
BEGIN
  SELECT organization_id INTO v_org
    FROM public.cuentas_bancarias
   WHERE id = p_cuenta_bancaria_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CUENTA_NO_ENCONTRADA: la cuenta bancaria no existe o está dada de baja'
      USING ERRCODE = '22023';
  END IF;
  PERFORM public._assert_writer(v_org);
  IF p_filas IS NOT NULL AND jsonb_typeof(p_filas) <> 'array' THEN
    RAISE EXCEPTION 'LC_IMPORTACION_REVISION_INVALIDA: las filas deben ser un arreglo'
      USING ERRCODE = '22023';
  END IF;
  SELECT count(*), count(*) FILTER (WHERE value ? 'espejo_revisado_id')
    INTO v_total, v_con_revision
    FROM jsonb_array_elements(COALESCE(p_filas, '[]'::jsonb));
  IF v_con_revision <> 0 AND v_con_revision <> v_total THEN
    RAISE EXCEPTION 'LC_IMPORTACION_REVISION_INVALIDA: todas las filas deben pertenecer a la misma revisión'
      USING ERRCODE = '22023';
  END IF;
  v_revisado := v_con_revision > 0;

  -- Serializar importaciones de esta cuenta. El lock también bloquea nuevas
  -- referencias FK a la cuenta durante la validación y absorción.
  PERFORM 1 FROM public.cuentas_bancarias
   WHERE id = p_cuenta_bancaria_id AND organization_id = v_org AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_IMPORTACION_REVISION_CAMBIO: la cuenta cambió; vuelve a revisar el archivo'
      USING ERRCODE = '23514';
  END IF;
  -- Estabilizar ediciones/restauraciones existentes; ningún lock global ni
  -- escritura en otras cuentas. Orden estable para importaciones concurrentes.
  PERFORM m.id FROM public.bbva_movimientos m
   WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
   ORDER BY m.id FOR UPDATE;

  FOR v_fila IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_filas, '[]'::jsonb))
      WITH ORDINALITY AS filas(value, orden) ORDER BY orden
  LOOP
    v_hash := v_fila->>'hash_dedupe';
    IF jsonb_typeof(v_fila) <> 'object' OR NULLIF(v_hash, '') IS NULL
       OR v_fila->>'fecha' IS NULL THEN
      RAISE EXCEPTION 'LC_IMPORTACION_REVISION_INVALIDA: una fila no contiene fecha o huella bancaria válida'
        USING ERRCODE = '22023';
    END IF;
    -- Reintentos y filas idénticas no consumen otro espejo.
    CONTINUE WHEN v_hash = ANY(v_hashes);
    v_hashes := array_append(v_hashes, v_hash);
    PERFORM 1 FROM public.bbva_movimientos
     WHERE cuenta_bancaria_id = p_cuenta_bancaria_id
       AND hash_dedupe = v_hash AND deleted_at IS NULL;
    CONTINUE WHEN FOUND;

    -- Sólo COBROS de cliente; nunca pagos, anticipos o devoluciones.
    -- Cada espejo se consume una vez, en el orden revisado del archivo.
    SELECT count(*), (array_agg(m.id ORDER BY m.id))[1] INTO v_cuantos, v_cand
      FROM public.bbva_movimientos m
     WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
       AND m.organization_id = v_org AND m.deleted_at IS NULL
       AND m.hash_dedupe LIKE 'cobro-%' AND m.pago_factura_id IS NOT NULL
       AND NOT (m.id = ANY(v_usados))
       AND round(m.cargo, 2) = round(COALESCE((v_fila->>'cargo')::numeric, 0), 2)
       AND round(m.abono, 2) = round(COALESCE((v_fila->>'abono')::numeric, 0), 2)
       AND abs(m.fecha - (v_fila->>'fecha')::date) <= 3;
    IF v_revisado THEN
      IF jsonb_typeof(v_fila->'espejo_revisado_id') NOT IN ('null', 'string') THEN
        RAISE EXCEPTION 'LC_IMPORTACION_REVISION_INVALIDA: el identificador revisado no es válido'
          USING ERRCODE = '22023';
      END IF;
      v_esperado := (v_fila->>'espejo_revisado_id')::uuid;
      IF v_esperado IS NULL THEN
        IF v_cuantos = 1 THEN
          RAISE EXCEPTION 'LC_IMPORTACION_REVISION_CAMBIO: apareció una coincidencia no revisada; vuelve a revisar el archivo'
            USING ERRCODE = '23514';
        END IF;
        CONTINUE;
      END IF;
      IF v_cuantos <> 1 OR v_cand IS DISTINCT FROM v_esperado THEN
        RAISE EXCEPTION 'LC_IMPORTACION_REVISION_CAMBIO: la coincidencia revisada cambió o es ambigua; vuelve a revisar el archivo'
          USING ERRCODE = '23514';
      END IF;
      v_huella := v_fila->'espejo_revisado_huella';
      IF v_huella IS NULL OR jsonb_typeof(v_huella) <> 'object'
         OR NOT (v_huella ?& ARRAY['cuenta_bancaria_id','hash_dedupe','pago_factura_id','fecha','cargo','abono']) THEN
        RAISE EXCEPTION 'LC_IMPORTACION_REVISION_INVALIDA: falta la huella del espejo revisado'
          USING ERRCODE = '22023';
      END IF;
      SELECT * INTO v_mov FROM public.bbva_movimientos WHERE id = v_cand;
      IF v_mov.cuenta_bancaria_id IS DISTINCT FROM (v_huella->>'cuenta_bancaria_id')::uuid
         OR v_mov.hash_dedupe IS DISTINCT FROM v_huella->>'hash_dedupe'
         OR v_mov.pago_factura_id IS DISTINCT FROM (v_huella->>'pago_factura_id')::uuid
         OR v_mov.fecha IS DISTINCT FROM (v_huella->>'fecha')::date
         OR v_mov.cargo IS DISTINCT FROM (v_huella->>'cargo')::numeric
         OR v_mov.abono IS DISTINCT FROM (v_huella->>'abono')::numeric THEN
        RAISE EXCEPTION 'LC_IMPORTACION_REVISION_CAMBIO: el espejo ya no coincide con los datos revisados; vuelve a revisar el archivo'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      CONTINUE WHEN v_cuantos <> 1;
    END IF;
    v_usados := array_append(v_usados, v_cand);
    v_planes := v_planes || jsonb_build_array(jsonb_build_object('id', v_cand, 'fila', v_fila));
  END LOOP;

  -- TODAS las precondiciones están comprobadas. Aplicar sólo IDs planificados
  -- sin buscar un candidato alternativo ni modificar el vínculo con el pago.
  FOR v_plan IN
    SELECT value FROM jsonb_array_elements(v_planes)
      WITH ORDINALITY AS planes(value, orden) ORDER BY orden
  LOOP
    v_fila := v_plan->'fila';
    v_cand := (v_plan->>'id')::uuid;
    UPDATE public.bbva_movimientos
       SET hash_dedupe = v_fila->>'hash_dedupe',
           fecha = (v_fila->>'fecha')::date,
           concepto = COALESCE(NULLIF(v_fila->>'concepto', ''), concepto),
           referencia = COALESCE(NULLIF(v_fila->>'referencia', ''), referencia),
           saldo = COALESCE((v_fila->>'saldo')::numeric, saldo)
     WHERE id = v_cand AND organization_id = v_org
       AND cuenta_bancaria_id = p_cuenta_bancaria_id AND deleted_at IS NULL
       AND hash_dedupe LIKE 'cobro-%' AND pago_factura_id IS NOT NULL;
    GET DIAGNOSTICS v_actualizados = ROW_COUNT;
    IF v_actualizados <> 1 THEN
      RAISE EXCEPTION 'LC_IMPORTACION_REVISION_CAMBIO: no se pudo conservar el espejo revisado; vuelve a revisar el archivo'
        USING ERRCODE = '23514';
    END IF;
    v_absorbidos := v_absorbidos + 1;
    PERFORM public.registrar_bitacora(
      'tesoreria', 'absorber_espejo_cobro_importacion', v_cand,
      COALESCE(v_fila->>'concepto', ''),
      jsonb_build_object('hash_dedupe', v_fila->>'hash_dedupe',
                         'cuenta_bancaria_id', p_cuenta_bancaria_id),
      v_org, auth.uid()
    );
  END LOOP;
  RETURN jsonb_build_object('absorbidos', v_absorbidos);
END;
$$;

REVOKE ALL ON FUNCTION public.absorber_espejos_importacion(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.absorber_espejos_importacion(uuid, jsonb) TO authenticated, service_role;
