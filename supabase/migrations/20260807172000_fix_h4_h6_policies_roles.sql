-- FIX-H4-09 / FIX-H6-09 (v13.452.1)
-- Re-aplica de forma idempotente las policies optimizadas de la migración
-- 20260807145542 (cada CREATE POLICY con su DROP POLICY IF EXISTS previo) y
-- re-aplica el bloque REVOKE/GRANT de public.has_role, que quedó fuera del
-- archivo original. Sin cambios de semántica: mismos predicados y permisos.

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;

-- 4) Reescritura de policies calientes: 1 policy por comando, 2 llamadas máx.
-- =============================================================================

-- ---------- embarques ----------
DROP POLICY IF EXISTS "Tenant CRUD embarques" ON public.embarques;
DROP POLICY IF EXISTS "Tenant viewer embarques" ON public.embarques;

DROP POLICY IF EXISTS "Tenant read embarques" ON public.embarques;
CREATE POLICY "Tenant read embarques" ON public.embarques
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant write embarques" ON public.embarques;
CREATE POLICY "Tenant write embarques" ON public.embarques
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant update embarques" ON public.embarques;
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

DROP POLICY IF EXISTS "Tenant delete embarques" ON public.embarques;
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

DROP POLICY IF EXISTS "Tenant read documentos_embarque" ON public.documentos_embarque;
CREATE POLICY "Tenant read documentos_embarque" ON public.documentos_embarque
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant write documentos_embarque" ON public.documentos_embarque;
CREATE POLICY "Tenant write documentos_embarque" ON public.documentos_embarque
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','super_admin']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant update documentos_embarque" ON public.documentos_embarque;
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

DROP POLICY IF EXISTS "Tenant delete documentos_embarque" ON public.documentos_embarque;
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

DROP POLICY IF EXISTS "Tenant read conceptos_costo" ON public.conceptos_costo;
CREATE POLICY "Tenant read conceptos_costo" ON public.conceptos_costo
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant write conceptos_costo" ON public.conceptos_costo;
CREATE POLICY "Tenant write conceptos_costo" ON public.conceptos_costo
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','operador','contador','super_admin']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant update conceptos_costo" ON public.conceptos_costo;
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

DROP POLICY IF EXISTS "Tenant delete conceptos_costo" ON public.conceptos_costo;
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

DROP POLICY IF EXISTS "Tenant read conceptos_venta" ON public.conceptos_venta;
CREATE POLICY "Tenant read conceptos_venta" ON public.conceptos_venta
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant write conceptos_venta" ON public.conceptos_venta;
CREATE POLICY "Tenant write conceptos_venta" ON public.conceptos_venta
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant update conceptos_venta" ON public.conceptos_venta;
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

DROP POLICY IF EXISTS "Tenant delete conceptos_venta" ON public.conceptos_venta;
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

DROP POLICY IF EXISTS "Tenant read facturas" ON public.facturas;
CREATE POLICY "Tenant read facturas" ON public.facturas
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant write facturas" ON public.facturas;
CREATE POLICY "Tenant write facturas" ON public.facturas
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant update facturas" ON public.facturas;
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

DROP POLICY IF EXISTS "Tenant delete facturas" ON public.facturas;
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

DROP POLICY IF EXISTS "Tenant read proformas" ON public.proformas;
CREATE POLICY "Tenant read proformas" ON public.proformas
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant write proformas" ON public.proformas;
CREATE POLICY "Tenant write proformas" ON public.proformas
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[]))
  );

DROP POLICY IF EXISTS "Tenant update proformas" ON public.proformas;
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

DROP POLICY IF EXISTS "Tenant delete proformas" ON public.proformas;
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

DROP POLICY IF EXISTS "Tenant read proveedor_facturas" ON public.proveedor_facturas;
CREATE POLICY "Tenant read proveedor_facturas" ON public.proveedor_facturas
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer']::app_role[]))
  );

-- ---------- pagos_factura (dos policies SELECT idénticas en esencia → una) ----------
DROP POLICY IF EXISTS "Tenant viewer pagos_factura" ON public.pagos_factura;
