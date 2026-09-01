CREATE OR REPLACE FUNCTION public.sidebar_alert_counts()
 RETURNS TABLE(embarques_demora bigint, facturas_vencidas bigint, garantias_atoradas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT count(*) FROM embarques e
     WHERE e.eta IS NOT NULL
       AND e.deleted_at IS NULL
       AND (current_date - e.eta) >= 7
       AND CASE
         WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado') THEN e.estado::text
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
       AND e.organization_id = public.org_scope()
    ) AS embarques_demora,
    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'
       AND f.deleted_at IS NULL
       AND f.organization_id = public.org_scope()
    ) AS facturas_vencidas,
    (SELECT count(*) FROM embarque_garantias_contenedor g
     JOIN embarques e ON e.id = g.embarque_id
     WHERE g.estado = 'depositado'
       AND g.deleted_at IS NULL
       AND e.deleted_at IS NULL
       AND g.fecha_deposito IS NOT NULL
       AND (current_date - g.fecha_deposito) > 30
       AND e.organization_id = public.org_scope()
    ) AS garantias_atoradas;
$function$;