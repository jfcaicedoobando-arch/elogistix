-- Cierra el acceso directo a tres funciones internas (Ola v17): la migración
-- original las dejó ejecutables por `authenticated`, pero los espejos
-- canónicos (supabase/schema/...) siempre las declararon service_role-only.
-- Son SECURITY DEFINER y sólo las llaman envolturas DEFINER, un trigger y el
-- cron, así que revocar no rompe ninguna ruta de la app.
REVOKE ALL ON FUNCTION public._saldo_factura_calc(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._saldo_factura_calc(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reversar_movimiento_cobro_rep_cancelado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reversar_movimiento_cobro_rep_cancelado(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.auditar_consistencia_cobranza() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auditar_consistencia_cobranza() TO service_role;