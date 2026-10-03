-- Auditoría 23: proteger también INSERT/UPDATE directos y otros callers.
-- El flujo explícito de reverso sólo cambia deleted_at y sigue intacto.
CREATE OR REPLACE FUNCTION public._guard_movimiento_anticipo_aplicado() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.pago_proveedor_id IS NOT NULL
     AND (EXISTS (SELECT 1 FROM public.pagos_proveedor pp
                  WHERE pp.id = NEW.pago_proveedor_id AND pp.es_anticipo_aplicado)
          OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                     WHERE aa.pago_proveedor_id = NEW.pago_proveedor_id AND aa.deleted_at IS NULL)) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_NUEVO_CARGO: una aplicación de anticipo utiliza la salida original; no puede vincular otro cargo bancario'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._guard_movimiento_anticipo_aplicado() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._guard_movimiento_anticipo_aplicado() TO service_role;

CREATE OR REPLACE FUNCTION public._guard_pago_anticipo_aplicado_edicion() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.es_anticipo_aplicado
      OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                 WHERE aa.pago_proveedor_id = OLD.id AND aa.deleted_at IS NULL))
     AND (NEW.proveedor_factura_id IS DISTINCT FROM OLD.proveedor_factura_id
          OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
          OR NEW.fecha_pago IS DISTINCT FROM OLD.fecha_pago
          OR NEW.monto IS DISTINCT FROM OLD.monto
          OR NEW.moneda IS DISTINCT FROM OLD.moneda
          OR NEW.tipo_cambio_usd IS DISTINCT FROM OLD.tipo_cambio_usd
          OR NEW.metodo_pago IS DISTINCT FROM OLD.metodo_pago
          OR NEW.referencia IS DISTINCT FROM OLD.referencia
          OR NEW.cuenta_bancaria_id IS DISTINCT FROM OLD.cuenta_bancaria_id
          OR NEW.notas IS DISTINCT FROM OLD.notas
          OR NEW.es_anticipo_aplicado IS DISTINCT FROM OLD.es_anticipo_aplicado) THEN
    RAISE EXCEPTION 'LC_PAGO_ANTICIPO_NO_EDITABLE: el pago proviene de un anticipo; usa Revertir aplicación y vuelve a aplicar el anticipo'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._guard_pago_anticipo_aplicado_edicion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._guard_pago_anticipo_aplicado_edicion() TO service_role;
