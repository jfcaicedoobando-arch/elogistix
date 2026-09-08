-- Fuente canónica de public._embarque_aplicar_tarifa_decidida (R201-COT-01).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.
--
-- Aplica al COSTO del embarque los importes de la tarifa realmente decidida
-- (`refrescada` / `sustituida`). No toca `cotizacion_costos` (el histórico de la
-- cotización y el precio de venta aceptado quedan intactos) ni renglones ya
-- liquidados. Es idempotente por construcción: sólo se invoca desde
-- `crear_embarque_borrador_desde_cotizacion` cuando el embarque aún no tenía
-- decisión de tarifa registrada.
--
-- R201-COT-01 (remate): prohibido el fallback silencioso.
--   · Refrescar la MISMA tarifa resuelve cada recargo por su identidad exacta
--     (`cotizacion_costos.costeo_tarifa_recargo_id`), nunca por texto: nombres
--     repetidos ya no se confunden entre sí.
--   · Sustituir por OTRA tarifa exige equivalencia segura (concepto + lado +
--     moneda con exactamente una fila) y coherencia de proveedor/moneda. Si no
--     la hay, la operación se RECHAZA con mensaje claro en lugar de etiquetar
--     "Sustituida" conservando el cargo viejo.

CREATE OR REPLACE FUNCTION public._embarque_aplicar_tarifa_decidida(
  p_embarque_id uuid,
  p_cotizacion_id uuid,
  p_tarifa_id_aplicada uuid
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_costo          RECORD;
  v_fila           RECORD;
  v_unit           numeric;
  v_base           numeric;
  v_n              integer;
  v_cent           bigint;
  v_piso           bigint;
  v_resto          bigint;
  v_equivalentes   integer;
  v_moneda_match   text;
  v_tarifa_origen  uuid;
  v_es_sustitucion boolean;
  v_ag_origen      uuid;
  v_ag_nueva       uuid;
  v_mon_origen     text;
  v_mon_nueva      text;
  v_actualizados   integer := 0;
BEGIN
  IF p_embarque_id IS NULL OR p_cotizacion_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT c.tarifa_id INTO v_tarifa_origen
    FROM public.cotizaciones c
   WHERE c.id = p_cotizacion_id;

  v_es_sustitucion := p_tarifa_id_aplicada IS NOT NULL
                  AND p_tarifa_id_aplicada IS DISTINCT FROM v_tarifa_origen;

  -- Coherencia global de la sustituta: mezclar precios de una tarifa con el
  -- proveedor/moneda sembrados de otra produciría un costo inauditable.
  IF v_es_sustitucion THEN
    SELECT t.agente_id, t.moneda INTO v_ag_nueva, v_mon_nueva
      FROM public.costeo_tarifas t WHERE t.id = p_tarifa_id_aplicada;
    SELECT t.agente_id, t.moneda INTO v_ag_origen, v_mon_origen
      FROM public.costeo_tarifas t WHERE t.id = v_tarifa_origen;

    IF v_ag_nueva IS NULL THEN
      RAISE EXCEPTION 'La tarifa sustituta no existe o no tiene agente asignado. Revisa y selecciona otra tarifa.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_tarifa_origen IS NOT NULL AND v_ag_nueva IS DISTINCT FROM v_ag_origen THEN
      RAISE EXCEPTION 'La tarifa sustituta pertenece a otro proveedor/agente: no se puede aplicar sin recotizar. Revisa y selecciona una tarifa del mismo proveedor.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_tarifa_origen IS NOT NULL AND upper(btrim(COALESCE(v_mon_nueva, ''))) IS DISTINCT FROM upper(btrim(COALESCE(v_mon_origen, ''))) THEN
      RAISE EXCEPTION 'La tarifa sustituta está en otra moneda (% vs %): no se puede aplicar sin recotizar. Revisa y selecciona una tarifa en la misma moneda.',
        v_mon_nueva, v_mon_origen USING ERRCODE = 'P0001';
    END IF;
  END IF;

  FOR v_costo IN
    SELECT cc.id, cc.concepto, cc.moneda,
           COALESCE(NULLIF(cc.cantidad, 0), 1) AS cantidad,
           cc.costo_unitario, cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id,
           r.concepto AS recargo_concepto, r.lado AS recargo_lado,
           r.monto AS recargo_monto_vigente, r.moneda AS recargo_moneda_vigente,
           r.id AS recargo_vigente_id
      FROM public.cotizacion_costos cc
      LEFT JOIN public.costeo_tarifa_recargos r ON r.id = cc.costeo_tarifa_recargo_id
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
       AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL)
  LOOP
    v_unit := NULL;

    IF v_costo.costeo_tarifa_recargo_id IS NOT NULL THEN
      IF v_es_sustitucion THEN
        -- Sustitución: sólo una equivalencia inequívoca es aceptable.
        SELECT count(*), min(r.monto), min(r.moneda)
          INTO v_equivalentes, v_unit, v_moneda_match
          FROM public.costeo_tarifa_recargos r
         WHERE r.tarifa_id = p_tarifa_id_aplicada
           AND lower(btrim(r.concepto)) = lower(btrim(COALESCE(v_costo.recargo_concepto, v_costo.concepto)))
           AND r.lado IS NOT DISTINCT FROM v_costo.recargo_lado
           AND upper(btrim(r.moneda)) = upper(btrim(v_costo.moneda));

        IF COALESCE(v_equivalentes, 0) = 0 THEN
          RAISE EXCEPTION 'La tarifa sustituta no tiene un cargo equivalente a "%" (%). Revisa y selecciona otra tarifa: no se aplicará conservando el cargo anterior.',
            COALESCE(v_costo.recargo_concepto, v_costo.concepto), v_costo.moneda
            USING ERRCODE = 'P0001';
        END IF;
        IF v_equivalentes > 1 THEN
          RAISE EXCEPTION 'La tarifa sustituta tiene % cargos llamados "%" (%): la equivalencia es ambigua. Revisa y selecciona otra tarifa.',
            v_equivalentes, COALESCE(v_costo.recargo_concepto, v_costo.concepto), v_costo.moneda
            USING ERRCODE = 'P0001';
        END IF;
        IF upper(btrim(COALESCE(v_moneda_match, ''))) IS DISTINCT FROM upper(btrim(v_costo.moneda)) THEN
          RAISE EXCEPTION 'El cargo equivalente a "%" está en otra moneda. Revisa y selecciona otra tarifa.',
            COALESCE(v_costo.recargo_concepto, v_costo.concepto) USING ERRCODE = 'P0001';
        END IF;
      ELSE
        -- Refrescar la misma tarifa: identidad exacta del recargo fuente.
        IF v_costo.recargo_vigente_id IS NULL THEN
          RAISE EXCEPTION 'El cargo "%" de la tarifa ya no existe: no se puede refrescar. Revisa y selecciona una tarifa vigente.',
            v_costo.concepto USING ERRCODE = 'P0001';
        END IF;
        IF upper(btrim(COALESCE(v_costo.recargo_moneda_vigente, ''))) IS DISTINCT FROM upper(btrim(v_costo.moneda)) THEN
          RAISE EXCEPTION 'El cargo "%" cambió de moneda en la tarifa: no se puede refrescar sin recotizar.',
            COALESCE(v_costo.recargo_concepto, v_costo.concepto) USING ERRCODE = 'P0001';
        END IF;
        v_unit := v_costo.recargo_monto_vigente;
      END IF;
    ELSE
      SELECT t.flete_base, t.moneda INTO v_unit, v_moneda_match
        FROM public.costeo_tarifas t
       WHERE t.id = COALESCE(p_tarifa_id_aplicada, v_costo.costeo_tarifa_id);

      IF v_unit IS NOT NULL
         AND upper(btrim(COALESCE(v_moneda_match, ''))) IS DISTINCT FROM upper(btrim(v_costo.moneda)) THEN
        RAISE EXCEPTION 'El flete de la tarifa aplicada está en % y el costo aceptado en %: no se puede aplicar sin recotizar.',
          v_moneda_match, v_costo.moneda USING ERRCODE = 'P0001';
      END IF;
    END IF;

    CONTINUE WHEN v_unit IS NULL;

    v_base := ROUND(v_unit * v_costo.cantidad, 2);

    SELECT count(*) INTO v_n
      FROM public.conceptos_costo c
     WHERE c.embarque_id = p_embarque_id
       AND c.deleted_at IS NULL
       AND c.estado_liquidacion = 'Pendiente'::estado_liquidacion
       AND c.origen IN ('cotizacion','costeo_tarifa')
       AND c.cotizacion_costo_origen_id = v_costo.id;

    CONTINUE WHEN COALESCE(v_n, 0) = 0;

    -- Reparto de centavos por resto mayor, sin crear montos negativos.
    v_cent := ROUND(GREATEST(v_base, 0) * 100)::bigint;
    v_piso := v_cent / v_n::bigint;
    v_resto := v_cent - (v_piso * v_n::bigint);

    FOR v_fila IN
      SELECT c.id, row_number() OVER (ORDER BY c.contenedor_id NULLS FIRST, c.created_at, c.id) AS rn
        FROM public.conceptos_costo c
       WHERE c.embarque_id = p_embarque_id
         AND c.deleted_at IS NULL
         AND c.estado_liquidacion = 'Pendiente'::estado_liquidacion
         AND c.origen IN ('cotizacion','costeo_tarifa')
         AND c.cotizacion_costo_origen_id = v_costo.id
    LOOP
      UPDATE public.conceptos_costo
         SET monto = (v_piso + CASE WHEN v_fila.rn <= v_resto THEN 1 ELSE 0 END)::numeric / 100,
             origen = 'costeo_tarifa',
             updated_at = now()
       WHERE id = v_fila.id;
      v_actualizados := v_actualizados + 1;
    END LOOP;
  END LOOP;

  IF v_actualizados > 0 THEN
    PERFORM public._recompute_totales_embarque(p_embarque_id);
  END IF;

  RETURN v_actualizados;
END;
$function$;

REVOKE ALL ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) TO service_role;
