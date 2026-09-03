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

  -- v13.823.64: en Aéreo/Terrestre el peso, volumen y piezas se capturan
  -- directamente en el embarque; los "contenedores" hijos son un artefacto de
  -- la conversión desde cotización (siempre vacíos). Recalcular desde ellos
  -- ponía los totales en cero y borraba lo que el usuario acababa de capturar.
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