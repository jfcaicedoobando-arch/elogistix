-- Forward-only: exact KAM membership and explicit ownership for this RPC only.
-- Apply the entire transaction; unknown source/ACL/owner fails before DDL.
-- No data migration, no changes to _assert_writer, no migration renumbering.
BEGIN;
CREATE TEMP TABLE crm_prospecto_kam_20261016060000_before (
  function_oid oid PRIMARY KEY,
  metadata jsonb NOT NULL
) ON COMMIT DROP;
DO $preflight$
DECLARE
  v_oid oid := to_regprocedure('public.crm_empresa_pasar_a_prospecto(uuid)');
  v_metadata jsonb;
BEGIN
  IF v_oid IS NULL THEN RAISE EXCEPTION 'CRM_PROSPECTO_KAM_PREFLIGHT: missing expected signature'; END IF;
  SELECT to_jsonb(p) INTO STRICT v_metadata FROM pg_proc p WHERE p.oid = v_oid;
  IF md5(v_metadata->>'prosrc') NOT IN ('1d8a763368ef97c02634860df5008a7c', '3f909f4d6d3e426c1e962909b1e55bcf') THEN
    RAISE EXCEPTION 'CRM_PROSPECTO_KAM_PREFLIGHT: source differs from reviewed pre/post image';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid = v_oid
      AND p.proowner = 'postgres'::regrole AND p.prosecdef
      AND p.proconfig = ARRAY['search_path=public']::text[]
      AND (SELECT array_agg(a::text ORDER BY a::text) FROM unnest(p.proacl) a)
        = ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]
  ) THEN
    RAISE EXCEPTION 'CRM_PROSPECTO_KAM_PREFLIGHT: owner, ACL or configuration differs';
  END IF;
  INSERT INTO pg_temp.crm_prospecto_kam_20261016060000_before VALUES (v_oid, v_metadata);
END;
$preflight$;

DO $attribution_preflight$
DECLARE v_guard oid := to_regprocedure('public._crm_empresa_proteger_creador()');
BEGIN
  IF v_guard IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid = v_guard
      AND md5(p.prosrc) = '99382bc36dc09e275e1950eabc65e554' AND p.proowner = 'postgres'::regrole
      AND p.prosecdef AND p.prorettype = 'trigger'::regtype
      AND p.proconfig = ARRAY['search_path=public']::text[]
      AND (SELECT array_agg(a::text ORDER BY a::text) FROM unnest(p.proacl) a)
        = ARRAY['postgres=X/postgres','service_role=X/postgres']::text[]
  ) THEN
    RAISE EXCEPTION 'CRM_PROSPECTO_KAM_PREFLIGHT: unexpected attribution guard';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.crm_empresas'::regclass
    AND t.tgname = 'trg_crm_empresa_proteger_creador'
    AND (v_guard IS NULL OR t.tgfoid <> v_guard OR t.tgenabled <> 'O'
      OR NOT (t.tgtype = 31 AND t.tgnargs = 0 AND NOT t.tgisinternal
      AND t.tgconstraint = 0 AND NOT t.tgdeferrable AND NOT t.tginitdeferred
      AND t.tgqual IS NULL AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
      AND t.tgargs = ''::bytea AND t.tgparentid = 0
      AND t.tgattr::text = (
        (SELECT attnum::text FROM pg_attribute WHERE attrelid = t.tgrelid AND attname = 'id')
        || ' ' || (SELECT attnum::text FROM pg_attribute WHERE attrelid = t.tgrelid AND attname = 'created_by'))))) THEN
    RAISE EXCEPTION 'CRM_PROSPECTO_KAM_PREFLIGHT: unexpected attribution trigger';
  END IF;
END;
$attribution_preflight$;

