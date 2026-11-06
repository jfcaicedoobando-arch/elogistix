CREATE OR REPLACE FUNCTION public._embarque_vendedora_recalcular_comisiones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago uuid;
BEGIN
  IF NEW.vendedora_id IS NOT DISTINCT FROM OLD.vendedora_id THEN
    RETURN NEW;
  END IF;
  IF OLD.vendedora_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM comisiones_devengadas cd
        WHERE cd.embarque_id = NEW.id AND cd.deleted_at IS NULL
          AND cd.estado IN ('Liquidada', 'Por recuperar')) THEN
    RAISE EXCEPTION 'No se puede cambiar la vendedora: el embarque ya tiene comisiones liquidadas.'
      USING ERRCODE = 'P0001', HINT = 'LC_COMISION_LIQUIDADA';
  END IF;
  FOR v_pago IN
    SELECT DISTINCT p.id
      FROM pagos_factura p
      JOIN facturas f ON f.id = p.factura_id
     WHERE p.organization_id = NEW.organization_id
       AND (f.embarque_id = NEW.id OR EXISTS (
             SELECT 1 FROM factura_embarques fe
              WHERE fe.factura_id = f.id AND fe.embarque_id = NEW.id
                AND COALESCE(fe.activa, true)))
  LOOP
    PERFORM public.calcular_comision_pago(v_pago);
    -- El cálculo no limpia la vendedora anterior en los casos sin vendedora.
    UPDATE comisiones_devengadas
       SET vendedora_id = NULL, updated_at = now()
     WHERE pago_factura_id = v_pago AND comision_mxn = 0
       AND porcentaje_aplicado = 0 AND vendedora_id IS NOT NULL
       AND NEW.vendedora_id IS NULL
       AND estado NOT IN ('Liquidada', 'Por recuperar');
    -- Una comisión cancelada que vuelve a calcular un monto vivo regresa a Devengada.
    UPDATE comisiones_devengadas
       SET estado = 'Devengada', updated_at = now()
     WHERE pago_factura_id = v_pago AND estado = 'Cancelada'
       AND comision_mxn > 0
       AND estado_previo_liquidacion IS DISTINCT FROM 'Por recuperar';
  END LOOP;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._embarque_vendedora_recalcular_comisiones() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_embarque_vendedora_recalcular_comisiones ON public.embarques;
CREATE TRIGGER trg_embarque_vendedora_recalcular_comisiones
  AFTER UPDATE OF vendedora_id ON public.embarques
  FOR EACH ROW EXECUTE FUNCTION public._embarque_vendedora_recalcular_comisiones();

CREATE OR REPLACE FUNCTION public._embarque_heredar_vendedora_cotizacion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.vendedora_id IS NULL AND NEW.cotizacion_id IS NOT NULL THEN
    SELECT c.vendedor_id INTO NEW.vendedora_id
      FROM cotizaciones c
      JOIN organization_members om
        ON om.user_id = c.vendedor_id AND om.organization_id = NEW.organization_id
     WHERE c.id = NEW.cotizacion_id
       AND c.organization_id = NEW.organization_id
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._embarque_heredar_vendedora_cotizacion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_embarque_heredar_vendedora_cotizacion ON public.embarques;
CREATE TRIGGER trg_embarque_heredar_vendedora_cotizacion
  BEFORE INSERT ON public.embarques
  FOR EACH ROW EXECUTE FUNCTION public._embarque_heredar_vendedora_cotizacion();