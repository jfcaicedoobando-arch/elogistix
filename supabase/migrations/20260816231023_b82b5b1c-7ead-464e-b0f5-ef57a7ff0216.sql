ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS cargo_contacto text,
  ADD COLUMN IF NOT EXISTS origen text,
  ADD COLUMN IF NOT EXISTS destino text;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS margen_pct numeric,
  ADD COLUMN IF NOT EXISTS margen_autorizado_por uuid,
  ADD COLUMN IF NOT EXISTS margen_autorizado_at timestamptz,
  ADD COLUMN IF NOT EXISTS riesgos_objeciones text;

ALTER TABLE public.crm_etapas_pipeline
  ADD COLUMN IF NOT EXISTS sla_dias integer;

CREATE OR REPLACE FUNCTION public.crm_autorizar_margen(_oportunidad_id uuid, _margen_pct numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.crm_oportunidades
  WHERE id = _oportunidad_id AND deleted_at IS NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_INEXISTENTE';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = v_org
        AND om.role IN ('admin_org', 'gerente_comercial')
    )
  ) THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO_AUTORIZAR_MARGEN';
  END IF;

  UPDATE public.crm_oportunidades
  SET margen_pct = _margen_pct,
      margen_autorizado_por = auth.uid(),
      margen_autorizado_at = now(),
      updated_at = now()
  WHERE id = _oportunidad_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_autorizar_margen(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_autorizar_margen(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_autorizar_margen(uuid, numeric) TO authenticated;