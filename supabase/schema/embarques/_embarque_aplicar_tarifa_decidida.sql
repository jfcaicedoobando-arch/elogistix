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
  v_por_fila     numeric;
  v_resto        numeric;
  v_actualizados integer := 0;
BEGIN
  IF p_embarque_id IS NULL OR p_cotizacion_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_costo IN
    SELECT cc.concepto, cc.moneda,
           COALESCE(NULLIF(cc.cantidad, 0), 1) AS cantidad,
           cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id
      FROM public.cotizacion_costos cc
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
       AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL)
  LOOP
    v_unit := NULL;

    IF v_costo.costeo_tarifa_recargo_id IS NOT NULL THEN
      -- Tarifa sustituida: el recargo equivalente se busca por concepto en la
      -- tarifa elegida; si no existe, se conserva el importe cotizado.
      IF p_tarifa_id_aplicada IS NOT NULL THEN
        SELECT r.monto INTO v_unit
          FROM public.costeo_tarifa_recargos r
         WHERE r.tarifa_id = p_tarifa_id_aplicada
           AND lower(btrim(r.concepto)) = lower(btrim(v_costo.concepto))
         LIMIT 1;
      END IF;
      IF v_unit IS NULL THEN
        SELECT r.monto INTO v_unit
          FROM public.costeo_tarifa_recargos r
         WHERE r.id = v_costo.costeo_tarifa_recargo_id;
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
       AND lower(btrim(c.concepto)) = lower(btrim(v_costo.concepto))
       AND c.moneda::text = v_costo.moneda;

    CONTINUE WHEN COALESCE(v_n, 0) = 0;

    -- Reparto en centavos: el residuo se carga al primer renglón para que la
    -- suma de los contenedores sea exactamente el total de la tarifa.
    v_por_fila := FLOOR(v_base / v_n * 100) / 100;
    v_resto := ROUND(v_base - (v_por_fila * v_n), 2);

    FOR v_fila IN
      SELECT c.id, row_number() OVER (ORDER BY c.contenedor_id NULLS FIRST, c.created_at, c.id) AS rn
        FROM public.conceptos_costo c
       WHERE c.embarque_id = p_embarque_id
         AND c.deleted_at IS NULL
         AND c.estado_liquidacion = 'Pendiente'::estado_liquidacion
         AND c.origen IN ('cotizacion','costeo_tarifa')
         AND lower(btrim(c.concepto)) = lower(btrim(v_costo.concepto))
         AND c.moneda::text = v_costo.moneda
    LOOP
      UPDATE public.conceptos_costo
         SET monto = v_por_fila + CASE WHEN v_fila.rn = 1 THEN v_resto ELSE 0 END,
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

REVOKE ALL ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) FROM authenticated;
GRANT ALL ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) TO service_role;
