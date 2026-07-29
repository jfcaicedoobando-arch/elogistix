-- ============================================================
-- M7 (auditoría arquitectura 2026-07-29) · organization_id directo
-- ============================================================

ALTER TABLE public.costeo_tarifa_recargos
  ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE public.costeo_tarifa_recargos r
   SET organization_id = t.organization_id
  FROM public.costeo_tarifas t
 WHERE r.tarifa_id = t.id
   AND r.organization_id IS NULL;

ALTER TABLE public.costeo_naviera_demoras_tarifa
  ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE public.costeo_naviera_demoras_tarifa d
   SET organization_id = c.organization_id
  FROM public.costeo_navieras_condiciones c
 WHERE d.naviera_condicion_id = c.id
   AND d.organization_id IS NULL;

DELETE FROM public.costeo_tarifa_recargos WHERE organization_id IS NULL;
DELETE FROM public.costeo_naviera_demoras_tarifa WHERE organization_id IS NULL;

ALTER TABLE public.costeo_tarifa_recargos
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.costeo_naviera_demoras_tarifa
  ALTER COLUMN organization_id SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costeo_tarifa_recargos_org_fkey') THEN
    ALTER TABLE public.costeo_tarifa_recargos
      ADD CONSTRAINT costeo_tarifa_recargos_org_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costeo_demoras_tarifa_org_fkey') THEN
    ALTER TABLE public.costeo_naviera_demoras_tarifa
      ADD CONSTRAINT costeo_demoras_tarifa_org_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_costeo_recargos_org
  ON public.costeo_tarifa_recargos (organization_id);
CREATE INDEX IF NOT EXISTS idx_costeo_demoras_tarifa_org
  ON public.costeo_naviera_demoras_tarifa (organization_id);

CREATE OR REPLACE FUNCTION public.trg_costeo_recargos_sync_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT t.organization_id INTO NEW.organization_id
    FROM public.costeo_tarifas t WHERE t.id = NEW.tarifa_id;
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'LC_COSTEO_RECARGO_SIN_PADRE: tarifa_id % no existe', NEW.tarifa_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_costeo_recargos_sync_org ON public.costeo_tarifa_recargos;
CREATE TRIGGER trg_costeo_recargos_sync_org
  BEFORE INSERT OR UPDATE OF tarifa_id ON public.costeo_tarifa_recargos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_costeo_recargos_sync_org();

CREATE OR REPLACE FUNCTION public.trg_costeo_demoras_tarifa_sync_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT c.organization_id INTO NEW.organization_id
    FROM public.costeo_navieras_condiciones c WHERE c.id = NEW.naviera_condicion_id;
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'LC_COSTEO_DEMORA_SIN_PADRE: naviera_condicion_id % no existe', NEW.naviera_condicion_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_costeo_demoras_tarifa_sync_org ON public.costeo_naviera_demoras_tarifa;
CREATE TRIGGER trg_costeo_demoras_tarifa_sync_org
  BEFORE INSERT OR UPDATE OF naviera_condicion_id ON public.costeo_naviera_demoras_tarifa
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_costeo_demoras_tarifa_sync_org();

DROP POLICY IF EXISTS costeo_recargos_write_org ON public.costeo_tarifa_recargos;
CREATE POLICY costeo_recargos_write_org ON public.costeo_tarifa_recargos
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = costeo_tarifa_recargos.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico']))
  OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = costeo_tarifa_recargos.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico']))
  OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS costeo_demoras_select_org ON public.costeo_naviera_demoras_tarifa;
CREATE POLICY costeo_demoras_select_org
  ON public.costeo_naviera_demoras_tarifa FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = costeo_naviera_demoras_tarifa.organization_id
      AND m.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS costeo_demoras_write_org ON public.costeo_naviera_demoras_tarifa;
CREATE POLICY costeo_demoras_write_org
  ON public.costeo_naviera_demoras_tarifa FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = costeo_naviera_demoras_tarifa.organization_id
      AND m.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = costeo_naviera_demoras_tarifa.organization_id
      AND m.user_id = (SELECT auth.uid())));