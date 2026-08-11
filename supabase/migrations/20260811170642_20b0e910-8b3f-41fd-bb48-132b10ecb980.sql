ALTER TABLE public.embarque_facturas_entrantes
  ADD COLUMN IF NOT EXISTS sin_costo_capturado boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.embarque_facturas_entrantes_conceptos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrante_id uuid NOT NULL REFERENCES public.embarque_facturas_entrantes(id) ON DELETE CASCADE,
  concepto_costo_id uuid NOT NULL REFERENCES public.conceptos_costo(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  monto_sugerido numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_efec_entrante_concepto UNIQUE (entrante_id, concepto_costo_id)
);

CREATE INDEX IF NOT EXISTS idx_efec_entrante ON public.embarque_facturas_entrantes_conceptos(entrante_id);
CREATE INDEX IF NOT EXISTS idx_efec_concepto ON public.embarque_facturas_entrantes_conceptos(concepto_costo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.embarque_facturas_entrantes_conceptos TO authenticated;
GRANT ALL ON public.embarque_facturas_entrantes_conceptos TO service_role;

ALTER TABLE public.embarque_facturas_entrantes_conceptos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lectura conceptos entrante" ON public.embarque_facturas_entrantes_conceptos
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

CREATE POLICY "Operaciones registra conceptos entrante" ON public.embarque_facturas_entrantes_conceptos
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      organization_id = public.current_user_org_id()
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
    AND EXISTS (
      SELECT 1 FROM public.embarque_facturas_entrantes e
      WHERE e.id = entrante_id
        AND e.organization_id = embarque_facturas_entrantes_conceptos.organization_id
        AND e.estado = 'por_capturar'
    )
  );

CREATE POLICY "Autor borra conceptos entrante" ON public.embarque_facturas_entrantes_conceptos
  FOR DELETE TO authenticated
  USING (
    (
      organization_id = public.current_user_org_id()
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
    AND EXISTS (
      SELECT 1 FROM public.embarque_facturas_entrantes e
      WHERE e.id = entrante_id AND e.estado = 'por_capturar'
    )
  );

CREATE TRIGGER trg_efec_updated_at
  BEFORE UPDATE ON public.embarque_facturas_entrantes_conceptos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();