-- H6: reemite el helper existente sin cambiar su cuerpo ni permisos efectivos.
-- Conserva las ACL verificadas: PUBLIC/anon sin EXECUTE; authenticated/service_role con EXECUTE.
-- No corrige aquí concurrencia, semántica del flag ni el alcance transaccional del bypass.

CREATE OR REPLACE FUNCTION public.recompute_embarque_tiene_proforma(p_embarque_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_embarque_id IS NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.embarques e
  SET tiene_proforma = EXISTS (
    SELECT 1
    FROM public.proformas p
    WHERE p.embarque_id = e.id
      AND p.deleted_at IS NULL
      AND COALESCE(p.estado_proforma, 'pendiente') <> 'cancelada'
      AND (
        COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id
        )
      )
  )
  WHERE e.id = p_embarque_id;
END;
$$;
REVOKE ALL ON FUNCTION public.recompute_embarque_tiene_proforma(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_embarque_tiene_proforma(uuid) TO authenticated, service_role;
