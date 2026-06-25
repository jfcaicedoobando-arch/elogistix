-- Adelantar consecutivo de proformas: soportar piso (floor) por org/año vía tabla configuracion.
CREATE OR REPLACE FUNCTION public.generar_numero_proforma(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_prefix text := 'PRO-' || v_year::text || '-';
  v_max int;
  v_floor int;
  v_next int;
BEGIN
  IF p_org_id IS NULL
     OR (p_org_id <> current_user_org_id()
         AND NOT has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden: organization mismatch';
  END IF;

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(numero, '^PRO-\d{4}-', ''), '')::int
  ), 0)
  INTO v_max
  FROM public.proformas
  WHERE organization_id = p_org_id
    AND numero LIKE v_prefix || '%';

  -- Piso opcional para adelantar el consecutivo (categoria='folios', clave='proforma_floor_<YEAR>')
  SELECT COALESCE((valor #>> '{}')::int, 0)
  INTO v_floor
  FROM public.configuracion
  WHERE organization_id = p_org_id
    AND categoria = 'folios'
    AND clave = 'proforma_floor_' || v_year::text
  LIMIT 1;

  v_next := GREATEST(v_max, COALESCE(v_floor, 0)) + 1;

  RETURN v_prefix || lpad(v_next::text, 4, '0');
END;
$function$;

-- Establece el piso 947 para 2026 en la org principal para que la próxima sea PRO-2026-0948.
INSERT INTO public.configuracion (organization_id, categoria, clave, valor, descripcion)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'folios',
  'proforma_floor_2026',
  to_jsonb(947),
  'Piso del consecutivo de proformas para 2026 (la siguiente será floor+1).'
)
ON CONFLICT DO NOTHING;