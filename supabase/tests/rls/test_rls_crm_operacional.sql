-- ============================================================================
-- Suite de pruebas de RLS — CRM + Operacional (Libre Carga)
-- ============================================================================
--
-- Cobertura: aislamiento multi-tenant en tablas no cubiertas por los suites
-- previos:
--   - crm_leads             (pipeline comercial)
--   - crm_oportunidades     (deals con monto estimado)
--   - crm_actividades       (tareas/llamadas/correos)
--   - documentos_embarque   (archivos operativos)
--   - presupuesto_mensual   (presupuesto financiero)
--
-- Cómo ejecutarlo (requiere base de pruebas con auth.users seeded; no correr
-- contra producción):
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_crm_operacional.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. ROLLBACK al final.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql


DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  emb_b uuid := gen_random_uuid();
  lead_a uuid := gen_random_uuid();
  lead_b uuid := gen_random_uuid();
  etapa_a uuid := gen_random_uuid();
  etapa_b uuid := gen_random_uuid();
  op_a uuid := gen_random_uuid();
  op_b uuid := gen_random_uuid();
  act_a uuid := gen_random_uuid();
  act_b uuid := gen_random_uuid();
  doc_a uuid := gen_random_uuid();
  doc_b uuid := gen_random_uuid();
  cat_a uuid := gen_random_uuid();
  cat_b uuid := gen_random_uuid();
  pres_a uuid := gen_random_uuid();
  pres_b uuid := gen_random_uuid();
  visible int;
BEGIN
  -- Seed base
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS CRM A'), (org_b, 'RLS CRM B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (user_a, 'admin_org'), (user_b, 'admin_org')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cli CRM A', 'XAXX010101000', 'a@test.local', org_a), (cli_b, 'Cli CRM B', 'XAXX010101001', 'b@test.local', org_b);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo)
  VALUES
    (emb_a, 'ELCRM00001', cli_a, 'Cli CRM A', org_a, 'Marítimo', 'Importación'),
    (emb_b, 'ELCRM00002', cli_b, 'Cli CRM B', org_b, 'Marítimo', 'Importación');

  -- Etapas pipeline (FK requerido por crm_oportunidades)
  -- Nombre único para no colisionar con etapas auto-seed del trigger handle_new_organization
  INSERT INTO public.crm_etapas_pipeline(id, organization_id, nombre, orden, probabilidad_default, color, tipo)
  VALUES
    (etapa_a, org_a, 'RLS Test Etapa', 99, 10, '#2563EB', 'abierta'),
    (etapa_b, org_b, 'RLS Test Etapa', 99, 10, '#2563EB', 'abierta');

  -- =========================================================================
  -- TEST 1: crm_leads — aislamiento por organization_id
  -- =========================================================================
  INSERT INTO public.crm_leads(
    id, organization_id, empresa, contacto, email, telefono, pais, ciudad,
    fuente, interes_modo, score, estado, vendedor_email, notas
  ) VALUES
    (lead_a, org_a, 'Lead A', 'Ana', 'a@a.mx', '555', 'MX', 'CDMX', 'Web', 'Marítimo', 5, 'Nuevo', 'v@a.mx', ''),
    (lead_b, org_b, 'Lead B', 'Beto', 'b@b.mx', '555', 'MX', 'MTY', 'Web', 'Aéreo', 5, 'Nuevo', 'v@b.mx', '');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.crm_leads WHERE id IN (lead_a, lead_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s crm_leads, esperaba 1', visible));

  -- TEST 2: User A no puede UPDATE lead de Org B
  UPDATE public.crm_leads SET empresa = 'HACKED' WHERE id = lead_b;
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT COUNT(*) INTO visible FROM public.crm_leads WHERE id = lead_b AND empresa = 'HACKED';
  PERFORM pg_temp.assert(visible = 0, 'User A modificó crm_leads de Org B (fuga RLS)');

  -- =========================================================================
  -- TEST 3: crm_oportunidades — aislamiento
  -- =========================================================================
  -- v13.777.6 — Fase 2 del rediseño CRM: `_crm_oportunidad_requiere_origen`
  -- exige origen (cliente_id o lead_id calificado). Se ancla al cliente de la
  -- misma org para no romper el candado de origen.
  INSERT INTO public.crm_oportunidades(
    id, organization_id, nombre, cliente_id, cliente_nombre, vendedor_email, etapa_id,
    monto_estimado, moneda, probabilidad, modo, tipo_carga, origen, destino, notas
  ) VALUES
    (op_a, org_a, 'Op A', cli_a, 'Cli CRM A', 'v@a.mx', etapa_a, 100000, 'MXN', 30, 'Marítimo', 'FCL', 'CN', 'MX', ''),
    (op_b, org_b, 'Op B', cli_b, 'Cli CRM B', 'v@b.mx', etapa_b, 200000, 'USD', 50, 'Aéreo', 'General', 'US', 'MX', '');


  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.crm_oportunidades WHERE id IN (op_a, op_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s crm_oportunidades, esperaba 1', visible));

  -- TEST 4: monto_estimado de Org B NUNCA visible para User A
  SELECT COUNT(*) INTO visible FROM public.crm_oportunidades WHERE monto_estimado = 200000;
  PERFORM pg_temp.assert(visible = 0, 'User A vio monto_estimado de oportunidad de Org B');

  -- =========================================================================
  -- TEST 5: crm_actividades — aislamiento
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.crm_actividades(
    id, organization_id, tipo, asunto, descripcion, entidad_tipo, entidad_id,
    resultado, responsable_email
  ) VALUES
    (act_a, org_a, 'llamada', 'Asunto A', 'desc', 'lead', lead_a, 'pendiente', 'v@a.mx'),
    (act_b, org_b, 'email', 'Asunto B', 'desc', 'lead', lead_b, 'pendiente', 'v@b.mx');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.crm_actividades WHERE id IN (act_a, act_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s crm_actividades, esperaba 1', visible));

  -- =========================================================================
  -- TEST 6: documentos_embarque — aislamiento vía embarque
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.documentos_embarque(id, embarque_id, nombre, estado, organization_id) VALUES
    (doc_a, emb_a, 'BL', 'Recibido', org_a),
    (doc_b, emb_b, 'BL', 'Recibido', org_b);

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.documentos_embarque WHERE id IN (doc_a, doc_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s documentos_embarque, esperaba 1', visible));

  -- =========================================================================
  -- TEST 7: presupuesto_mensual — aislamiento financiero
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre, orden, activa) VALUES
    (cat_a, org_a, 'RLS Test Cat', 99, true),
    (cat_b, org_b, 'RLS Test Cat', 99, true);
  INSERT INTO public.presupuesto_mensual(id, organization_id, categoria_id, periodo, monto_mxn) VALUES
    (pres_a, org_a, cat_a, '2026-06', 500000),
    (pres_b, org_b, cat_b, '2026-06', 999999);

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.presupuesto_mensual WHERE id IN (pres_a, pres_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s presupuesto_mensual, esperaba 1', visible));

  -- TEST 8: monto presupuestal de Org B nunca visible
  SELECT COUNT(*) INTO visible FROM public.presupuesto_mensual WHERE monto_mxn = 999999;
  PERFORM pg_temp.assert(visible = 0, 'User A vio monto presupuestal de Org B');

  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE '✓ test_rls_crm_operacional: 8 aserciones OK';
END;
$$;

ROLLBACK;
