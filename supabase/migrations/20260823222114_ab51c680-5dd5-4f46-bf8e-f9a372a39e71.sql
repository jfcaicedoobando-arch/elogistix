-- FIX B-4 (residual) · El reproceso nocturno cerraba en silencio los ajustes de
-- nota de crédito sobre comisiones ya 'Liquidada': marcaba resuelto_at sin
-- aplicar descuento, y el ajuste desaparecía de la vista de Finanzas.
-- Ahora esas entradas (etapa = 'ajuste_nc_liquidada') se saltan y quedan
-- abiertas para descuento manual en la siguiente liquidación.
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

COMMENT ON FUNCTION public._reprocesar_comisiones_org(uuid) IS
  'Ola 2 · O2.11.1 + FIX B-4 — Núcleo del reproceso de la cola de comisiones para UNA organización. Sin guardas de sesión: los llamadores (RPC pública y job de plataforma) son los responsables de autorizar. Idempotente; nunca modifica comisiones Liquidadas. Las entradas ajuste_nc_liquidada se saltan: requieren descuento manual en la siguiente liquidación.';

REVOKE ALL ON FUNCTION public._reprocesar_comisiones_org(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._reprocesar_comisiones_org(uuid) TO service_role;