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
  -- Fixture indispensable: sin usuarios auth no hay sesión que probar, así que
  -- NO se envuelve en WHEN OTHERS (tragaba el error y dejaba un falso rojo/verde).
  INSERT INTO auth.users(id, email) VALUES
    (v_vend, 'own-vend@test.local'), (v_vend2, 'own-vend2@test.local'),
    (v_stale, 'own-stale@test.local'), (v_fresh, 'own-fresh@test.local'),
    (v_gerente, 'own-ger@test.local'), (v_operador, 'own-oper@test.local'),
    (v_user_b, 'own-b@test.local');

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
        AND polname IN ('Gestion leads in-org select crm_leads',
                        'Gestion leads in-org insert crm_leads',
                        'Gestion leads in-org update crm_leads',
                        'Vendedor own select crm_leads',
                        'Vendedor own insert crm_leads',
                        'Vendedor own update crm_leads',
                        'Vendedor bolsa crm_leads', 'Lectura in-org crm_leads')) = 8,
    'D: crm_leads debe tener las 8 policies permisivas in-org por comando');

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
         AND position('has_any_role_in_org' in
               COALESCE(pg_get_expr(polqual, polrelid), '')
               || COALESCE(pg_get_expr(polwithcheck, polrelid), '')) = 0),
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

-- ===== E) v13.823.61 · organización ACTIVA, ACL exacta y Papelera =====
--
-- Nota de fixture: los roles legacy 'operador' y 'viewer' están bloqueados por
-- `trg_bloquear_rol_legacy_om`, así que el "operador real" se siembra con su
-- equivalente moderno `coordinador_logistico` y el "viewer real" con
-- `customer_service`. Ambos entran por la policy de lectura in-org.
DO $$
DECLARE
  v_org_a uuid := 'c1c1c1c1-0000-4000-8000-00000000000a';
  v_org_b uuid := 'c1c1c1c1-0000-4000-8000-00000000000b';
  v_multi uuid := 'c1c1c1c1-0000-4000-8000-000000000101';  -- miembro de A y B
  v_oper uuid := 'c1c1c1c1-0000-4000-8000-000000000102';   -- operador moderno
  v_viewer uuid := 'c1c1c1c1-0000-4000-8000-000000000103';  -- viewer moderno
  v_super uuid := 'c1c1c1c1-0000-4000-8000-000000000104';
  v_lead_a uuid := 'c1c1c1c1-0000-4000-8000-000000000201';
  v_lead_b uuid := 'c1c1c1c1-0000-4000-8000-000000000202';
  v_lead_soft uuid := 'c1c1c1c1-0000-4000-8000-000000000203';
