-- ============================================================================
-- FIX3 · Ronda-2 P3: sync_cotizacion_embarque_link — validación de misma org.
-- ============================================================================
-- Hallazgo (bugs2/db_rls_round2.md, P3): el trigger (re-emitido por
-- 20260821015117 sin corregir el defecto del cuerpo original) permitía que un
-- escritor de la org A apuntara `embarques.cotizacion_id` al UUID de una
-- cotización de la org B: la FK no valida org y el trigger SECURITY DEFINER
-- escribía sobre la cotización ajena (`En operación`, `embarque_id`), y al
-- tirar el embarque a la papelera la regresaba a `Aceptada`.
--
-- Fix:
--   1. Vínculo (INSERT/UPDATE de cotizacion_id): la cotización debe existir
--      y pertenecer a la MISMA organización del embarque; si no, se rechaza
--      el cambio con LC_COTIZACION_OTRA_ORG (23514). La cotización legítima
--      siempre es de la misma org, así que ningún flujo válido se rompe.
--   2. Papelera (deleted_at): el UPDATE que libera la cotización se acota
--      además a la org del embarque (defensa ante datos ya corruptos: nunca
--      toca filas de otro tenant, queda como no-op cross-tenant).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_cotizacion_embarque_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Embarque en papelera: la cotización se libera y vuelve a estar disponible.
  IF NEW.deleted_at IS NOT NULL THEN
    UPDATE public.cotizaciones
       SET embarque_id = NULL,
           estado = CASE
             WHEN estado = 'En operación'::estado_cotizacion
               THEN 'Aceptada'::estado_cotizacion
             ELSE estado
           END,
           updated_at = now()
     WHERE embarque_id = NEW.id
       AND organization_id = NEW.organization_id; -- FIX3: nunca tocar otro tenant
    RETURN NEW;
  END IF;

  IF NEW.cotizacion_id IS NOT NULL THEN
    -- FIX3: la cotización vinculada debe ser de la misma organización del
    -- embarque (o existir siquiera); de lo contrario se rechaza la escritura.
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

DROP TRIGGER IF EXISTS trg_sync_cotizacion_embarque_link ON public.embarques;
CREATE TRIGGER trg_sync_cotizacion_embarque_link
AFTER INSERT OR UPDATE OF cotizacion_id, deleted_at ON public.embarques
FOR EACH ROW EXECUTE FUNCTION public.sync_cotizacion_embarque_link();
