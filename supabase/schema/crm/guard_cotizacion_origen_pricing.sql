-- Local review candidate. Does not change the existing prospect trigger.
CREATE OR REPLACE FUNCTION public.guard_cotizacion_origen_pricing()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP='UPDATE' AND OLD.pricing_solicitud_id IS NOT NULL AND
    ROW(NEW.pricing_solicitud_id,NEW.oportunidad_id,NEW.cliente_id,NEW.tarifa_id,NEW.organization_id,NEW.es_prospecto,NEW.moneda)
      IS DISTINCT FROM
    ROW(OLD.pricing_solicitud_id,OLD.oportunidad_id,OLD.cliente_id,OLD.tarifa_id,OLD.organization_id,OLD.es_prospecto,OLD.moneda) THEN
    RAISE EXCEPTION 'LC_COT_PRICING_ORIGEN_CONFIRMADO' USING ERRCODE='22023';
  END IF;
  IF NEW.pricing_solicitud_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' OR OLD.pricing_solicitud_id IS NULL THEN
    -- No client-controlled GUC can bypass this guard. The reviewed RPC is owned
    -- by postgres, as other canonical RPCs; application roles cannot set lineage.
    IF current_user <> 'postgres' THEN
      RAISE EXCEPTION 'LC_COT_PRICING_SOLO_RPC' USING ERRCODE='42501';
    END IF;
    IF NEW.es_prospecto IS DISTINCT FROM false OR NEW.cliente_id IS NULL
      OR NEW.oportunidad_id IS NULL OR NEW.tarifa_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.crm_solicitudes_pricing s
        JOIN public.crm_oportunidades o ON o.id=s.oportunidad_id
        JOIN public.clientes c ON c.id=o.cliente_id
        JOIN public.costeo_tarifas t ON t.id=NEW.tarifa_id
        WHERE s.id=NEW.pricing_solicitud_id AND s.oportunidad_id=NEW.oportunidad_id
          AND s.organization_id=NEW.organization_id AND s.deleted_at IS NULL
          AND o.organization_id=NEW.organization_id AND o.deleted_at IS NULL
          AND c.organization_id=NEW.organization_id AND c.deleted_at IS NULL AND c.id=NEW.cliente_id
          AND t.organization_id=NEW.organization_id
          AND (s.tarifa_tarifario_id=t.id OR t.solicitud_pricing_id=s.id)
      ) THEN
      RAISE EXCEPTION 'LC_COT_PRICING_ORIGEN_INVALIDO' USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.guard_cotizacion_origen_pricing() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_cotizacion_origen_pricing() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_guard_cotizacion_origen_pricing ON public.cotizaciones;
CREATE TRIGGER trg_guard_cotizacion_origen_pricing
BEFORE INSERT OR UPDATE OF pricing_solicitud_id,oportunidad_id,cliente_id,tarifa_id,organization_id,es_prospecto,moneda
ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION public.guard_cotizacion_origen_pricing();
