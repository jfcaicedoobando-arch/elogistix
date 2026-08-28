-- convertir_lead_rpc — candado de alta de clientes + herencia a la oportunidad.
--
-- Historia: la RPC (SECURITY DEFINER) creaba el cliente con los campos del lead,
-- saltándose el gate de roles de public.clientes y las validaciones fiscales del
-- wizard "Nuevo cliente" (clientes sin RFC/CP/régimen). Ahora el alta de clientes
-- vive SÓLO en el módulo de Clientes: la conversión únicamente liga uno existente.
--
-- Ejecutar con:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola6_convertir_propaga.sql
DO $$
DECLARE
  v_org uuid;
  v_org_ajena uuid;
  v_etapa uuid;
  v_lead uuid;
  v_lead2 uuid;
  v_res jsonb;
  v_cli uuid;
  v_cli_ajeno uuid;
  v_op uuid;
  v_sector text;
  v_origen text;
  v_destino text;
  v_cli_op uuid;
  v_err text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST OLA6 PROPAGA', 'TO6200000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST OLA6 AJENA', 'TO6200000XX1', 'basico', true)
  RETURNING id INTO v_org_ajena;

  INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, tipo, orden, activa)
  VALUES (v_org, 'Prospección OLA6P', 'abierta'::public.crm_etapa_tipo, 1, true)
  RETURNING id INTO v_etapa;

  INSERT INTO public.crm_leads (
    organization_id, empresa, estado,
    rfc, direccion, cp, entidad_federativa, sector, origen, destino
  ) VALUES (
    v_org, 'LEAD FISCAL OLA6', 'Calificado'::public.crm_lead_estado,
    'PROS260821AB1', 'Av. Siempre Viva 742', '04360', 'Ciudad de México',
    'Manufactura', 'Veracruz', 'Lázaro Cárdenas'
  ) RETURNING id INTO v_lead;

  -- 1) Pedir el alta del cliente desde el lead está prohibido.
  BEGIN
    v_res := public.convertir_lead_rpc(v_lead, true, NULL, 'OP PROHIBIDA', 1000, 'MXN', NULL);
    RAISE EXCEPTION 'CRM FAIL: la conversión creó un cliente (alta prohibida)';
  EXCEPTION WHEN others THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_LEAD_ALTA_CLIENTE_PROHIBIDA%' THEN
      RAISE EXCEPTION 'CRM FAIL: esperaba LC_LEAD_ALTA_CLIENTE_PROHIBIDA, obtuve [%]', v_err;
    END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.clientes WHERE organization_id = v_org) THEN
    RAISE EXCEPTION 'CRM FAIL: quedó un cliente creado desde el lead';
  END IF;

  -- 2) Convertir sin cliente funciona y la oportunidad hereda sector/origen/destino.
  v_res := public.convertir_lead_rpc(v_lead, false, NULL, 'OP PROPAGA OLA6', 1000, 'MXN', NULL);
  v_op := (v_res->>'oportunidad_id')::uuid;
  IF v_op IS NULL THEN
    RAISE EXCEPTION 'CRM FAIL: la conversión no creó la oportunidad';
  END IF;
  IF (v_res->>'cliente_id') IS NOT NULL THEN
    RAISE EXCEPTION 'CRM FAIL: la conversión devolvió un cliente sin haberlo ligado';
  END IF;

  SELECT sector, origen, destino INTO v_sector, v_origen, v_destino
  FROM public.crm_oportunidades WHERE id = v_op;
  IF v_sector IS DISTINCT FROM 'Manufactura' THEN
    RAISE EXCEPTION 'CRM FAIL: oportunidad nació con sector [%], esperaba el del lead', v_sector;
  END IF;
  IF v_origen <> 'Veracruz' OR v_destino <> 'Lázaro Cárdenas' THEN
    RAISE EXCEPTION 'CRM FAIL: oportunidad nació con origen/destino [%/%], esperaba los del lead', v_origen, v_destino;
  END IF;

  -- Idempotencia intacta: reconvertir no duplica.
  v_res := public.convertir_lead_rpc(v_lead, false, NULL, 'OP PROPAGA OLA6', 1000, 'MXN', NULL);
  IF (v_res->>'creado')::boolean IS NOT FALSE
     OR (v_res->>'oportunidad_id')::uuid <> v_op THEN
    RAISE EXCEPTION 'CRM FAIL: la reconversión duplicó la oportunidad';
  END IF;

  -- 3) Ligar un cliente existente de la misma organización sí funciona.
  INSERT INTO public.clientes (organization_id, nombre, rfc, cp, regimen_fiscal, email)
  VALUES (v_org, 'CLIENTE OLA6 COMPLETO', 'CLO260821AB2', '04360', '601', 'ola6-completo@test.mx')
  RETURNING id INTO v_cli;

  INSERT INTO public.crm_leads (organization_id, empresa, estado)
  VALUES (v_org, 'LEAD LIGA OLA6', 'Calificado'::public.crm_lead_estado)
  RETURNING id INTO v_lead2;

  v_res := public.convertir_lead_rpc(v_lead2, false, v_cli, 'OP LIGADA OLA6', 500, 'MXN', NULL);
  SELECT cliente_id INTO v_cli_op FROM public.crm_oportunidades
  WHERE id = (v_res->>'oportunidad_id')::uuid;
  IF v_cli_op IS DISTINCT FROM v_cli THEN
    RAISE EXCEPTION 'CRM FAIL: no se ligó el cliente existente a la oportunidad';
  END IF;

  -- 4) Un cliente de otra organización no puede ligarse.
  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org_ajena, 'CLIENTE AJENO OLA6', 'CAJ260821AB3', 'ola6-ajeno@test.mx')
  RETURNING id INTO v_cli_ajeno;

  INSERT INTO public.crm_leads (organization_id, empresa, estado)
  VALUES (v_org, 'LEAD AJENO OLA6', 'Calificado'::public.crm_lead_estado)
  RETURNING id INTO v_lead2;

  BEGIN
    v_res := public.convertir_lead_rpc(v_lead2, false, v_cli_ajeno, 'OP AJENA OLA6', 500, 'MXN', NULL);
    RAISE EXCEPTION 'CRM FAIL: se ligó un cliente de otra organización';
  EXCEPTION WHEN others THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_CLIENTE_NO_ENCONTRADO%' THEN
      RAISE EXCEPTION 'CRM FAIL: esperaba LC_CLIENTE_NO_ENCONTRADO, obtuve [%]', v_err;
    END IF;
  END;

  -- Limpieza
  DELETE FROM public.crm_oportunidades WHERE organization_id IN (v_org, v_org_ajena);
  DELETE FROM public.crm_leads WHERE organization_id IN (v_org, v_org_ajena);
  DELETE FROM public.crm_etapas_pipeline WHERE organization_id IN (v_org, v_org_ajena);
  DELETE FROM public.clientes WHERE organization_id IN (v_org, v_org_ajena);
  DELETE FROM public.organizations WHERE id IN (v_org, v_org_ajena);

  RAISE NOTICE 'OK ola6_convertir_propaga (alta de clientes prohibida en la conversión; herencia y ligado intactos)';
END$$;
