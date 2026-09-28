-- AUD-260927-R2 / F03: editar una tarifa no debe recrear los recargos ya
-- cotizados. El borrado anterior ponía a NULL la FK de cotizacion_costos y
-- hacía que la revalidación comparase BAF contra el flete base.
CREATE OR REPLACE FUNCTION public.actualizar_tarifa_con_recargos_rpc(
  p_id uuid, p_tarifa jsonb, p_recargos jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_es_agente_dueno boolean := false;
  v_recargo jsonb;
  v_id uuid;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_concepto text;
  v_lado text;
  v_monto numeric;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.costeo_tarifas WHERE id = p_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_TARIFA_NO_ENCONTRADA';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.costeo_tarifas t
    WHERE t.id = p_id
      AND public.has_role(auth.uid(), 'agente_carga'::app_role)
      AND t.agente_id = public.current_agente_id()
      AND t.organization_id = public.current_agente_org()
      AND t.estado_aprobacion = ANY (ARRAY['borrador'::text, 'rechazada'::text])
  ) INTO v_es_agente_dueno;

  IF auth.uid() IS NOT NULL
     AND NOT public.is_org_member(v_org)
     AND NOT v_es_agente_dueno THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  IF v_es_agente_dueno AND NOT public.is_org_member(v_org) THEN
    p_tarifa := jsonb_set(
      COALESCE(p_tarifa, '{}'::jsonb),
      '{agente_id}',
      to_jsonb(public.current_agente_id()::text)
    );
  END IF;

  UPDATE public.costeo_tarifas SET
    agente_id = CASE WHEN p_tarifa ? 'agente_id'
      THEN NULLIF(p_tarifa->>'agente_id', '')::uuid ELSE agente_id END,
    naviera_id = CASE WHEN p_tarifa ? 'naviera_id'
      THEN NULLIF(p_tarifa->>'naviera_id', '')::uuid ELSE naviera_id END,
    ruta_id = CASE WHEN p_tarifa ? 'ruta_id'
      THEN NULLIF(p_tarifa->>'ruta_id', '')::uuid ELSE ruta_id END,
    tipo_contenedor_id = CASE WHEN p_tarifa ? 'tipo_contenedor_id'
      THEN NULLIF(p_tarifa->>'tipo_contenedor_id', '')::uuid ELSE tipo_contenedor_id END,
    flete_base = CASE WHEN p_tarifa ? 'flete_base'
      THEN NULLIF(p_tarifa->>'flete_base', '')::numeric ELSE flete_base END,
    dias_libres_demoras = CASE WHEN p_tarifa ? 'dias_libres_demoras'
      THEN NULLIF(p_tarifa->>'dias_libres_demoras', '')::integer ELSE dias_libres_demoras END,
    vigente_desde = COALESCE(NULLIF(p_tarifa->>'vigente_desde', '')::date, vigente_desde),
    vigente_hasta = COALESCE(NULLIF(p_tarifa->>'vigente_hasta', '')::date, vigente_hasta),
    transit_time_dias = CASE WHEN p_tarifa ? 'transit_time_dias'
      THEN NULLIF(p_tarifa->>'transit_time_dias', '')::integer ELSE transit_time_dias END,
    notas = CASE WHEN p_tarifa ? 'notas'
      THEN NULLIF(p_tarifa->>'notas', '') ELSE notas END,
    moneda = 'USD',
    updated_at = now()
  WHERE id = p_id;

  FOR v_recargo IN SELECT value FROM jsonb_array_elements(COALESCE(p_recargos, '[]'::jsonb))
  LOOP
    v_concepto := btrim(COALESCE(v_recargo->>'concepto', ''));
    v_monto := COALESCE(NULLIF(v_recargo->>'monto', '')::numeric, 0);
    IF v_concepto = '' OR v_monto <= 0 THEN CONTINUE; END IF;
    v_lado := COALESCE(NULLIF(v_recargo->>'lado', ''), 'origen');
    v_id := NULLIF(v_recargo->>'id', '')::uuid;

    -- Compatibilidad con clientes anteriores que todavía no envían id:
    -- reutilizar sólo una fila idéntica, sin adivinar ante duplicados.
    IF v_id IS NULL THEN
      SELECT r.id INTO v_id
      FROM public.costeo_tarifa_recargos r
      WHERE r.tarifa_id = p_id AND r.organization_id = v_org
        AND r.concepto = v_concepto AND r.lado = v_lado AND r.monto = v_monto
        AND NOT (r.id = ANY(v_ids))
      ORDER BY r.created_at, r.id
      LIMIT 1;
    END IF;

    IF v_id IS NOT NULL THEN
      IF v_id = ANY(v_ids) THEN RAISE EXCEPTION 'LC_RECARGO_DUPLICADO'; END IF;
      UPDATE public.costeo_tarifa_recargos SET
        concepto = v_concepto,
        lado = v_lado,
        monto = v_monto,
        moneda = 'USD',
        incluido_en_total = COALESCE((v_recargo->>'incluido_en_total')::boolean, true)
      WHERE id = v_id AND tarifa_id = p_id AND organization_id = v_org;
      IF NOT FOUND THEN RAISE EXCEPTION 'LC_RECARGO_AJENO_O_INEXISTENTE'; END IF;
    ELSE
      INSERT INTO public.costeo_tarifa_recargos (
        tarifa_id, organization_id, concepto, lado, monto, moneda, incluido_en_total
      ) VALUES (
        p_id, v_org, v_concepto, v_lado, v_monto, 'USD',
        COALESCE((v_recargo->>'incluido_en_total')::boolean, true)
      ) RETURNING id INTO v_id;
    END IF;
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  -- Una tarifa ya cotizada no puede perder silenciosamente el recargo fuente.
  -- Crear una versión nueva es más seguro que romper la trazabilidad.
  IF EXISTS (
    SELECT 1 FROM public.costeo_tarifa_recargos r
    JOIN public.cotizacion_costos cc ON cc.costeo_tarifa_recargo_id = r.id
      AND cc.organization_id = v_org AND cc.deleted_at IS NULL
    WHERE r.tarifa_id = p_id AND r.organization_id = v_org
      AND NOT (r.id = ANY(v_ids))
  ) THEN
    RAISE EXCEPTION 'LC_RECARGO_COTIZADO_NO_ELIMINABLE';
  END IF;

  DELETE FROM public.costeo_tarifa_recargos
  WHERE tarifa_id = p_id AND organization_id = v_org
    AND NOT (id = ANY(v_ids));
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) TO authenticated, service_role;

-- Reparación conservadora de enlaces históricos: sólo costo auto-generado,
-- concepto/lado/importe exactos y un único recargo candidato del mismo tenant.
-- Si hay ambigüedad, se deja el registro intacto para revisión manual.
WITH candidatos AS (
  SELECT cc.id AS costo_id, (array_agg(r.id ORDER BY r.id::text))[1] AS recargo_id
  FROM public.cotizacion_costos cc
  JOIN public.costeo_tarifa_recargos r
    ON r.tarifa_id = cc.costeo_tarifa_id
   AND r.organization_id = cc.organization_id
   AND cc.concepto = r.concepto || ' (' || r.lado || ')'
   AND cc.costo_unitario = r.monto
  WHERE cc.costeo_tarifa_recargo_id IS NULL
    AND cc.costeo_tarifa_id IS NOT NULL
    AND cc.deleted_at IS NULL
    AND cc.notas = 'Auto-cargado desde tarifa marítima'
  GROUP BY cc.id
  HAVING count(*) = 1
)
UPDATE public.cotizacion_costos cc
SET costeo_tarifa_recargo_id = c.recargo_id
FROM candidatos c
WHERE cc.id = c.costo_id;
