-- Isolate only crm_leads_buscar_duplicados. No global helper, policy or ACL change.
-- Existing postgres owner and exact predecessor/final body are required.
-- Caller owns one transaction with stop-on-error across this entire file.
-- SAVEPOINT rejects autocommit before mutation; this file never commits.
-- Idempotent reapplication accepts only the exact reviewed final body.
SAVEPOINT leads_scope_forward;
DO $leads_scope_pre$
DECLARE
  v_oid oid := pg_catalog.to_regprocedure('public.crm_leads_buscar_duplicados(jsonb)');
  v_owner oid := pg_catalog.to_regrole('postgres');
  v_authenticated oid := pg_catalog.to_regrole('authenticated');
  v_service oid := pg_catalog.to_regrole('service_role');
  v_anon oid := pg_catalog.to_regrole('anon');
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_hash text;
  v_before jsonb;
  v_expected CONSTANT jsonb := $leads_scope_attributes${"probin":null,"procost":100,"prokind":"f","proname":"crm_leads_buscar_duplicados","prorows":1000,"pronargs":1,"proconfig":["search_path=public"],"proretset":true,"prosecdef":true,"prosqlbody":null,"prosupport":"-","proargmodes":["i","t","t","t","t","t","t","t","t","t"],"proargnames":["p_claves","id","empresa","contacto","email","telefono","estado","empresa_norm","email_norm","telefono_norm"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"proargdefaults":null,"pronargdefaults":0}$leads_scope_attributes$::jsonb;
  v_capture CONSTANT text := $leads_scope_capture$SELECT pg_catalog.jsonb_build_object(
  'function', (SELECT pg_catalog.to_jsonb(p)-'prosrc' FROM pg_catalog.pg_proc p WHERE p.oid=$1),
  'acl', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a)
    ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a WHERE p.oid=$1),
  'effective', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'role_oid',r.oid,'role',r.rolname,
    'execute',pg_catalog.has_function_privilege(r.oid,$1,'EXECUTE'),
    'grant_option',pg_catalog.has_function_privilege(r.oid,$1,'EXECUTE WITH GRANT OPTION'))
    ORDER BY r.rolname) FROM pg_catalog.pg_roles r)
)$leads_scope_capture$;
BEGIN
  IF current_user <> 'postgres' OR session_user <> current_user
     OR v_owner IS NULL OR v_authenticated IS NULL OR v_service IS NULL OR v_anon IS NULL THEN
    RAISE EXCEPTION 'LEADS_SCOPE_PRECONDITION: existing postgres identity and client roles required';
  END IF;
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LEADS_SCOPE_PRECONDITION: target must already exist';
  END IF;
  SELECT p.* INTO STRICT v_proc FROM pg_catalog.pg_proc p WHERE p.oid=v_oid;
  IF v_proc.proowner <> v_owner OR v_proc.pronamespace <> 'public'::regnamespace
     OR v_proc.prolang <> (SELECT oid FROM pg_catalog.pg_language WHERE lanname='sql')
     OR v_proc.prorettype <> 'record'::regtype
     OR v_proc.proargtypes <> ARRAY['jsonb'::regtype::oid]::pg_catalog.oidvector
     OR v_proc.proallargtypes IS DISTINCT FROM ARRAY[
       'jsonb'::regtype::oid,'uuid'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
       'text'::regtype::oid,'text'::regtype::oid,'public.crm_lead_estado'::regtype::oid,
       'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid]
     OR (pg_catalog.to_jsonb(v_proc)-ARRAY['oid', 'pronamespace', 'proowner', 'prolang', 'prorettype', 'proargtypes', 'proallargtypes', 'proacl', 'prosrc']::text[]) IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'LEADS_SCOPE_PRECONDITION: unexpected owner, identity or nonbody attributes';
  END IF;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_proc.prosrc,'UTF8')),'hex');
  IF v_hash NOT IN ('e7beb680647fad4758ade550e2ba4aad40a059965fdec34c4896423a8ba3091c','437d1682bf8d95cc7ec2c6f03d3dc2e4e57237a2865c8bdb5d4b77ceb3d617ca') THEN
    RAISE EXCEPTION 'LEADS_SCOPE_PRECONDITION: unreviewed target body';
  END IF;
  IF v_proc.proacl IS NULL
     OR (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl)) <> 3
     OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
       WHERE a.grantor <> v_owner OR a.is_grantable OR a.privilege_type <> 'EXECUTE'
          OR a.grantee NOT IN (v_owner,v_authenticated,v_service))
     OR EXISTS (SELECT 1 FROM unnest(ARRAY[v_owner,v_authenticated,v_service]) expected(grantee)
       WHERE (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl) a
              WHERE a.grantee=expected.grantee) <> 1) THEN
    RAISE EXCEPTION 'LEADS_SCOPE_PRECONDITION: unexpected direct ACL';
  END IF;
  IF pg_catalog.has_function_privilege(v_anon,v_oid,'EXECUTE')
     OR pg_catalog.has_function_privilege(v_anon,v_oid,'EXECUTE WITH GRANT OPTION')
     OR NOT pg_catalog.has_function_privilege(v_authenticated,v_oid,'EXECUTE')
     OR pg_catalog.has_function_privilege(v_authenticated,v_oid,'EXECUTE WITH GRANT OPTION')
     OR NOT pg_catalog.has_function_privilege(v_service,v_oid,'EXECUTE')
     OR pg_catalog.has_function_privilege(v_service,v_oid,'EXECUTE WITH GRANT OPTION')
     OR NOT pg_catalog.has_function_privilege(v_owner,v_oid,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(v_owner,v_oid,'EXECUTE WITH GRANT OPTION') THEN
    RAISE EXCEPTION 'LEADS_SCOPE_PRECONDITION: unexpected effective client or owner ACL';
  END IF;
  EXECUTE v_capture INTO v_before USING v_oid;
  PERFORM pg_catalog.set_config('librecarga.leads_scope_snapshot',v_before::text,true);
  PERFORM pg_catalog.set_config('librecarga.leads_scope_txid',pg_catalog.pg_current_xact_id()::text,true);
END
$leads_scope_pre$;

-- ACL already checked exactly above; replacement preserves it byte-for-byte.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public.crm_leads_buscar_duplicados(p_claves jsonb) RETURNS TABLE(id uuid, empresa text, contacto text, email text, telefono text, estado public.crm_lead_estado, empresa_norm text, email_norm text, telefono_norm text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH claves AS (
    SELECT
      NULLIF(lower(regexp_replace(coalesce(c->>'empresa', ''), '[^a-z0-9]', '', 'gi')), '') AS empresa_norm,
      NULLIF(lower(trim(coalesce(c->>'email', ''))), '')                                   AS email_norm,
      NULLIF(regexp_replace(coalesce(c->>'telefono', ''), '\D', '', 'g'), '')               AS telefono_norm
    FROM jsonb_array_elements(coalesce(p_claves, '[]'::jsonb)) AS c
  )
  SELECT DISTINCT
    l.id, l.empresa, l.contacto, l.email, l.telefono, l.estado,
    lower(regexp_replace(coalesce(l.empresa, ''), '[^a-z0-9]', '', 'gi')) AS empresa_norm,
    lower(trim(coalesce(l.email, '')))                                   AS email_norm,
    regexp_replace(coalesce(l.telefono, ''), '\D', '', 'g')              AS telefono_norm
  FROM public.crm_leads l
  JOIN claves k ON (
       (k.email_norm    IS NOT NULL AND lower(trim(coalesce(l.email, ''))) = k.email_norm)
    OR (k.telefono_norm IS NOT NULL AND length(k.telefono_norm) >= 8
        AND right(regexp_replace(coalesce(l.telefono, ''), '\D', '', 'g'), 10) = right(k.telefono_norm, 10))
    OR (k.empresa_norm  IS NOT NULL AND length(k.empresa_norm) >= 4
        AND lower(regexp_replace(coalesce(l.empresa, ''), '[^a-z0-9]', '', 'gi')) = k.empresa_norm)
  )
  WHERE l.deleted_at IS NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND l.organization_id = (SELECT public.org_scope())
    AND public.is_org_member(l.organization_id)
    AND public.rls_tenant_scope_ok(l.organization_id)
    AND (
      public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['admin', 'gerente_comercial']::public.app_role[], l.organization_id)
      OR public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['viewer', 'operador']::public.app_role[], l.organization_id)
      OR (l.vendedor_id IS NULL AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[], l.organization_id))
      OR (l.vendedor_id = (SELECT auth.uid()) AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[], l.organization_id))
    );
