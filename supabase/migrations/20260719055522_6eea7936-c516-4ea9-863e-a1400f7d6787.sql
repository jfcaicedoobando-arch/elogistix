
-- Fase R.5 — Bug 8: bloquear eliminación (soft-delete) de un pago con REP vivo.
-- REP vivo = uuid_rep IS NOT NULL AND rep_cancelado_en IS NULL.
-- Si el REP está cancelado o nunca se timbró, la eliminación procede normalmente.

CREATE OR REPLACE FUNCTION public.assert_pago_sin_rep_vivo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sólo actuamos cuando se está haciendo soft-delete (deleted_at pasa de NULL a NOT NULL).
  IF NEW.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.deleted_at IS NOT NULL THEN
    -- ya estaba borrado; no re-validamos
    RETURN NEW;
  END IF;

  IF OLD.uuid_rep IS NOT NULL AND OLD.rep_cancelado_en IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_CON_REP_VIVO'
      USING HINT = COALESCE(OLD.uuid_rep::text, ''),
            ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_pago_sin_rep_vivo() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_pago_sin_rep_vivo ON public.pagos_factura;
CREATE TRIGGER trg_pago_sin_rep_vivo
BEFORE UPDATE OF deleted_at ON public.pagos_factura
FOR EACH ROW
WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
EXECUTE FUNCTION public.assert_pago_sin_rep_vivo();

COMMENT ON FUNCTION public.assert_pago_sin_rep_vivo() IS
  'Fase R.5 · Bug 8 — impide soft-delete de pagos_factura cuando el REP está timbrado y no cancelado. El usuario debe cancelar el REP primero.';
