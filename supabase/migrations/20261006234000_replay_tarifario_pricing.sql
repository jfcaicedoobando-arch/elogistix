-- Replay canónico de Drizzle 0010; guardas de reaplicación sin cambiar definiciones ni GRANT explícitos.
-- Comparar catálogo/ledger antes de cualquier uso remoto; estas guardas no certifican equivalencia.
CREATE TABLE IF NOT EXISTS public.costeo_cargos_fob_agente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  agente_id uuid NOT NULL REFERENCES public.costeo_agentes(id) ON DELETE RESTRICT,
  concepto text NOT NULL DEFAULT 'Cargos FOB',
  monto numeric(14,2) NOT NULL CHECK (monto >= 0),
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD','MXN','EUR')),
  unidad text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.costeo_cargos_locales_naviera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  naviera_id uuid NOT NULL REFERENCES public.navieras(id) ON DELETE RESTRICT,
  concepto text NOT NULL DEFAULT 'Revalidación',
  monto numeric(14,2) NOT NULL CHECK (monto >= 0),
  moneda text NOT NULL DEFAULT 'MXN' CHECK (moneda IN ('USD','MXN','EUR')),
  unidad text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS costeo_cargos_fob_agente_org_idx ON public.costeo_cargos_fob_agente(organization_id, agente_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS costeo_cargos_locales_naviera_org_idx ON public.costeo_cargos_locales_naviera(organization_id, naviera_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.costeo_cargos_fob_agente TO authenticated;
GRANT ALL ON public.costeo_cargos_fob_agente TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.costeo_cargos_locales_naviera TO authenticated;
GRANT ALL ON public.costeo_cargos_locales_naviera TO service_role;

ALTER TABLE public.costeo_cargos_fob_agente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costeo_cargos_locales_naviera ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org lee cargos FOB" ON public.costeo_cargos_fob_agente;
CREATE POLICY "Org lee cargos FOB" ON public.costeo_cargos_fob_agente FOR SELECT TO authenticated
  USING (organization_id = public.org_scope() AND deleted_at IS NULL);
DROP POLICY IF EXISTS "Pricing crea cargos FOB" ON public.costeo_cargos_fob_agente;
CREATE POLICY "Pricing crea cargos FOB" ON public.costeo_cargos_fob_agente FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.org_scope() AND public._crm_es_pricing(organization_id));
DROP POLICY IF EXISTS "Pricing edita cargos FOB" ON public.costeo_cargos_fob_agente;
CREATE POLICY "Pricing edita cargos FOB" ON public.costeo_cargos_fob_agente FOR UPDATE TO authenticated
  USING (organization_id = public.org_scope() AND public._crm_es_pricing(organization_id))
  WITH CHECK (organization_id = public.org_scope() AND public._crm_es_pricing(organization_id));

DROP POLICY IF EXISTS "Org lee cargos locales" ON public.costeo_cargos_locales_naviera;
CREATE POLICY "Org lee cargos locales" ON public.costeo_cargos_locales_naviera FOR SELECT TO authenticated
  USING (organization_id = public.org_scope() AND deleted_at IS NULL);
DROP POLICY IF EXISTS "Pricing crea cargos locales" ON public.costeo_cargos_locales_naviera;
CREATE POLICY "Pricing crea cargos locales" ON public.costeo_cargos_locales_naviera FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.org_scope() AND public._crm_es_pricing(organization_id));
DROP POLICY IF EXISTS "Pricing edita cargos locales" ON public.costeo_cargos_locales_naviera;
CREATE POLICY "Pricing edita cargos locales" ON public.costeo_cargos_locales_naviera FOR UPDATE TO authenticated
  USING (organization_id = public.org_scope() AND public._crm_es_pricing(organization_id))
  WITH CHECK (organization_id = public.org_scope() AND public._crm_es_pricing(organization_id));

ALTER TABLE public.crm_solicitudes_pricing
  ADD COLUMN IF NOT EXISTS tarifa_tarifario_id uuid REFERENCES public.costeo_tarifas(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.crm_solicitudes_pricing.tarifa_tarifario_id IS 'Tarifa del tarifario elegida como respuesta automática';

CREATE OR REPLACE FUNCTION public.crm_aplicar_tarifa_tarifario(p_solicitud_id uuid, p_tarifa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; t record;
BEGIN
  SELECT * INTO v FROM public.crm_solicitudes_pricing WHERE id = p_solicitud_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF v.solicitante_id IS DISTINCT FROM auth.uid() AND v.created_by IS DISTINCT FROM auth.uid()
     AND NOT public._crm_es_pricing(v.organization_id) THEN
    RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
  END IF;
  IF v.estado = 'respondida' AND v.tarifa_tarifario_id = p_tarifa_id THEN
    RETURN jsonb_build_object('id', v.id, 'ya_respondida', true);
  END IF;
  IF v.estado NOT IN ('borrador','enviada') THEN
    RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO t FROM public.costeo_tarifas
   WHERE id = p_tarifa_id AND organization_id = v.organization_id AND estado = 'vigente'
     AND (vigente_hasta IS NULL OR vigente_hasta >= current_date);
  IF t.id IS NULL THEN RAISE EXCEPTION 'LC_TARIFA_NO_VIGENTE' USING ERRCODE = 'P0001'; END IF;
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE public.crm_solicitudes_pricing
     SET tarifa_tarifario_id = p_tarifa_id, estado = 'respondida',
         enviada_at = coalesce(enviada_at, now()), respondida_at = now()
   WHERE id = p_solicitud_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  RETURN jsonb_build_object('id', v.id, 'ya_respondida', false);
END $$;
REVOKE ALL ON FUNCTION public.crm_aplicar_tarifa_tarifario(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_aplicar_tarifa_tarifario(uuid, uuid) TO authenticated, service_role;
