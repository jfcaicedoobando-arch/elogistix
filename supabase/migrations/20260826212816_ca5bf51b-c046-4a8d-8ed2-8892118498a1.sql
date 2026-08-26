CREATE OR REPLACE FUNCTION public.congelar_factura_al_emitir()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conceptos jsonb;
  v_cliente jsonb;
  v_org jsonb;
  v_tasa_iva numeric;
BEGIN
  IF NEW.estado NOT IN ('Emitida', 'Pagada') THEN
    RETURN NEW;
  END IF;

  -- QA-R2 D-05: no emitir una factura sin conceptos vivos (sólo transiciones
  -- UPDATE: en INSERT los conceptos aún no pueden existir por la FK).
  IF TG_OP = 'UPDATE'
     AND NEW.estado = 'Emitida'
     AND OLD.estado IS DISTINCT FROM 'Emitida'::public.estado_factura
     AND NOT EXISTS (
       SELECT 1 FROM public.conceptos_factura cf
       WHERE cf.factura_id = NEW.id AND cf.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'LC_FACTURA_SIN_CONCEPTOS: no se puede emitir una factura sin conceptos'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.snapshot_emision IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(cf)), '[]'::jsonb)
    INTO v_conceptos
    FROM public.conceptos_factura cf
   WHERE cf.factura_id = NEW.id
     AND cf.deleted_at IS NULL;

  SELECT jsonb_build_object(
           'id', c.id,
           'nombre', c.nombre,
           'rfc', c.rfc,
           'direccion', c.direccion,
           'ciudad', c.ciudad,
           'estado', c.estado,
           'cp', c.cp
         )
    INTO v_cliente
    FROM public.clientes c
   WHERE c.id = NEW.cliente_id;

  SELECT jsonb_build_object(
           'id', o.id,
           'nombre', o.nombre,
           'rfc', o.rfc
         )
    INTO v_org
    FROM public.organizations o
   WHERE o.id = NEW.organization_id;

  v_tasa_iva := CASE
    WHEN COALESCE(NEW.subtotal, 0) = 0 THEN 0
    ELSE round((NEW.iva / NEW.subtotal)::numeric, 4)
  END;

  NEW.snapshot_emision := jsonb_build_object(
    'version', 1,
    'congelado_at', now(),
    'estado_al_congelar', NEW.estado,
    'numero', NEW.numero,
    'moneda', NEW.moneda,
    'subtotal', NEW.subtotal,
    'iva', NEW.iva,
    'total', NEW.total,
    'tasa_iva', v_tasa_iva,
    'tipo_cambio', NEW.tipo_cambio,
    'fecha_emision', NEW.fecha_emision,
    'fecha_vencimiento', NEW.fecha_vencimiento,
    'expediente', NEW.expediente,
    'referencia_bl', NEW.referencia_bl,
    'cliente_snapshot', v_cliente,
    'organizacion_snapshot', v_org,
    'conceptos', v_conceptos
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.congelar_factura_al_emitir() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.congelar_factura_al_emitir() TO authenticated, service_role;