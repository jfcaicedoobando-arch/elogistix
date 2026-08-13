-- H4: las políticas de proveedor_documentos se crearon sin DROP POLICY IF EXISTS.
-- Se recrean idénticas con el patrón idempotente obligatorio.

DROP POLICY IF EXISTS "Org puede ver documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Org puede ver documentos de proveedor"
ON public.proveedor_documentos FOR SELECT TO authenticated
USING (
  organization_id = public.current_user_org_id()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Compras puede insertar documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Compras puede insertar documentos de proveedor"
ON public.proveedor_documentos FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id = proveedor_id
      AND p.organization_id = public.current_user_org_id()
  )
);

DROP POLICY IF EXISTS "Compras puede actualizar documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Compras puede actualizar documentos de proveedor"
ON public.proveedor_documentos FOR UPDATE TO authenticated
USING (organization_id = public.current_user_org_id())
WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Compras puede borrar documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Compras puede borrar documentos de proveedor"
ON public.proveedor_documentos FOR DELETE TO authenticated
USING (organization_id = public.current_user_org_id());