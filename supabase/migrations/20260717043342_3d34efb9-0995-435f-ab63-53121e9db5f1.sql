
-- =========================================================================
-- v13.301.57 — Bitácora transaccional de provisioning
-- =========================================================================

-- 1) Tabla de bitácora
CREATE TABLE public.provisioning_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source text NOT NULL,
  accion text NOT NULL,
  entidad text NOT NULL,
  filas_afectadas integer NOT NULL DEFAULT 0,
  detalles jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provisioning_log_source_valido
    CHECK (source IN ('trigger','backfill','rpc','manual','reseed'))
);

CREATE INDEX idx_provisioning_log_org ON public.provisioning_log(organization_id, created_at DESC);
CREATE INDEX idx_provisioning_log_accion ON public.provisioning_log(accion, created_at DESC);

COMMENT ON TABLE public.provisioning_log IS
  'v13.301.57 — Bitácora transaccional del auto-provisioning de organizaciones (seeds neutros).';

-- 2) GRANTs (autenticados leen bajo RLS; escritura sólo desde SECURITY DEFINER = service_role)
GRANT SELECT ON public.provisioning_log TO authenticated;
GRANT ALL ON public.provisioning_log TO service_role;

-- 3) RLS
ALTER TABLE public.provisioning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provisioning_log super_admin ve todo"
  ON public.provisioning_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "provisioning_log miembros ven su org"
  ON public.provisioning_log FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

