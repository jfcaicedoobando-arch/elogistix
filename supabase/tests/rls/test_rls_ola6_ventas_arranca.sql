-- ============================================================================
-- Suite RLS — Ola 6 "Ventas arranca" (O6.1 bolsa de leads + O6.3 etapas)
--
-- Cobertura:
--   O6.1 · Policy "Vendedor bolsa crm_leads" + RPC crm_tomar_lead:
--     - vendedor VE los leads sin asignar de su org (bolsa común)
--     - vendedor NO ve la bolsa de OTRA org (cross-tenant)
--     - escritura "de lo propio" intacta: un vendedor NO puede actualizar el
--       lead asignado a otro vendedor
--     - crm_tomar_lead asigna vendedor_id = auth.uid() y es idempotente
--     - segunda toma (otro vendedor) → LC_LEAD_YA_ASIGNADO y el lead queda
--       fuera de su alcance de escritura
--     - toma cross-tenant → LC_ORG_AJENA
--     - rol sin ventas (customer_service) → LC_LEAD_SIN_PERMISO_TOMA
--   O6.3 · Policy "Tenant admin crm_etapas_pipeline":
--     - gerente_comercial SÍ escribe etapas de su org
--     - vendedor NO escribe etapas, pero SÍ las lee (kanban)
--     - gerente_comercial NO escribe etapas de otra org (cross-tenant)
--
-- Nota de lectura: "Tenant viewer crm_leads" (20260525014353) + la jerarquía
-- de has_role ya permiten al vendedor LEER todos los leads de su org; la bolsa
-- se ejerce en la ESCRITURA (sólo crm_tomar_lead asigna).
--
-- Cómo ejecutarlo (base de pruebas; no correr contra producción):
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_ola6_ventas_arranca.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. ROLLBACK al final.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  vendedor_a1 uuid := gen_random_uuid();
  vendedor_a2 uuid := gen_random_uuid();
  vendedor_b uuid := gen_random_uuid();
  gerente_a uuid := gen_random_uuid();
  sin_ventas_a uuid := gen_random_uuid();
  lead_bolsa_a uuid := gen_random_uuid();
  lead_bolsa_a2 uuid := gen_random_uuid();
  lead_asignado_a uuid := gen_random_uuid();
  lead_bolsa_b uuid := gen_random_uuid();
  etapa_a uuid := gen_random_uuid();
  etapa_b uuid := gen_random_uuid();
  visible int;
  v_res jsonb;
  v_vendedor uuid;
