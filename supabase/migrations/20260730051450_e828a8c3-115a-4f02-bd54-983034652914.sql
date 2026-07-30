-- Q-04 fix: la cotización no tenía columna de autor, el trigger SoD fallaba
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_cotizaciones_created_by
  ON public.cotizaciones (created_by);

CREATE OR REPLACE FUNCTION public._cotizaciones_bloquear_auto_aceptacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.estado = 'Aceptada'::estado_cotizacion
     AND COALESCE(OLD.estado, 'Borrador'::estado_cotizacion) <> 'Aceptada'::estado_cotizacion
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

-- FIX-45: las funciones trigger SECURITY DEFINER no deben ser ejecutables por anon/PUBLIC
REVOKE ALL ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_auto_aceptacion()
  TO service_role;

DROP TRIGGER IF EXISTS trg_cotizaciones_sod_aceptacion ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_sod_aceptacion
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public._cotizaciones_bloquear_auto_aceptacion();