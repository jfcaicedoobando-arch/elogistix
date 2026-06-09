-- (a) Deduplicar user_roles conservando el rol más privilegiado por usuario.
WITH ranked AS (
  SELECT id, user_id, role,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 1
        WHEN 'admin_org' THEN 2
        WHEN 'admin' THEN 3
        WHEN 'gerente_operaciones' THEN 4
        WHEN 'contador' THEN 5
        WHEN 'tesorero' THEN 6
        WHEN 'ejecutivo_pricing' THEN 7
        WHEN 'coordinador_logistico' THEN 8
        WHEN 'operador' THEN 9
        WHEN 'vendedor' THEN 10
        WHEN 'customer_service' THEN 11
        WHEN 'viewer' THEN 12
        WHEN 'cliente' THEN 13
        ELSE 99
      END
    ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked r
WHERE ur.id = r.id AND r.rn > 1;

-- (b) Garantizar un único rol por usuario hacia adelante.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- (c) Reescribir get_user_context para ordenar por prioridad (defensa en profundidad).
CREATE OR REPLACE FUNCTION public.get_user_context()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'role', (
      SELECT role::text FROM public.user_roles
      WHERE user_id = auth.uid()
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 1
        WHEN 'admin_org' THEN 2
        WHEN 'admin' THEN 3
        WHEN 'gerente_operaciones' THEN 4
        WHEN 'contador' THEN 5
        WHEN 'tesorero' THEN 6
        WHEN 'ejecutivo_pricing' THEN 7
        WHEN 'coordinador_logistico' THEN 8
        WHEN 'operador' THEN 9
        WHEN 'vendedor' THEN 10
        WHEN 'customer_service' THEN 11
        WHEN 'viewer' THEN 12
        WHEN 'cliente' THEN 13
        ELSE 99
      END
      LIMIT 1
    ),
    'orgRole', (
      SELECT role::text FROM public.organization_members
      WHERE user_id = auth.uid()
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 1
        WHEN 'admin_org' THEN 2
        WHEN 'admin' THEN 3
        WHEN 'gerente_operaciones' THEN 4
        WHEN 'contador' THEN 5
        WHEN 'tesorero' THEN 6
        WHEN 'ejecutivo_pricing' THEN 7
        WHEN 'coordinador_logistico' THEN 8
        WHEN 'operador' THEN 9
        WHEN 'vendedor' THEN 10
        WHEN 'customer_service' THEN 11
        WHEN 'viewer' THEN 12
        WHEN 'cliente' THEN 13
        ELSE 99
      END
      LIMIT 1
    ),
    'organizationId', (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1),
    'organization', (
      SELECT jsonb_build_object('id', o.id, 'nombre', o.nombre, 'logo_url', o.logo_url, 'plan', o.plan, 'rfc', o.rfc, 'activo', o.activo)
      FROM public.organizations o
      WHERE o.id = (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1)
    )
  );
$$;