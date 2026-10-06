CREATE OR REPLACE FUNCTION public._crm_sol_pricing_before_ins() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_num bigint; v_tipo text;
BEGIN
  SELECT organization_id INTO v_org FROM public.crm_oportunidades WHERE id = NEW.oportunidad_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'LC_PRICING_OPORTUNIDAD_INVALIDA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = NEW.solicitante_id AND organization_id = v_org) THEN
    RAISE EXCEPTION 'LC_PRICING_SOLICITANTE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  v_tipo := 'pricing_' || to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYMM');
  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero) VALUES (v_org, v_tipo, 1)
  ON CONFLICT (organization_id, tipo) DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1, updated_at = now()
  RETURNING ultimo_numero INTO v_num;
  NEW.folio := public._crm_folio_pricing_prefijo(now()) || lpad(v_num::text, 4, '0');
  NEW.created_by := auth.uid();
  NEW.estado := 'borrador';
  NEW.enviada_at := NULL; NEW.vence_at := NULL; NEW.respondida_at := NULL;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public._crm_sol_pricing_before_ins() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_sol_pricing_before_ins() TO service_role;
