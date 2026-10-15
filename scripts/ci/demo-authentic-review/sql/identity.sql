-- PROPOSED ONLY. Not registered or applied. Base cf4af5c6a959fe1c15aa8e636e36f6eccac49fd2.
-- One DO statement makes creation, NEW-object ACL closure and assertions atomic.
-- No existing objects, roles, role memberships or default-privilege rules are changed.
DO $install$
DECLARE
  v_owner oid;
  v_schema oid;
  v_registry oid;
  v_grantee record;
  v_proc record;
  v_app record;
  v_privilege text;
BEGIN
  SELECT p.proowner INTO v_owner FROM pg_catalog.pg_proc AS p
   WHERE p.oid = pg_catalog.to_regprocedure('public.seed_demo_organization_core()');
  IF v_owner IS NULL OR pg_catalog.pg_get_userbyid(v_owner) IS DISTINCT FROM current_user THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_INSTALL_OWNER_REQUIRED: install as existing core owner'
      USING ERRCODE = '42501';
  END IF;
  -- Intentionally no IF NOT EXISTS: unknown preexisting definitions must fail.
CREATE SCHEMA demo_fixture_identity;

CREATE TABLE demo_fixture_identity.registry (
  organization_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
  fixture_key text PRIMARY KEY,
  contact_fixture_key text GENERATED ALWAYS AS (
    CASE fixture_key
      WHEN 'cliente.pacifico' THEN 'contacto.pacifico.principal'
      WHEN 'cliente.monterrey' THEN 'contacto.monterrey.principal'
      ELSE NULL
    END
  ) STORED UNIQUE,
  cliente_id uuid NOT NULL UNIQUE,
  contacto_id uuid UNIQUE,
  empresa_id uuid NOT NULL UNIQUE,
  adopted boolean NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (organization_id = '00000000-0000-4000-8000-000000000001'::uuid),
  CHECK (fixture_key IN ('cliente.pacifico', 'cliente.monterrey', 'cliente.bajio')),
  CHECK ((fixture_key = 'cliente.bajio') = (contacto_id IS NULL)),
  FOREIGN KEY (cliente_id, organization_id)
    REFERENCES public.clientes (id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (contacto_id) REFERENCES public.contactos_cliente (id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id) REFERENCES public.crm_empresas (id) ON DELETE RESTRICT
);

CREATE FUNCTION demo_fixture_identity.reject_rebinding()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'LC_DEMO_FIXTURE_IMMUTABLE: registry bindings cannot be replaced or deleted'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER immutable_fixture_identity
BEFORE UPDATE OR DELETE ON demo_fixture_identity.registry
FOR EACH ROW EXECUTE FUNCTION demo_fixture_identity.reject_rebinding();

CREATE FUNCTION demo_fixture_identity.fixture(p_key text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT CASE p_key
    WHEN 'cliente.pacifico' THEN
      '{"nombre":"Synthetic Customer 1","rfc":"","ciudad":"Synthetic City","estado":"Synthetic State","contacto":"Synthetic Contact 1","email":"customer1@example.invalid","telefono":"","dias_credito":30,"has_contact":true}'::jsonb
    WHEN 'cliente.monterrey' THEN
      '{"nombre":"Synthetic Customer 2","rfc":"","ciudad":"Synthetic City","estado":"Synthetic State","contacto":"Synthetic Contact 2","email":"customer2@example.invalid","telefono":"","dias_credito":15,"has_contact":true}'::jsonb
    WHEN 'cliente.bajio' THEN
      '{"nombre":"Synthetic Customer 3","rfc":"","ciudad":"Synthetic City","estado":"Synthetic State","contacto":"Synthetic Contact 3","email":"customer3@example.invalid","telefono":"","dias_credito":45,"has_contact":false}'::jsonb
    ELSE NULL
  END;
$$;

-- ID-only validation; editable labels are never identity evidence.
CREATE FUNCTION demo_fixture_identity.assert_ids(
  p_key text, p_cliente uuid, p_contacto uuid, p_empresa uuid
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  v_org constant uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_fixture jsonb := demo_fixture_identity.fixture(p_key);
BEGIN
  IF v_fixture IS NULL THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_UNKNOWN' USING ERRCODE = '22023';
  END IF;
  IF p_cliente IS NULL OR p_empresa IS NULL
     OR (v_fixture ->> 'has_contact')::boolean <> (p_contacto IS NOT NULL) THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_IDS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.clientes AS c
   WHERE c.id = p_cliente AND c.organization_id = v_org AND c.deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_INVALID: cliente missing, deleted or outside demo'
      USING ERRCODE = '23514';
  END IF;

  IF p_contacto IS NOT NULL THEN
    PERFORM 1 FROM public.contactos_cliente AS c
     WHERE c.id = p_contacto AND c.organization_id = v_org
       AND c.cliente_id = p_cliente AND c.deleted_at IS NULL
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LC_DEMO_FIXTURE_INVALID: contacto missing, deleted or reassigned'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  PERFORM 1 FROM public.crm_empresas AS e
   WHERE e.id = p_empresa AND e.organization_id = v_org
     AND e.cliente_id = p_cliente AND e.deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_INVALID: empresa missing, deleted or reassigned'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

-- Bootstrap requires an explicit reviewed mapping of full IDs. No inferred adoption.
-- Use all three calls in ONE transaction; this helper changes only the registry.
CREATE FUNCTION demo_fixture_identity.adopt(
  p_key text, p_cliente uuid, p_contacto uuid, p_empresa uuid
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  v_binding demo_fixture_identity.registry%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('seed_demo_organization'));
  PERFORM demo_fixture_identity.assert_ids(p_key, p_cliente, p_contacto, p_empresa);
  SELECT r.* INTO v_binding FROM demo_fixture_identity.registry AS r
   WHERE r.fixture_key = p_key FOR UPDATE;
  IF FOUND THEN
    IF v_binding.cliente_id IS DISTINCT FROM p_cliente
       OR v_binding.contacto_id IS DISTINCT FROM p_contacto
       OR v_binding.empresa_id IS DISTINCT FROM p_empresa THEN
      RAISE EXCEPTION 'LC_DEMO_FIXTURE_REBIND_DENIED' USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM demo_fixture_identity.registry AS r
     WHERE r.cliente_id = p_cliente OR r.empresa_id = p_empresa
        OR (p_contacto IS NOT NULL AND r.contacto_id = p_contacto)
  ) THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_ID_ALREADY_BOUND' USING ERRCODE = '23514';
  END IF;
  INSERT INTO demo_fixture_identity.registry
    (fixture_key, cliente_id, contacto_id, empresa_id, adopted)
  VALUES (p_key, p_cliente, p_contacto, p_empresa, true);
END;
$$;

-- Returns existing IDs without overwriting fields. Creation only in a proven empty
-- (or entirely registered) demo namespace; all unregistered rows require review.
CREATE FUNCTION demo_fixture_identity.ensure(p_key text)
RETURNS TABLE (cliente_id uuid, contacto_id uuid, empresa_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  v_org constant uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_fixture jsonb := demo_fixture_identity.fixture(p_key);
  v_binding demo_fixture_identity.registry%ROWTYPE;
  v_cliente uuid;
  v_contacto uuid;
  v_empresa uuid;
BEGIN
  IF v_fixture IS NULL THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_UNKNOWN' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('seed_demo_organization'));
  SELECT r.* INTO v_binding FROM demo_fixture_identity.registry AS r
   WHERE r.fixture_key = p_key FOR UPDATE;
  IF FOUND THEN
    PERFORM demo_fixture_identity.assert_ids(
      p_key, v_binding.cliente_id, v_binding.contacto_id, v_binding.empresa_id
    );
    RETURN QUERY SELECT v_binding.cliente_id, v_binding.contacto_id, v_binding.empresa_id;
    RETURN;
  END IF;

  -- A table lock cannot refresh an earlier Repeatable Read snapshot. Reject
  -- creation before using negative evidence; never change caller isolation.
  IF pg_catalog.current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_READ_COMMITTED_REQUIRED: creation requires fresh statement snapshots'
      USING ERRCODE = '25001';
  END IF;
  -- In Read Committed, the next VOLATILE PL/pgSQL query gets a fresh snapshot
  -- after this lock; manual writes cannot race the negative-evidence query.
  -- Uses the same advisory lock as both current demo wrappers.
  LOCK TABLE public.clientes, public.contactos_cliente, public.crm_empresas
    IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (
    SELECT 1 FROM public.clientes AS c
     WHERE c.organization_id = v_org AND NOT EXISTS (
       SELECT 1 FROM demo_fixture_identity.registry AS r WHERE r.cliente_id = c.id
     )
  ) OR EXISTS (
    SELECT 1 FROM public.contactos_cliente AS c
     WHERE c.organization_id = v_org AND NOT EXISTS (
       SELECT 1 FROM demo_fixture_identity.registry AS r WHERE r.contacto_id = c.id
     )
  ) OR EXISTS (
    SELECT 1 FROM public.crm_empresas AS e
     WHERE e.organization_id = v_org AND NOT EXISTS (
       SELECT 1 FROM demo_fixture_identity.registry AS r WHERE r.empresa_id = e.id
     )
  ) THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_ADOPTION_REQUIRED: unregistered demo rows, no inferred match'
      USING ERRCODE = '23514';
  END IF;

  v_cliente := pg_catalog.gen_random_uuid();
  v_empresa := pg_catalog.gen_random_uuid();
  -- Only this NEW row is temporarily inactive. The historical 0016 AFTER INSERT
  -- WHEN predicate is false; no arbitrary same-name empresa can be selected.
  INSERT INTO public.clientes
    (id, organization_id, nombre, rfc, ciudad, estado, contacto, email,
     telefono, dias_credito, deleted_at)
  VALUES (
    v_cliente, v_org, v_fixture ->> 'nombre', v_fixture ->> 'rfc',
    v_fixture ->> 'ciudad', v_fixture ->> 'estado', v_fixture ->> 'contacto',
    'fixture-pending-' || v_cliente::text || '@example.invalid', v_fixture ->> 'telefono',
    (v_fixture ->> 'dias_credito')::integer, pg_catalog.clock_timestamp()
  );
  INSERT INTO public.crm_empresas (id, organization_id, nombre, cliente_id, estado_crm)
  VALUES (v_empresa, v_org, v_fixture ->> 'nombre', v_cliente, 'Cliente');
  -- Changing email from the temporary value runs the existing UPDATE OF email
  -- uniqueness guard on activation; setting only deleted_at would skip it.
  -- Preserve all existing guards. Privileged core owner executes this UPDATE.
  UPDATE public.clientes AS c
     SET deleted_at = NULL, email = v_fixture ->> 'email' WHERE c.id = v_cliente;

  IF (v_fixture ->> 'has_contact')::boolean THEN
    v_contacto := pg_catalog.gen_random_uuid();
    INSERT INTO public.contactos_cliente
      (id, organization_id, cliente_id, nombre, email, telefono)
    VALUES (v_contacto, v_org, v_cliente, v_fixture ->> 'contacto',
            v_fixture ->> 'email', v_fixture ->> 'telefono');
  END IF;
  INSERT INTO demo_fixture_identity.registry
    (fixture_key, cliente_id, contacto_id, empresa_id, adopted)
  VALUES (p_key, v_cliente, v_contacto, v_empresa, false);
  PERFORM demo_fixture_identity.assert_ids(p_key, v_cliente, v_contacto, v_empresa);
  RETURN QUERY SELECT v_cliente, v_contacto, v_empresa;
END;
$$;

-- Remove explicit/default grants on NEW objects only, including PUBLIC. All
-- statements below target this freshly created schema, table and five functions.
SELECT n.oid INTO v_schema FROM pg_catalog.pg_namespace AS n
 WHERE n.nspname = 'demo_fixture_identity';
SELECT c.oid INTO v_registry FROM pg_catalog.pg_class AS c
 WHERE c.relnamespace = v_schema AND c.relname = 'registry' AND c.relkind = 'r';
IF v_registry IS NULL
   OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace AS n
               WHERE n.oid = v_schema AND n.nspowner <> v_owner)
   OR EXISTS (SELECT 1 FROM pg_catalog.pg_class AS c
               WHERE c.relnamespace = v_schema AND c.relowner <> v_owner)
   OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc AS p
               WHERE p.pronamespace = v_schema AND p.proowner <> v_owner)
   OR (SELECT count(*) FROM pg_catalog.pg_class AS c
        WHERE c.relnamespace = v_schema AND c.relkind IN ('r','p','f','v','m','S')) <> 1
   OR (SELECT count(*) FROM pg_catalog.pg_proc AS p WHERE p.pronamespace = v_schema) <> 5 THEN
  RAISE EXCEPTION 'LC_DEMO_FIXTURE_INSTALL_OBJECT_DRIFT' USING ERRCODE = '23514';
END IF;

FOR v_grantee IN
  SELECT DISTINCT a.grantee FROM (
    SELECT n.nspowner AS owner, n.nspacl AS acl, 'n'::"char" AS kind
      FROM pg_catalog.pg_namespace AS n WHERE n.oid = v_schema
    UNION ALL
    SELECT c.relowner, c.relacl, 'r'::"char"
      FROM pg_catalog.pg_class AS c WHERE c.oid = v_registry
    UNION ALL
    SELECT p.proowner, p.proacl, 'f'::"char"
      FROM pg_catalog.pg_proc AS p WHERE p.pronamespace = v_schema
  ) AS o
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    coalesce(o.acl, pg_catalog.acldefault(o.kind, o.owner))
  ) AS a
  WHERE a.grantee <> v_owner
