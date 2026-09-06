-- A1/A7 · La sincronización cotización → oportunidad no debe redenominar el
-- monto existente de la oportunidad cuando la cotización aún no tiene ventas.
-- Antes: monto_estimado se conservaba con subtotal 0, pero `moneda` sí se
-- sobrescribía con la de la cotización (prellenado), dejando "125,000" en otra
-- divisa sin conversión.
CREATE OR REPLACE FUNCTION public._crm_sync_oportunidad_desde_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal numeric := NULLIF(NEW.subtotal, 0);
BEGIN
  IF NEW.oportunidad_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Sólo oportunidades vivas, ABIERTAS y de la misma organización: una
  -- cotización alternativa/Borrador no puede mover una ganada o perdida.
  -- La moneda sólo se alinea junto con un importe real (v_subtotal NOT NULL).
  UPDATE public.crm_oportunidades o
     SET monto_estimado = COALESCE(v_subtotal, o.monto_estimado),
         moneda         = CASE
                            WHEN v_subtotal IS NOT NULL
                              THEN COALESCE(NEW.moneda::text, o.moneda)
                            ELSE o.moneda
                          END,
         cliente_id     = COALESCE(o.cliente_id, NEW.cliente_id),
         updated_at     = now()
   WHERE o.id = NEW.oportunidad_id
     AND o.organization_id = NEW.organization_id
     AND o.deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM public.crm_etapas_pipeline e
        WHERE e.id = o.etapa_id
          AND e.tipo = 'abierta'::crm_etapa_tipo
          AND e.deleted_at IS NULL
     )
     AND (
       COALESCE(o.monto_estimado, 0) <> COALESCE(v_subtotal, o.monto_estimado, 0)
       OR (v_subtotal IS NOT NULL
           AND COALESCE(o.moneda, '') <> COALESCE(NEW.moneda::text, o.moneda, ''))
       OR (o.cliente_id IS NULL AND NEW.cliente_id IS NOT NULL)
     );
  RETURN NEW;
END;
$function$;