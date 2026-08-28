-- Restaura N15 (proformas vivas + facturas en Borrador) en el assert de cancelación
-- de embarques, perdido al reescribir la función en 20260902000100_qa_r2_etapa1_guards.sql.
CREATE OR REPLACE FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado = 'Cancelado'::public.estado_embarque
     AND OLD.estado NOT IN ('Cancelado'::public.estado_embarque, 'Cerrado'::public.estado_embarque)
     AND NEW.deleted_at IS NULL
     AND current_setting('app.via_rpc_estado', true) IS DISTINCT FROM '1' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturas f
      WHERE f.embarque_id = NEW.id
        AND f.deleted_at IS NULL
        AND f.estado IN ('Emitida', 'Vencida', 'Parcialmente pagada')
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXC: cancela o sustituye las facturas de cliente antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.proveedor_facturas pf
      WHERE pf.embarque_id = NEW.id
        AND pf.deleted_at IS NULL
        AND pf.estado <> 'Cancelada'
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXP: cancela las facturas de proveedor antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
    -- N15: facturas de cliente en Borrador y proformas vivas.
    IF EXISTS (
      SELECT 1 FROM public.facturas f
      WHERE f.embarque_id = NEW.id
        AND f.deleted_at IS NULL
        AND f.estado = 'Borrador'
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_FACTURA_BORRADOR: elimina las facturas en borrador del embarque antes de cancelarlo'
        USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.proformas p
      WHERE p.embarque_id = NEW.id
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_PROFORMA: cancela o elimina las proformas del embarque antes de cancelarlo'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp() FROM anon;

DROP TRIGGER IF EXISTS trg_embarques_cancelacion_cxc_cxp ON public.embarques;
CREATE TRIGGER trg_embarques_cancelacion_cxc_cxp
  BEFORE UPDATE OF estado ON public.embarques
  FOR EACH ROW EXECUTE FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp();