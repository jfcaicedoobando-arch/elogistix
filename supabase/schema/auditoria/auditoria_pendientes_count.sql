CREATE OR REPLACE FUNCTION public.auditoria_pendientes_count()
RETURNS bigint
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $$
  WITH reporte AS MATERIALIZED (
    SELECT public.auditoria_embarques_org() AS datos
  )
  SELECT count(*)
  FROM reporte
  CROSS JOIN LATERAL jsonb_array_elements(reporte.datos->'hallazgos') AS hallazgo(h)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.auditoria_revisiones r
    WHERE r.organization_id = (SELECT public.current_user_org_id())
      AND r.embarque_id = (h->>'embarque_id')::uuid
      AND r.regla = h->>'regla'
      AND r.detalle_hash = public._auditoria_hallazgo_hash(
        concat(h->>'embarque_id', '|', h->>'regla', '|', h->>'detalle')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.auditoria_pendientes_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_pendientes_count() TO authenticated, service_role;