BEGIN
  -- Seed base (como postgres, sin RLS)
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'RLS OLA6 A'), (org_b, 'RLS OLA6 B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, vendedor_a1, 'vendedor'),
    (org_a, vendedor_a2, 'vendedor'),
    (org_b, vendedor_b, 'vendedor'),
    (org_a, gerente_a, 'gerente_comercial'),
    (org_a, sin_ventas_a, 'customer_service');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (vendedor_a1, 'vendedor'),
    (vendedor_a2, 'vendedor'),
    (vendedor_b, 'vendedor'),
    (gerente_a, 'gerente_comercial'),
    (sin_ventas_a, 'customer_service')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.crm_etapas_pipeline(id, organization_id, nombre, orden, tipo)
  VALUES
    (etapa_a, org_a, 'RLS OLA6 Etapa A', 99, 'abierta'),
    (etapa_b, org_b, 'RLS OLA6 Etapa B', 99, 'abierta');

  INSERT INTO public.crm_leads(id, organization_id, empresa, estado, vendedor_id)
  VALUES
    (lead_bolsa_a, org_a, 'Lead Bolsa A1', 'Nuevo', NULL),
    (lead_bolsa_a2, org_a, 'Lead Bolsa A2', 'Nuevo', NULL),
    (lead_asignado_a, org_a, 'Lead Asignado A', 'Nuevo', vendedor_a2),
    (lead_bolsa_b, org_b, 'Lead Bolsa B', 'Nuevo', NULL);

  -- =========================================================================
  -- O6.1 · TEST 1: vendedor ve la bolsa de SU org (lead sin asignar)
  -- =========================================================================
  PERFORM pg_temp.as_user(vendedor_a1);
  SELECT COUNT(*) INTO visible FROM public.crm_leads WHERE id = lead_bolsa_a;
  PERFORM pg_temp.assert(visible = 1,
    'O6.1: vendedor no vio el lead sin asignar de su org (bolsa)');

  -- TEST 2: RLS de escritura intacto — NO puede actualizar el lead de otro
  UPDATE public.crm_leads SET empresa = 'HACKED' WHERE id = lead_asignado_a;
  PERFORM pg_temp.as_postgres();
  SELECT COUNT(*) INTO visible FROM public.crm_leads
   WHERE id = lead_asignado_a AND empresa = 'HACKED';
  PERFORM pg_temp.assert(visible = 0,
    'O6.1: vendedor modificó un lead asignado a otro vendedor (fuga RLS)');

  -- TEST 3: cross-tenant — vendedor A NO ve la bolsa de Org B
  PERFORM pg_temp.as_user(vendedor_a1);
  SELECT COUNT(*) INTO visible FROM public.crm_leads WHERE id = lead_bolsa_b;
  PERFORM pg_temp.assert(visible = 0,
    'O6.1: vendedor vio la bolsa de otra organización (fuga cross-tenant)');

  -- =========================================================================
  -- O6.1 · TEST 4: crm_tomar_lead asigna vendedor_id = auth.uid()
  -- =========================================================================
  v_res := public.crm_tomar_lead(lead_bolsa_a);
  PERFORM pg_temp.assert((v_res->>'tomado')::boolean IS TRUE,
    'O6.1: crm_tomar_lead no reportó tomado=true');
  PERFORM pg_temp.assert((v_res->>'vendedor_id')::uuid = vendedor_a1,
    'O6.1: crm_tomar_lead no asignó vendedor_id = auth.uid()');

  PERFORM pg_temp.as_postgres();
  SELECT vendedor_id INTO v_vendedor FROM public.crm_leads WHERE id = lead_bolsa_a;
  PERFORM pg_temp.assert(v_vendedor = vendedor_a1,
    'O6.1: el lead no quedó asignado al vendedor que lo tomó');

  -- TEST 5: idempotencia — re-tomar el lead propio NO es error
  PERFORM pg_temp.as_user(vendedor_a1);
  v_res := public.crm_tomar_lead(lead_bolsa_a);
  PERFORM pg_temp.assert((v_res->>'tomado')::boolean IS FALSE,
    'O6.1: re-tomar el lead propio debía ser idempotente (tomado=false)');

  -- TEST 6: otro vendedor NO puede tomarlo ni escribirlo
  PERFORM pg_temp.as_user(vendedor_a2);
  BEGIN
    PERFORM public.crm_tomar_lead(lead_bolsa_a);
    RAISE EXCEPTION 'O6.1: segundo vendedor tomó un lead ya asignado';
  EXCEPTION WHEN raise_exception THEN
    PERFORM pg_temp.assert(SQLERRM LIKE '%LC_LEAD_YA_ASIGNADO%',
      format('O6.1: segunda toma lanzó [%s] en vez de LC_LEAD_YA_ASIGNADO', SQLERRM));
  END;
  UPDATE public.crm_leads SET empresa = 'HACKED' WHERE id = lead_bolsa_a;
  PERFORM pg_temp.as_postgres();
  SELECT COUNT(*) INTO visible FROM public.crm_leads
   WHERE id = lead_bolsa_a AND empresa = 'HACKED';
  PERFORM pg_temp.assert(visible = 0,
    'O6.1: otro vendedor modificó un lead ya tomado (fuga RLS)');

  -- TEST 7: toma cross-tenant bloqueada (vendedor B sobre lead libre de Org A)
  PERFORM pg_temp.as_user(vendedor_b);
  BEGIN
    PERFORM public.crm_tomar_lead(lead_bolsa_a2);
    RAISE EXCEPTION 'O6.1: toma cross-tenant NO fue bloqueada';
  EXCEPTION WHEN raise_exception THEN
    PERFORM pg_temp.assert(SQLERRM LIKE '%LC_ORG_AJENA%',
      format('O6.1: toma cross-tenant lanzó [%s] en vez de LC_ORG_AJENA', SQLERRM));
  END;

  -- TEST 8: customer_service (sin rol de ventas) no puede tomar leads
  PERFORM pg_temp.as_user(sin_ventas_a);
  BEGIN
    PERFORM public.crm_tomar_lead(lead_bolsa_a2);
    RAISE EXCEPTION 'O6.1: customer_service tomó un lead';
  EXCEPTION WHEN raise_exception THEN
    PERFORM pg_temp.assert(SQLERRM LIKE '%LC_LEAD_SIN_PERMISO_TOMA%',
      format('O6.1: toma por customer_service lanzó [%s] en vez de LC_LEAD_SIN_PERMISO_TOMA', SQLERRM));
  END;

  -- El lead libre de Org A sigue sin asignar tras los intentos bloqueados
  PERFORM pg_temp.as_postgres();
  SELECT vendedor_id INTO v_vendedor FROM public.crm_leads WHERE id = lead_bolsa_a2;
  PERFORM pg_temp.assert(v_vendedor IS NULL,
    'O6.1: un intento bloqueado de toma modificó el lead');

  -- =========================================================================
  -- O6.3 · TEST 9: gerente_comercial SÍ escribe etapas de su org
  -- =========================================================================
  PERFORM pg_temp.as_user(gerente_a);
  INSERT INTO public.crm_etapas_pipeline(organization_id, nombre, orden, tipo)
  VALUES (org_a, 'RLS OLA6 Etapa Gerente', 100, 'abierta');
  UPDATE public.crm_etapas_pipeline SET orden = 98 WHERE id = etapa_a;

  -- TEST 10: vendedor lee etapas (kanban) pero NO las escribe
  PERFORM pg_temp.as_user(vendedor_a1);
  SELECT COUNT(*) INTO visible FROM public.crm_etapas_pipeline WHERE id = etapa_a;
  PERFORM pg_temp.assert(visible = 1,
    'O6.3: vendedor no pudo leer las etapas de su org');
  BEGIN
    INSERT INTO public.crm_etapas_pipeline(organization_id, nombre, orden, tipo)
    VALUES (org_a, 'RLS OLA6 Etapa Vendedor', 101, 'abierta');
    RAISE EXCEPTION 'O6.3: vendedor insertó una etapa del pipeline';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    NULL; -- bloqueo RLS esperado
  END;

  -- TEST 11: gerente_comercial NO escribe etapas de OTRA org (cross-tenant)
  PERFORM pg_temp.as_user(gerente_a);
  UPDATE public.crm_etapas_pipeline SET orden = 97 WHERE id = etapa_b;
  PERFORM pg_temp.as_postgres();
  SELECT COUNT(*) INTO visible FROM public.crm_etapas_pipeline WHERE id = etapa_b AND orden = 97;
  PERFORM pg_temp.assert(visible = 0,
    'O6.3: gerente_comercial modificó etapas de otra organización (fuga RLS)');

  RAISE NOTICE 'OK ola6_ventas_arranca: bolsa de leads + crm_tomar_lead + policy etapas';
END;
$$;

ROLLBACK;