LOOP
  v_privilege := CASE WHEN v_grantee.grantee = 0 THEN 'PUBLIC'
    ELSE pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(v_grantee.grantee)) END;
  EXECUTE pg_catalog.format('REVOKE ALL PRIVILEGES ON SCHEMA demo_fixture_identity FROM %s CASCADE', v_privilege);
  EXECUTE pg_catalog.format('REVOKE ALL PRIVILEGES ON TABLE demo_fixture_identity.registry FROM %s CASCADE', v_privilege);
  EXECUTE pg_catalog.format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA demo_fixture_identity FROM %s CASCADE', v_privilege);
END LOOP;

-- Assert the resulting ACLs, including initially NULL ACLs/default rules.
IF EXISTS (
  SELECT 1 FROM (
    SELECT n.nspowner AS owner, n.nspacl AS acl, 'n'::"char" AS kind
      FROM pg_catalog.pg_namespace AS n WHERE n.oid = v_schema
    UNION ALL
    SELECT c.relowner, c.relacl, 'r'::"char"
      FROM pg_catalog.pg_class AS c WHERE c.oid = v_registry
    UNION ALL
    SELECT p.proowner, p.proacl, 'f'::"char"
      FROM pg_catalog.pg_proc AS p WHERE p.pronamespace = v_schema
  ) AS o
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    coalesce(o.acl, pg_catalog.acldefault(o.kind, o.owner))
  ) AS a
  WHERE a.grantee <> v_owner
) THEN
  RAISE EXCEPTION 'LC_DEMO_FIXTURE_INSTALL_ACL_DRIFT' USING ERRCODE = '42501';
