CREATE OR REPLACE FUNCTION public.cerrar_caso_refacturacion(p_caso_id uuid, p_cancelar boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
  v_val jsonb;
  v_estado_nueva text;
  v_uuid_nueva text;
  v_pago_ok boolean;
  v_mov_pendiente int;
BEGIN
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_c.organization_id);

  IF NOT p_cancelar THEN
    IF v_c.factura_nueva_id IS NULL THEN
      RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: falta generar y timbrar la nueva factura'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT estado::text, uuid_fiscal INTO v_estado_nueva, v_uuid_nueva
    FROM public.facturas WHERE id = v_c.factura_nueva_id;
    IF v_uuid_nueva IS NULL OR v_estado_nueva IN ('Borrador','Cancelada','Sustituida') THEN
      RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: la nueva factura debe estar timbrada y vigente'
        USING ERRCODE = 'P0001';
    END IF;

    v_val := public.refacturacion_validar_consistencia(p_caso_id);
    IF NOT (v_val->>'ok')::boolean THEN
      RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: %',
        COALESCE((v_val->'hallazgos'->0->>'mensaje'), 'la nueva factura no es consistente con la original')
        USING ERRCODE = 'P0001';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.pagos_factura
      WHERE factura_id = v_c.factura_nueva_id AND deleted_at IS NULL
    ) INTO v_pago_ok;
    IF NOT v_pago_ok THEN
      RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: el pago recibido aún no está aplicado a la nueva factura'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_c.pago_nuevo_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_mov_pendiente
      FROM public.bbva_movimientos
      WHERE pago_factura_id = v_c.pago_nuevo_id AND estado_conciliacion <> 'Conciliado';
      IF v_mov_pendiente > 0 THEN
        RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: el movimiento bancario quedó sin conciliar'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- Trazabilidad: la proforma origen debe apuntar a la factura viva
    UPDATE public.proformas
       SET factura_id = v_c.factura_nueva_id, updated_at = now()
     WHERE factura_id = v_c.factura_original_id
       AND organization_id = v_c.organization_id
       AND deleted_at IS NULL;

    UPDATE public.proformas
       SET factura_secundaria_id = v_c.factura_nueva_id, updated_at = now()
     WHERE factura_secundaria_id = v_c.factura_original_id
       AND organization_id = v_c.organization_id
       AND deleted_at IS NULL;
  END IF;

  UPDATE public.refacturaciones
     SET estado = CASE WHEN p_cancelar THEN 'cancelado' ELSE 'completado' END,
         paso_actual = CASE WHEN p_cancelar THEN paso_actual ELSE 5 END,
         cerrado_at = now()
   WHERE id = p_caso_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_c.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    CASE WHEN p_cancelar THEN 'refacturacion_cancelada' ELSE 'refacturacion_completada' END,
    'facturacion', v_c.factura_original_id, '',
    jsonb_build_object('caso_id', p_caso_id, 'factura_nueva_id', v_c.factura_nueva_id)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cerrar_caso_refacturacion(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cerrar_caso_refacturacion(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.cerrar_caso_refacturacion(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_caso_refacturacion(uuid, boolean) TO service_role;

-- 2) Aging CxC: no sumar facturas en trámite de cancelación ni sustituidas
