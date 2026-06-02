
CREATE TABLE public.presupuesto_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL DEFAULT public.current_user_org_id(),
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, nombre)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presupuesto_categorias TO authenticated;
GRANT ALL ON public.presupuesto_categorias TO service_role;

ALTER TABLE public.presupuesto_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuesto_categorias_select"
ON public.presupuesto_categorias FOR SELECT TO authenticated
USING (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "presupuesto_categorias_admin_insert"
ON public.presupuesto_categorias FOR INSERT TO authenticated
WITH CHECK (
  (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "presupuesto_categorias_admin_update"
ON public.presupuesto_categorias FOR UPDATE TO authenticated
USING (
  (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "presupuesto_categorias_admin_delete"
ON public.presupuesto_categorias FOR DELETE TO authenticated
USING (
  (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE TABLE public.presupuesto_mensual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL DEFAULT public.current_user_org_id(),
  categoria_id UUID NOT NULL REFERENCES public.presupuesto_categorias(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  monto_mxn NUMERIC(14,2) NOT NULL DEFAULT 0,
  notas TEXT,
  creado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, categoria_id, periodo)
);

CREATE INDEX idx_presupuesto_mensual_org_periodo ON public.presupuesto_mensual(organization_id, periodo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presupuesto_mensual TO authenticated;
GRANT ALL ON public.presupuesto_mensual TO service_role;

ALTER TABLE public.presupuesto_mensual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuesto_mensual_select"
ON public.presupuesto_mensual FOR SELECT TO authenticated
USING (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "presupuesto_mensual_admin_insert"
ON public.presupuesto_mensual FOR INSERT TO authenticated
WITH CHECK (
  (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "presupuesto_mensual_admin_update"
ON public.presupuesto_mensual FOR UPDATE TO authenticated
USING (
  (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "presupuesto_mensual_admin_delete"
ON public.presupuesto_mensual FOR DELETE TO authenticated
USING (
  (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS categoria_presupuesto_id UUID
    REFERENCES public.presupuesto_categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proveedor_facturas_categoria
  ON public.proveedor_facturas(categoria_presupuesto_id)
  WHERE categoria_presupuesto_id IS NOT NULL;

CREATE TRIGGER trg_presupuesto_categorias_updated_at
  BEFORE UPDATE ON public.presupuesto_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_presupuesto_mensual_updated_at
  BEFORE UPDATE ON public.presupuesto_mensual
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.seed_presupuesto_categorias(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_existing FROM public.presupuesto_categorias WHERE organization_id = p_organization_id;
  IF v_existing > 0 THEN RETURN; END IF;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden) VALUES
    (p_organization_id, 'Nómina', 10),
    (p_organization_id, 'Renta', 20),
    (p_organization_id, 'Servicios', 30),
    (p_organization_id, 'Marketing', 40),
    (p_organization_id, 'Comisiones', 50),
    (p_organization_id, 'Otros', 99);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_presupuesto_categorias(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_presupuesto_categorias(UUID) TO authenticated;
