-- Helper: validar rol dentro de una organización
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
  )
$$;

-- Reemplazar políticas de auditoria_revisiones para que respeten el rol por organización
DROP POLICY IF EXISTS "Tenant CRUD auditoria_revisiones" ON public.auditoria_revisiones;
DROP POLICY IF EXISTS "Tenant viewer auditoria_revisiones" ON public.auditoria_revisiones;

-- Lectura: cualquier miembro de la organización (o super_admin)
CREATE POLICY "Tenant read auditoria_revisiones"
ON public.auditoria_revisiones
FOR SELECT
TO authenticated
USING (
  organization_id = current_user_org_id()
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Escritura (insert/update/delete): admin u operador de la organización, o super_admin
CREATE POLICY "Tenant write auditoria_revisiones"
ON public.auditoria_revisiones
FOR ALL
TO authenticated
USING (
  (
    organization_id = current_user_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'operador'::app_role)
    )
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (
    organization_id = current_user_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'operador'::app_role)
    )
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);