-- Ola 7 · B8 — Guard único para notas de crédito.
-- `check_factura_saldo_para_nc` era parcial y contradictorio (sólo INSERT,
-- ignoraba deleted_at, sólo estado 'Aplicada'). `assert_nc_no_excede_saldo`
-- (trg_nc_no_excede_saldo) cubre INSERT OR UPDATE, respeta soft-delete y
-- considera 'Aplicada' + 'Emitida'.
DROP TRIGGER IF EXISTS trg_check_factura_saldo_para_nc ON public.factura_notas_credito;
DROP FUNCTION IF EXISTS public.check_factura_saldo_para_nc();