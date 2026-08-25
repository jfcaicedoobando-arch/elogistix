-- ============================================================================
-- FIX4 tanda 4 · N-1 · Papelera de embarques vs cotización 'En operación'
--
-- Bug (verificado en vivo): al mandar a la papelera un embarque cuya
-- cotización ligada está en 'En operación', sync_cotizacion_embarque_link
-- intenta revertirla a 'Aceptada' y guard_estado_cotizacion aborta con
-- LC_COT_TRANSICION_INVALIDA ('En operación' → 'Aceptada' no es una
-- transición permitida). Resultado: UPDATE embarques SET deleted_at = now()
-- imposible para cualquier embarque en operación con cotización ligada.
-- Documentado como "conflicto pre-existente" en la NOTA de
-- supabase/tests/fix3_sync_cotizacion_org.sql (tanda 3).
--
-- Fix (mismo patrón que la GUC app.bypass_cierre de bug10/cerrar_embarque):
--   1) sync_cotizacion_embarque_link levanta la GUC transaccional
--      app.liberando_papelera alrededor del UPDATE de liberación.
--   2) guard_estado_cotizacion admite ÚNICAMENTE la transición
--      'En operación' → 'Aceptada' cuando la GUC está puesta. Cualquier otra
--      transición sigue rechazada, con o sin GUC.
-- ============================================================================

-- 1) El trigger de papelera marca la GUC durante la liberación.
CREATE OR REPLACE FUNCTION public.sync_cotizacion_embarque_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    -- FIX4 N-1: la reversión 'En operación' → 'Aceptada' es housekeeping de
    -- la papelera, no un cambio de estado del flujo comercial; la GUC
    -- transaccional lo deja pasar por guard_estado_cotizacion (patrón
    -- app.bypass_cierre).
    PERFORM set_config('app.liberando_papelera', 'on', true);
    UPDATE public.cotizaciones
       SET embarque_id = NULL,
           estado = CASE
             WHEN estado = 'En operación'::estado_cotizacion
               THEN 'Aceptada'::estado_cotizacion
             ELSE estado
           END,
           updated_at = now()
     WHERE embarque_id = NEW.id
       AND organization_id = NEW.organization_id;
    PERFORM set_config('app.liberando_papelera', 'off', true);
    RETURN NEW;
  END IF;

  IF NEW.cotizacion_id IS NOT NULL THEN
    PERFORM 1
      FROM public.cotizaciones
     WHERE id = NEW.cotizacion_id
       AND organization_id = NEW.organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LC_COTIZACION_OTRA_ORG: la cotización no existe o pertenece a otra organización'
        USING ERRCODE = '23514',
              HINT    = json_build_object(
                'cotizacion_id', NEW.cotizacion_id,
                'organization_id', NEW.organization_id
              )::text;
    END IF;

    UPDATE public.cotizaciones
    SET
      embarque_id = NEW.id,
      estado = CASE
        WHEN estado = 'Aceptada'::estado_cotizacion
             AND NEW.estado <> 'Borrador'::estado_embarque
        THEN 'En operación'::estado_cotizacion
        ELSE estado
      END,
      updated_at = now()
    WHERE id = NEW.cotizacion_id
      AND organization_id = NEW.organization_id
      AND (
        embarque_id IS DISTINCT FROM NEW.id
        OR (estado = 'Aceptada'::estado_cotizacion AND NEW.estado <> 'Borrador'::estado_embarque)
      );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_cotizacion_embarque_link() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_cotizacion_embarque_link() FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_cotizacion_embarque_link() TO authenticated, service_role;

-- 2) El guard admite sólo la reversión de papelera cuando la GUC está puesta.
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

  -- Housekeeping: Vencida >90 días → Archivada (C5)
  IF v_old = 'Vencida' AND v_new = 'Archivada' THEN
    RETURN NEW;
  END IF;

  -- Reactivación manual desde estados de housekeeping (A3).
  -- RG11: 'Aceptada' fuera de la lista (requiere snapshot del flujo normal).
  IF v_old IN ('Vencida','Archivada')
     AND v_new IN ('Solicitada','Borrador','Enviada') THEN
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

  -- FIX4 N-1: la papelera de embarques (sync_cotizacion_embarque_link)
  -- revierte 'En operación' → 'Aceptada' al liberar la cotización. Es la
  -- única transición admitida bajo la GUC transaccional
  -- app.liberando_papelera; sin ella, LC_COT_TRANSICION_INVALIDA.
  IF v_old = 'En operación' AND v_new = 'Aceptada'
     AND current_setting('app.liberando_papelera', true) = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LC_COT_TRANSICION_INVALIDA: no se puede pasar de % a %', v_old, v_new
    USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_estado_cotizacion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_estado_cotizacion() FROM anon;
GRANT EXECUTE ON FUNCTION public.guard_estado_cotizacion() TO authenticated, service_role;
