-- LOCAL DISPOSABLE FULL-SCHEMA TEST ONLY. Never run against a remote database.
-- Parent installs a separately generated enabled test variant and grants only
-- authenticated. The staged candidate stays disabled, unregistered and revoked.
-- Execute from the staged repo so the shared helper include resolves.
-- All fixtures, helpers and historical anomalies roll back. No constraints,
-- triggers, RLS policies, role memberships or production helpers are disabled.
\set ON_ERROR_STOP on
BEGIN;
\i supabase/tests/rls/_helpers.sql

CREATE FUNCTION pg_temp.s148_assert(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'SELECTOR148 FAIL: %', label; END IF;
END $$;

CREATE FUNCTION pg_temp.s148_reject(statement text, label text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE rejected boolean := false; state text; message text; detail text; hint text;
  schema_name text; table_name text; column_name text; constraint_name text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS state = RETURNED_SQLSTATE, message = MESSAGE_TEXT,
      detail = PG_EXCEPTION_DETAIL, hint = PG_EXCEPTION_HINT,
      schema_name = SCHEMA_NAME, table_name = TABLE_NAME,
      column_name = COLUMN_NAME, constraint_name = CONSTRAINT_NAME;
    PERFORM pg_temp.s148_assert(state = 'P0001'
      AND message = 'LC_SELECTOR148_NO_DISPONIBLE'
      AND coalesce(detail, '') = '' AND coalesce(hint, '') = ''
      AND coalesce(schema_name, '') = '' AND coalesce(table_name, '') = ''
      AND coalesce(column_name, '') = '' AND coalesce(constraint_name, '') = '',
      label || ': exact generic error, no raw diagnostics');
    rejected := true;
  END;
  -- This assertion is outside the exception block to prevent false positives.
  PERFORM pg_temp.s148_assert(rejected, label || ': must reject');
END $$;

CREATE FUNCTION pg_temp.s148_shape(page jsonb, label text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE item jsonb; keys text[]; last_id uuid; last_date date;
BEGIN
  SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(page) AS k;
  PERFORM pg_temp.s148_assert(keys = ARRAY['items','next_cursor'], label || ': exact top-level keys');
  PERFORM pg_temp.s148_assert(jsonb_typeof(page->'items') = 'array', label || ': items array');
  FOR item IN SELECT value FROM jsonb_array_elements(page->'items') LOOP
    SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(item) AS k;
    PERFORM pg_temp.s148_assert(keys = ARRAY['folio_interno','id','moneda','proveedor_nombre','subtotal'],
      label || ': exact five public item fields');
    PERFORM pg_temp.s148_assert(jsonb_typeof(item->'subtotal') = 'string', label || ': exact numeric text');
    PERFORM pg_temp.s148_assert(EXISTS (
      SELECT 1 FROM public.proveedor_facturas pf WHERE pf.id = (item->>'id')::uuid
        AND item = jsonb_build_object('id', pf.id, 'folio_interno', pf.folio_interno,
          'proveedor_nombre', pf.proveedor_nombre, 'subtotal', pf.subtotal::text, 'moneda', pf.moneda::text)
    ), label || ': item equals caller-readable invoice header');
  END LOOP;
  IF page->'next_cursor' <> 'null'::jsonb THEN
    SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(page->'next_cursor') AS k;
    PERFORM pg_temp.s148_assert(keys = ARRAY['fecha_emision','id'], label || ': exact cursor keys');
    PERFORM pg_temp.s148_assert(jsonb_array_length(page->'items') > 0, label || ': no empty progress cursor');
    last_id := (page->'items'->-1->>'id')::uuid;
    SELECT fecha_emision INTO STRICT last_date FROM public.proveedor_facturas WHERE id = last_id;
    PERFORM pg_temp.s148_assert(page->'next_cursor' = jsonb_build_object('fecha_emision',last_date,'id',last_id),
      label || ': cursor is last RETURNED eligible item, never sentinel or rejected row');
  END IF;
END $$;

CREATE FUNCTION pg_temp.s148_user(org uuid, global_role public.app_role,
  member_role public.app_role DEFAULT 'customer_service') RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE result uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.seed_auth_user(result);
  IF org IS NOT NULL THEN
    -- INSERT legacy roles is prohibited by real schema. The historical-role
    -- UPDATE path remains legal and preserves every actual trigger/constraint.
    INSERT INTO public.organization_members(organization_id,user_id,role)
      VALUES(org,result,'customer_service');
    UPDATE public.organization_members SET role = member_role WHERE user_id = result;
  END IF;
  INSERT INTO public.user_roles(user_id,role) VALUES(result,'admin_org')
    ON CONFLICT(user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.user_roles SET role = global_role WHERE user_id = result;
  RETURN result;
END $$;

CREATE FUNCTION pg_temp.s148_ship(org uuid, client uuid) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE result uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd,tipo_cambio_eur)
    VALUES(result,org,client,NULL,'Marítimo','Importación',20,22);
  RETURN result;
END $$;

CREATE FUNCTION pg_temp.s148_invoice(ship uuid, org uuid, provider uuid, category uuid,
  base numeric DEFAULT 100, emitted date DEFAULT DATE '2026-10-01',
  state public.estado_proveedor_factura DEFAULT 'Vigente', deleted timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,proveedor_nombre,
    categoria_presupuesto_id,embarque_id,folio_proveedor,fecha_emision,moneda,
    subtotal,iva,total,tipo_cambio_usd,estado,deleted_at)
  VALUES(result,org,provider,'Synthetic selector supplier',category,ship,result::text,
    emitted,'MXN',base,0,base,20,state,deleted);
  RETURN result;
END $$;

CREATE FUNCTION pg_temp.s148_policy(pf uuid, ship uuid, org uuid, premium numeric DEFAULT 100,
  deleted timestamptz DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.seguros_embarque(id,organization_id,embarque_id,aseguradora,numero_poliza,
    prima,moneda,vigencia_desde,vigencia_hasta,proveedor_factura_id,deleted_at)
  VALUES(result,org,ship,'Synthetic selector insurer',result::text,premium,'MXN',
    DATE '2026-10-01',DATE '2027-10-01',pf,deleted);
  RETURN result;
END $$;

CREATE FUNCTION pg_temp.s148_catalog() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object(
   'functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'definition',pg_get_functiondef(p.oid),
     'owner',p.proowner,'acl',p.proacl) ORDER BY p.oid)
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN ('has_role','has_any_role','has_any_role_efectivo',
       'roles_jerarquia','current_user_org_id','default_user_org_id','org_scope','rls_tenant_scope_ok',
       '_seguro_validar_factura_proveedor','pnl_financiero_embarque','seguro_facturas_elegibles')),
   'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p),
   'tables',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'owner',c.relowner,'acl',c.relacl,
      'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.oid)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
   'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_constraint c
      WHERE c.connamespace='public'::regnamespace),
   'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
   'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member) FROM pg_auth_members m),
   'default_acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.oid) FROM pg_default_acl a));
$$;

CREATE FUNCTION pg_temp.s148_reject_fk(statement text, expected_constraint text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE name text; failed boolean := false;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS name = CONSTRAINT_NAME;
    IF name IS DISTINCT FROM expected_constraint THEN RAISE; END IF;
    failed := true;
  END;
  PERFORM pg_temp.s148_assert(failed, 'all-row persistent enforcement: ' || expected_constraint);
END $$;

DO $security_pagination$
#variable_conflict use_variable
DECLARE
  fx record; provider_a uuid:=gen_random_uuid(); provider_b uuid:=gen_random_uuid();
  category_a uuid:=gen_random_uuid(); category_b uuid:=gen_random_uuid();
  client_a uuid:=gen_random_uuid(); client_b uuid:=gen_random_uuid();
  e_roles uuid; e_b uuid; e_hidden uuid; e_trash uuid; e_page uuid; e_policy uuid; e_anomaly uuid;
  pf_roles uuid; pf_b uuid; pf_hidden uuid; pf uuid; pf2 uuid; pf3 uuid; policy uuid; policy2 uuid;
  cc uuid; cc2 uuid; line uuid; hidden_line uuid; user_id uuid; coord uuid; coord_viewer uuid;
  super_user uuid; other_role public.app_role; approved_role public.app_role;
  global_role public.app_role; viewer_role public.app_role; allowed boolean; blocked boolean;
  approved public.app_role[]:=ARRAY['admin','admin_org','super_admin','coordinador_logistico','gerente_operaciones']::public.app_role[];
  viewer_family public.app_role[]:=ARRAY['viewer','vendedor','ejecutivo_pricing','contador','tesorero',
    'customer_service','gerente_visor','gerente_comercial','auxiliar_contable','ejecutivo_cobranza']::public.app_role[];
  page jsonb; page2 jsonb; before_row jsonb; before_catalog jsonb; visible_header jsonb;
  expected uuid[]; actual uuid[]; page_ids uuid[]; cursor_date date; cursor_id uuid;
  page_limit integer; loops integer; i integer; bad_statement text; bad_limit integer;
  singleton_count integer:=0; denied_pair_count integer:=0; approved_pair_count integer:=0;
  scalar_date date; role_oid oid; fixture_count integer;
BEGIN
  before_catalog:=pg_temp.s148_catalog();
  PERFORM pg_temp.s148_assert(EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.user_roles'::regclass AND contype='u'
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.user_roles'::regclass
        AND attname='user_id')]::smallint[]), 'real schema permits one global role per user');
  -- Multiple GLOBAL-role pairs cannot be represented under this unique key.
  -- Do not drop it to manufacture coverage. Exhaustive future-role-set source
  -- modeling is a separate parent artifact, not runtime evidence from this SQL.
  PERFORM pg_temp.s148_assert(has_function_privilege('authenticated',
    'public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)','EXECUTE')
    AND NOT has_function_privilege('anon',
    'public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)','EXECUTE')
    AND NOT has_function_privilege('service_role',
    'public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)','EXECUTE'),
    'isolated enabled test variant effective ACL only authenticated');
  PERFORM pg_temp.s148_assert(NOT EXISTS(SELECT 1 FROM pg_proc p,
    LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid='public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)'::regprocedure
      AND a.grantee=0 AND a.privilege_type='EXECUTE'), 'no PUBLIC execution');
  PERFORM pg_temp.s148_assert((SELECT p.prosecdef AND p.provolatile='s'
    AND p.proowner='postgres'::regrole
    AND p.proconfig @> ARRAY['search_path=pg_catalog, public']
    FROM pg_proc p WHERE p.oid='public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)'::regprocedure),
    'owner, SECURITY DEFINER, STABLE snapshot and controlled search path');
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('SELECTOR148 SECURITY PAGINATION');
  INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo) VALUES
    (provider_a,fx.org_a,'Synthetic selector A','Logistico','Naviera'),
    (provider_b,fx.org_b,'Synthetic selector B','Logistico','Naviera');
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES
    (category_a,fx.org_a,'Synthetic selector A'),(category_b,fx.org_b,'Synthetic selector B');
  INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES
    (client_a,fx.org_a,'Synthetic selector A','selector-a@test.local'),
    (client_b,fx.org_b,'Synthetic selector B','selector-b@test.local');
  e_roles:=pg_temp.s148_ship(fx.org_a,client_a); e_b:=pg_temp.s148_ship(fx.org_b,client_b);
  e_hidden:=pg_temp.s148_ship(fx.org_a,client_a); e_trash:=pg_temp.s148_ship(fx.org_a,client_a);
  e_page:=pg_temp.s148_ship(fx.org_a,client_a); e_policy:=pg_temp.s148_ship(fx.org_a,client_a);
  e_anomaly:=pg_temp.s148_ship(fx.org_a,client_a);
  pf_roles:=pg_temp.s148_invoice(e_roles,fx.org_a,provider_a,category_a);
  pf_b:=pg_temp.s148_invoice(e_b,fx.org_b,provider_b,category_b);

  -- Every actual enum singleton. Legacy globals are reached by permitted UPDATE.
  FOREACH global_role IN ARRAY enum_range(NULL::public.app_role) LOOP
    user_id:=pg_temp.s148_user(fx.org_a,global_role,
      CASE WHEN global_role='super_admin' THEN 'customer_service'::public.app_role ELSE global_role END);
    IF global_role='super_admin' THEN
      INSERT INTO public.super_admin_org_activa(user_id,organization_id) VALUES(user_id,fx.org_a);
    END IF;
    allowed:=global_role=ANY(approved);
    PERFORM pg_temp.as_user(user_id);
    IF allowed THEN
      page:=public.seguro_facturas_elegibles(e_roles,100,'MXN');
      PERFORM pg_temp.s148_shape(page,'singleton '||global_role);
      PERFORM pg_temp.s148_assert(jsonb_array_length(page->'items')=1
        AND page->'items'->0->>'id'=pf_roles::text,'approved singleton '||global_role);
    ELSE
      PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_roles),
        'unapproved singleton '||global_role);
      IF global_role=ANY(viewer_family) THEN
        PERFORM pg_temp.s148_assert(EXISTS(SELECT 1 FROM public.proveedor_facturas WHERE id=pf_roles),
          'denied selector leaves existing viewer invoice access '||global_role);
      END IF;
    END IF;
    PERFORM pg_temp.as_postgres(); singleton_count:=singleton_count+1;
  END LOOP;
  PERFORM pg_temp.s148_assert(singleton_count=18,'all 18 current app_role enum singletons covered');

  -- Ten disallowed operador + viewer-family GLOBAL/MEMBERSHIP disagreements.
  -- Both directions run under real schema; this is not a two-global-role fixture.
  FOREACH viewer_role IN ARRAY viewer_family LOOP
    user_id:=pg_temp.s148_user(fx.org_a,'operador',viewer_role);
    PERFORM pg_temp.as_user(user_id);
    PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_roles),
      'operador global with membership '||viewer_role);
    PERFORM pg_temp.as_postgres();
    user_id:=pg_temp.s148_user(fx.org_a,viewer_role,'operador');
    PERFORM pg_temp.as_user(user_id);
    PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_roles),
      'viewer-family global with operador membership '||viewer_role);
    PERFORM pg_temp.as_postgres(); denied_pair_count:=denied_pair_count+1;
  END LOOP;
  PERFORM pg_temp.s148_assert(denied_pair_count=10,'all ten disallowed disagreement families');

  -- All five approved globals with every schema-permitted membership.
  FOREACH approved_role IN ARRAY approved LOOP
    FOREACH other_role IN ARRAY enum_range(NULL::public.app_role) LOOP
      IF other_role='super_admin' THEN CONTINUE; END IF;
      user_id:=pg_temp.s148_user(fx.org_a,approved_role,other_role);
      IF approved_role='super_admin' THEN
        INSERT INTO public.super_admin_org_activa(user_id,organization_id) VALUES(user_id,fx.org_a);
      END IF;
      PERFORM pg_temp.as_user(user_id);
      page:=public.seguro_facturas_elegibles(e_roles,100,'MXN');
      PERFORM pg_temp.s148_assert(jsonb_array_length(page->'items')=1,
        'approved global '||approved_role||' retains existing gates with membership '||other_role);
      PERFORM pg_temp.as_postgres(); approved_pair_count:=approved_pair_count+1;
    END LOOP;
  END LOOP;
  PERFORM pg_temp.s148_assert(approved_pair_count=85,'all 5 x 17 valid approved-global membership combinations');
  SELECT to_jsonb(om) INTO STRICT before_row FROM public.organization_members om WHERE om.user_id=fx.admin_a;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.s148_assert(EXISTS(SELECT 1 FROM public.organization_members om WHERE om.user_id=fx.admin_a),
    'authenticated admin_org can read its existing membership before forbidden elevation');
  blocked:=false; fixture_count:=NULL;
  BEGIN
    -- Qualify the column: the enclosing fixture has a user_id PL/pgSQL variable.
    UPDATE public.organization_members SET role='super_admin' WHERE organization_members.user_id=fx.admin_a;
    GET DIAGNOSTICS fixture_count=ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  PERFORM pg_temp.s148_assert(blocked OR fixture_count=0,
    'authenticated admin_org cannot elevate membership to super_admin through RLS or existing trigger');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.s148_assert((SELECT to_jsonb(om) FROM public.organization_members om WHERE om.user_id=fx.admin_a)=before_row,
    'denied platform-role membership change preserves the exact original row');
  user_id:=pg_temp.s148_user(fx.org_a,'coordinador_logistico','admin_org');
  DELETE FROM public.user_roles WHERE user_roles.user_id=user_id;
  PERFORM pg_temp.as_user(user_id);
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_roles),
    'approved membership without global role cannot supply endpoint entitlement');
  PERFORM pg_temp.as_postgres();
  user_id:=pg_temp.s148_user(NULL,'admin_org');
  PERFORM pg_temp.as_user(user_id);
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_roles),
    'approved global without organization');
  PERFORM pg_temp.as_postgres();
  PERFORM set_config('role','authenticated',true);
  PERFORM pg_temp.as_authenticated_sin_uid();
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_roles),
    'authenticated missing uid');
  PERFORM pg_temp.as_postgres();

  -- Tenant A/B and restrictive super-admin scope, including fallback default org.
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_b),'A cannot target B');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(fx.admin_b);
  page:=public.seguro_facturas_elegibles(e_b,100,'MXN');
  PERFORM pg_temp.s148_assert(page->'items'->0->>'id'=pf_b::text,'B receives only B invoice');
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_roles),'B cannot target A');
  PERFORM pg_temp.as_postgres();
  super_user:=pg_temp.s148_user(fx.org_a,'super_admin');
  PERFORM pg_temp.as_user(super_user);
  PERFORM pg_temp.s148_assert(public.current_user_org_id()=fx.org_a,'super default organization exists without active scope');
  PERFORM pg_temp.s148_assert(NOT EXISTS(SELECT 1 FROM public.proveedor_facturas WHERE id=pf_roles),
    'super without active scope cannot read even default-org invoice');
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_roles),
    'super missing active scope is denied despite default organization');
  PERFORM pg_temp.as_postgres();
  INSERT INTO public.super_admin_org_activa(user_id,organization_id) VALUES(super_user,fx.org_a);
  PERFORM pg_temp.as_user(super_user);
  page:=public.seguro_facturas_elegibles(e_roles,100,'MXN');
  PERFORM pg_temp.s148_assert(page->'items'->0->>'id'=pf_roles::text,'super active A');
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_b),'super active A cannot target B');
  PERFORM pg_temp.as_postgres();
  UPDATE public.super_admin_org_activa SET organization_id=fx.org_b WHERE super_admin_org_activa.user_id=super_user;
  PERFORM pg_temp.as_user(super_user);
  page:=public.seguro_facturas_elegibles(e_b,100,'MXN');
  PERFORM pg_temp.s148_assert(page->'items'->0->>'id'=pf_b::text,'super active B changes exact tenant');
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_roles),'super active B cannot target A');
  PERFORM pg_temp.as_postgres();

  -- Same-tenant allocation to a trashed shipment stays in the denominator.
  cc:=gen_random_uuid(); cc2:=gen_random_uuid();
  INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda)
  VALUES(cc,fx.org_a,e_hidden,provider_a,'Visible target allocation',1000,'MXN'),
    (cc2,fx.org_a,e_trash,provider_a,'Hidden same-tenant allocation',1000,'MXN');
  pf_hidden:=pg_temp.s148_invoice(NULL,fx.org_a,provider_a,category_a,100);
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,monto)
    VALUES(fx.org_a,pf_hidden,cc,100);
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,monto)
    VALUES(fx.org_a,pf_hidden,cc2,100) RETURNING id INTO hidden_line;
  UPDATE public.embarques SET deleted_at=now() WHERE id=e_trash;
  coord:=pg_temp.s148_user(fx.org_a,'coordinador_logistico','coordinador_logistico');
  coord_viewer:=pg_temp.s148_user(fx.org_a,'coordinador_logistico','viewer');
  PERFORM pg_temp.as_user(coord);
  PERFORM pg_temp.s148_assert((SELECT count(*) FROM public.proveedor_facturas_conceptos
    WHERE proveedor_factura_id=pf_hidden)=1 AND NOT EXISTS(SELECT 1 FROM public.proveedor_facturas_conceptos
    WHERE id=hidden_line),'coordinator cannot read hidden denominator assignment');
  -- B100 * visible S100 / canonical A200 =50. An invoker-only denominator
  -- would incorrectly use A100 and manufacture coverage100. P75 discriminates.
  page:=public.seguro_facturas_elegibles(e_hidden,75,'MXN');
  PERFORM pg_temp.s148_assert(page=jsonb_build_object('items','[]'::jsonb,'next_cursor',NULL),
    'hidden same-tenant denominator prevents false complete coverage 75');
  page:=public.seguro_facturas_elegibles(e_hidden,50,'MXN');
  PERFORM pg_temp.s148_shape(page,'hidden allocation exact boundary');
  PERFORM pg_temp.s148_assert(page->'items'->0->>'id'=pf_hidden::text,'exact canonical 50 is eligible');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(coord_viewer);
  PERFORM pg_temp.s148_assert(NOT EXISTS(SELECT 1 FROM public.proveedor_facturas_conceptos
    WHERE proveedor_factura_id=pf_hidden),'effective membership viewer still hides both PFC lines');
  page:=public.seguro_facturas_elegibles(e_hidden,50,'MXN');
  PERFORM pg_temp.s148_assert(page->'items'->0->>'id'=pf_hidden::text,
    'approved global coordinator retains authorized derived capability with viewer membership');
  PERFORM pg_temp.as_postgres();
  blocked:=false;
  BEGIN
    PERFORM pg_temp.s148_policy(pf_hidden,e_hidden,fx.org_a,75);
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  PERFORM pg_temp.s148_assert(blocked,'canonical writer also rejects hidden-denominator 75');
  policy:=pg_temp.s148_policy(pf_hidden,e_hidden,fx.org_a,50);
  PERFORM pg_temp.as_user(coord);
  page:=public.seguro_facturas_elegibles(e_hidden,50,'MXN',policy);
  PERFORM pg_temp.s148_assert(page->'items'->0->>'id'=pf_hidden::text,'writer accepted 50 remains selectable for same policy');
  PERFORM pg_temp.as_postgres();
  UPDATE public.seguros_embarque SET deleted_at=now() WHERE id=policy;

  -- Ordinary unlinked fiscal PFC rows are not canonical allocation inputs.
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,pf_roles,'Ordinary unlinked fiscal line',1,100);
  PERFORM pg_temp.as_user(fx.admin_a);
  page:=public.seguro_facturas_elegibles(e_roles,100,'MXN');
  PERFORM pg_temp.s148_assert(page->'items'->0->>'id'=pf_roles::text,'clean unlinked fiscal line does not disable selector');
  PERFORM pg_temp.as_postgres();

  -- 275 eligible equal-date invoices; 125 newer rejects precede the first one.
  FOR i IN 1..275 LOOP
    PERFORM pg_temp.s148_invoice(e_page,fx.org_a,provider_a,category_a,100,DATE '2026-10-01');
  END LOOP;
  FOR i IN 1..125 LOOP
    PERFORM pg_temp.s148_invoice(e_page,fx.org_a,provider_a,category_a,99,DATE '2026-10-02');
  END LOOP;
  PERFORM pg_temp.s148_invoice(e_page,fx.org_a,provider_a,category_a,100,DATE '2026-10-03','Borrador');
  PERFORM pg_temp.s148_invoice(e_page,fx.org_a,provider_a,category_a,100,DATE '2026-10-03','Cancelada');
  PERFORM pg_temp.s148_invoice(e_page,fx.org_a,provider_a,category_a,100,DATE '2026-10-03','Vigente',now());
  SELECT array_agg(id ORDER BY fecha_emision DESC,id DESC) INTO expected
    FROM public.proveedor_facturas WHERE embarque_id=e_page AND subtotal=100
      AND estado::text='Vigente' AND deleted_at IS NULL;
  PERFORM pg_temp.s148_assert(cardinality(expected)=275,'pagination fixture has 275 exact eligible rows');
  PERFORM pg_temp.as_user(fx.admin_a);
  FOREACH page_limit IN ARRAY ARRAY[1,25,100] LOOP
    actual:='{}'::uuid[]; cursor_date:=NULL; cursor_id:=NULL; loops:=0;
    LOOP
      page:=public.seguro_facturas_elegibles(e_page,100,'MXN',NULL,page_limit,cursor_date,cursor_id);
      PERFORM pg_temp.s148_shape(page,'page limit '||page_limit);
      SELECT coalesce(array_agg((value->>'id')::uuid ORDER BY ordinality),'{}'::uuid[])
        INTO page_ids FROM jsonb_array_elements(page->'items') WITH ORDINALITY;
      PERFORM pg_temp.s148_assert(cardinality(page_ids)<=page_limit AND cardinality(page_ids)>0,
        'no false empty completion after more than 100 rejected candidates');
      actual:=actual||page_ids; loops:=loops+1;
      PERFORM pg_temp.s148_assert(loops<=275,'pagination termination bound');
      EXIT WHEN page->'next_cursor'='null'::jsonb;
      PERFORM pg_temp.s148_assert(cardinality(page_ids)=page_limit,'nonterminal page full after eligibility filtering');
      cursor_date:=(page->'next_cursor'->>'fecha_emision')::date;
      cursor_id:=(page->'next_cursor'->>'id')::uuid;
    END LOOP;
    PERFORM pg_temp.s148_assert(actual=expected,'complete exact ordering beyond 250, no duplicates or omissions, limit '||page_limit);
  END LOOP;
  -- A forged but correctly typed tuple is only an ordering bound. No lookup.
  page:=public.seguro_facturas_elegibles(e_page,100,'MXN',NULL,100,DATE '2026-10-01',pf_b);
  SELECT coalesce(array_agg(id ORDER BY id DESC),'{}'::uuid[]) INTO page_ids FROM (
    SELECT id FROM public.proveedor_facturas WHERE embarque_id=e_page AND subtotal=100
      AND estado::text='Vigente' AND deleted_at IS NULL AND id<pf_b ORDER BY id DESC LIMIT 100
  ) authorized;
  SELECT coalesce(array_agg((value->>'id')::uuid ORDER BY ordinality),'{}'::uuid[])
    INTO actual FROM jsonb_array_elements(page->'items') WITH ORDINALITY;
  PERFORM pg_temp.s148_assert(actual=page_ids,'foreign UUID cursor cannot widen or consult another tenant');
  PERFORM pg_temp.s148_shape(page,'forged foreign cursor');
  page:=public.seguro_facturas_elegibles(e_page,100,'MXN',NULL,25,DATE '2026-10-09',gen_random_uuid());
  PERFORM pg_temp.s148_assert(page->'items'->0->>'id'=expected[1]::text,'nonexistent future cursor does not require identity lookup');
  page:=public.seguro_facturas_elegibles(e_page,100,'MXN',NULL,25,DATE '2025-01-01',gen_random_uuid());
  PERFORM pg_temp.s148_assert(page=jsonb_build_object('items','[]'::jsonb,'next_cursor',NULL),'forged past cursor yields exact terminal empty page');
  FOREACH bad_limit IN ARRAY ARRAY[-1,0,101,NULL::integer] LOOP
    PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',NULL,%L)',e_page,bad_limit),
      'invalid or null page size');
  END LOOP;
  FOREACH bad_statement IN ARRAY ARRAY[
    format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',NULL,25,NULL,%L)',e_page,pf_b),
    format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',NULL,25,''2026-10-01'',NULL)',e_page),
    format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',NULL,25,''infinity'',%L)',e_page,pf_b),
    format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',NULL,25,''-infinity'',%L)',e_page,pf_b),
    format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',NULL,25,''10000-01-01'',%L)',e_page,pf_b),
    format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',NULL,25,''0001-01-01 BC'',%L)',e_page,pf_b),
    format('SELECT public.seguro_facturas_elegibles(%L,NULL,''MXN'')',e_page),
    format('SELECT public.seguro_facturas_elegibles(%L,''NaN'',''MXN'')',e_page),
    format('SELECT public.seguro_facturas_elegibles(%L,''Infinity'',''MXN'')',e_page),
    format('SELECT public.seguro_facturas_elegibles(%L,''-Infinity'',''MXN'')',e_page),
    format('SELECT public.seguro_facturas_elegibles(%L,-1,''MXN'')',e_page),
    format('SELECT public.seguro_facturas_elegibles(%L,1e20,''MXN'')',e_page),
    format('SELECT public.seguro_facturas_elegibles(%L,100,NULL)',e_page),
    format('SELECT public.seguro_facturas_elegibles(%L,100,''XXX'')',e_page),
    format('SELECT public.seguro_facturas_elegibles(NULL,100,''MXN'')'),
    format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',gen_random_uuid()),
    format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'')',e_trash)
  ] LOOP PERFORM pg_temp.s148_reject(bad_statement,'invalid typed input or unavailable target'); END LOOP;
  -- Malformed UUID/date text is rejected by PostgreSQL argument casting before
  -- function entry; it cannot receive this endpoint's exception normalization.
  PERFORM pg_temp.as_postgres();

  -- Typed dates may still be unrepresentable by the four-digit cursor protocol.
  -- Every candidate is eligible financially. Both a newer and an older invalid
  -- date must reject the whole result instead of being skipped, returned with an
  -- unusable cursor, or allowing an apparently completed partial page. The
  -- ordinary companion invoice demonstrates that no partial items escape.
  FOREACH scalar_date IN ARRAY ARRAY[DATE 'infinity',DATE '-infinity',
    DATE '10000-01-01',DATE '0001-01-01 BC'] LOOP
    BEGIN
      PERFORM pg_temp.s148_invoice(e_anomaly,fx.org_a,provider_a,category_a,100,DATE '2026-10-01');
      PERFORM pg_temp.s148_invoice(e_anomaly,fx.org_a,provider_a,category_a,100,scalar_date);
      PERFORM pg_temp.as_user(fx.admin_a);
      PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',NULL,25)',e_anomaly),
        'eligible candidate date outside finite four-digit cursor protocol '||scalar_date::text);
      PERFORM pg_temp.as_postgres();
      RAISE EXCEPTION USING ERRCODE='Z0148',MESSAGE='rollback synthetic unsupported invoice date';
    EXCEPTION WHEN SQLSTATE 'Z0148' THEN NULL; END;
  END LOOP;

  -- Occupancy, current-policy identity and preserving historical links.
  pf:=pg_temp.s148_invoice(e_policy,fx.org_a,provider_a,category_a,100);
  pf2:=pg_temp.s148_invoice(e_policy,fx.org_a,provider_a,category_a,100);
  pf3:=pg_temp.s148_invoice(e_policy,fx.org_a,provider_a,category_a,100);
  policy:=pg_temp.s148_policy(pf,e_policy,fx.org_a,100);
  policy2:=pg_temp.s148_policy(pf2,e_policy,fx.org_a,100,now());
  SELECT to_jsonb(s) INTO before_row FROM public.seguros_embarque s WHERE s.id=policy;
  PERFORM pg_temp.as_user(fx.admin_a);
  page:=public.seguro_facturas_elegibles(e_policy,100,'MXN');
  PERFORM pg_temp.s148_assert(jsonb_array_length(page->'items')=2
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'items') x WHERE x->>'id'=pf::text),
    'active occupied invoice excluded; soft-deleted occupancy releases invoice');
  page:=public.seguro_facturas_elegibles(e_policy,100,'MXN',policy);
  PERFORM pg_temp.s148_assert(jsonb_array_length(page->'items')=3,'editing current valid policy exempts only itself');
  PERFORM pg_temp.s148_shape(page,'current-policy occupancy');
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',%L)',e_roles,policy),
    'current policy belonging to different same-tenant shipment');
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',%L)',e_policy,policy2),
    'soft-deleted current policy has identical unavailable error');
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',%L)',e_policy,gen_random_uuid()),
    'nonexistent current policy has identical unavailable error');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.s148_assert((SELECT to_jsonb(s) FROM public.seguros_embarque s WHERE s.id=policy)=before_row,
    'selector is read-only and preserves exact saved policy row');
  policy2:=pg_temp.s148_policy(pf_b,e_b,fx.org_b,100);
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.s148_reject(format('SELECT public.seguro_facturas_elegibles(%L,100,''MXN'',%L)',e_policy,policy2),
    'foreign current policy has identical unavailable error');
  PERFORM pg_temp.as_postgres();
  UPDATE public.proveedor_facturas SET subtotal=99,total=99 WHERE id=pf;
  SELECT to_jsonb(s) INTO before_row FROM public.seguros_embarque s WHERE s.id=policy;
  PERFORM pg_temp.as_user(fx.admin_a);
  page:=public.seguro_facturas_elegibles(e_policy,100,'MXN',policy);
  PERFORM pg_temp.s148_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'items') x WHERE x->>'id'=pf::text),
    'stale saved link is not fabricated as eligible');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.s148_assert((SELECT to_jsonb(s) FROM public.seguros_embarque s WHERE s.id=policy)=before_row,
    'stale saved policy stays untouched');

  -- Those historical states cannot now be created. Every exact FK is checked,
  -- including nullable links and soft-deleted policies. The original containment
  -- suite remains preserved and runs independently on the unchanged control.
  BEGIN
    pf:=pg_temp.s148_invoice(NULL,fx.org_a,provider_a,category_a,100);
    INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,descripcion,monto)
      VALUES(fx.org_a,pf,'Null concept still tenant-protected',0);
    PERFORM pg_temp.s148_reject_fk(format(
      'UPDATE public.proveedor_facturas SET organization_id=%L,proveedor_id=%L,categoria_presupuesto_id=%L,folio_interno=%L WHERE id=%L',
      fx.org_b,provider_b,category_b,'INTEGRATED-PF-'||pf::text,pf), 'pfc_pf_same_org_fk');
    RAISE EXCEPTION USING ERRCODE='Z0148';
  EXCEPTION WHEN SQLSTATE 'Z0148' THEN NULL; END;
  BEGIN
    cc:=gen_random_uuid();
    INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,concepto,monto,moneda)
      VALUES(cc,fx.org_a,e_anomaly,'Protected concept',1000,'MXN');
    pf:=pg_temp.s148_invoice(NULL,fx.org_a,provider_a,category_a,100);
    INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,monto)
      VALUES(fx.org_a,pf,cc,1);
    PERFORM pg_temp.s148_reject_fk(format('UPDATE public.conceptos_costo SET organization_id=%L,embarque_id=%L WHERE id=%L',fx.org_b,e_b,cc),'pfc_cc_same_org_fk');
    RAISE EXCEPTION USING ERRCODE='Z0148';
  EXCEPTION WHEN SQLSTATE 'Z0148' THEN NULL; END;
  BEGIN
    cc:=gen_random_uuid(); user_id:=pg_temp.s148_ship(fx.org_a,client_a);
    INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,concepto,monto,moneda)
      VALUES(cc,fx.org_a,user_id,'Protected shipment concept',1000,'MXN');
    PERFORM pg_temp.s148_reject_fk(format('UPDATE public.embarques SET organization_id=%L,cliente_id=%L WHERE id=%L',fx.org_b,client_b,user_id),'cc_shipment_same_org_fk');
    RAISE EXCEPTION USING ERRCODE='Z0148';
  EXCEPTION WHEN SQLSTATE 'Z0148' THEN NULL; END;
  BEGIN
    user_id:=pg_temp.s148_ship(fx.org_a,client_a);
    pf:=pg_temp.s148_invoice(user_id,fx.org_a,provider_a,category_a,100);
    PERFORM pg_temp.s148_reject_fk(format('UPDATE public.embarques SET organization_id=%L,cliente_id=%L WHERE id=%L',fx.org_b,client_b,user_id),'pf_shipment_same_org_fk');
    RAISE EXCEPTION USING ERRCODE='Z0148';
  EXCEPTION WHEN SQLSTATE 'Z0148' THEN NULL; END;
  BEGIN
    pf:=pg_temp.s148_invoice(e_b,fx.org_b,provider_b,category_b,100);
    policy:=pg_temp.s148_policy(pf,e_b,fx.org_b,100);
    UPDATE public.seguros_embarque SET deleted_at=now() WHERE id=policy;
    PERFORM pg_temp.s148_reject_fk(format(
      'UPDATE public.proveedor_facturas SET organization_id=%L,proveedor_id=%L,categoria_presupuesto_id=%L,embarque_id=NULL,folio_interno=%L WHERE id=%L',
      fx.org_a,provider_a,category_a,'INTEGRATED-OCC-'||pf::text,pf),'insurance_pf_same_org_fk');
    RAISE EXCEPTION USING ERRCODE='Z0148';
  EXCEPTION WHEN SQLSTATE 'Z0148' THEN NULL; END;
  BEGIN
    user_id:=pg_temp.s148_ship(fx.org_a,client_a);
    policy:=pg_temp.s148_policy(NULL,user_id,fx.org_a,0);
    UPDATE public.seguros_embarque SET deleted_at=now() WHERE id=policy;
    PERFORM pg_temp.s148_reject_fk(format('UPDATE public.embarques SET organization_id=%L,cliente_id=%L WHERE id=%L',fx.org_b,client_b,user_id),'insurance_shipment_same_org_fk');
    RAISE EXCEPTION USING ERRCODE='Z0148';
  EXCEPTION WHEN SQLSTATE 'Z0148' THEN NULL; END;

  PERFORM pg_temp.as_user(fx.admin_a);
  page:=public.seguro_facturas_elegibles(e_anomaly,100,'MXN');
  PERFORM pg_temp.s148_assert(page=jsonb_build_object('items','[]'::jsonb,'next_cursor',NULL),
    'all historical anomaly fixtures rolled back completely');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.s148_assert(pg_temp.s148_catalog()=before_catalog,
    'runtime suite preserved production functions, owner/ACL, policies, RLS, triggers, constraints and DB role memberships');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'PASS SELECTOR148: 18 singleton roles; 10 disallowed disagreement families both directions; 85 approved-global memberships; tenant and super scope; hidden denominator; 275 equal-date eligible + 125 rejects at limits 1/25/100; exact output/cursor/errors; 4 invalid candidate dates and out-of-range cursors; occupancy/identity; 6 exact persistent FK rejections; catalog preservation';
END $security_pagination$;

ROLLBACK;
