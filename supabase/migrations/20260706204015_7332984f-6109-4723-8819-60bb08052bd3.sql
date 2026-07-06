-- v13.205.3 — Endurecer sync de `embarques.tiene_proforma` (retry con bypass de cierre).

CREATE OR REPLACE FUNCTION public.recompute_embarque_tiene_proforma(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_embarque_id IS NULL THEN
    RETURN;
  END IF;
  -- Permite actualizar tiene_proforma aun en embarques cerrados (sync automático).
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.embarques e
  SET tiene_proforma = EXISTS (
    SELECT 1
    FROM public.proformas p
    WHERE p.embarque_id = e.id
      AND (
        COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
        OR COALESCE(p.total_mxn, 0) > 0
        OR COALESCE(p.total_usd, 0) > 0
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id
        )
      )
  )
  WHERE e.id = p_embarque_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_embarque_tiene_proforma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_embarque_tiene_proforma(OLD.embarque_id);
    RETURN OLD;
  END IF;

  PERFORM public.recompute_embarque_tiene_proforma(NEW.embarque_id);

  IF TG_OP = 'UPDATE' AND OLD.embarque_id IS DISTINCT FROM NEW.embarque_id THEN
    PERFORM public.recompute_embarque_tiene_proforma(OLD.embarque_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_embarque_tiene_proforma ON public.proformas;
CREATE TRIGGER trg_sync_embarque_tiene_proforma
AFTER INSERT OR UPDATE OR DELETE ON public.proformas
FOR EACH ROW EXECUTE FUNCTION public.sync_embarque_tiene_proforma();

CREATE OR REPLACE FUNCTION public.sync_embarque_tiene_proforma_from_concepto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_embarque uuid;
  v_new_embarque uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.proforma_id IS NOT NULL THEN
      SELECT embarque_id INTO v_old_embarque FROM public.proformas WHERE id = OLD.proforma_id;
      PERFORM public.recompute_embarque_tiene_proforma(v_old_embarque);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.proforma_id IS NOT NULL THEN
      SELECT embarque_id INTO v_new_embarque FROM public.proformas WHERE id = NEW.proforma_id;
      PERFORM public.recompute_embarque_tiene_proforma(v_new_embarque);
    END IF;
    RETURN NEW;
  ELSE
    IF OLD.proforma_id IS DISTINCT FROM NEW.proforma_id THEN
      IF OLD.proforma_id IS NOT NULL THEN
        SELECT embarque_id INTO v_old_embarque FROM public.proformas WHERE id = OLD.proforma_id;
        PERFORM public.recompute_embarque_tiene_proforma(v_old_embarque);
      END IF;
      IF NEW.proforma_id IS NOT NULL THEN
        SELECT embarque_id INTO v_new_embarque FROM public.proformas WHERE id = NEW.proforma_id;
        PERFORM public.recompute_embarque_tiene_proforma(v_new_embarque);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_embarque_tiene_proforma_from_concepto ON public.conceptos_venta;
CREATE TRIGGER trg_sync_embarque_tiene_proforma_from_concepto
AFTER INSERT OR UPDATE OF proforma_id OR DELETE ON public.conceptos_venta
FOR EACH ROW EXECUTE FUNCTION public.sync_embarque_tiene_proforma_from_concepto();

-- Backfill con bypass de cierre
DO $$
BEGIN
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.embarques e
  SET tiene_proforma = EXISTS (
    SELECT 1
    FROM public.proformas p
    WHERE p.embarque_id = e.id
      AND (
        COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
        OR COALESCE(p.total_mxn, 0) > 0
        OR COALESCE(p.total_usd, 0) > 0
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id
        )
      )
  );
END $$;
