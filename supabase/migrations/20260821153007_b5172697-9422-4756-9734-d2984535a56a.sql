-- =============================================================================
-- Ola 8 · Estructural: has_role_in_org / has_any_role_in_org
-- =============================================================================
-- Cura definitiva de la clase de bugs cross-tenant de la Ola 1
-- (reabrir_embarque_con_motivo, revertir_proforma…): el rol debe verificarse
-- contra la membresía de LA organización del documento, no contra el rol
-- global en user_roles (que hoy es sólo un espejo de la membresía y no dice
-- a qué organización pertenece el privilegio).
--
-- Semántica:
--   - El rol operativo se lee de public.organization_members (user_id, org).
--   - Se expande con roles_jerarquia (misma jerarquía canónica que has_role).
--   - super_admin es rol de PLATAFORMA: vive en user_roles y está prohibido
--     en organization_members (_bloquear_rol_plataforma_om), así que conserva
--     su bypass global vía has_role.
--   - uid NULL (anon) → false.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_any_role_in_org(_user_id uuid, _roles app_role[], _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND _org IS NOT NULL
     AND (
       public.has_role(_user_id, 'super_admin'::app_role)
       OR EXISTS (
         SELECT 1
           FROM public.organization_members om
          WHERE om.user_id = _user_id
            AND om.organization_id = _org
            AND om.role = ANY (
              SELECT DISTINCT e
                FROM unnest(_roles) AS r,
                     unnest(public.roles_jerarquia(r)) AS e
            )
       )
     )
$$;

REVOKE ALL ON FUNCTION public.has_any_role_in_org(uuid, app_role[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role_in_org(uuid, app_role[], uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id uuid, _role app_role, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role_in_org(_user_id, ARRAY[_role], _org)
$$;

REVOKE ALL ON FUNCTION public.has_role_in_org(uuid, app_role, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role_in_org(uuid, app_role, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.has_role_in_org(uuid, app_role, uuid) IS
  'Ola 8: autorización por organización. TRUE si la membresía del usuario en _org satisface _role (jerarquía canónica) o si es super_admin de plataforma. Preferir sobre has_role global en RPCs nuevas.';