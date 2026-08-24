-- Linter 0010 (security_definer_view): public.embarques_interno_v era una vista
-- sin security_invoker, por lo que corría con los privilegios de su creador.
-- Se conserva la misma superficie (nombre, columnas y candados) pero ahora la
-- vista es SECURITY INVOKER y la lectura de las columnas internas de
-- public.embarques se hace por una funcion SECURITY DEFINER acotada, que
-- reaplica los mismos candados (membresia de organizacion y exclusion de los
-- roles de portal 'cliente' / 'agente_carga').

CREATE OR REPLACE FUNCTION public.embarques_internos_src()
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  cerrado_snapshot jsonb,
  tarifa_delta_jsonb jsonb,
  reabierto_motivo text,
  created_by_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id,
         e.organization_id,
         e.cerrado_snapshot,
         e.tarifa_delta_jsonb,
         e.reabierto_motivo,
         e.created_by_email
  FROM public.embarques e
  WHERE public.is_org_member(e.organization_id)
    AND NOT public.has_role((SELECT auth.uid()), 'cliente'::app_role)
    AND NOT public.has_role((SELECT auth.uid()), 'agente_carga'::app_role);
$$;

REVOKE ALL ON FUNCTION public.embarques_internos_src() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.embarques_internos_src() FROM anon;
GRANT EXECUTE ON FUNCTION public.embarques_internos_src() TO authenticated;
GRANT EXECUTE ON FUNCTION public.embarques_internos_src() TO service_role;

CREATE OR REPLACE VIEW public.embarques_interno_v
WITH (security_invoker = true) AS
  SELECT e.id,
         e.organization_id,
         e.cerrado_snapshot,
         e.tarifa_delta_jsonb,
         e.reabierto_motivo,
         e.created_by_email
  FROM public.embarques_internos_src() e
  WHERE public.is_org_member(e.organization_id)
    AND NOT public.has_role((SELECT auth.uid()), 'cliente'::app_role)
    AND NOT public.has_role((SELECT auth.uid()), 'agente_carga'::app_role);

REVOKE ALL ON public.embarques_interno_v FROM anon;
GRANT SELECT ON public.embarques_interno_v TO authenticated;
GRANT SELECT ON public.embarques_interno_v TO service_role;