BEGIN
  INSERT INTO auth.users(id, email) VALUES
    (v_multi, 'e-multi@test.local'), (v_oper, 'e-oper@test.local'),
    (v_viewer, 'e-viewer@test.local'), (v_super, 'e-super@test.local');

  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org_a, 'TEST ORG ACTIVA A'), (v_org_b, 'TEST ORG ACTIVA B');

  -- created_at explícito: `default_user_org_id()` ordena por created_at y luego
  -- por organization_id, así que A queda determinísticamente como la ACTIVA.
  INSERT INTO public.organization_members (organization_id, user_id, role, created_at) VALUES
    (v_org_a, v_multi, 'gerente_comercial', now() - interval '2 day'),
    (v_org_b, v_multi, 'admin_org',         now() - interval '1 day'),
    (v_org_a, v_oper, 'coordinador_logistico', now()),
    (v_org_a, v_viewer, 'customer_service', now());

  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_multi, 'gerente_comercial'), (v_oper, 'coordinador_logistico'),
    (v_viewer, 'customer_service'), (v_super, 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.super_admin_org_activa (user_id, organization_id)
  VALUES (v_super, v_org_a);

  INSERT INTO public.crm_leads (id, organization_id, empresa, estado) VALUES
    (v_lead_a, v_org_a, 'Lead org A', 'Contactado'),
    (v_lead_b, v_org_b, 'Lead org B', 'Contactado'),
    (v_lead_soft, v_org_a, 'Lead a papelera', 'Contactado');

  -- E1 · multimembresía: con A activa, B no existe para el usuario.
  PERFORM pg_temp.as_user(v_multi);
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_leads WHERE id = v_lead_a) = 1,
    'E1: el usuario debe leer los leads de su organización ACTIVA (A)');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_leads WHERE organization_id = v_org_b) = 0,
    'E1b: la organización no activa (B) no debe ser visible aunque haya membresía');

  -- E2 · tampoco escribe en B (0 filas) ni puede mover A → B (WITH CHECK).
  UPDATE public.crm_leads SET empresa = 'B tocada' WHERE id = v_lead_b;
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_leads SET organization_id = %L WHERE id = %L', v_org_b, v_lead_a),
    'row-level security', 'E2 mover lead de la org activa a la no activa');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(
    (SELECT empresa FROM public.crm_leads WHERE id = v_lead_b) = 'Lead org B',
    'E2b: la organización no activa no debe poder modificarse (verificado desde postgres)');
  PERFORM pg_temp.assert(
    (SELECT organization_id FROM public.crm_leads WHERE id = v_lead_a) = v_org_a,
    'E2c: organization_id no puede reasignarse desde el cliente');

  -- E3 · operador y viewer reales: leen in-org, no escriben.
  PERFORM pg_temp.as_user(v_oper);
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_leads WHERE id = v_lead_a) = 1,
    'E3: el operador debe leer los leads de su organización');
  UPDATE public.crm_leads SET empresa = 'Operador manda' WHERE id = v_lead_a;
  PERFORM pg_temp.as_user(v_viewer);
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_leads WHERE id = v_lead_a) = 1,
    'E3b: el viewer debe leer los leads de su organización');
  UPDATE public.crm_leads SET empresa = 'Viewer manda' WHERE id = v_lead_a;
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(
    (SELECT empresa FROM public.crm_leads WHERE id = v_lead_a) = 'Lead org A',
    'E3c: ni operador ni viewer pueden escribir leads (verificado desde postgres)');

  -- E4 · super admin: sólo su org_scope activo (A), nunca B.
  PERFORM pg_temp.as_user(v_super);
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_leads WHERE id = v_lead_a) = 1,
    'E4: el super admin debe operar su organización activa');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_leads WHERE organization_id = v_org_b) = 0,
    'E4b: el super admin no debe ver organizaciones fuera de su org_scope');

  -- E5 · Papelera: DELETE físico prohibido por ACL; soft-delete permitido.
  PERFORM pg_temp.as_user(v_multi);
  PERFORM pg_temp.espera_lc(
    format('DELETE FROM public.crm_leads WHERE id = %L', v_lead_soft),
    'permission denied', 'E5 borrado físico de leads');
  UPDATE public.crm_leads
     SET deleted_at = now(), deleted_by = v_multi
   WHERE id = v_lead_soft;
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_leads WHERE id = v_lead_soft) = 1,
    'E5b: el borrado físico no debe haber ocurrido');
  PERFORM pg_temp.assert(
    (SELECT deleted_at FROM public.crm_leads WHERE id = v_lead_soft) IS NOT NULL,
    'E5c: la eliminación de la app debe seguir funcionando como soft-delete');
END;
$$;

-- ===== F) ACL exacta de tabla y de RPCs (sin búsqueda de strings) =====
DO $$
DECLARE
  v_privs text[];
  v_esperado text[] := ARRAY['INSERT','SELECT','UPDATE'];
  r record;
  v_n integer;
