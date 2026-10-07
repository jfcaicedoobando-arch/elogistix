-- Fuente canónica. Forward: 20261006233000_proforma_operativa_compatibilidad.sql.
CREATE OR REPLACE FUNCTION public.recompute_embarque_tiene_proforma(p_embarque_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tiene_proforma boolean;
  v_bypass_prev text;
BEGIN
  v_bypass_prev := current_setting('app.bypass_cierre', true);
  -- Materializar el valor previo conserva la salida unset->vacío del SET
  -- original incluso ante retorno temprano o error de lock, sin activar bypass.
  PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
  IF p_embarque_id IS NULL THEN RETURN; END IF;
  -- Serializar antes de leer los hijos. En READ COMMITTED, la siguiente
  -- sentencia toma un snapshot nuevo después de esperar al último escritor.
  -- NO KEY UPDATE es compatible con los KEY SHARE de las claves foráneas.
  PERFORM 1 FROM public.embarques WHERE id = p_embarque_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.proformas p
    WHERE p.embarque_id = p_embarque_id
      AND p.deleted_at IS NULL
      AND COALESCE(p.estado_proforma, 'pendiente') <> 'cancelada'
      AND COALESCE(p.estado_cliente, 'pendiente') <> 'rechazada'
      AND COALESCE(p.estado_revision, 'aprobada') <> 'consolidada'
      AND p.consolidada_en IS NULL
      AND (
        p.estado_proforma = 'facturada'
        OR COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id AND cv.deleted_at IS NULL
        )
      )
  ) INTO v_tiene_proforma;
  -- Un cambio de metadatos de la proforma no altera updated_at del embarque.
  BEGIN
    PERFORM set_config('app.bypass_cierre', 'on', true);
    UPDATE public.embarques SET tiene_proforma = v_tiene_proforma
    WHERE id = p_embarque_id AND tiene_proforma IS DISTINCT FROM v_tiene_proforma;
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    RAISE;
  END;
END;
$$;
