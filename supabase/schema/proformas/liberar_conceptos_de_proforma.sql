-- Fuente canónica. Forward: 20261006233000_proforma_operativa_compatibilidad.sql.
CREATE OR REPLACE FUNCTION public.liberar_conceptos_de_proforma(p_proforma_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_embarque_id uuid;
  v_liberados   integer := 0;
BEGIN
  SELECT embarque_id INTO v_embarque_id FROM public.proformas WHERE id = p_proforma_id;
  IF v_embarque_id IS NULL THEN
    RETURN 0;
  END IF;
  WITH upd AS (
    UPDATE public.conceptos_venta
       SET proforma_id = NULL,
           estado_facturacion = 'pendiente'
     WHERE proforma_id = p_proforma_id AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_liberados FROM upd;
  -- El cálculo canónico incluye rechazo, cancelación, borradores y consolidación.
  PERFORM public.recompute_embarque_tiene_proforma(v_embarque_id);
  RETURN v_liberados;
END;
$$;
