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

-- R2: ACL mínima canónica H6 para una función de trigger:
-- nadie público ni anónimo; sólo service_role la ejecuta.
REVOKE ALL ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion() FROM anon;
GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion() TO service_role;