CREATE OR REPLACE FUNCTION public._cotizacion_autorizacion_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
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
    -- Clientes especiales (tarifa propia) no piden autorización: se registra como autorizada automáticamente.
    IF EXISTS (SELECT 1 FROM clientes c WHERE c.id = NEW.cliente_id
               AND c.organization_id = NEW.organization_id AND c.tipo_cliente = 'especial') THEN
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

-- El handover debe nacer también con la autorización automática (no aparece en el SET del UPDATE).
DROP TRIGGER IF EXISTS trg_cotizacion_crear_handover ON public.cotizaciones;
CREATE TRIGGER trg_cotizacion_crear_handover AFTER UPDATE ON public.cotizaciones
  FOR EACH ROW WHEN (OLD.autorizada_at IS NULL AND NEW.autorizada_at IS NOT NULL)
  EXECUTE FUNCTION public._cotizacion_crear_handover();