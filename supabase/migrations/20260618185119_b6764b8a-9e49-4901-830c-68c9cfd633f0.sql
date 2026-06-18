CREATE OR REPLACE FUNCTION public.enforce_cotizacion_obligatoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_es_libre boolean := false;
BEGIN
  -- Si ya viene con cotización, todo OK
  IF NEW.cotizacion_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Sin auth context (jobs internos / service_role) — permitir
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- ¿Es super_admin global?
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role = 'super_admin'
  ) INTO v_es_libre;

  IF v_es_libre THEN
    RETURN NEW;
  END IF;

  -- ¿Tiene rol admin/dirección en la organización del embarque?
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_uid
      AND organization_id = NEW.organization_id
      AND role IN ('admin_org', 'admin', 'gerente_operaciones')
  ) INTO v_es_libre;

  IF v_es_libre THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Tu rol requiere vincular una cotización Aceptada para crear el embarque.'
    USING ERRCODE = 'check_violation', HINT = 'Selecciona una cotización en el paso 1 del wizard.';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cotizacion_obligatoria ON public.embarques;
CREATE TRIGGER trg_enforce_cotizacion_obligatoria
BEFORE INSERT ON public.embarques
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cotizacion_obligatoria();