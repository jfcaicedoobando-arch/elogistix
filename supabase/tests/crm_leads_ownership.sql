-- =============================================================
-- crm_leads_ownership.sql · v13.823.60
--
-- Congela la autorización y el ownership de leads:
--   A) crm_calificar_prospecto: rol EFECTIVO en la organización del lead
--      (no has_role global), ownership del vendedor, LC_LEAD_SIN_ASIGNAR,
--      ICP antes del retorno idempotente.
--   B) crm_tomar_lead: mismo criterio in-org, atomicidad y idempotencia.
--   C) RLS crm_leads: gestión in-org escribe, vendedor sólo su propio lead,
--      operador/viewer leen pero no escriben, cross-org bloqueado, y ni
--      organization_id ni vendedor_id pueden reasignarse a lo propio.
--   D) Invariantes de definición y ACL de las dos RPCs.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/crm_leads_ownership.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

CREATE OR REPLACE FUNCTION pg_temp.espera_lc(_sql text, _codigo text, _caso text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_msg text;
  v_permitido boolean := false;
BEGIN
  BEGIN
    EXECUTE _sql;
    v_permitido := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF position(_codigo in v_msg) = 0 THEN
      RAISE EXCEPTION 'FALLO %: se esperaba % y llegó «%»', _caso, _codigo, v_msg;
    END IF;
  END;

  IF v_permitido THEN
    RAISE EXCEPTION 'FALLO %: se esperaba % y la operación fue permitida', _caso, _codigo;
  END IF;
END;
$$;

DO $$
DECLARE
  v_org_a uuid := 'b0b0b0b0-0000-4000-8000-00000000000a';
  v_org_b uuid := 'b0b0b0b0-0000-4000-8000-00000000000b';
  v_vend uuid := 'b0b0b0b0-0000-4000-8000-000000000201';
  v_vend2 uuid := 'b0b0b0b0-0000-4000-8000-000000000202';
  v_stale uuid := 'b0b0b0b0-0000-4000-8000-000000000203';  -- role global vendedor, membership customer_service
  v_fresh uuid := 'b0b0b0b0-0000-4000-8000-000000000204';  -- membership vendedor, role global stale distinto
  v_gerente uuid := 'b0b0b0b0-0000-4000-8000-000000000205';
  v_operador uuid := 'b0b0b0b0-0000-4000-8000-000000000206';
  v_user_b uuid := 'b0b0b0b0-0000-4000-8000-000000000211';
  v_lead_propio uuid := 'b0b0b0b0-0000-4000-8000-000000000301';
  v_lead_ajeno uuid := 'b0b0b0b0-0000-4000-8000-000000000302';
  v_lead_bolsa uuid := 'b0b0b0b0-0000-4000-8000-000000000303';
  v_lead_fresh uuid := 'b0b0b0b0-0000-4000-8000-000000000304';
  v_lead_prospecto uuid := 'b0b0b0b0-0000-4000-8000-000000000305';
  v_lead_prosp_incompleto uuid := 'b0b0b0b0-0000-4000-8000-000000000306';
  v_lead_b uuid := 'b0b0b0b0-0000-4000-8000-000000000311';
  v_res jsonb;
  v_n integer;
BEGIN
  BEGIN
    INSERT INTO auth.users(id, email) VALUES
      (v_vend, 'own-vend@test.local'), (v_vend2, 'own-vend2@test.local'),
      (v_stale, 'own-stale@test.local'), (v_fresh, 'own-fresh@test.local'),
      (v_gerente, 'own-ger@test.local'), (v_operador, 'own-oper@test.local'),
      (v_user_b, 'own-b@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;  -- CI sin GoTrue
  END;

  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org_a, 'TEST OWNERSHIP A'), (v_org_b, 'TEST OWNERSHIP B');

  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
    (v_org_a, v_vend, 'vendedor'),
    (v_org_a, v_vend2, 'vendedor'),
    (v_org_a, v_stale, 'customer_service'),
    (v_org_a, v_fresh, 'vendedor'),
    (v_org_a, v_gerente, 'gerente_comercial'),
    (v_org_a, v_operador, 'coordinador_logistico'),
    (v_org_b, v_user_b, 'admin_org');

  -- Roles globales deliberadamente desalineados con la membresía.
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_vend, 'vendedor'), (v_vend2, 'vendedor'),
    (v_stale, 'vendedor'),            -- credencial "de otra sucursal"
    (v_fresh, 'customer_service'),    -- rol global viejo, membership vendedor
    (v_gerente, 'gerente_comercial'), (v_operador, 'coordinador_logistico'),
    (v_user_b, 'admin_org')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.crm_leads (
    id, organization_id, empresa, estado, vendedor_id,
    sector, mercancia, rutas, volumen, frecuencia, dolor_explicito, proveedor_actual
  ) VALUES
    (v_lead_propio, v_org_a, 'Lead propio', 'Contactado', v_vend,
      'Automotriz', 'Refacciones', 'CN-MX', '2 TEU', 'Mensual', 'Demoras', 'Otro forwarder'),
    (v_lead_ajeno, v_org_a, 'Lead ajeno', 'Contactado', v_vend2,
      'Automotriz', 'Refacciones', 'CN-MX', '2 TEU', 'Mensual', 'Demoras', 'Otro forwarder'),
    (v_lead_bolsa, v_org_a, 'Lead bolsa', 'Contactado', NULL,
      'Automotriz', 'Refacciones', 'CN-MX', '2 TEU', 'Mensual', 'Demoras', 'Otro forwarder'),
    (v_lead_fresh, v_org_a, 'Lead fresh', 'Contactado', v_fresh,
      'Automotriz', 'Refacciones', 'CN-MX', '2 TEU', 'Mensual', 'Demoras', 'Otro forwarder'),
    (v_lead_prospecto, v_org_a, 'Lead ya prospecto', 'Prospecto', v_vend,
      'Automotriz', 'Refacciones', 'CN-MX', '2 TEU', 'Mensual', 'Demoras', 'Otro forwarder'),
    (v_lead_prosp_incompleto, v_org_a, 'Lead prospecto sin ICP', 'Prospecto', v_vend,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (v_lead_b, v_org_b, 'Lead B', 'Contactado', v_user_b,
      'Automotriz', 'Refacciones', 'CN-MX', '2 TEU', 'Mensual', 'Demoras', 'Otro forwarder');

  -- ===== A) crm_calificar_prospecto =====

  -- A1 · vendedor propietario: camino feliz.
  PERFORM pg_temp.as_user(v_vend);
  v_res := public.crm_calificar_prospecto(v_lead_propio);
  PERFORM pg_temp.assert((v_res->>'calificado') = 'true',
    'A1: el vendedor propietario debe poder calificar su lead');
  PERFORM pg_temp.assert(
    (SELECT estado FROM public.crm_leads WHERE id = v_lead_propio) = 'Prospecto'::crm_lead_estado,
    'A1: el lead calificado debe quedar en Prospecto');

  -- A2 · vendedor con lead AJENO: ownership cerrado.
  PERFORM pg_temp.espera_lc(
    format('SELECT public.crm_calificar_prospecto(%L)', v_lead_ajeno),
    'LC_LEAD_SIN_PERMISO_CALIFICAR', 'A2 vendedor sobre lead ajeno');

  -- A3 · lead sin asignar: falla cerrado para cualquier rol.
  PERFORM pg_temp.espera_lc(
    format('SELECT public.crm_calificar_prospecto(%L)', v_lead_bolsa),
    'LC_LEAD_SIN_ASIGNAR', 'A3 vendedor sobre lead sin asignar');
  PERFORM pg_temp.as_user(v_gerente);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.crm_calificar_prospecto(%L)', v_lead_bolsa),
    'LC_LEAD_SIN_ASIGNAR', 'A3b gerente sobre lead sin asignar');

  -- A4 · gerente comercial in-org sobre lead ASIGNADO ajeno: permitido.
  v_res := public.crm_calificar_prospecto(v_lead_ajeno);
  PERFORM pg_temp.assert((v_res->>'calificado') = 'true',
    'A4: gerencia comercial de la organización debe poder calificar un lead asignado ajeno');

  -- A5 · role global vendedor pero membership customer_service: bloqueado.
  PERFORM pg_temp.as_user(v_stale);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.crm_calificar_prospecto(%L)', v_lead_fresh),
    'LC_LEAD_SIN_PERMISO_CALIFICAR', 'A5 role global no basta');

  -- A6 · membership vendedor con role global stale distinto: sí puede su lead.
  PERFORM pg_temp.as_user(v_fresh);
  v_res := public.crm_calificar_prospecto(v_lead_fresh);
  PERFORM pg_temp.assert((v_res->>'calificado') = 'true',
    'A6: la membresía vigente manda sobre el rol global viejo');

  -- A7 · retry idempotente con expediente completo: sin UPDATE ni bitácora.
  PERFORM pg_temp.as_user(v_vend);
  SELECT count(*) INTO v_n FROM public.bitacora_actividad
   WHERE entidad_id = v_lead_prospecto AND accion = 'crm_calificar_prospecto';
  v_res := public.crm_calificar_prospecto(v_lead_prospecto);
  PERFORM pg_temp.assert((v_res->>'calificado') = 'false',
    'A7: recalificar un prospecto debe ser idempotente');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.bitacora_actividad
      WHERE entidad_id = v_lead_prospecto AND accion = 'crm_calificar_prospecto') = v_n,
    'A7: el retry idempotente no debe escribir una segunda bitácora');

  -- A8 · retry sobre prospecto con ICP incompleto: avisa, no aprueba mudo.
  PERFORM pg_temp.espera_lc(
    format('SELECT public.crm_calificar_prospecto(%L)', v_lead_prosp_incompleto),
    'LC_LEAD_PERFIL_INCOMPLETO', 'A8 retry con ICP incompleto');

  -- A9 · cross-org.
  PERFORM pg_temp.as_user(v_user_b);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.crm_calificar_prospecto(%L)', v_lead_propio),
    'LC_ORG_AJENA', 'A9 usuario de otra organización');

  -- ===== B) crm_tomar_lead =====

  -- B1 · role global vendedor con membership customer_service: bloqueado.
  PERFORM pg_temp.as_user(v_stale);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.crm_tomar_lead(%L)', v_lead_bolsa),
    'LC_LEAD_SIN_PERMISO_TOMA', 'B1 role global no basta para tomar');

  -- B2 · vendedor efectivo toma el lead de la bolsa; retry idempotente.
  PERFORM pg_temp.as_user(v_vend);
  v_res := public.crm_tomar_lead(v_lead_bolsa);
  PERFORM pg_temp.assert((v_res->>'tomado') = 'true', 'B2: el vendedor debe poder tomar el lead libre');
  PERFORM pg_temp.assert((public.crm_tomar_lead(v_lead_bolsa)->>'tomado') = 'false',
    'B2b: re-tomar un lead propio es idempotente');

  -- B3 · otro actor no puede robarlo.
  PERFORM pg_temp.as_user(v_vend2);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.crm_tomar_lead(%L)', v_lead_bolsa),
    'LC_LEAD_YA_ASIGNADO', 'B3 lead ya asignado');

  -- B4 · cross-org.
  PERFORM pg_temp.as_user(v_user_b);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.crm_tomar_lead(%L)', v_lead_propio),
    'LC_ORG_AJENA', 'B4 tomar lead de otra organización');

  -- ===== C) RLS crm_leads =====

  -- C1 · operador conserva SELECT pero no UPDATE.
  PERFORM pg_temp.as_user(v_operador);
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_leads WHERE id = v_lead_propio) = 1,
    'C1: operador debe conservar lectura in-org');
  UPDATE public.crm_leads SET empresa = 'Operador manda' WHERE id = v_lead_propio;
  PERFORM pg_temp.assert(
    (SELECT empresa FROM public.crm_leads WHERE id = v_lead_propio) <> 'Operador manda',
    'C1b: operador no debe poder escribir leads');

  -- C2 · vendedor no puede editar un lead ajeno.
  PERFORM pg_temp.as_user(v_vend);
  UPDATE public.crm_leads SET empresa = 'Robo directo' WHERE id = v_lead_ajeno;
  PERFORM pg_temp.assert(
    (SELECT empresa FROM public.crm_leads WHERE id = v_lead_ajeno) <> 'Robo directo',
    'C2: el vendedor no debe poder editar un lead ajeno');

  -- C3 · el vendedor tampoco puede apropiárselo cambiando vendedor_id.
  UPDATE public.crm_leads SET vendedor_id = v_vend WHERE id = v_lead_ajeno;
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(
    (SELECT vendedor_id FROM public.crm_leads WHERE id = v_lead_ajeno) = v_vend2,
    'C3: no se puede convertir una fila ajena en propia vía vendedor_id');

  -- C4 · el vendedor no puede mover su lead a otra organización: WITH CHECK
  -- lo rechaza con error explícito (no silenciosamente 0 filas).
  PERFORM pg_temp.as_user(v_vend);
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_leads SET organization_id = %L WHERE id = %L', v_org_b, v_lead_propio),
    'row-level security', 'C4 mover lead a otra organización');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(
    (SELECT organization_id FROM public.crm_leads WHERE id = v_lead_propio) = v_org_a,
    'C4: organization_id de un lead no puede cambiarse desde el cliente');

  -- C5 · gerencia comercial in-org sí escribe.
  PERFORM pg_temp.as_user(v_gerente);
  UPDATE public.crm_leads SET empresa = 'Gerente edita' WHERE id = v_lead_ajeno;
  PERFORM pg_temp.assert(
    (SELECT empresa FROM public.crm_leads WHERE id = v_lead_ajeno) = 'Gerente edita',
    'C5: gerencia comercial debe poder editar leads de su organización');

  -- C6 · usuario de otra organización no lee ni escribe los leads de A.
  PERFORM pg_temp.as_user(v_user_b);
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_leads WHERE organization_id = v_org_a) = 0,
    'C6: cross-org no debe ver leads de otra organización');

  PERFORM pg_temp.as_postgres();
