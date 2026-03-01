
-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false);

-- Admins and operators can upload files
CREATE POLICY "Admin/operador upload documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
);

-- Admins and operators can update files
CREATE POLICY "Admin/operador update documentos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
);

-- Admins and operators can delete files
CREATE POLICY "Admin/operador delete documentos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
);

-- All authenticated users can view/download files
CREATE POLICY "Authenticated users can view documentos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos');
