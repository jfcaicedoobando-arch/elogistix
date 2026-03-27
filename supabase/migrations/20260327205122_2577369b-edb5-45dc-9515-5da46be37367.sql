
-- 1. Create security definer functions to avoid RLS recursion on organization_members

-- Function: get user's org IDs (avoids recursion)
CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id;
$$;

-- Function: check if user is admin of a specific org
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = 'admin'
  );
$$;

-- 2. Fix organization_members RLS (drop recursive policies, recreate with functions)

DROP POLICY IF EXISTS "Org admins manage own org members" ON public.organization_members;
DROP POLICY IF EXISTS "Super admins manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Users read own memberships" ON public.organization_members;

-- Users can read their own memberships
CREATE POLICY "Users read own memberships"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'super_admin'));

-- Org admins can manage members of their own org (no recursion)
CREATE POLICY "Org admins manage own org members"
  ON public.organization_members FOR ALL
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- Super admins can manage all members
CREATE POLICY "Super admins manage members"
  ON public.organization_members FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- 3. Fix organizations RLS (drop recursive policy, recreate with function)

DROP POLICY IF EXISTS "Members can read own org" ON public.organizations;

CREATE POLICY "Members can read own org"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_user_org_ids(auth.uid())) OR has_role(auth.uid(), 'super_admin'));

-- 4. Make bitacora_actividad.organization_id nullable for super_admin actions
ALTER TABLE public.bitacora_actividad ALTER COLUMN organization_id DROP NOT NULL;
