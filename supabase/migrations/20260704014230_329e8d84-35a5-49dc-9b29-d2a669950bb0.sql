
-- Enum reutilizable para el ambiente de timbrado por documento.
DO $$ BEGIN
  CREATE TYPE public.ambiente_facturapi AS ENUM ('sandbox', 'live');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.facturas              ADD COLUMN IF NOT EXISTS ambiente public.ambiente_facturapi;
ALTER TABLE public.factura_notas_credito ADD COLUMN IF NOT EXISTS ambiente public.ambiente_facturapi;
ALTER TABLE public.pagos_factura         ADD COLUMN IF NOT EXISTS ambiente public.ambiente_facturapi;

-- Backfill: todos los documentos ya timbrados históricamente se emitieron en sandbox.
UPDATE public.facturas               SET ambiente = 'sandbox' WHERE facturapi_id     IS NOT NULL AND ambiente IS NULL;
UPDATE public.factura_notas_credito  SET ambiente = 'sandbox' WHERE facturapi_id     IS NOT NULL AND ambiente IS NULL;
UPDATE public.pagos_factura          SET ambiente = 'sandbox' WHERE facturapi_rep_id IS NOT NULL AND ambiente IS NULL;

-- Extender el RPC de listado para incluir el ambiente.
DROP FUNCTION IF EXISTS public.facturas_listado(uuid, text, text, date, date, integer, integer);

CREATE OR REPLACE FUNCTION public.facturas_listado(
  p_organization_id uuid DEFAULT NULL::uuid,
  p_search          text DEFAULT NULL::text,
  p_estado          text DEFAULT NULL::text,
  p_fecha_desde     date DEFAULT NULL::date,
  p_fecha_hasta     date DEFAULT NULL::date,
  p_offset          integer DEFAULT 0,
  p_limit           integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, numero text, cliente_nombre text, expediente text,
  total numeric, moneda public.moneda, fecha_emision date,
  fecha_vencimiento date, estado public.estado_factura,
  proforma_id uuid, proforma_numero text,
  factura_pdf_url text, factura_xml_url text,
  ambiente public.ambiente_facturapi,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT f.*
    FROM facturas f
    WHERE ( p_organization_id IS NULL OR f.organization_id = p_organization_id )
      AND ( p_search IS NULL OR p_search = '' OR
            f.numero ILIKE '%' || p_search || '%' OR
            f.cliente_nombre ILIKE '%' || p_search || '%' OR
            f.expediente ILIKE '%' || p_search || '%' )
      AND ( p_estado IS NULL OR f.estado = p_estado::estado_factura )
      AND ( p_fecha_desde IS NULL OR f.fecha_emision >= p_fecha_desde )
      AND ( p_fecha_hasta IS NULL OR f.fecha_emision <= p_fecha_hasta )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_count
    FROM filtered f
    ORDER BY f.created_at DESC
    OFFSET p_offset LIMIT p_limit
  )
  SELECT c.id, c.numero, c.cliente_nombre, c.expediente, c.total, c.moneda,
         c.fecha_emision, c.fecha_vencimiento, c.estado, c.proforma_id,
         p.numero AS proforma_numero,
         c.factura_pdf_url, c.factura_xml_url,
         c.ambiente,
         c.total_count
  FROM counted c
  LEFT JOIN proformas p ON p.id = c.proforma_id
  ORDER BY c.fecha_emision DESC NULLS LAST;
$function$;
