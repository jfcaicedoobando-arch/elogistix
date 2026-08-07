-- =============================================================================
-- Fase 1 · Rendimiento RLS: colapsar la evaluación de roles
-- =============================================================================

-- 1) Jerarquía de roles extraída de has_role() a una función IMMUTABLE reusable.
CREATE OR REPLACE FUNCTION public.roles_jerarquia(_role app_role)
RETURNS app_role[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'super_admin'::app_role THEN ARRAY['super_admin']::app_role[]
    WHEN 'admin'::app_role THEN ARRAY['admin','admin_org','super_admin']::app_role[]
    WHEN 'admin_org'::app_role THEN ARRAY['admin_org','super_admin']::app_role[]
    WHEN 'operador'::app_role THEN ARRAY['operador','coordinador_logistico','gerente_operaciones','admin','admin_org','super_admin']::app_role[]
    WHEN 'viewer'::app_role THEN ARRAY['viewer','customer_service','vendedor','contador','tesorero','auxiliar_contable','ejecutivo_cobranza','ejecutivo_pricing','gerente_operaciones','gerente_visor','gerente_comercial','coordinador_logistico','admin','admin_org','super_admin']::app_role[]
    WHEN 'vendedor'::app_role THEN ARRAY['vendedor','gerente_comercial','admin_org','super_admin']::app_role[]
    WHEN 'contador'::app_role THEN ARRAY['contador','auxiliar_contable','admin_org','super_admin']::app_role[]
    WHEN 'tesorero'::app_role THEN ARRAY['tesorero','admin_org','super_admin']::app_role[]
    WHEN 'auxiliar_contable'::app_role THEN ARRAY['auxiliar_contable','contador','admin_org','super_admin']::app_role[]
    WHEN 'ejecutivo_cobranza'::app_role THEN ARRAY['ejecutivo_cobranza','contador','admin_org','super_admin']::app_role[]
    ELSE ARRAY[_role]::app_role[]
  END
$$;

-- 2) has_role() ahora delega en la jerarquía (una sola fuente de verdad).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (public.roles_jerarquia(_role))
  )
$$;

-- 3) has_any_role(): UNA sola lectura de user_roles para N roles solicitados.
--    Reemplaza cadenas de 5 llamadas a has_role() en las policies calientes.
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (
        SELECT DISTINCT e
        FROM unnest(_roles) AS r,
             unnest(public.roles_jerarquia(r)) AS e
      )
  )
$$;

REVOKE ALL ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.roles_jerarquia(app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roles_jerarquia(app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated, anon, service_role;

-- =============================================================================
-- 4) Reescritura de policies calientes: 1 policy por comando, 2 llamadas máx.
-- =============================================================================

-- ---------- embarques ----------
DROP POLICY IF EXISTS "Tenant CRUD embarques" ON public.embarques;
DROP POLICY IF EXISTS "Tenant viewer embarques" ON public.embarques;

CREATE POLICY "Tenant read embarques" ON public.embarques
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

CREATE POLICY "Tenant write embarques" ON public.embarques
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant update embarques" ON public.embarques
  FOR UPDATE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant delete embarques" ON public.embarques
  FOR DELETE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  );

-- ---------- documentos_embarque ----------
DROP POLICY IF EXISTS "Tenant CRUD documentos_embarque" ON public.documentos_embarque;
DROP POLICY IF EXISTS "Tenant viewer documentos_embarque" ON public.documentos_embarque;

CREATE POLICY "Tenant read documentos_embarque" ON public.documentos_embarque
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

CREATE POLICY "Tenant write documentos_embarque" ON public.documentos_embarque
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant update documentos_embarque" ON public.documentos_embarque
  FOR UPDATE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant delete documentos_embarque" ON public.documentos_embarque
  FOR DELETE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  );

-- ---------- conceptos_costo ----------
DROP POLICY IF EXISTS "Tenant CRUD conceptos_costo" ON public.conceptos_costo;
DROP POLICY IF EXISTS "Tenant viewer conceptos_costo" ON public.conceptos_costo;

CREATE POLICY "Tenant read conceptos_costo" ON public.conceptos_costo
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

CREATE POLICY "Tenant write conceptos_costo" ON public.conceptos_costo
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','contador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant update conceptos_costo" ON public.conceptos_costo
  FOR UPDATE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','contador','super_admin']::app_role[]))
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','contador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant delete conceptos_costo" ON public.conceptos_costo
  FOR DELETE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','contador','super_admin']::app_role[]))
  );

-- ---------- conceptos_venta ----------
DROP POLICY IF EXISTS "Tenant CRUD conceptos_venta" ON public.conceptos_venta;
DROP POLICY IF EXISTS "Tenant viewer conceptos_venta" ON public.conceptos_venta;

CREATE POLICY "Tenant read conceptos_venta" ON public.conceptos_venta
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

CREATE POLICY "Tenant write conceptos_venta" ON public.conceptos_venta
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant update conceptos_venta" ON public.conceptos_venta
  FOR UPDATE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant delete conceptos_venta" ON public.conceptos_venta
  FOR DELETE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

-- ---------- facturas ----------
DROP POLICY IF EXISTS "Tenant CRUD facturas" ON public.facturas;
DROP POLICY IF EXISTS "Tenant viewer facturas" ON public.facturas;

CREATE POLICY "Tenant read facturas" ON public.facturas
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

CREATE POLICY "Tenant write facturas" ON public.facturas
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant update facturas" ON public.facturas
  FOR UPDATE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant delete facturas" ON public.facturas
  FOR DELETE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

-- ---------- proformas ----------
DROP POLICY IF EXISTS "Tenant CRUD proformas" ON public.proformas;
DROP POLICY IF EXISTS "Tenant viewer proformas" ON public.proformas;

CREATE POLICY "Tenant read proformas" ON public.proformas
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

CREATE POLICY "Tenant write proformas" ON public.proformas
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant update proformas" ON public.proformas
  FOR UPDATE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

CREATE POLICY "Tenant delete proformas" ON public.proformas
  FOR DELETE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

-- ---------- proveedor_facturas (solo lectura: 6 llamadas → 2) ----------
DROP POLICY IF EXISTS "Tenant read proveedor_facturas" ON public.proveedor_facturas;
DROP POLICY IF EXISTS "Tenant viewer proveedor_facturas" ON public.proveedor_facturas;

CREATE POLICY "Tenant read proveedor_facturas" ON public.proveedor_facturas
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

-- ---------- pagos_factura (dos policies SELECT idénticas en esencia → una) ----------
DROP POLICY IF EXISTS "Tenant viewer pagos_factura" ON public.pagos_factura;
