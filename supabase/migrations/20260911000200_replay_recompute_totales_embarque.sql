-- Replay-mirror (R4BD-01): la migración vigente de mayor timestamp
-- (20260905000100_ola7_v15_m1_m8_m10_n1.sql) redefinía
-- `_recompute_totales_embarque` SIN el guard de v13.823.64 (Aéreo/Terrestre
-- capturan totales en el embarque y no se recalculan desde los contenedores
-- hijos, que llegan vacíos desde la cotización y los ponían en cero).
-- Forward-only: se re-emite el cuerpo canónico del espejo con timestamp
-- posterior. No toca datos de negocio.
CREATE OR REPLACE FUNCTION public._recompute_totales_embarque(p_embarque_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_peso numeric;
  v_total_vol numeric;
  v_total_piezas integer;
  v_primer record;
  v_modo text;
BEGIN
  IF p_embarque_id IS NULL THEN RETURN; END IF;

  SELECT modo::text INTO v_modo FROM public.embarques WHERE id = p_embarque_id;
  IF v_modo IN ('Aéreo', 'Terrestre') THEN RETURN; END IF;

  SELECT COALESCE(SUM(peso_kg), 0), COALESCE(SUM(volumen_m3), 0), COALESCE(SUM(piezas), 0)
    INTO v_total_peso, v_total_vol, v_total_piezas
  FROM public.embarque_contenedores
  WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  SELECT numero_contenedor, tipo_contenedor INTO v_primer
  FROM public.embarque_contenedores
  WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  ORDER BY orden ASC, created_at ASC
  LIMIT 1;

  UPDATE public.embarques
     SET contenedor = COALESCE(v_primer.numero_contenedor, ''),
         tipo_contenedor = COALESCE(v_primer.tipo_contenedor, ''),
         peso_kg = v_total_peso,
         volumen_m3 = v_total_vol,
         piezas = v_total_piezas
   WHERE id = p_embarque_id;
END;
$function$;
