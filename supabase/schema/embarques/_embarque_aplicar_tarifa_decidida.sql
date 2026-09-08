-- Fuente canónica de public._embarque_aplicar_tarifa_decidida (R201-COT-01).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.
--
-- Aplica al COSTO del embarque los importes de la tarifa realmente decidida
-- (`refrescada` / `sustituida`). No toca `cotizacion_costos` (el histórico de la
-- cotización y el precio de venta aceptado quedan intactos) ni renglones ya
-- liquidados. Es idempotente por construcción: sólo se invoca desde
-- `crear_embarque_borrador_desde_cotizacion` cuando el embarque aún no tenía
-- decisión de tarifa registrada.

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
  v_costo        RECORD;
  v_fila         RECORD;
  v_unit         numeric;
  v_base         numeric;
  v_n            integer;
  v_cent         bigint;
  v_piso         bigint;
  v_resto        bigint;
  v_equivalentes integer;
  v_actualizados integer := 0;
BEGIN
  IF p_embarque_id IS NULL OR p_cotizacion_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_costo IN
    SELECT cc.id, cc.concepto, cc.moneda,
           COALESCE(NULLIF(cc.cantidad, 0), 1) AS cantidad,
           cc.costo_unitario, cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id,
           r.concepto AS recargo_concepto, r.lado AS recargo_lado
      FROM public.cotizacion_costos cc
      LEFT JOIN public.costeo_tarifa_recargos r ON r.id = cc.costeo_tarifa_recargo_id
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
       AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL)
  LOOP
    v_unit := NULL;

    IF v_costo.costeo_tarifa_recargo_id IS NOT NULL THEN
      -- Una sustitución sólo usa un recargo equivalente cuando concepto + lado
      -- identifican exactamente una fila. Si falta o es ambiguo, conserva el
      -- costo aceptado: nunca elige una coincidencia arbitraria con LIMIT 1.
      IF p_tarifa_id_aplicada IS NOT NULL AND v_costo.recargo_concepto IS NOT NULL THEN
        SELECT count(*), min(r.monto) INTO v_equivalentes, v_unit
          FROM public.costeo_tarifa_recargos r
         WHERE r.tarifa_id = p_tarifa_id_aplicada
            AND lower(btrim(r.concepto)) = lower(btrim(v_costo.recargo_concepto))
            AND r.lado = v_costo.recargo_lado
            AND r.moneda = v_costo.moneda;
        IF v_equivalentes <> 1 THEN v_unit := NULL; END IF;
      END IF;
      IF v_unit IS NULL THEN
        v_unit := v_costo.costo_unitario;
      END IF;
    ELSE
      SELECT t.flete_base INTO v_unit
        FROM public.costeo_tarifas t
       WHERE t.id = COALESCE(p_tarifa_id_aplicada, v_costo.costeo_tarifa_id);
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
