CREATE OR REPLACE FUNCTION public.sidebar_alert_counts()
RETURNS TABLE(embarques_demora bigint, facturas_vencidas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM embarques e
     WHERE e.eta IS NOT NULL
       AND (current_date - e.eta) >= 7
       AND CASE
         WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Cerrado') THEN e.estado::text
         WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación'
              AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
           CASE
             WHEN current_date < e.etd THEN 'Confirmado'
             WHEN current_date >= e.etd AND current_date < e.eta THEN 'En Tránsito'
             WHEN current_date >= e.eta THEN 'Arribo'
             ELSE e.estado::text
           END
         ELSE e.estado::text
       END = 'Arribo'
       AND (e.organization_id = current_user_org_id()
            OR has_role(auth.uid(), 'super_admin'))
    ) AS embarques_demora,
    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'
       AND (f.organization_id = current_user_org_id()
            OR has_role(auth.uid(), 'super_admin'))
    ) AS facturas_vencidas;
$$;