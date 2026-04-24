
-- Tabla para almacenar los conceptos detallados de proformas consolidadas
-- Necesaria para regenerar el PDF agrupado por contenedor con trazabilidad completa.
CREATE TABLE IF NOT EXISTS public.proforma_conceptos_consolidados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id uuid NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
  embarque_id uuid,
  contenedor text,
  tipo_contenedor text,
  descripcion text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  moneda public.moneda NOT NULL DEFAULT 'MXN',
  aplica_iva boolean NOT NULL DEFAULT false,
  iva numeric NOT NULL DEFAULT 0,
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcc_proforma ON public.proforma_conceptos_consolidados(proforma_id);
CREATE INDEX IF NOT EXISTS idx_pcc_org ON public.proforma_conceptos_consolidados(organization_id);

ALTER TABLE public.proforma_conceptos_consolidados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente read own pcc"
ON public.proforma_conceptos_consolidados
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND proforma_id IN (
    SELECT id FROM public.proformas
    WHERE cliente_id IN (SELECT current_user_client_ids())
  )
);

CREATE POLICY "Tenant CRUD pcc"
ON public.proforma_conceptos_consolidados
FOR ALL TO authenticated
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Tenant viewer pcc"
ON public.proforma_conceptos_consolidados
FOR SELECT TO authenticated
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND has_role(auth.uid(), 'viewer'::app_role)
);
