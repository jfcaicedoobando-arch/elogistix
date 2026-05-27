
-- 1) auditoria_snapshots: restringir SELECT a staff (admin/operador/super_admin)
DROP POLICY IF EXISTS "Tenant read auditoria_snapshots" ON public.auditoria_snapshots;
CREATE POLICY "Staff read auditoria_snapshots"
  ON public.auditoria_snapshots
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      organization_id = current_user_org_id()
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'operador'::app_role)
      )
    )
  );

-- 2) bitacora_actividad: scopear admin global por organización
DROP POLICY IF EXISTS "Tenant admin bitacora" ON public.bitacora_actividad;
CREATE POLICY "Org admin bitacora"
  ON public.bitacora_actividad
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      organization_id = current_user_org_id()
      AND (
        is_org_admin(auth.uid(), organization_id)
        OR has_role(auth.uid(), 'admin'::app_role)
      )
    )
  );

-- 3) tracking_intentos: restringir SELECT/INSERT a staff de la org
DROP POLICY IF EXISTS "Tenant read tracking_intentos" ON public.tracking_intentos;
DROP POLICY IF EXISTS "Tenant insert tracking_intentos" ON public.tracking_intentos;

CREATE POLICY "Staff read tracking_intentos"
  ON public.tracking_intentos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      organization_id = current_user_org_id()
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'operador'::app_role)
      )
    )
  );

CREATE POLICY "Staff insert tracking_intentos"
  ON public.tracking_intentos
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      organization_id = current_user_org_id()
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'operador'::app_role)
      )
    )
  );