END IF;

IF NOT pg_catalog.has_schema_privilege(v_owner, v_schema, 'USAGE') THEN
  RAISE EXCEPTION 'LC_DEMO_FIXTURE_INSTALL_OWNER_USAGE_REQUIRED' USING ERRCODE = '42501';
END IF;
FOREACH v_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
  IF NOT pg_catalog.has_table_privilege(v_owner, v_registry, v_privilege) THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_INSTALL_OWNER_DML_REQUIRED' USING ERRCODE = '42501';
  END IF;
END LOOP;
FOR v_proc IN SELECT p.oid FROM pg_catalog.pg_proc AS p WHERE p.pronamespace = v_schema LOOP
  IF NOT pg_catalog.has_function_privilege(v_owner, v_proc.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_INSTALL_OWNER_EXECUTE_REQUIRED' USING ERRCODE = '42501';
  END IF;
END LOOP;

-- Effective application privileges must be absent, including inheritance,
-- superuser status and global-role bypass. Do not repair existing roles: abort.
FOR v_app IN
  SELECT r.oid FROM pg_catalog.pg_roles AS r
   WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator')
LOOP
  IF pg_catalog.has_schema_privilege(v_app.oid, v_schema, 'USAGE')
     OR pg_catalog.has_schema_privilege(v_app.oid, v_schema, 'CREATE') THEN
    RAISE EXCEPTION 'LC_DEMO_FIXTURE_INSTALL_APP_SCHEMA_ACCESS' USING ERRCODE = '42501';
  END IF;
  FOREACH v_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
    IF pg_catalog.has_table_privilege(v_app.oid, v_registry, v_privilege) THEN
      RAISE EXCEPTION 'LC_DEMO_FIXTURE_INSTALL_APP_TABLE_ACCESS' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  FOR v_proc IN SELECT p.oid FROM pg_catalog.pg_proc AS p WHERE p.pronamespace = v_schema LOOP
    IF pg_catalog.has_function_privilege(v_app.oid, v_proc.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'LC_DEMO_FIXTURE_INSTALL_APP_RPC_ACCESS' USING ERRCODE = '42501';
    END IF;
  END LOOP;
END LOOP;
END;
$install$;
