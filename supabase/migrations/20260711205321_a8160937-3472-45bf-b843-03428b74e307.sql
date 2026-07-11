CREATE OR REPLACE FUNCTION public.complete_onboarding(_rfc text, _direccion text, _moneda text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _org_id uuid;
  _rfc_clean text := upper(btrim(coalesce(_rfc, '')));
  _dir_clean text := btrim(coalesce(_direccion, ''));
  _mon_clean text := upper(btrim(coalesce(_moneda, 'MXN')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- RFC opcional; si viene, validar longitud
  IF _rfc_clean <> '' AND (length(_rfc_clean) < 12 OR length(_rfc_clean) > 13) THEN
    RAISE EXCEPTION 'RFC inválido (debe tener 12 o 13 caracteres)';
  END IF;

  -- Dirección opcional; si viene, validar longitud
  IF _dir_clean <> '' AND (length(_dir_clean) < 5 OR length(_dir_clean) > 500) THEN
    RAISE EXCEPTION 'Dirección inválida (5 a 500 caracteres)';
  END IF;

  IF _mon_clean NOT IN ('MXN','USD','EUR') THEN
    RAISE EXCEPTION 'Moneda no soportada';
  END IF;

  SELECT organization_id INTO _org_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND role IN ('admin','admin_org','super_admin')
  LIMIT 1;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'No tienes una organización administrable';
  END IF;

  UPDATE public.organizations
  SET rfc = NULLIF(_rfc_clean, ''),
      direccion = NULLIF(_dir_clean, ''),
      moneda_preferida = _mon_clean,
      onboarding_completado = true,
      updated_at = now()
  WHERE id = _org_id;

  RETURN jsonb_build_object('ok', true, 'organization_id', _org_id);
END;
$function$;