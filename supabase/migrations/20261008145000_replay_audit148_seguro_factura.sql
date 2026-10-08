-- Hallazgo 148: vínculo explícito póliza ↔ factura de proveedor para no contar dos veces el mismo gasto.
ALTER TABLE public.seguros_embarque
  ADD COLUMN IF NOT EXISTS proveedor_factura_id uuid
  REFERENCES public.proveedor_facturas(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.seguros_embarque.proveedor_factura_id IS
  'Factura de proveedor que documenta esta prima. Si está ligada y vigente, la utilidad cuenta la factura y no la prima. Opcional; los históricos quedan sin vínculo.';

-- Una factura sólo puede respaldar una póliza activa (también protege restauraciones concurrentes).
CREATE UNIQUE INDEX IF NOT EXISTS ux_seguros_embarque_factura_activa
  ON public.seguros_embarque (proveedor_factura_id)
  WHERE proveedor_factura_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public._seguro_validar_factura_proveedor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.proveedor_factura_id IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.proveedor_facturas pf
    WHERE pf.id = NEW.proveedor_factura_id
      AND pf.organization_id = NEW.organization_id
      AND pf.deleted_at IS NULL
      AND pf.estado::text NOT IN ('Borrador','Cancelada')
      AND (pf.embarque_id = NEW.embarque_id OR EXISTS (
        SELECT 1 FROM public.proveedor_facturas_conceptos pfc
        JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
        WHERE pfc.proveedor_factura_id = pf.id AND cc.embarque_id = NEW.embarque_id
          AND cc.deleted_at IS NULL AND COALESCE(pfc.monto, 0) > 0))
    FOR SHARE OF pf
  ) THEN
    RAISE EXCEPTION 'LC_SEGURO_FACTURA_INVALIDA: la factura no es vigente, no es de tu organización o no pertenece a este embarque.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public._seguro_validar_factura_proveedor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_seguro_validar_factura_proveedor ON public.seguros_embarque;
CREATE TRIGGER trg_seguro_validar_factura_proveedor
  BEFORE INSERT OR UPDATE OF proveedor_factura_id, deleted_at, embarque_id, organization_id
  ON public.seguros_embarque
  FOR EACH ROW EXECUTE FUNCTION public._seguro_validar_factura_proveedor();

-- Utilidad: la prima ligada a una factura vigente ya está contada en esa factura.
DO $do$
DECLARE
  v_def text := pg_get_functiondef('public.pnl_financiero_embarque(uuid)'::regprocedure);
  v_old text := 'FROM public.seguros_embarque
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL';
  v_new text := 'FROM public.seguros_embarque s
    WHERE s.embarque_id = _embarque_id AND s.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.proveedor_facturas pfx
                      WHERE pfx.id = s.proveedor_factura_id AND pfx.organization_id = _org
                        AND pfx.deleted_at IS NULL
                        AND pfx.estado::text NOT IN (''Borrador'',''Cancelada''))';
BEGIN
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'pnl_financiero_embarque: bloque de seguros no encontrado exactamente una vez';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END;
$do$;