$$;

DO $leads_scope_post$
DECLARE
  v_oid oid := pg_catalog.to_regprocedure('public.crm_leads_buscar_duplicados(jsonb)');
  v_before jsonb;
  v_after jsonb;
  v_hash text;
  v_capture CONSTANT text := $leads_scope_capture$SELECT pg_catalog.jsonb_build_object(
  'function', (SELECT pg_catalog.to_jsonb(p)-'prosrc' FROM pg_catalog.pg_proc p WHERE p.oid=$1),
  'acl', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a)
    ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a WHERE p.oid=$1),
  'effective', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'role_oid',r.oid,'role',r.rolname,
    'execute',pg_catalog.has_function_privilege(r.oid,$1,'EXECUTE'),
    'grant_option',pg_catalog.has_function_privilege(r.oid,$1,'EXECUTE WITH GRANT OPTION'))
    ORDER BY r.rolname) FROM pg_catalog.pg_roles r)
)$leads_scope_capture$;
BEGIN
  IF pg_catalog.current_setting('librecarga.leads_scope_txid',true)
     IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'LEADS_SCOPE_TRANSACTION: checks must share the caller transaction';
  END IF;
  v_before := NULLIF(pg_catalog.current_setting('librecarga.leads_scope_snapshot',true),'')::jsonb;
  IF v_before IS NULL OR v_oid IS NULL THEN
    RAISE EXCEPTION 'LEADS_SCOPE_TRANSACTION: missing target or transaction snapshot';
  END IF;
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')
    INTO v_hash FROM pg_catalog.pg_proc p WHERE p.oid=v_oid;
  IF v_hash IS DISTINCT FROM '437d1682bf8d95cc7ec2c6f03d3dc2e4e57237a2865c8bdb5d4b77ceb3d617ca' THEN
    RAISE EXCEPTION 'LEADS_SCOPE_INVARIANT: final body differs';
  END IF;
  EXECUTE v_capture INTO v_after USING v_oid;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'LEADS_SCOPE_INVARIANT: identity, nonbody metadata or privileges changed';
  END IF;
END
$leads_scope_post$;
RELEASE SAVEPOINT leads_scope_forward;
