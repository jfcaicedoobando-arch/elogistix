CREATE OR REPLACE FUNCTION public._rfc_valido(p_rfc text, p_permitir_generico boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v text := upper(btrim(COALESCE(p_rfc, '')));
BEGIN
  IF v = '' THEN
    RETURN false;
  END IF;
  IF NOT p_permitir_generico AND v IN ('XAXX010101000', 'XEXX010101000') THEN
    RETURN false;
  END IF;
  RETURN v ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$';
END;
$function$;

REVOKE ALL ON FUNCTION public._rfc_valido(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._rfc_valido(text, boolean) TO authenticated, service_role;

-- 2) Receptor fiscalmente completo (CFDI 4.0).
