CREATE OR REPLACE FUNCTION public.hueco_facturacion_count(
  p_organization_id uuid DEFAULT NULL,
  p_limite_eta date DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH alcance AS MATERIALIZED (
    SELECT public.org_requerida(p_organization_id) AS org_id,
           coalesce(p_limite_eta, public.fecha_negocio_mx() + 3) AS limite_eta,
           ARRAY['Emitida', 'Pagada', 'Vencida', 'Parcialmente pagada']::public.estado_factura[] AS estados_vivos
  )
  SELECT count(*)
  FROM alcance a
  JOIN public.embarques e ON e.organization_id = a.org_id
  CROSS JOIN LATERAL (
    SELECT coalesce(bool_or(c.estado_facturacion = 'pendiente'), false) AS tiene_pendiente,
           count(*) > 0 AND bool_and(coalesce(
             c.estado_facturacion = 'facturado' OR
             (c.estado_facturacion = 'en_proforma' AND p.estado_proforma = 'facturada'), false
           )) AS cubierta
    FROM public.conceptos_venta c
    LEFT JOIN public.proformas p ON p.id = c.proforma_id AND p.deleted_at IS NULL
    WHERE c.embarque_id = e.id AND c.deleted_at IS NULL
  ) v
  WHERE e.deleted_at IS NULL
    AND e.eta BETWEEN DATE '2026-04-01' AND a.limite_eta
    AND e.facturado_historico = false
    AND (
      v.tiene_pendiente OR (
        NOT v.cubierta
        AND NOT EXISTS (
          SELECT 1 FROM public.factura_embarques fe
          JOIN public.facturas f ON f.id = fe.factura_id
          WHERE fe.organization_id = a.org_id AND fe.embarque_id = e.id
            AND fe.activa AND f.estado = ANY(a.estados_vivos)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.facturas f
          WHERE f.organization_id = a.org_id AND f.expediente = e.expediente
            AND f.estado = ANY(a.estados_vivos) AND f.factura_pdf_url IS NOT NULL
            AND f.deleted_at IS NULL
        )
      )
    );
$function$;