CREATE OR REPLACE FUNCTION public.crm_empresa_pasar_a_prospecto(p_empresa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid := public.org_scope();
  v_uid uuid := auth.uid();
  v_kam boolean := false;
  v_emp public.crm_empresas%ROWTYPE;
  v_origen public.crm_leads%ROWTYPE;
  v_existente public.crm_oportunidades%ROWTYPE;
  v_vinculo record;
  v_lead uuid; v_etapa uuid; v_op uuid; v_email text;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'LC_SIN_ORGANIZACION' USING ERRCODE = '42501'; END IF;
  -- Preserve the existing writer contract; only this RPC adds an exact KAM
  -- membership path. Never broaden the shared _assert_writer helper.
  BEGIN
    PERFORM public._assert_writer(v_org);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM 1 FROM public.organization_members om
      JOIN public.organizations org ON org.id = om.organization_id AND org.activo IS TRUE
     WHERE om.organization_id = v_org AND om.user_id = v_uid AND om.role::text = 'vendedor'
     FOR SHARE OF om, org;
    IF NOT FOUND THEN RAISE; END IF;
    v_kam := true;
  END;
  SELECT * INTO v_emp FROM public.crm_empresas
   WHERE id = p_empresa_id AND organization_id = v_org AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_CRM_EMPRESA_NO_ENCONTRADA' USING ERRCODE = 'P0002'; END IF;

  IF v_kam THEN
    IF v_emp.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'LC_CRM_PROSPECTO_NO_AUTORIZADO' USING ERRCODE = '42501';
    END IF;
    IF v_emp.estado_crm = 'Cliente' OR v_emp.cliente_id IS NOT NULL THEN
      RAISE EXCEPTION 'LC_CRM_EMPRESA_YA_CLIENTE';
    END IF;

    IF v_emp.lead_origen_id IS NOT NULL THEN
      SELECT * INTO v_origen FROM public.crm_leads
       WHERE id = v_emp.lead_origen_id FOR UPDATE;
      IF NOT FOUND OR v_origen.organization_id IS DISTINCT FROM v_org
        OR v_origen.deleted_at IS NOT NULL OR v_origen.vendedor_id IS DISTINCT FROM v_uid
        OR v_origen.estado::text = 'Convertido' OR v_origen.cliente_convertido_id IS NOT NULL THEN
        RAISE EXCEPTION 'LC_CRM_PROSPECTO_VINCULO_INVALIDO' USING ERRCODE = '42501';
      END IF;
    END IF;

    -- Validate and lock EVERY link, including deleted/foreign opportunities.
    -- A favourable LIMIT 1 must never hide a different owner's relationship.
    FOR v_vinculo IN SELECT oe.organization_id, oe.oportunidad_id
      FROM public.crm_oportunidad_empresa oe WHERE oe.empresa_id = v_emp.id
      ORDER BY oe.oportunidad_id FOR UPDATE
    LOOP
      SELECT * INTO v_existente FROM public.crm_oportunidades
       WHERE id = v_vinculo.oportunidad_id FOR UPDATE;
      IF NOT FOUND OR v_vinculo.organization_id IS DISTINCT FROM v_org
        OR v_existente.organization_id IS DISTINCT FROM v_org
        OR v_existente.deleted_at IS NOT NULL OR v_existente.vendedor_id IS DISTINCT FROM v_uid
        OR v_emp.lead_origen_id IS NULL
        OR v_existente.lead_id IS DISTINCT FROM v_emp.lead_origen_id THEN
        RAISE EXCEPTION 'LC_CRM_PROSPECTO_VINCULO_INVALIDO' USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  SELECT o.id INTO v_op FROM public.crm_oportunidad_empresa oe
    JOIN public.crm_oportunidades o ON o.id = oe.oportunidad_id AND o.deleted_at IS NULL
   WHERE oe.empresa_id = v_emp.id ORDER BY o.created_at LIMIT 1;
  IF v_emp.estado_crm NOT IN ('Lead','Sospechoso') AND v_op IS NOT NULL THEN
    RETURN jsonb_build_object('oportunidad_id', v_op, 'sin_cambios', true);
  END IF;

  SELECT id INTO v_etapa FROM public.crm_etapas_pipeline
   WHERE organization_id = v_org AND nombre = 'Prospecto' ORDER BY orden LIMIT 1;
  IF v_etapa IS NULL THEN RAISE EXCEPTION 'LC_CRM_ETAPA_PROSPECTO_FALTANTE'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  v_lead := v_emp.lead_origen_id;
  IF v_lead IS NULL THEN
    INSERT INTO public.crm_leads (organization_id, empresa, estado, vendedor_id, vendedor_email, created_by)
    VALUES (v_org, v_emp.nombre, 'Prospecto', auth.uid(), coalesce(v_email, ''), auth.uid())
    RETURNING id INTO v_lead;
    UPDATE public.crm_empresas SET lead_origen_id = v_lead WHERE id = v_emp.id;
  ELSE
    UPDATE public.crm_leads SET estado = 'Prospecto'
     WHERE id = v_lead AND estado::text IN ('Nuevo','Contactado','Descalificado');
  END IF;

  IF v_op IS NULL THEN
    INSERT INTO public.crm_oportunidades
      (organization_id, nombre, cliente_nombre, lead_id, etapa_id, vendedor_id, vendedor_email, created_by)
    VALUES (v_org, v_emp.nombre, v_emp.nombre, v_lead, v_etapa, auth.uid(), coalesce(v_email, ''), auth.uid())
    RETURNING id INTO v_op;
    INSERT INTO public.crm_oportunidad_empresa (oportunidad_id, empresa_id) VALUES (v_op, v_emp.id);
  END IF;

  UPDATE public.crm_empresas SET estado_crm = 'Prospecto' WHERE id = v_emp.id AND estado_crm IN ('Lead','Sospechoso');
  RETURN jsonb_build_object('oportunidad_id', v_op, 'sin_cambios', false);
END $$;
REVOKE ALL ON FUNCTION public.crm_empresa_pasar_a_prospecto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_empresa_pasar_a_prospecto(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public._crm_empresa_proteger_creador()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  -- Historical migrations and trusted backend producers may attribute records
  -- on behalf of another user. An end-user RPC keeps its authenticated JWT.
  IF auth.role() = 'service_role'
    OR (v_uid IS NULL AND coalesce(auth.role(), '') <> 'authenticated') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_CRM_EMPRESA_CREADOR_PROTEGIDO' USING ERRCODE = '42501';
  END IF;
  BEGIN
    PERFORM public._assert_writer(CASE WHEN TG_OP = 'INSERT' THEN NEW.organization_id ELSE OLD.organization_id END);
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'LC_CRM_EMPRESA_CREADOR_PROTEGIDO' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'LC_CRM_EMPRESA_CREADOR_PROTEGIDO' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'LC_CRM_EMPRESA_CREADOR_PROTEGIDO' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_proteger_creador() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_empresa_proteger_creador() TO service_role;

DO $attribution_install$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.crm_empresas'::regclass
    AND tgname = 'trg_crm_empresa_proteger_creador') THEN
    CREATE TRIGGER trg_crm_empresa_proteger_creador
      BEFORE INSERT OR DELETE OR UPDATE OF id, created_by ON public.crm_empresas
      FOR EACH ROW EXECUTE FUNCTION public._crm_empresa_proteger_creador();
  END IF;
END;
$attribution_install$;

DO $postcheck$
DECLARE v_before record; v_after jsonb;
BEGIN
  SELECT * INTO STRICT v_before FROM pg_temp.crm_prospecto_kam_20261016060000_before;
  SELECT to_jsonb(p) INTO v_after FROM pg_proc p WHERE p.oid = v_before.function_oid;
  IF v_after IS NULL OR (v_after - 'prosrc') IS DISTINCT FROM (v_before.metadata - 'prosrc')
    OR md5(v_after->>'prosrc') IS DISTINCT FROM '3f909f4d6d3e426c1e962909b1e55bcf' THEN
    RAISE EXCEPTION 'CRM_PROSPECTO_KAM_POSTCHECK: identity, ACL, owner, attributes or source changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.crm_empresas'::regclass AND t.tgname = 'trg_crm_empresa_proteger_creador'
      AND t.tgenabled = 'O' AND (t.tgtype = 31 AND t.tgnargs = 0 AND NOT t.tgisinternal
      AND t.tgconstraint = 0 AND NOT t.tgdeferrable AND NOT t.tginitdeferred
      AND t.tgqual IS NULL AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
      AND t.tgargs = ''::bytea AND t.tgparentid = 0
      AND t.tgattr::text = (
        (SELECT attnum::text FROM pg_attribute WHERE attrelid = t.tgrelid AND attname = 'id')
        || ' ' || (SELECT attnum::text FROM pg_attribute WHERE attrelid = t.tgrelid AND attname = 'created_by')))
      AND md5(p.prosrc) = '99382bc36dc09e275e1950eabc65e554' AND p.proowner = 'postgres'::regrole
      AND p.prosecdef AND p.proconfig = ARRAY['search_path=public']::text[]
      AND (SELECT array_agg(a::text ORDER BY a::text) FROM unnest(p.proacl) a)
        = ARRAY['postgres=X/postgres','service_role=X/postgres']::text[]) THEN
    RAISE EXCEPTION 'CRM_PROSPECTO_KAM_POSTCHECK: invalid attribution guard or trigger'
      USING DETAIL = (SELECT jsonb_build_object('source_md5', md5(p.prosrc), 'owner', pg_get_userbyid(p.proowner),
        'acl', p.proacl, 'config', p.proconfig, 'trigger', pg_get_triggerdef(t.oid),
        'type', t.tgtype, 'columns', t.tgattr::text)::text
        FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgrelid = 'public.crm_empresas'::regclass AND t.tgname = 'trg_crm_empresa_proteger_creador');
  END IF;
END;
$postcheck$;
COMMIT;
