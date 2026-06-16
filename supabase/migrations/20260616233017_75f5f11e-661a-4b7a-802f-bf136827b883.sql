
-- Onboarding inicial: capturar datos de la agencia tras el registro
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS moneda_preferida text NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS onboarding_completado boolean NOT NULL DEFAULT false;

-- Las organizaciones ya existentes (creadas antes del onboarding) se marcan como completadas
UPDATE public.organizations SET onboarding_completado = true WHERE created_at < now();

-- Constraint suave para monedas soportadas
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_moneda_preferida_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_moneda_preferida_check
  CHECK (moneda_preferida IN ('MXN','USD','EUR'));

-- Recrear get_user_context para exponer los nuevos campos al cliente
CREATE OR REPLACE FUNCTION public.get_user_context()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'role', (
      SELECT role::text FROM public.user_roles
      WHERE user_id = auth.uid()
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 1 WHEN 'admin_org' THEN 2 WHEN 'admin' THEN 3
        WHEN 'gerente_operaciones' THEN 4 WHEN 'contador' THEN 5 WHEN 'tesorero' THEN 6
        WHEN 'ejecutivo_pricing' THEN 7 WHEN 'coordinador_logistico' THEN 8
        WHEN 'operador' THEN 9 WHEN 'vendedor' THEN 10 WHEN 'customer_service' THEN 11
        WHEN 'viewer' THEN 12 WHEN 'cliente' THEN 13 ELSE 99
      END LIMIT 1
    ),
    'orgRole', (
      SELECT role::text FROM public.organization_members
      WHERE user_id = auth.uid()
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 1 WHEN 'admin_org' THEN 2 WHEN 'admin' THEN 3
        WHEN 'gerente_operaciones' THEN 4 WHEN 'contador' THEN 5 WHEN 'tesorero' THEN 6
        WHEN 'ejecutivo_pricing' THEN 7 WHEN 'coordinador_logistico' THEN 8
        WHEN 'operador' THEN 9 WHEN 'vendedor' THEN 10 WHEN 'customer_service' THEN 11
        WHEN 'viewer' THEN 12 WHEN 'cliente' THEN 13 ELSE 99
      END LIMIT 1
    ),
    'organizationId', (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1),
    'organization', (
      SELECT jsonb_build_object(
        'id', o.id, 'nombre', o.nombre, 'logo_url', o.logo_url, 'plan', o.plan,
        'rfc', o.rfc, 'activo', o.activo,
        'direccion', o.direccion,
        'moneda_preferida', o.moneda_preferida,
        'onboarding_completado', o.onboarding_completado
      )
      FROM public.organizations o
      WHERE o.id = (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1)
    )
  );
$function$;

-- RPC dedicado para completar el onboarding desde el cliente con validación server-side
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  _rfc text,
  _direccion text,
  _moneda text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org_id uuid;
  _rfc_clean text := upper(btrim(coalesce(_rfc, '')));
  _dir_clean text := btrim(coalesce(_direccion, ''));
  _mon_clean text := upper(btrim(coalesce(_moneda, 'MXN')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF length(_rfc_clean) < 12 OR length(_rfc_clean) > 13 THEN
    RAISE EXCEPTION 'RFC inválido (debe tener 12 o 13 caracteres)';
  END IF;
  IF length(_dir_clean) < 5 OR length(_dir_clean) > 500 THEN
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
  SET rfc = _rfc_clean,
      direccion = _dir_clean,
      moneda_preferida = _mon_clean,
      onboarding_completado = true,
      updated_at = now()
  WHERE id = _org_id;

  RETURN jsonb_build_object('ok', true, 'organization_id', _org_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text, text) TO authenticated;
