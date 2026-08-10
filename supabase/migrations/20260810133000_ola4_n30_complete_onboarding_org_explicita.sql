-- Ola 4 · N30: complete_onboarding elegía la org con LIMIT 1 sin ORDER BY →
-- un admin multi-org escribía RFC/dirección/moneda y onboarding_completado en
-- la org equivocada. Nueva firma con _organization_id explícito + validación
-- de membresía admin. Base: 20260711205321 (íntegra).
DROP FUNCTION IF EXISTS public.complete_onboarding(text, text, text);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  _organization_id uuid, _rfc text, _direccion text, _moneda text
)
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

  IF _rfc_clean <> '' AND (length(_rfc_clean) < 12 OR length(_rfc_clean) > 13) THEN
    RAISE EXCEPTION 'RFC inválido (debe tener 12 o 13 caracteres)';
  END IF;

  IF _dir_clean <> '' AND (length(_dir_clean) < 5 OR length(_dir_clean) > 500) THEN
    RAISE EXCEPTION 'Dirección inválida (5 a 500 caracteres)';
  END IF;

  IF _mon_clean NOT IN ('MXN','USD','EUR') THEN
    RAISE EXCEPTION 'Moneda no soportada';
  END IF;

  -- Ola 4 · N30: org explícita + membresía admin validada (antes: LIMIT 1
  -- arbitrario entre TODAS las membresías admin del usuario).
  IF _organization_id IS NULL THEN
    RAISE EXCEPTION 'LC_ONBOARDING_ORG_REQUERIDA: organización requerida'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members om
       WHERE om.user_id = auth.uid()
         AND om.organization_id = _organization_id
         AND om.role IN ('admin','admin_org','super_admin')
     ) THEN
    RAISE EXCEPTION 'LC_ONBOARDING_ORG_AJENA: no administras esa organización'
      USING ERRCODE = '42501';
  END IF;

  _org_id := _organization_id;

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

REVOKE ALL ON FUNCTION public.complete_onboarding(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(uuid, text, text, text) TO authenticated, service_role;
