-- ============================================================================
-- Ola 12 · Homologación Cliente ↔ Proveedor (4A + 4B)
-- 4A: contactos múltiples de proveedor  (tabla nueva)
-- 4B: expediente documental del cliente (tabla nueva + policies de storage)
-- ============================================================================

-- ---------------------------------------------------------------- 4A ---------
CREATE TABLE public.proveedor_contactos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  puesto text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT 'Operaciones',
  email text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  extension text NOT NULL DEFAULT '',
  notas text,
  es_principal boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT proveedor_contactos_nombre_check CHECK (btrim(nombre) <> ''),
  CONSTRAINT proveedor_contactos_area_check CHECK (
    area = ANY (ARRAY['Operaciones','Facturación','Cobranza','Dirección','Otro'])
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_contactos TO authenticated;
GRANT ALL ON public.proveedor_contactos TO service_role;

ALTER TABLE public.proveedor_contactos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org puede ver contactos de proveedor" ON public.proveedor_contactos;
CREATE POLICY "Org puede ver contactos de proveedor"
  ON public.proveedor_contactos FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

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
  );

DROP POLICY IF EXISTS "Compras puede actualizar contactos de proveedor" ON public.proveedor_contactos;
CREATE POLICY "Compras puede actualizar contactos de proveedor"
  ON public.proveedor_contactos FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_org_id())
  WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Compras puede borrar contactos de proveedor" ON public.proveedor_contactos;
CREATE POLICY "Compras puede borrar contactos de proveedor"
  ON public.proveedor_contactos FOR DELETE TO authenticated
  USING (organization_id = public.current_user_org_id());

CREATE INDEX IF NOT EXISTS idx_proveedor_contactos_proveedor
  ON public.proveedor_contactos (proveedor_id, es_principal DESC, nombre)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proveedor_contactos_org
  ON public.proveedor_contactos (organization_id)
  WHERE deleted_at IS NULL;

-- Un solo contacto principal vivo por proveedor.
CREATE UNIQUE INDEX IF NOT EXISTS uq_proveedor_contactos_principal
  ON public.proveedor_contactos (proveedor_id)
  WHERE es_principal AND deleted_at IS NULL;

CREATE TRIGGER trg_proveedor_contactos_updated_at
  BEFORE UPDATE ON public.proveedor_contactos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Al marcar un principal, desmarca el anterior (evita choque con el índice único).
CREATE OR REPLACE FUNCTION public._proveedor_contacto_principal_unico()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.es_principal AND NEW.deleted_at IS NULL THEN
    UPDATE public.proveedor_contactos
       SET es_principal = false
     WHERE proveedor_id = NEW.proveedor_id
       AND id <> NEW.id
       AND es_principal
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proveedor_contacto_principal_unico
  BEFORE INSERT OR UPDATE OF es_principal, deleted_at
  ON public.proveedor_contactos
  FOR EACH ROW EXECUTE FUNCTION public._proveedor_contacto_principal_unico();

-- Semilla: el contacto plano que ya existía en `proveedores` pasa a ser principal.
INSERT INTO public.proveedor_contactos
  (organization_id, proveedor_id, nombre, email, telefono, es_principal, area)
SELECT
  p.organization_id,
  p.id,
  NULLIF(btrim(COALESCE(p.contacto, '')), ''),
  COALESCE(p.email, ''),
  COALESCE(p.telefono, ''),
  true,
  'Operaciones'
FROM public.proveedores p
WHERE p.deleted_at IS NULL
  AND btrim(COALESCE(p.contacto, '')) <> '';

-- ---------------------------------------------------------------- 4B ---------
CREATE TABLE public.cliente_documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  nombre text NOT NULL,
  archivo text NOT NULL,
  mime_type text,
  tamano_bytes bigint,
  fecha_documento date,
  fecha_vencimiento date,
  notas text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT cliente_documentos_tipo_check CHECK (
    tipo = ANY (ARRAY[
      'Constancia de situación fiscal',
      'Comprobante de domicilio',
      'Acta constitutiva',
      'Poder notarial',
      'Identificación del representante',
      'Contrato de servicios',
      'Carta de crédito',
      'Otro'
    ])
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_documentos TO authenticated;
GRANT ALL ON public.cliente_documentos TO service_role;

ALTER TABLE public.cliente_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org puede ver documentos de cliente" ON public.cliente_documentos;
CREATE POLICY "Org puede ver documentos de cliente"
  ON public.cliente_documentos FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
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
  );

DROP POLICY IF EXISTS "Org puede actualizar documentos de cliente" ON public.cliente_documentos;
CREATE POLICY "Org puede actualizar documentos de cliente"
  ON public.cliente_documentos FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_org_id())
  WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Org puede borrar documentos de cliente" ON public.cliente_documentos;
CREATE POLICY "Org puede borrar documentos de cliente"
  ON public.cliente_documentos FOR DELETE TO authenticated
  USING (organization_id = public.current_user_org_id());

CREATE INDEX IF NOT EXISTS idx_cliente_documentos_cliente
  ON public.cliente_documentos (cliente_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_documentos_org
  ON public.cliente_documentos (organization_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_cliente_documentos_updated_at
  BEFORE UPDATE ON public.cliente_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage: prefijo `clientes/{cliente_id}/` del bucket privado `documentos`.
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
  );

DROP POLICY IF EXISTS "Cliente docs read" ON storage.objects;
CREATE POLICY "Cliente docs read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = 'clientes'
    AND EXISTS (
      SELECT 1 FROM public.cliente_documentos d
      WHERE d.archivo = name
        AND d.organization_id = public.current_user_org_id()
        AND d.deleted_at IS NULL
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
  );