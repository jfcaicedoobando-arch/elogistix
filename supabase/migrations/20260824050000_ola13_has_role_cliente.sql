-- ============================================================
-- Ola 13 · Sprint 05 · R4BD-04: las policies de escritura/borrado de
-- proveedor_contactos y cliente_documentos (feature 20260813170331) y las
-- de storage de la carpeta clientes/ del bucket 'documentos' sólo
-- verificaban organization_id. Se recrean exigiendo la matriz de escritura
-- de R3BD-01 (admin/admin_org/operador/contador/super_admin).
-- Las policies de lectura NO se tocan. Idempotente.
-- ============================================================

DROP POLICY IF EXISTS "Compras puede insertar contactos de proveedor" ON public.proveedor_contactos;
CREATE POLICY "Compras puede insertar contactos de proveedor"
ON public.proveedor_contactos FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id = proveedor_id
      AND p.organization_id = public.current_user_org_id()
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Compras puede actualizar contactos de proveedor" ON public.proveedor_contactos;
CREATE POLICY "Compras puede actualizar contactos de proveedor"
ON public.proveedor_contactos FOR UPDATE TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Compras puede borrar contactos de proveedor" ON public.proveedor_contactos;
CREATE POLICY "Compras puede borrar contactos de proveedor"
ON public.proveedor_contactos FOR DELETE TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Org puede insertar documentos de cliente" ON public.cliente_documentos;
CREATE POLICY "Org puede insertar documentos de cliente"
ON public.cliente_documentos FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = cliente_id
      AND c.organization_id = public.current_user_org_id()
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Org puede actualizar documentos de cliente" ON public.cliente_documentos;
CREATE POLICY "Org puede actualizar documentos de cliente"
ON public.cliente_documentos FOR UPDATE TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Org puede borrar documentos de cliente" ON public.cliente_documentos;
CREATE POLICY "Org puede borrar documentos de cliente"
ON public.cliente_documentos FOR DELETE TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Cliente docs upload" ON storage.objects;
CREATE POLICY "Cliente docs upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = 'clientes'
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.organization_id = public.current_user_org_id()
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Cliente docs delete" ON storage.objects;
CREATE POLICY "Cliente docs delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = 'clientes'
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.organization_id = public.current_user_org_id()
  )
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);