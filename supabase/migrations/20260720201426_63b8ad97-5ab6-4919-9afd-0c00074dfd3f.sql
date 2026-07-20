-- v13.303.0 · Ajuste: `siguiente_folio_cotizacion` sin parámetro
-- Deriva la org del `current_user_org_id()`; el cliente no la conoce.
CREATE OR REPLACE FUNCTION public.siguiente_folio_cotizacion()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.current_user_org_id();
  v_num bigint;
  v_anio text := to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYY');
  v_tipo text := 'cotizacion_' || v_anio;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_NO_RESUELTA: no se pudo determinar la organización';
  END IF;
  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
  VALUES (v_org, v_tipo, 1)
  ON CONFLICT (organization_id, tipo)
  DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_num;
  RETURN 'COT-' || v_anio || '-' || lpad(v_num::text, 4, '0');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.siguiente_folio_cotizacion() TO authenticated;

-- Drop la versión con parámetro (evita ambigüedad y confusión al llamar).
DROP FUNCTION IF EXISTS public.siguiente_folio_cotizacion(uuid);