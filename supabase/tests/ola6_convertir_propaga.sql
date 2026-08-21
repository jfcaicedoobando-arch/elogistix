-- Ola 6 · O6.2 — convertir_lead_rpc propaga los datos fiscales del lead.
--
-- Regresión: antes el cliente nacía con rfc/direccion/cp = '' aunque el lead
-- ya los tuviera capturados (20260818212541), y la oportunidad no heredaba
-- sector/origen/destino. Captura única restaurada.
--
-- Ejecutar con:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola6_convertir_propaga.sql
DO $$
DECLARE
  v_org uuid;
  v_etapa uuid;
  v_lead uuid;
  v_res jsonb;
  v_cli uuid;
  v_op uuid;
  v_rfc text;
  v_direccion text;
  v_cp text;
  v_estado_cli text;
  v_sector text;
  v_origen text;
  v_destino text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST OLA6 PROPAGA', 'TO6200000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, tipo, orden, activa)
  VALUES (v_org, 'Prospección OLA6P', 'abierta'::public.crm_etapa_tipo, 1, true)
  RETURNING id INTO v_etapa;

  INSERT INTO public.crm_leads (
    organization_id, empresa, estado,
    rfc, direccion, cp, entidad_federativa, sector, origen, destino
  ) VALUES (
    v_org, 'LEAD FISCAL OLA6', 'Nuevo'::public.crm_lead_estado,
    'PROS260821AB1', 'Av. Siempre Viva 742', '04360', 'Ciudad de México',
    'Manufactura', 'Veracruz', 'Lázaro Cárdenas'
  ) RETURNING id INTO v_lead;

  v_res := public.convertir_lead_rpc(v_lead, true, NULL, 'OP PROPAGA OLA6', 1000, 'MXN', NULL);
  v_cli := (v_res->>'cliente_id')::uuid;
  v_op := (v_res->>'oportunidad_id')::uuid;
  IF v_cli IS NULL OR v_op IS NULL THEN
    RAISE EXCEPTION 'OLA6 O6.2 FAIL: la conversión no creó cliente/oportunidad';
  END IF;

  -- El cliente nace con los datos fiscales del lead (cero recaptura).
  SELECT rfc, direccion, cp, estado INTO v_rfc, v_direccion, v_cp, v_estado_cli
  FROM public.clientes WHERE id = v_cli;
  IF v_rfc <> 'PROS260821AB1' THEN
    RAISE EXCEPTION 'OLA6 O6.2 FAIL: cliente nació con rfc [%], esperaba el del lead', v_rfc;
  END IF;
  IF v_direccion <> 'Av. Siempre Viva 742' THEN
    RAISE EXCEPTION 'OLA6 O6.2 FAIL: cliente nació con direccion [%], esperaba la del lead', v_direccion;
  END IF;
  IF v_cp <> '04360' THEN
    RAISE EXCEPTION 'OLA6 O6.2 FAIL: cliente nació con cp [%], esperaba el del lead', v_cp;
  END IF;
  IF v_estado_cli <> 'Ciudad de México' THEN
    RAISE EXCEPTION 'OLA6 O6.2 FAIL: cliente nació con estado [%], esperaba entidad_federativa del lead', v_estado_cli;
  END IF;

  -- La oportunidad hereda sector/origen/destino del lead.
  SELECT sector, origen, destino INTO v_sector, v_origen, v_destino
  FROM public.crm_oportunidades WHERE id = v_op;
  IF v_sector IS DISTINCT FROM 'Manufactura' THEN
    RAISE EXCEPTION 'OLA6 O6.2 FAIL: oportunidad nació con sector [%], esperaba el del lead', v_sector;
  END IF;
  IF v_origen <> 'Veracruz' OR v_destino <> 'Lázaro Cárdenas' THEN
    RAISE EXCEPTION 'OLA6 O6.2 FAIL: oportunidad nació con origen/destino [%/%, esperaba los del lead', v_origen, v_destino;
  END IF;

  -- Idempotencia intacta: reconvertir no duplica ni pisa los datos.
  v_res := public.convertir_lead_rpc(v_lead, true, NULL, 'OP PROPAGA OLA6', 1000, 'MXN', NULL);
  IF (v_res->>'creado')::boolean IS NOT FALSE
     OR (v_res->>'cliente_id')::uuid <> v_cli
     OR (v_res->>'oportunidad_id')::uuid <> v_op THEN
    RAISE EXCEPTION 'OLA6 O6.2 FAIL: la reconversión duplicó cliente/oportunidad';
  END IF;

  -- Limpieza
  DELETE FROM public.crm_oportunidades WHERE organization_id = v_org;
  DELETE FROM public.crm_leads WHERE organization_id = v_org;
  DELETE FROM public.crm_etapas_pipeline WHERE organization_id = v_org;
  DELETE FROM public.clientes WHERE organization_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;

  RAISE NOTICE 'OK ola6_convertir_propaga (O6.2: rfc/direccion/cp al cliente, sector/origen/destino a la oportunidad)';
END$$;
