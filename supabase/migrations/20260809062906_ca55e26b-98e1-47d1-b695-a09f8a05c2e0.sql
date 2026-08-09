-- Ola 4 · A13: rol efectivo por organización (precedencia organización → global).
CREATE OR REPLACE FUNCTION public.rol_efectivo(_user_id uuid, _org uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT om.role FROM public.organization_members om
      WHERE om.user_id = _user_id AND om.organization_id = _org
      LIMIT 1),
    (SELECT ur.role FROM public.user_roles ur
      WHERE ur.user_id = _user_id
      ORDER BY ur.role LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION public.rol_efectivo(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rol_efectivo(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rol_efectivo(uuid, uuid) TO service_role;

-- Estrictamente restrictivo: exige el rol global (comportamiento actual) Y, si
-- existe membresía en la organización activa, que ese rol de organización
-- también satisfaga los roles pedidos. Una democión a nivel organización
-- revoca la escritura de inmediato.
CREATE OR REPLACE FUNCTION public.has_any_role_efectivo(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, _roles)
     AND (
       NOT EXISTS (
         SELECT 1 FROM public.organization_members om
          WHERE om.user_id = _user_id
            AND om.organization_id = public.current_user_org_id()
       )
       OR EXISTS (
         SELECT 1 FROM public.organization_members om
          WHERE om.user_id = _user_id
            AND om.organization_id = public.current_user_org_id()
            AND om.role = ANY (
              SELECT DISTINCT e
              FROM unnest(_roles) AS r, unnest(public.roles_jerarquia(r)) AS e
            )
       )
     );
$$;

REVOKE ALL ON FUNCTION public.has_any_role_efectivo(uuid, app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_any_role_efectivo(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role_efectivo(uuid, app_role[]) TO service_role;

-- Reescribe las políticas de escritura que usan has_any_role para usar el rol efectivo.
DO $do$
DECLARE
  r record;
  v_qual text;
  v_check text;
  v_sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND cmd <> 'SELECT'
       AND (COALESCE(qual,'') || COALESCE(with_check,'')) LIKE '%has_any_role(%'
  LOOP
    v_qual := replace(COALESCE(r.qual,''), 'has_any_role(', 'has_any_role_efectivo(');
    v_check := replace(COALESCE(r.with_check,''), 'has_any_role(', 'has_any_role_efectivo(');

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    v_sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      r.policyname, r.schemaname, r.tablename,
      CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      r.cmd,
      array_to_string(r.roles, ', '));
    IF r.qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_qual);
    END IF;
    IF r.with_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_sql;
  END LOOP;
END
$do$;