-- FIX R4 P0-1: permitir operar cotizaciones originadas en portal (estado 'Solicitada').
-- portal_solicitar_cotizacion crea en 'Solicitada' pero guard_estado_cotizacion no
-- contemplaba ninguna transición desde ese estado -> LC_COT_TRANSICION_INVALIDA.
CREATE OR REPLACE FUNCTION public.guard_estado_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_old text := OLD.estado::text;
  v_new text := NEW.estado::text;
BEGIN
  IF v_old IS NULL OR v_new IS NULL OR v_old = v_new THEN
    RETURN NEW;
  END IF;

  -- Vencida siempre puede aplicarse desde cualquier estado no terminal
  IF v_new = 'Vencida' AND v_old IN ('Solicitada','Borrador','Enviada','Aceptada') THEN
    RETURN NEW;
  END IF;

  -- Transiciones válidas
  IF (v_old = 'Solicitada'    AND v_new IN ('Borrador','Enviada','Aceptada','Rechazada'))
  OR (v_old = 'Borrador'      AND v_new IN ('Enviada','Aceptada','Rechazada'))
  OR (v_old = 'Enviada'       AND v_new IN ('Aceptada','Rechazada'))
  OR (v_old = 'Aceptada'      AND v_new IN ('En operación'))
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LC_COT_TRANSICION_INVALIDA: no se puede pasar de % a %', v_old, v_new
    USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_estado_cotizacion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_estado_cotizacion() TO authenticated, service_role;

-- Snapshot también al aceptar directo desde 'Solicitada' (paridad con 'Borrador').
CREATE OR REPLACE FUNCTION public.snapshot_cotizacion_al_enviar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_next_version integer;
  v_costos jsonb;
  v_should_snapshot boolean := false;
BEGIN
  IF (OLD.estado IS DISTINCT FROM NEW.estado) THEN
    IF NEW.estado::text = 'Enviada' THEN
      v_should_snapshot := true;
    ELSIF NEW.estado::text = 'Aceptada' AND OLD.estado::text IN ('Borrador','Solicitada') THEN
      v_should_snapshot := true;
    END IF;
  END IF;

  IF v_should_snapshot THEN
    SELECT COALESCE(MAX(version_num), 0) + 1
      INTO v_next_version
      FROM public.cotizacion_versiones
     WHERE cotizacion_id = NEW.id;

    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
      INTO v_costos
      FROM public.cotizacion_costos c
     WHERE c.cotizacion_id = NEW.id;

    INSERT INTO public.cotizacion_versiones (
      cotizacion_id, organization_id, version_num, folio,
      estado_al_snapshot, snapshot, costos_snapshot, created_by
    ) VALUES (
      NEW.id, NEW.organization_id, v_next_version, NEW.folio,
      NEW.estado::text, to_jsonb(NEW), v_costos, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.snapshot_cotizacion_al_enviar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snapshot_cotizacion_al_enviar() TO authenticated, service_role;