END;
$$;

-- ===== D) Invariantes de definición y ACL =====
DO $$
DECLARE
  v_def text;
  v_acl text;
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('crm_calificar_prospecto', 'crm_tomar_lead')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    PERFORM pg_temp.assert(v_def LIKE '%SECURITY DEFINER%',
      format('D: %s debe seguir siendo SECURITY DEFINER', r.proname));
    PERFORM pg_temp.assert(v_def LIKE '%SET search_path TO ''public''%',
      format('D: %s debe fijar search_path', r.proname));
    PERFORM pg_temp.assert(position('has_role(' in v_def) = 0,
      format('D: %s no debe usar has_role global', r.proname));
    PERFORM pg_temp.assert(position('WHEN OTHERS' in v_def) = 0,
      format('D: %s no debe atrapar WHEN OTHERS', r.proname));
    PERFORM pg_temp.assert(position('has_any_role_in_org' in v_def) > 0,
      format('D: %s debe autorizar con has_any_role_in_org', r.proname));
    PERFORM pg_temp.assert(position('rls_tenant_scope_ok' in v_def) > 0,
      format('D: %s debe validar el tenant activo', r.proname));

    SELECT COALESCE(array_to_string(proacl::text[], '|'), 'default') INTO v_acl
      FROM pg_proc WHERE oid = r.oid;
    PERFORM pg_temp.assert(position('=X/' in v_acl) > 0 AND v_acl NOT LIKE '=X/%',
      format('D: %s no debe conceder EXECUTE a PUBLIC (acl=%s)', r.proname, v_acl));
    PERFORM pg_temp.assert(position('anon=' in v_acl) = 0,
      format('D: %s no debe conceder EXECUTE a anon (acl=%s)', r.proname, v_acl));
    PERFORM pg_temp.assert(position('authenticated=X' in v_acl) > 0,
      format('D: %s debe conceder EXECUTE a authenticated (acl=%s)', r.proname, v_acl));
  END LOOP;

  PERFORM pg_temp.assert(
    NOT EXISTS (
      SELECT 1 FROM aclexplode((SELECT relacl FROM pg_class WHERE oid = 'public.crm_leads'::regclass)) a
       WHERE pg_get_userbyid(a.grantee) = 'anon'),
    'D: anon no debe tener privilegios sobre crm_leads');

  PERFORM pg_temp.assert(
    (SELECT count(*) FROM pg_policy
      WHERE polrelid = 'public.crm_leads'::regclass
        AND polname IN ('Gestion leads in-org crm_leads', 'Vendedor own crm_leads',
                        'Vendedor bolsa crm_leads', 'Lectura in-org crm_leads')) = 4,
    'D: crm_leads debe tener las 4 policies permisivas in-org');

  PERFORM pg_temp.assert(
    (SELECT polcmd FROM pg_policy
      WHERE polrelid = 'public.crm_leads'::regclass
        AND polname = 'Vendedor bolsa crm_leads') = 'r',
    'D: la bolsa común debe ser sólo lectura (la toma pasa por la RPC)');

  PERFORM pg_temp.assert(
    NOT EXISTS (
      SELECT 1 FROM pg_policy
       WHERE polrelid = 'public.crm_leads'::regclass
         AND polpermissive
         AND polcmd <> 'r'
         AND position('has_any_role_in_org' in COALESCE(pg_get_expr(polqual, polrelid), '')) = 0),
    'D: ninguna policy de escritura puede autorizar sin has_any_role_in_org');

  PERFORM pg_temp.assert(
    EXISTS (
      SELECT 1 FROM pg_policy
       WHERE polrelid = 'public.crm_leads'::regclass
         AND NOT polpermissive
         AND polname = 'Scope tenant activo super admin'),
    'D: debe conservarse la policy restrictiva de tenant activo');
END;
$$;

ROLLBACK;
