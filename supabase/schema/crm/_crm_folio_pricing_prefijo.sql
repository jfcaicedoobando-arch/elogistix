CREATE OR REPLACE FUNCTION public._crm_folio_pricing_prefijo(p_ts timestamptz) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (ARRAY['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'])
           [extract(month FROM p_ts AT TIME ZONE 'America/Mexico_City')::int]
         || to_char(p_ts AT TIME ZONE 'America/Mexico_City', 'YY')
$$;

REVOKE ALL ON FUNCTION public._crm_folio_pricing_prefijo(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._crm_folio_pricing_prefijo(timestamptz) TO authenticated, service_role;
