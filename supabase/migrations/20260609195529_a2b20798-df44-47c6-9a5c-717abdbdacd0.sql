-- Backfill: migrate legacy roles to modern equivalents.
UPDATE public.user_roles SET role = 'admin_org' WHERE role = 'admin';
UPDATE public.user_roles SET role = 'coordinador_logistico' WHERE role = 'operador';
UPDATE public.user_roles SET role = 'customer_service' WHERE role = 'viewer';

UPDATE public.organization_members SET role = 'admin_org' WHERE role = 'admin';
UPDATE public.organization_members SET role = 'coordinador_logistico' WHERE role = 'operador';
UPDATE public.organization_members SET role = 'customer_service' WHERE role = 'viewer';

-- Helper SECURITY DEFINER functions for permission area checks.
CREATE OR REPLACE FUNCTION public.can_admin_tenant(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin_org','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_finance(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin_org','admin','contador','tesorero')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_operations(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin_org','admin','gerente_operaciones','coordinador_logistico','operador','ejecutivo_pricing')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin_org','admin','vendedor','ejecutivo_pricing')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_financials(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin_org','admin','gerente_operaciones','contador','tesorero','ejecutivo_pricing')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_admin_tenant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_finance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_operations(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_sales(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_financials(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_admin_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_finance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_operations(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_sales(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_financials(uuid) TO authenticated, service_role;