CREATE POLICY "provisioning_log service_role escribe"
  ON public.provisioning_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4) Helper interno para registrar pasos (usado desde SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public._log_provisioning_step(
  p_org_id uuid,
  p_source text,
  p_accion text,
  p_entidad text,
  p_filas integer,
  p_detalles jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_filas IS NULL OR p_filas <= 0 THEN
    RETURN; -- nada que registrar
  END IF;
  INSERT INTO public.provisioning_log(
    organization_id, source, accion, entidad, filas_afectadas, detalles, created_by
  ) VALUES (
    p_org_id, p_source, p_accion, p_entidad, p_filas, coalesce(p_detalles,'{}'::jsonb), auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public._log_provisioning_step(uuid, text, text, text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._log_provisioning_step(uuid, text, text, text, integer, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public._log_provisioning_step(uuid, text, text, text, integer, jsonb) TO service_role;

-- 5) Actualizar handle_new_organization para registrar cada seed
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  -- Serie de facturación por defecto
  INSERT INTO public.factura_series (organization_id, codigo, prefijo, folio_actual, folio_inicial, activa, es_default, descripcion)
  VALUES (NEW.id, 'A', 'A', 0, 1, true, true, 'Serie por defecto')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM public._log_provisioning_step(NEW.id, 'trigger', 'seed_factura_series', 'factura_series', v_rows);

  -- Pipeline CRM
  INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, orden, probabilidad_default, color, tipo)
  VALUES
    (NEW.id, 'Prospecto',    1, 10,  '#94a3b8', 'abierta'),
    (NEW.id, 'Calificado',   2, 25,  '#38bdf8', 'abierta'),
    (NEW.id, 'Propuesta',    3, 50,  '#6366f1', 'abierta'),
    (NEW.id, 'Negociación',  4, 75,  '#f59e0b', 'abierta'),
    (NEW.id, 'Ganada',       5, 100, '#10b981', 'ganada'),
    (NEW.id, 'Perdida',      6, 0,   '#ef4444', 'perdida')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM public._log_provisioning_step(NEW.id, 'trigger', 'seed_crm_etapas_pipeline', 'crm_etapas_pipeline', v_rows);

  -- Motivos de pérdida
  INSERT INTO public.crm_motivos_perdida (organization_id, nombre)
  VALUES
    (NEW.id, 'Precio'),
    (NEW.id, 'Tiempo de tránsito'),
    (NEW.id, 'Competencia'),
    (NEW.id, 'No responde'),
    (NEW.id, 'Otro')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM public._log_provisioning_step(NEW.id, 'trigger', 'seed_crm_motivos_perdida', 'crm_motivos_perdida', v_rows);

  -- Categorías de presupuesto
  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, tipo_contable)
  VALUES
    (NEW.id, 'Ventas',           1, 'Venta'),
    (NEW.id, 'Costo directo',    2, 'CostoDirectoEmbarque'),
    (NEW.id, 'Administración',   3, 'Administracion')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM public._log_provisioning_step(NEW.id, 'trigger', 'seed_presupuesto_categorias', 'presupuesto_categorias', v_rows);

  RETURN NEW;
END;
$$;

-- 6) RPC de reproceso (idempotente) restringida a super_admin
CREATE OR REPLACE FUNCTION public.reseed_organization_catalogs(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_rows integer;
  v_out jsonb := '{}'::jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(v_caller, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Sólo super_admin puede reprocesar seeds' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organización no existe' USING ERRCODE = '22023';
  END IF;

  -- factura_series
  IF NOT EXISTS (SELECT 1 FROM public.factura_series WHERE organization_id = p_org_id) THEN
    INSERT INTO public.factura_series (organization_id, codigo, prefijo, folio_actual, folio_inicial, activa, es_default, descripcion)
    VALUES (p_org_id, 'A', 'A', 0, 1, true, true, 'Serie por defecto');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM public._log_provisioning_step(p_org_id, 'reseed', 'seed_factura_series', 'factura_series', v_rows);
    v_out := v_out || jsonb_build_object('factura_series', v_rows);
  END IF;

  -- crm_etapas_pipeline
  IF NOT EXISTS (SELECT 1 FROM public.crm_etapas_pipeline WHERE organization_id = p_org_id) THEN
    INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, orden, probabilidad_default, color, tipo) VALUES
      (p_org_id, 'Prospecto',    1, 10,  '#94a3b8', 'abierta'),
      (p_org_id, 'Calificado',   2, 25,  '#38bdf8', 'abierta'),
      (p_org_id, 'Propuesta',    3, 50,  '#6366f1', 'abierta'),
      (p_org_id, 'Negociación',  4, 75,  '#f59e0b', 'abierta'),
      (p_org_id, 'Ganada',       5, 100, '#10b981', 'ganada'),
      (p_org_id, 'Perdida',      6, 0,   '#ef4444', 'perdida');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM public._log_provisioning_step(p_org_id, 'reseed', 'seed_crm_etapas_pipeline', 'crm_etapas_pipeline', v_rows);
    v_out := v_out || jsonb_build_object('crm_etapas_pipeline', v_rows);
  END IF;

  -- crm_motivos_perdida
  IF NOT EXISTS (SELECT 1 FROM public.crm_motivos_perdida WHERE organization_id = p_org_id) THEN
    INSERT INTO public.crm_motivos_perdida (organization_id, nombre) VALUES
      (p_org_id, 'Precio'),
      (p_org_id, 'Tiempo de tránsito'),
      (p_org_id, 'Competencia'),
      (p_org_id, 'No responde'),
      (p_org_id, 'Otro');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM public._log_provisioning_step(p_org_id, 'reseed', 'seed_crm_motivos_perdida', 'crm_motivos_perdida', v_rows);
    v_out := v_out || jsonb_build_object('crm_motivos_perdida', v_rows);
  END IF;

  -- presupuesto_categorias
  IF NOT EXISTS (SELECT 1 FROM public.presupuesto_categorias WHERE organization_id = p_org_id) THEN
    INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, tipo_contable) VALUES
      (p_org_id, 'Ventas',           1, 'Venta'),
      (p_org_id, 'Costo directo',    2, 'CostoDirectoEmbarque'),
      (p_org_id, 'Administración',   3, 'Administracion');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM public._log_provisioning_step(p_org_id, 'reseed', 'seed_presupuesto_categorias', 'presupuesto_categorias', v_rows);
    v_out := v_out || jsonb_build_object('presupuesto_categorias', v_rows);
  END IF;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.reseed_organization_catalogs(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reseed_organization_catalogs(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reseed_organization_catalogs(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reseed_organization_catalogs(uuid) TO service_role;

COMMENT ON FUNCTION public.reseed_organization_catalogs(uuid) IS
  'v13.301.57 — Reproceso idempotente de seeds neutros. Sólo super_admin. Registra en provisioning_log.';

-- 7) Backfill histórico: registrar una entrada "backfill" para orgs existentes
--    de forma que la bitácora refleje que ya tienen los catálogos aunque los
--    inserts originales hayan sucedido antes de esta migración.
DO $$
DECLARE
  org_row RECORD;
  v_cnt integer;
BEGIN
  FOR org_row IN SELECT id FROM public.organizations LOOP
    SELECT count(*) INTO v_cnt FROM public.factura_series WHERE organization_id = org_row.id;
    IF v_cnt > 0 THEN
      INSERT INTO public.provisioning_log(organization_id, source, accion, entidad, filas_afectadas, detalles)
      VALUES (org_row.id, 'backfill', 'baseline_factura_series', 'factura_series', v_cnt,
              jsonb_build_object('nota','entrada retrospectiva v13.301.57'));
    END IF;

    SELECT count(*) INTO v_cnt FROM public.crm_etapas_pipeline WHERE organization_id = org_row.id;
    IF v_cnt > 0 THEN
      INSERT INTO public.provisioning_log(organization_id, source, accion, entidad, filas_afectadas, detalles)
      VALUES (org_row.id, 'backfill', 'baseline_crm_etapas_pipeline', 'crm_etapas_pipeline', v_cnt,
              jsonb_build_object('nota','entrada retrospectiva v13.301.57'));
    END IF;

    SELECT count(*) INTO v_cnt FROM public.crm_motivos_perdida WHERE organization_id = org_row.id;
    IF v_cnt > 0 THEN
      INSERT INTO public.provisioning_log(organization_id, source, accion, entidad, filas_afectadas, detalles)
      VALUES (org_row.id, 'backfill', 'baseline_crm_motivos_perdida', 'crm_motivos_perdida', v_cnt,
              jsonb_build_object('nota','entrada retrospectiva v13.301.57'));
    END IF;

    SELECT count(*) INTO v_cnt FROM public.presupuesto_categorias WHERE organization_id = org_row.id;
    IF v_cnt > 0 THEN
      INSERT INTO public.provisioning_log(organization_id, source, accion, entidad, filas_afectadas, detalles)
      VALUES (org_row.id, 'backfill', 'baseline_presupuesto_categorias', 'presupuesto_categorias', v_cnt,
              jsonb_build_object('nota','entrada retrospectiva v13.301.57'));
    END IF;
  END LOOP;
END $$;