BEGIN
  -- F1 · authenticated: exactamente SELECT/INSERT/UPDATE.
  SELECT array_agg(DISTINCT a.privilege_type ORDER BY a.privilege_type)
    INTO v_privs
    FROM aclexplode((SELECT relacl FROM pg_class WHERE oid = 'public.crm_leads'::regclass)) a
   WHERE pg_get_userbyid(a.grantee) = 'authenticated';
  PERFORM pg_temp.assert(v_privs = v_esperado,
    format('F1: authenticated debe tener sólo SELECT/INSERT/UPDATE sobre crm_leads (tiene %s)', v_privs));
  PERFORM pg_temp.assert(
    NOT has_table_privilege('authenticated', 'public.crm_leads', 'DELETE'),
    'F1b: authenticated no debe tener DELETE sobre crm_leads');
  PERFORM pg_temp.assert(
    NOT has_table_privilege('authenticated', 'public.crm_leads', 'TRUNCATE'),
    'F1c: authenticated no debe tener TRUNCATE sobre crm_leads');
  PERFORM pg_temp.assert(
    NOT has_table_privilege('authenticated', 'public.crm_leads', 'REFERENCES'),
    'F1d: authenticated no debe tener REFERENCES sobre crm_leads');
  PERFORM pg_temp.assert(
    NOT has_table_privilege('authenticated', 'public.crm_leads', 'TRIGGER'),
    'F1e: authenticated no debe tener TRIGGER sobre crm_leads');

  -- F2 · anon y PUBLIC sin nada; service_role con el contrato de backend.
  PERFORM pg_temp.assert(
    NOT EXISTS (
      SELECT 1 FROM aclexplode((SELECT relacl FROM pg_class WHERE oid = 'public.crm_leads'::regclass)) a
       WHERE a.grantee = 0 OR pg_get_userbyid(a.grantee) = 'anon'),
    'F2: ni PUBLIC ni anon deben tener privilegios sobre crm_leads');
  PERFORM pg_temp.assert(
    has_table_privilege('service_role', 'public.crm_leads', 'SELECT')
    AND has_table_privilege('service_role', 'public.crm_leads', 'INSERT')
    AND has_table_privilege('service_role', 'public.crm_leads', 'UPDATE')
    AND has_table_privilege('service_role', 'public.crm_leads', 'DELETE'),
    'F2b: service_role debe conservar el acceso completo de backend');

  -- F3 · las dos RPCs de leads: exactamente dos, owner postgres, DEFINER,
  -- search_path=public, EXECUTE para authenticated/service_role y nunca
  -- para PUBLIC/anon (vía aclexplode / has_function_privilege).
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('crm_calificar_prospecto', 'crm_tomar_lead');
  PERFORM pg_temp.assert(v_n = 2,
    format('F3: deben existir exactamente 2 RPCs de leads (hay %s)', v_n));

  FOR r IN
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig, p.proacl,
           pg_get_userbyid(p.proowner) AS owner
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('crm_calificar_prospecto', 'crm_tomar_lead')
  LOOP
    PERFORM pg_temp.assert(r.owner = 'postgres',
      format('F3a: %s debe pertenecer a postgres (owner=%s)', r.proname, r.owner));
    PERFORM pg_temp.assert(r.prosecdef,
      format('F3b: %s debe ser SECURITY DEFINER', r.proname));
    PERFORM pg_temp.assert('search_path=public' = ANY (COALESCE(r.proconfig, ARRAY[]::text[])),
      format('F3c: %s debe fijar search_path=public', r.proname));
    PERFORM pg_temp.assert(r.proacl IS NOT NULL,
      format('F3d: %s no puede quedarse con la ACL por defecto (PUBLIC ejecuta)', r.proname));
    PERFORM pg_temp.assert(
      NOT EXISTS (
        SELECT 1 FROM aclexplode(r.proacl) a
         WHERE a.grantee = 0 OR pg_get_userbyid(a.grantee) = 'anon'),
      format('F3e: %s no debe conceder EXECUTE a PUBLIC ni anon', r.proname));
    PERFORM pg_temp.assert(
      EXISTS (
        SELECT 1 FROM aclexplode(r.proacl) a
         WHERE pg_get_userbyid(a.grantee) = 'authenticated' AND a.privilege_type = 'EXECUTE'),
      format('F3f: %s debe conceder EXECUTE a authenticated', r.proname));
    PERFORM pg_temp.assert(
      EXISTS (
        SELECT 1 FROM aclexplode(r.proacl) a
         WHERE pg_get_userbyid(a.grantee) = 'service_role' AND a.privilege_type = 'EXECUTE'),
      format('F3g: %s debe conceder EXECUTE a service_role', r.proname));
  END LOOP;

  -- F4 · toda policy permisiva impone la organización ACTIVA y ninguna es FOR ALL.
  PERFORM pg_temp.assert(
    NOT EXISTS (
      SELECT 1 FROM pg_policy
       WHERE polrelid = 'public.crm_leads'::regclass
         AND polpermissive
         AND (position('is_org_member' in
               COALESCE(pg_get_expr(polqual, polrelid), '')
               || COALESCE(pg_get_expr(polwithcheck, polrelid), '')) = 0)),
    'F4: toda policy permisiva de crm_leads debe exigir is_org_member(organization_id)');
  PERFORM pg_temp.assert(
    NOT EXISTS (
      SELECT 1 FROM pg_policy
       WHERE polrelid = 'public.crm_leads'::regclass
         AND polpermissive AND polcmd = '*'),
    'F4b: ninguna policy permisiva de crm_leads debe ser FOR ALL (evita DELETE futuro)');
  PERFORM pg_temp.assert(
    NOT EXISTS (
      SELECT 1 FROM pg_policy
       WHERE polrelid = 'public.crm_leads'::regclass
         AND polpermissive AND polcmd = 'd'),
    'F4c: ninguna policy permisiva debe autorizar DELETE físico de leads');
  PERFORM pg_temp.assert(
    position('operador' in (
      SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
       WHERE polrelid = 'public.crm_leads'::regclass
         AND polname = 'Lectura in-org crm_leads')) > 0,
    'F4d: la lectura in-org debe incluir el rol operador explícitamente');
END;
$$;

ROLLBACK;
