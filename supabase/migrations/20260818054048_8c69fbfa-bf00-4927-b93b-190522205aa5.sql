-- UI-15 / CRM: `crm_higiene_pipeline` sumaba monto_estimado sin mirar `moneda`,
-- mezclando MXN con USD/EUR y rotulando el total como pesos. Ahora convierte
-- cada oportunidad a MXN con el TC DOF vigente y expone la trazabilidad del TC.
DROP FUNCTION IF EXISTS public.crm_higiene_pipeline();

CREATE OR REPLACE FUNCTION public.crm_higiene_pipeline()
RETURNS TABLE (
  abiertas integer,
  registros_completos integer,
  higiene_pct numeric,
  seguimiento_oportuno_pct numeric,
  vencidas integer,
  sin_actividad_programada integer,
  pipeline_bruto numeric,
  pipeline_ponderado numeric,
  tc_fecha date,
  tc_estimado boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH h AS (SELECT * FROM public.crm_higiene_oportunidades()),
  tc AS (SELECT * FROM public.tc_dof_vigente(CURRENT_DATE)),
  m AS (
    SELECT
      h.*,
      CASE upper(COALESCE(h.moneda, 'MXN'))
        WHEN 'MXN' THEN COALESCE(h.monto_estimado, 0)
        WHEN 'USD' THEN COALESCE(h.monto_estimado, 0) * (SELECT usd_mxn FROM tc)
        WHEN 'EUR' THEN COALESCE(h.monto_estimado, 0) * (SELECT eur_mxn FROM tc)
        ELSE NULL
      END AS monto_mxn
    FROM h
  )
  SELECT COUNT(*)::int,
         COUNT(*) FILTER (WHERE registro_completo)::int,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(COUNT(*) FILTER (WHERE registro_completo)::numeric / COUNT(*), 4) END,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(COUNT(*) FILTER (WHERE NOT actividad_vencida)::numeric / COUNT(*), 4) END,
         COUNT(*) FILTER (WHERE estado_higiene = 'vencida')::int,
         COUNT(*) FILTER (WHERE proxima_actividad_at IS NULL)::int,
         ROUND(COALESCE(SUM(monto_mxn), 0), 2),
         ROUND(COALESCE(SUM(monto_mxn * COALESCE(probabilidad, 0) / 100.0), 0), 2),
         (SELECT fecha FROM tc),
         -- Estimado cuando hay montos en moneda extranjera que no se pudieron
         -- convertir (sin TC DOF publicado o moneda no soportada).
         EXISTS (
           SELECT 1 FROM m
           WHERE m.monto_mxn IS NULL
             AND COALESCE(m.monto_estimado, 0) <> 0
         )
    FROM m;
$$;

REVOKE ALL ON FUNCTION public.crm_higiene_pipeline() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_higiene_pipeline() TO authenticated, service_role;