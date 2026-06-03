-- Trigger: bloquear cambios a conceptos de venta/costo cuando el embarque está cerrado
CREATE OR REPLACE FUNCTION public.bloquear_conceptos_en_embarque_cerrado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
BEGIN
  SELECT estado::text INTO v_estado
  FROM public.embarques
  WHERE id = COALESCE(NEW.embarque_id, OLD.embarque_id);

  IF v_estado = 'Cerrado' THEN
    -- Permitir soft-delete (UPDATE que sólo marca deleted_at) sin importar el estado.
    IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden agregar ni modificar conceptos en un embarque Cerrado. Reabre el embarque antes de editar.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_conceptos_venta_cerrado ON public.conceptos_venta;
CREATE TRIGGER trg_bloquear_conceptos_venta_cerrado
BEFORE INSERT OR UPDATE ON public.conceptos_venta
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_conceptos_en_embarque_cerrado();

DROP TRIGGER IF EXISTS trg_bloquear_conceptos_costo_cerrado ON public.conceptos_costo;
CREATE TRIGGER trg_bloquear_conceptos_costo_cerrado
BEFORE INSERT OR UPDATE ON public.conceptos_costo
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_conceptos_en_embarque_cerrado();