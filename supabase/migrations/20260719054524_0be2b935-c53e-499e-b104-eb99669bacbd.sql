-- Bug 21: enforce state machine for proveedor_notas_credito at DB level.
-- Allowed transitions:
--   Borrador  -> Aprobada, Cancelada
--   Aprobada  -> Aplicada, Cancelada
--   Aplicada  -> Cancelada (revert)
--   Cancelada -> (terminal, no change allowed)

CREATE OR REPLACE FUNCTION public.enforce_nc_proveedor_estado_transicion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old public.estado_nota_credito_proveedor := OLD.estado;
  v_new public.estado_nota_credito_proveedor := NEW.estado;
BEGIN
  -- No estado change → nothing to enforce here.
  IF v_old = v_new THEN
    RETURN NEW;
  END IF;

  -- Cancelada is terminal.
  IF v_old = 'Cancelada' THEN
    RAISE EXCEPTION 'LC_NC_PROV_ESTADO_TERMINAL'
      USING HINT = 'La nota de crédito está Cancelada y no admite cambios de estado.',
            ERRCODE = 'P0001';
  END IF;

  -- Enumerate allowed transitions.
  IF v_old = 'Borrador' AND v_new IN ('Aprobada','Cancelada') THEN
    RETURN NEW;
  END IF;

  IF v_old = 'Aprobada' AND v_new IN ('Aplicada','Cancelada') THEN
    RETURN NEW;
  END IF;

  IF v_old = 'Aplicada' AND v_new = 'Cancelada' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LC_NC_PROV_TRANSICION_INVALIDA'
    USING HINT = format('No se puede pasar de %s a %s.', v_old, v_new),
          ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_nc_prov_estado_machine ON public.proveedor_notas_credito;

CREATE TRIGGER trg_nc_prov_estado_machine
BEFORE UPDATE OF estado ON public.proveedor_notas_credito
FOR EACH ROW
EXECUTE FUNCTION public.enforce_nc_proveedor_estado_transicion();