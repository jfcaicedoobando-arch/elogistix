
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.cotizaciones WHERE estado::text = 'Confirmada';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Hay % cotización(es) con estado Confirmada. Aborto.', v_count;
  END IF;
END $$;

DROP POLICY IF EXISTS "Cliente read own cotizaciones" ON public.cotizaciones;
DROP TRIGGER IF EXISTS trg_cotizacion_acepta_oportunidad ON public.cotizaciones;
DROP TRIGGER IF EXISTS trg_cotizacion_cierra_oportunidad ON public.cotizaciones;
DROP FUNCTION IF EXISTS public.cotizaciones_listado(uuid,text,text,text,uuid,date,date,integer,integer);

CREATE TYPE public.estado_cotizacion_new AS ENUM (
  'Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Vencida', 'En operación'
);

ALTER TABLE public.cotizaciones ALTER COLUMN estado DROP DEFAULT;

ALTER TABLE public.cotizaciones
  ALTER COLUMN estado TYPE public.estado_cotizacion_new
  USING estado::text::public.estado_cotizacion_new;

DROP TYPE public.estado_cotizacion;
ALTER TYPE public.estado_cotizacion_new RENAME TO estado_cotizacion;

ALTER TABLE public.cotizaciones
  ALTER COLUMN estado SET DEFAULT 'Borrador'::public.estado_cotizacion;

-- Recrear triggers
CREATE TRIGGER trg_cotizacion_acepta_oportunidad
  AFTER INSERT OR UPDATE OF estado ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.crm_marcar_oportunidad_ganada();

CREATE TRIGGER trg_cotizacion_cierra_oportunidad
  AFTER INSERT OR UPDATE OF estado, embarque_id ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.crm_cierra_oportunidad_desde_cotizacion();

-- Recrear policy
CREATE POLICY "Cliente read own cotizaciones"
  ON public.cotizaciones
  FOR SELECT
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND (cliente_id IN (SELECT current_user_client_ids()))
    AND (estado = ANY (ARRAY[
      'Enviada'::estado_cotizacion,
      'Aceptada'::estado_cotizacion,
      'Rechazada'::estado_cotizacion,
      'En operación'::estado_cotizacion
    ]))
  );

-- Recrear función cotizaciones_listado idéntica
CREATE OR REPLACE FUNCTION public.cotizaciones_listado(
  p_organization_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_estado text DEFAULT NULL::text,
  p_modo text DEFAULT NULL::text,
  p_cliente_id uuid DEFAULT NULL::uuid,
  p_fecha_desde date DEFAULT NULL::date,
  p_fecha_hasta date DEFAULT NULL::date,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, folio text, cliente_id uuid, cliente_nombre text,
  modo modo_transporte, origen text, destino text, subtotal numeric,
  moneda moneda, estado estado_cotizacion, fecha_vigencia date,
  created_at timestamp with time zone, descripcion_mercancia text,
  embarques_vinculados bigint, total_count bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT c.*
    FROM cotizaciones c
    WHERE c.deleted_at IS NULL
      AND ( p_organization_id IS NULL OR c.organization_id = p_organization_id )
      AND ( p_search IS NULL OR p_search = '' OR
            c.folio ILIKE '%' || p_search || '%' OR
            c.cliente_nombre ILIKE '%' || p_search || '%' OR
            c.descripcion_mercancia ILIKE '%' || p_search || '%' )
      AND ( p_estado IS NULL OR c.estado = p_estado::estado_cotizacion )
      AND ( p_modo IS NULL OR c.modo = p_modo::modo_transporte )
      AND ( p_cliente_id IS NULL OR c.cliente_id = p_cliente_id )
      AND ( p_fecha_desde IS NULL OR c.created_at >= p_fecha_desde )
      AND ( p_fecha_hasta IS NULL OR c.created_at <= (p_fecha_hasta + interval '1 day') )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_count
    FROM filtered f
    ORDER BY f.created_at DESC
    OFFSET p_offset LIMIT p_limit
  ),
  emb_agg AS (
    SELECT e.cotizacion_id, count(*)::bigint AS embarques_vinculados
    FROM embarques e
    WHERE e.cotizacion_id IN (SELECT id FROM counted)
    GROUP BY e.cotizacion_id
  )
  SELECT c.id, c.folio, c.cliente_id, c.cliente_nombre, c.modo, c.origen, c.destino,
         c.subtotal, c.moneda, c.estado, c.fecha_vigencia, c.created_at, c.descripcion_mercancia,
         COALESCE(ea.embarques_vinculados, 0),
         c.total_count
  FROM counted c
  LEFT JOIN emb_agg ea ON ea.cotizacion_id = c.id
  ORDER BY c.created_at DESC;
$function$;
