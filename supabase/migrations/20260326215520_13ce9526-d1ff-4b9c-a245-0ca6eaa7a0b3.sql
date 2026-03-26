
-- Update RLS policies for tenant isolation on all tables
-- Pattern: existing role check AND (org match OR super_admin)

-- EMBARQUES
DROP POLICY IF EXISTS "Admins y operadores CRUD embarques" ON public.embarques;
DROP POLICY IF EXISTS "Viewers pueden ver embarques" ON public.embarques;
DROP POLICY IF EXISTS "Permitir eliminar embarques" ON public.embarques;

CREATE POLICY "Tenant CRUD embarques" ON public.embarques FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Tenant viewer embarques" ON public.embarques FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND has_role(auth.uid(), 'viewer')
  );

-- CLIENTES
DROP POLICY IF EXISTS "Admins y operadores CRUD clientes" ON public.clientes;
DROP POLICY IF EXISTS "Viewers pueden ver clientes" ON public.clientes;

CREATE POLICY "Tenant CRUD clientes" ON public.clientes FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Tenant viewer clientes" ON public.clientes FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND has_role(auth.uid(), 'viewer')
  );

-- PROVEEDORES
DROP POLICY IF EXISTS "Admins y operadores CRUD proveedores" ON public.proveedores;
DROP POLICY IF EXISTS "Viewers pueden ver proveedores" ON public.proveedores;

CREATE POLICY "Tenant CRUD proveedores" ON public.proveedores FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Tenant viewer proveedores" ON public.proveedores FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND has_role(auth.uid(), 'viewer')
  );

-- COTIZACIONES
DROP POLICY IF EXISTS "Admins y operadores CRUD cotizaciones" ON public.cotizaciones;
DROP POLICY IF EXISTS "Viewers pueden ver cotizaciones" ON public.cotizaciones;

CREATE POLICY "Tenant CRUD cotizaciones" ON public.cotizaciones FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Tenant viewer cotizaciones" ON public.cotizaciones FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND has_role(auth.uid(), 'viewer')
  );

-- FACTURAS
DROP POLICY IF EXISTS "Admins y operadores CRUD facturas" ON public.facturas;
DROP POLICY IF EXISTS "Viewers pueden ver facturas" ON public.facturas;
DROP POLICY IF EXISTS "Permitir eliminar facturas" ON public.facturas;

CREATE POLICY "Tenant CRUD facturas" ON public.facturas FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Tenant viewer facturas" ON public.facturas FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND has_role(auth.uid(), 'viewer')
  );
