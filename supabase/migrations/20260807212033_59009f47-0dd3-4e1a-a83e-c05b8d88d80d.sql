-- 1) Normalizador de módulo en bitácora (fuente única, sirve a frontend, RPCs y edge functions)
CREATE OR REPLACE FUNCTION public._bitacora_normalizar_modulo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v text := lower(trim(COALESCE(NEW.modulo, '')));
BEGIN
  NEW.modulo := CASE v
    WHEN 'facturas' THEN 'facturacion'
    WHEN 'proformas' THEN 'facturacion'
    WHEN 'facturacion emitida' THEN 'facturacion'
    WHEN 'compras' THEN 'cxp'
    WHEN 'cuentas por pagar' THEN 'cxp'
    WHEN 'facturapi_credenciales' THEN 'configuracion'
    WHEN 'crm_oportunidades' THEN 'crm'
    WHEN 'crm_leads' THEN 'crm'
    WHEN 'costeo agentes' THEN 'costeo'
    WHEN 'costeo_agentes' THEN 'costeo'
    WHEN 'tracking' THEN 'embarques'
    WHEN 'bancos' THEN 'tesoreria'
    WHEN 'conciliacion' THEN 'tesoreria'
    WHEN '' THEN 'otro'
    ELSE v
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bitacora_normalizar_modulo ON public.bitacora_actividad;
CREATE TRIGGER trg_bitacora_normalizar_modulo
BEFORE INSERT OR UPDATE OF modulo ON public.bitacora_actividad
FOR EACH ROW EXECUTE FUNCTION public._bitacora_normalizar_modulo();

-- 2) Backfill del historial
UPDATE public.bitacora_actividad SET modulo = modulo WHERE modulo <> lower(trim(modulo))
  OR lower(trim(modulo)) IN ('facturas','proformas','compras','facturapi_credenciales','crm_oportunidades','costeo agentes','costeo_agentes','tracking','bancos','conciliacion','');

-- 3) Cambios de rol visibles en bitácora
CREATE OR REPLACE FUNCTION public._log_role_change_om()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.role_change_log
      (user_id, organization_id, source, from_role, to_role, changed_by)
    VALUES
      (NEW.user_id, NEW.organization_id, 'organization_members', OLD.role::text, NEW.role::text, auth.uid());
    PERFORM public.registrar_bitacora(
      'usuarios', 'cambiar_rol', NEW.user_id, '',
      jsonb_build_object('origen', 'organization_members', 'rol_anterior', OLD.role::text, 'rol_nuevo', NEW.role::text),
      NEW.organization_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._log_role_change_ur()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.role_change_log
      (user_id, organization_id, source, from_role, to_role, changed_by)
    VALUES
      (NEW.user_id, NULL, 'user_roles', OLD.role::text, NEW.role::text, auth.uid());
    PERFORM public.registrar_bitacora(
      'usuarios', 'cambiar_rol_global', NEW.user_id, '',
      jsonb_build_object('origen', 'user_roles', 'rol_anterior', OLD.role::text, 'rol_nuevo', NEW.role::text),
      NULL, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;