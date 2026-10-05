-- Replica sólo el esquema y las funciones de Drizzle 0001.
-- No vuelve a copiar datos de leads, archivar oportunidades ni renombrar etapas.
ALTER TABLE public.crm_empresas ADD COLUMN IF NOT EXISTS estado_crm text NOT NULL DEFAULT 'Lead';
DO $$ BEGIN
  ALTER TABLE public.crm_empresas ADD CONSTRAINT crm_empresas_estado_crm_chk
    CHECK (estado_crm IN ('Lead','Sospechoso','Prospecto','Cliente'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS crm_empresas_org_estado_idx ON public.crm_empresas (organization_id, estado_crm);

CREATE OR REPLACE FUNCTION public._crm_empresa_estado_por_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN NEW.estado_crm := 'Cliente'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_estado_por_cliente() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_empresa_estado_por_cliente() TO service_role;

CREATE OR REPLACE FUNCTION public._crm_lead_sync_estado_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.crm_empresas e
     SET estado_crm = CASE WHEN NEW.estado::text = 'Convertido' THEN 'Cliente' ELSE 'Prospecto' END
   WHERE e.lead_origen_id = NEW.id AND e.organization_id = NEW.organization_id
     AND e.estado_crm <> 'Cliente'
     AND NEW.estado::text IN ('Prospecto','Calificado','Pendiente de alta','Convertido');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_lead_sync_estado_empresa() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_lead_sync_estado_empresa() TO service_role;

CREATE OR REPLACE FUNCTION public.crm_empresa_pasar_a_prospecto(p_empresa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid := public.org_scope();
  v_emp public.crm_empresas%ROWTYPE;
  v_lead uuid; v_etapa uuid; v_op uuid; v_email text;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'LC_SIN_ORGANIZACION' USING ERRCODE = '42501'; END IF;
  PERFORM public._assert_writer(v_org);
  SELECT * INTO v_emp FROM public.crm_empresas
   WHERE id = p_empresa_id AND organization_id = v_org AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_CRM_EMPRESA_NO_ENCONTRADA' USING ERRCODE = 'P0002'; END IF;

  SELECT o.id INTO v_op FROM public.crm_oportunidad_empresa oe
    JOIN public.crm_oportunidades o ON o.id = oe.oportunidad_id AND o.deleted_at IS NULL
   WHERE oe.empresa_id = v_emp.id ORDER BY o.created_at LIMIT 1;
  IF v_emp.estado_crm NOT IN ('Lead','Sospechoso') AND v_op IS NOT NULL THEN
    RETURN jsonb_build_object('oportunidad_id', v_op, 'sin_cambios', true);
  END IF;

  SELECT id INTO v_etapa FROM public.crm_etapas_pipeline
   WHERE organization_id = v_org AND nombre = 'Prospecto' ORDER BY orden LIMIT 1;
  IF v_etapa IS NULL THEN RAISE EXCEPTION 'LC_CRM_ETAPA_PROSPECTO_FALTANTE'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  v_lead := v_emp.lead_origen_id;
  IF v_lead IS NULL THEN
    INSERT INTO public.crm_leads (organization_id, empresa, estado, vendedor_id, vendedor_email, created_by)
    VALUES (v_org, v_emp.nombre, 'Prospecto', auth.uid(), coalesce(v_email, ''), auth.uid())
    RETURNING id INTO v_lead;
    UPDATE public.crm_empresas SET lead_origen_id = v_lead WHERE id = v_emp.id;
  ELSE
    UPDATE public.crm_leads SET estado = 'Prospecto'
     WHERE id = v_lead AND estado::text IN ('Nuevo','Contactado','Descalificado');
  END IF;

  IF v_op IS NULL THEN
    INSERT INTO public.crm_oportunidades
      (organization_id, nombre, cliente_nombre, lead_id, etapa_id, vendedor_id, vendedor_email, created_by)
    VALUES (v_org, v_emp.nombre, v_emp.nombre, v_lead, v_etapa, auth.uid(), coalesce(v_email, ''), auth.uid())
    RETURNING id INTO v_op;
    INSERT INTO public.crm_oportunidad_empresa (oportunidad_id, empresa_id) VALUES (v_op, v_emp.id);
  END IF;

  UPDATE public.crm_empresas SET estado_crm = 'Prospecto' WHERE id = v_emp.id AND estado_crm IN ('Lead','Sospechoso');
  RETURN jsonb_build_object('oportunidad_id', v_op, 'sin_cambios', false);
END $$;
REVOKE ALL ON FUNCTION public.crm_empresa_pasar_a_prospecto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_empresa_pasar_a_prospecto(uuid) TO authenticated, service_role;
DROP TRIGGER IF EXISTS trg_crm_empresa_estado_por_cliente ON public.crm_empresas;
CREATE TRIGGER trg_crm_empresa_estado_por_cliente
BEFORE INSERT OR UPDATE OF cliente_id ON public.crm_empresas
FOR EACH ROW EXECUTE FUNCTION public._crm_empresa_estado_por_cliente();
DROP TRIGGER IF EXISTS trg_crm_lead_sync_estado_empresa ON public.crm_leads;
CREATE TRIGGER trg_crm_lead_sync_estado_empresa
AFTER UPDATE OF estado ON public.crm_leads
FOR EACH ROW WHEN (NEW.estado IS DISTINCT FROM OLD.estado)
EXECUTE FUNCTION public._crm_lead_sync_estado_empresa();
