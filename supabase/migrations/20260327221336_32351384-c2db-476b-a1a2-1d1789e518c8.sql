
-- 1. RPC: sidebar_alert_counts — lightweight counts for sidebar badge
CREATE OR REPLACE FUNCTION public.sidebar_alert_counts()
RETURNS TABLE(embarques_demora bigint, facturas_vencidas bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM embarques e
     WHERE e.estado = 'Arribo'
       AND e.eta IS NOT NULL
       AND (current_date - e.eta) >= 7
       AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    ) AS embarques_demora,
    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'
       AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    ) AS facturas_vencidas;
$$;

-- 2. RPC: embarques_list_extras — liquidation + docs counts in one call
CREATE OR REPLACE FUNCTION public.embarques_list_extras(p_ids uuid[])
RETURNS TABLE(embarque_id uuid, costos_total bigint, costos_pagados bigint, docs_total bigint, docs_pendientes bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    e.id AS embarque_id,
    COALESCE(cc.total, 0) AS costos_total,
    COALESCE(cc.pagados, 0) AS costos_pagados,
    COALESCE(dd.total, 0) AS docs_total,
    COALESCE(dd.pendientes, 0) AS docs_pendientes
  FROM unnest(p_ids) AS e(id)
  LEFT JOIN (
    SELECT c.embarque_id,
      count(*) AS total,
      count(*) FILTER (WHERE c.estado_liquidacion = 'Pagado') AS pagados
    FROM conceptos_costo c WHERE c.embarque_id = ANY(p_ids)
    GROUP BY c.embarque_id
  ) cc ON cc.embarque_id = e.id
  LEFT JOIN (
    SELECT d.embarque_id,
      count(*) AS total,
      count(*) FILTER (WHERE d.estado NOT IN ('Recibido', 'Validado')) AS pendientes
    FROM documentos_embarque d WHERE d.embarque_id = ANY(p_ids)
    GROUP BY d.embarque_id
  ) dd ON dd.embarque_id = e.id;
$$;
