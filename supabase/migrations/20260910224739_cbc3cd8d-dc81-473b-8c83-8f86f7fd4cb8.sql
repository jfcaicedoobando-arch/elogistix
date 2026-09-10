REVOKE ALL ON FUNCTION public.reversar_movimiento_cobro_rep_cancelado(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._trg_reversar_movimiento_rep_cancelado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reversar_movimiento_cobro_rep_cancelado(uuid) TO service_role;