
-- === Fase 1: auto-provisioning de organizaciones ===
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Serie de facturación por defecto (neutra)
  INSERT INTO public.factura_series (organization_id, codigo, prefijo, folio_actual, folio_inicial, activa, es_default, descripcion)
  VALUES (NEW.id, 'A', 'A', 0, 1, true, true, 'Serie por defecto')
  ON CONFLICT DO NOTHING;

  -- Pipeline CRM neutro
  INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, orden, probabilidad_default, color, tipo)
  VALUES
    (NEW.id, 'Prospecto',    1, 10,  '#94a3b8', 'abierta'),
    (NEW.id, 'Calificado',   2, 25,  '#38bdf8', 'abierta'),
    (NEW.id, 'Propuesta',    3, 50,  '#6366f1', 'abierta'),
    (NEW.id, 'Negociación',  4, 75,  '#f59e0b', 'abierta'),
    (NEW.id, 'Ganada',       5, 100, '#10b981', 'ganada'),
    (NEW.id, 'Perdida',      6, 0,   '#ef4444', 'perdida')
  ON CONFLICT DO NOTHING;

  -- Motivos de pérdida neutros
  INSERT INTO public.crm_motivos_perdida (organization_id, nombre)
  VALUES
    (NEW.id, 'Precio'),
    (NEW.id, 'Tiempo de tránsito'),
    (NEW.id, 'Competencia'),
    (NEW.id, 'No responde'),
    (NEW.id, 'Otro')
  ON CONFLICT DO NOTHING;

  -- Categorías de presupuesto neutras
  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, tipo_contable)
  VALUES
    (NEW.id, 'Ventas',           1, 'Venta'),
    (NEW.id, 'Costo directo',    2, 'CostoDirectoEmbarque'),
    (NEW.id, 'Administración',   3, 'Administracion')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_organization ON public.organizations;
CREATE TRIGGER trg_handle_new_organization
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- === Backfill idempotente para orgs existentes ===
DO $$
DECLARE
  org_row RECORD;
BEGIN
  FOR org_row IN SELECT id FROM public.organizations LOOP
    -- factura_series default si no tiene ninguna
    IF NOT EXISTS (SELECT 1 FROM public.factura_series WHERE organization_id = org_row.id) THEN
      INSERT INTO public.factura_series (organization_id, codigo, prefijo, folio_actual, folio_inicial, activa, es_default, descripcion)
      VALUES (org_row.id, 'A', 'A', 0, 1, true, true, 'Serie por defecto');
    END IF;

    -- pipeline CRM si no tiene ninguna etapa
    IF NOT EXISTS (SELECT 1 FROM public.crm_etapas_pipeline WHERE organization_id = org_row.id) THEN
      INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, orden, probabilidad_default, color, tipo) VALUES
        (org_row.id, 'Prospecto',    1, 10,  '#94a3b8', 'abierta'),
        (org_row.id, 'Calificado',   2, 25,  '#38bdf8', 'abierta'),
        (org_row.id, 'Propuesta',    3, 50,  '#6366f1', 'abierta'),
        (org_row.id, 'Negociación',  4, 75,  '#f59e0b', 'abierta'),
        (org_row.id, 'Ganada',       5, 100, '#10b981', 'ganada'),
        (org_row.id, 'Perdida',      6, 0,   '#ef4444', 'perdida');
    END IF;

    -- motivos de pérdida si no tiene ninguno
    IF NOT EXISTS (SELECT 1 FROM public.crm_motivos_perdida WHERE organization_id = org_row.id) THEN
      INSERT INTO public.crm_motivos_perdida (organization_id, nombre) VALUES
        (org_row.id, 'Precio'),
        (org_row.id, 'Tiempo de tránsito'),
        (org_row.id, 'Competencia'),
        (org_row.id, 'No responde'),
        (org_row.id, 'Otro');
    END IF;

    -- presupuesto_categorias si no tiene ninguna
    IF NOT EXISTS (SELECT 1 FROM public.presupuesto_categorias WHERE organization_id = org_row.id) THEN
      INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, tipo_contable) VALUES
        (org_row.id, 'Ventas',           1, 'Venta'),
        (org_row.id, 'Costo directo',    2, 'CostoDirectoEmbarque'),
        (org_row.id, 'Administración',   3, 'Administracion');
    END IF;
  END LOOP;
END $$;

-- === Fase 3: blindaje ===
-- H4: eliminar tabla de backup histórica sin RLS
DROP TABLE IF EXISTS public._backup_conceptos_venta_elimp00195_20260706;
