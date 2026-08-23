-- Espejo canónico de public._reprocesar_comisiones_org
-- Fuente vigente (mayor timestamp): 20260823222114_ab51c680-5dd5-4f46-bf8e-f9a372a39e71.sql
-- Vigilado por `bun run audit:replay-mirror` y `audit:schema-functions`.

CREATE OR REPLACE FUNCTION public._reprocesar_comisiones_org(p_org uuid)
 RETURNS TABLE(procesadas integer, resueltas integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_procesadas integer := 0;
  v_resueltas integer := 0;
  v_comision numeric;
  v_estado text;
BEGIN
  IF p_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_INEXISTENTE: organización requerida'
      USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT id, pago_factura_id
      FROM public.comisiones_recalculo_pendiente
     WHERE organization_id = p_org AND resuelto_at IS NULL
       -- FIX B-4: el ajuste de una NC sobre comisión ya Liquidada NO se
       -- auto-resuelve; requiere descuento manual y debe permanecer visible.
       AND COALESCE(etapa, '') <> 'ajuste_nc_liquidada'
     ORDER BY created_at
  LOOP
    v_procesadas := v_procesadas + 1;
    BEGIN
      PERFORM public.calcular_comision_pago(v_row.pago_factura_id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.comisiones_recalculo_pendiente
         SET intentos = intentos + 1,
             sqlstate_code = SQLSTATE,
             sqlerrm_text = SQLERRM,
             updated_at = now()
       WHERE id = v_row.id;
      CONTINUE;
    END;

    -- Sólo se cierra el pendiente si el recálculo dejó una comisión sana.
    -- Una comisión ya 'Liquidada' se respeta tal cual (guarda del canon).
    SELECT comision_mxn, estado INTO v_comision, v_estado
      FROM public.comisiones_devengadas
     WHERE pago_factura_id = v_row.pago_factura_id;

    IF v_estado = 'Liquidada' OR COALESCE(v_comision, 0) <> 0 THEN
      UPDATE public.comisiones_recalculo_pendiente
         SET resuelto_at = now(),
             resultado_recalculo = 'Comisión recalculada: ' || COALESCE(v_comision, 0)::text,
             updated_at = now()
       WHERE id = v_row.id;
      v_resueltas := v_resueltas + 1;
    ELSE
      UPDATE public.comisiones_recalculo_pendiente
         SET intentos = intentos + 1,
             sqlerrm_text = 'Recálculo sigue dando 0 (faltan datos del embarque)',
             updated_at = now()
       WHERE id = v_row.id;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_procesadas, v_resueltas;
END;
$function$;
