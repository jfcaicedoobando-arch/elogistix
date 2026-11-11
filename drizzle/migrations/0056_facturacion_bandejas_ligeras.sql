CREATE OR REPLACE VIEW public.v_reps_historico
WITH (security_invoker = true) AS
SELECT p.id, p.organization_id, p.factura_id, p.fecha_pago, p.monto, p.moneda,
       p.uuid_rep, p.timbrado_rep_en, p.rep_cancellation_status,
       coalesce(f.numero, '—') AS factura_numero,
       coalesce(f.cliente_nombre, '—') AS cliente_nombre,
       rep.folio_rep,
       concat_ws(' ', rep.folio_rep, f.numero, f.cliente_nombre, p.uuid_rep) AS busqueda,
       CASE lower(p.rep_cancellation_status)
         WHEN 'accepted' THEN 'Cancelado'
         WHEN 'pending' THEN 'En cancelación'
         WHEN 'verifying' THEN 'En cancelación'
         ELSE 'Timbrado'
       END AS estado_visible
FROM public.pagos_factura p
JOIN public.facturas f ON f.id = p.factura_id AND f.organization_id = p.organization_id
CROSS JOIN LATERAL (
  SELECT coalesce(nullif(concat_ws('-', nullif(p.serie_rep, ''), p.folio_rep), ''), '—') AS folio_rep
) rep
WHERE p.estado_rep = 'Timbrado' AND p.deleted_at IS NULL;

REVOKE ALL ON public.v_reps_historico FROM PUBLIC, anon;
GRANT SELECT ON public.v_reps_historico TO authenticated, service_role;

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

REVOKE EXECUTE ON FUNCTION public.hueco_facturacion_count(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hueco_facturacion_count(uuid, date) TO authenticated, service_role;
