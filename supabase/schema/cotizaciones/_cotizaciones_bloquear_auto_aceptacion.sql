-- Fuente canónica de public._cotizaciones_bloquear_auto_aceptacion() (SoD).
-- v13.823.389: el guard se acota a la aceptación REAL. El regreso automático
-- 'En operación' -> 'Aceptada' que ejecuta eliminar_embarque_completo al borrar
-- el último embarque de la cotización no es una aceptación y bloqueaba el
-- borrado de borradores creados por error (LC_SOD_VIOLATION, ERRCODE 23514).
CREATE OR REPLACE FUNCTION public._cotizaciones_bloquear_auto_aceptacion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- SoD: quien elaboró la cotización no puede aceptarla. Sólo aplica a la
  -- aceptación real (estados previos a la aceptación). El regreso automático
  -- 'En operación' -> 'Aceptada' que hace eliminar_embarque_completo NO es una
  -- aceptación y no debe bloquearse.
  IF NEW.estado = 'Aceptada'::estado_cotizacion
     AND COALESCE(OLD.estado, 'Borrador'::estado_cotizacion) IN (
       'Borrador'::estado_cotizacion,
       'Solicitada'::estado_cotizacion,
       'Enviada'::estado_cotizacion,
       'Vencida'::estado_cotizacion
     )
     AND v_uid IS NOT NULL
     AND NEW.created_by IS NOT NULL
     AND NEW.created_by = v_uid
     AND NOT (
       public.has_role(v_uid, 'admin'::app_role)
       OR public.has_role(v_uid, 'admin_org'::app_role)
       OR public.has_role(v_uid, 'super_admin'::app_role)
     )
  THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: quien creó la cotización no puede aceptarla'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion() FROM PUBLIC;
GRANT ALL ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion() TO service_role;
