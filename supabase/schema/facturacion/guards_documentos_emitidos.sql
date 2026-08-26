CREATE OR REPLACE FUNCTION public.assert_nc_fecha_valida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha_factura date;
  v_hoy_mexico date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  SELECT f.fecha_emision INTO v_fecha_factura
  FROM public.facturas f
  WHERE f.id = NEW.factura_id AND f.deleted_at IS NULL;

  IF v_fecha_factura IS NULL OR NEW.fecha_emision IS NULL
     OR NEW.fecha_emision < v_fecha_factura OR NEW.fecha_emision > v_hoy_mexico THEN
    RAISE EXCEPTION 'LC_NC_FECHA_INVALIDA: la fecha debe estar entre la emisión de la factura y hoy'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.conceptos_factura_assert_borrador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid;
  v_estado public.estado_factura;
BEGIN
  IF TG_OP = 'DELETE' THEN v_factura_id := OLD.factura_id;
  ELSE v_factura_id := NEW.factura_id;
  END IF;

  SELECT f.estado INTO v_estado FROM public.facturas f WHERE f.id = v_factura_id AND f.deleted_at IS NULL;
  IF v_estado IS DISTINCT FROM 'Borrador'::public.estado_factura THEN
    RAISE EXCEPTION 'LC_FACTURA_INMUTABLE: los conceptos sólo se editan mientras la factura está en Borrador'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_nc_fecha_valida ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_fecha_valida
BEFORE INSERT OR UPDATE OF factura_id, fecha_emision ON public.factura_notas_credito
FOR EACH ROW EXECUTE FUNCTION public.assert_nc_fecha_valida();

DROP TRIGGER IF EXISTS trg_conceptos_factura_assert_borrador ON public.conceptos_factura;
CREATE TRIGGER trg_conceptos_factura_assert_borrador
BEFORE INSERT OR UPDATE OR DELETE ON public.conceptos_factura
FOR EACH ROW EXECUTE FUNCTION public.conceptos_factura_assert_borrador();