-- FIX-H6-05 / FIX-45: revocar EXECUTE de PUBLIC/anon en funciones SECURITY DEFINER
-- creadas con el estado "Por liquidar" (v13.380.x).

REVOKE ALL ON FUNCTION public._trg_autocierre_por_liquidar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._trg_autocierre_por_liquidar() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public._trg_promover_por_liquidar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._trg_promover_por_liquidar() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.embarque_operativo_completo(p_embarque_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.embarque_operativo_completo(p_embarque_id uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.promover_embarque_por_liquidar(p_embarque_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promover_embarque_por_liquidar(p_embarque_id uuid) TO authenticated, service_role;