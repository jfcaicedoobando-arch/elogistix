-- Forward-only repair: keep the unscoped margin helper private.
-- Do not grant authenticated/anon a callable SECURITY DEFINER margin RPC.
CREATE OR REPLACE FUNCTION public._cotizacion_autorizacion_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog, public, pg_temp
AS $function$
BEGIN
  -- This owner-only entry point is valid only as the existing row trigger.
  IF TG_RELID <> 'public.cotizaciones'::regclass OR TG_LEVEL <> 'ROW'
     OR TG_WHEN <> 'BEFORE' OR TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RAISE EXCEPTION 'LC_COT_TRIGGER_CONTEXTO_INVALIDO' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.autorizacion_solicitada_at := NULL; NEW.autorizada_at := NULL; NEW.autorizada_por := NULL;
    NEW.margen_autorizado_pct := NULL; NEW.autorizacion_motivo := NULL;
    RETURN NEW;
  END IF;
  IF coalesce(current_setting('lc.cot_autorizacion', true), '') <> '1' AND (
     NEW.autorizacion_solicitada_at IS DISTINCT FROM OLD.autorizacion_solicitada_at
     OR NEW.autorizada_at IS DISTINCT FROM OLD.autorizada_at OR NEW.autorizada_por IS DISTINCT FROM OLD.autorizada_por
     OR NEW.margen_autorizado_pct IS DISTINCT FROM OLD.margen_autorizado_pct
     OR NEW.autorizacion_motivo IS DISTINCT FROM OLD.autorizacion_motivo) THEN
    RAISE EXCEPTION 'LC_COT_AUTORIZACION_SOLO_RPC' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.autorizada_at IS NOT NULL AND NEW.estado IN ('Borrador','Solicitada') AND (
     NEW.conceptos_venta IS DISTINCT FROM OLD.conceptos_venta OR NEW.moneda IS DISTINCT FROM OLD.moneda
     OR NEW.tipo_cambio_usd IS DISTINCT FROM OLD.tipo_cambio_usd OR NEW.subtotal IS DISTINCT FROM OLD.subtotal) THEN
    NEW.autorizada_at := NULL; NEW.autorizada_por := NULL; NEW.margen_autorizado_pct := NULL;
    NEW.autorizacion_motivo := NULL; NEW.autorizacion_solicitada_at := NULL;
  END IF;
  IF OLD.estado IN ('Borrador','Solicitada') AND NEW.estado IN ('Enviada','Aceptada') AND NEW.autorizada_at IS NULL THEN
    -- Never use a changed primary key/tenant to select another quote's margin.
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA' USING ERRCODE = '42501';
    END IF;
    -- Clientes especiales (tarifa propia) no piden autorización: se registra como autorizada automáticamente.
    IF EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = NEW.cliente_id
               AND c.organization_id = NEW.organization_id AND c.tipo_cliente = 'especial') THEN
      -- Table UPDATE still uses caller RLS. Bound the privileged margin lookup as well.
      IF auth.uid() IS NULL OR NEW.organization_id IS DISTINCT FROM public.org_scope() THEN
        RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA' USING ERRCODE = '42501';
      END IF;
      NEW.autorizada_at := now();
      NEW.autorizada_por := auth.uid();
      NEW.margen_autorizado_pct := public._cotizacion_margen_pct(NEW.id);
      NEW.autorizacion_motivo := 'Cliente especial: no requiere autorización';
    ELSE
      RAISE EXCEPTION 'LC_COT_SIN_AUTORIZACION: un administrador o el gerente comercial debe autorizar la cotización antes de enviarla o aceptarla'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $function$;


REVOKE ALL ON FUNCTION public._cotizacion_autorizacion_guard() FROM PUBLIC, anon, authenticated, service_role;
-- Explicit pg_temp-last prevents temporary relations shadowing public tables.
ALTER FUNCTION public._cotizacion_margen_pct(uuid) SET search_path TO pg_catalog, public, pg_temp;
