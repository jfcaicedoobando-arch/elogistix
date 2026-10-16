\set ON_ERROR_STOP on
-- SYNTHETIC LAB ONLY. This populates a disposable, isolated candidate database.
-- auth.users/auth_context are labelled fixtures, not authentication evidence.
-- Canonical organization, membership, identity and financial triggers stay enabled.
BEGIN;
SET LOCAL check_function_bodies = on;
DO $guard$
BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('listen_addresses')<>'' OR inet_server_addr() IS NOT NULL
 OR current_setting('transaction_isolation')<>'read committed'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT rolsuper AND rolbypassrls AND NOT rolinherit AND NOT rolcreatedb
  AND NOT rolcreaterole AND NOT rolreplication)
 OR pg_has_role(current_user,'supabase_admin','MEMBER')
 OR (SELECT proowner FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure)
  IS DISTINCT FROM current_user::regrole::oid
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND NOT rolcanlogin
  AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreatedb
  AND NOT rolcreaterole AND NOT rolreplication) THEN
  RAISE EXCEPTION 'FINANCIAL_BEHAVIOR_SYNTHETIC_CANDIDATE_REQUIRED';
 END IF;
 IF EXISTS(SELECT 1 FROM public.organizations)
 OR EXISTS(SELECT 1 FROM auth.users)
 OR EXISTS(SELECT 1 FROM financial_compile_fixture.auth_context)
 OR EXISTS(SELECT 1 FROM demo_fixture_identity.registry)
 OR EXISTS(SELECT 1 FROM demo_fixture_identity.prepared_receipts)
 OR EXISTS(SELECT 1 FROM demo_fixture_identity.preparation_runs)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.transport_approvals)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.scheduler_approvals)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.server_admissions)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.control)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.runs)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.lineages)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts)
 OR EXISTS(SELECT 1 FROM public.proveedor_facturas)
 OR EXISTS(SELECT 1 FROM public.pagos_proveedor)
 OR EXISTS(SELECT 1 FROM public.demo_seed_state) THEN
  RAISE EXCEPTION 'FINANCIAL_BEHAVIOR_FRESH_SYNTHETIC_DATABASE_REQUIRED';
 END IF;
END $guard$;

-- Explicit fixture IDs are authority inputs reviewed by the lab owner. No lookup
-- adopts a supplier or shipment using its editable name/expediente.
CREATE TEMP TABLE financial_fixture_ids (
 fixture_id text PRIMARY KEY,
 fixture_key text NOT NULL UNIQUE,
 supplier_id uuid NOT NULL UNIQUE,
 shipment_id uuid NOT NULL UNIQUE,
 expediente text NOT NULL UNIQUE
);
INSERT INTO pg_temp.financial_fixture_ids VALUES
 ('aap-vencida','cliente.pacifico','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','DEMO-2026-1'),
 ('ttn-vigente','cliente.monterrey','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','DEMO-2026-2'),
 ('ofc-parcial','cliente.bajio','10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','DEMO-2026-3');
-- AUTHORIZED LAB MANIFEST VARIANT: the runner substitutes only the three
-- shipmentExpediente values SYNTHETIC-SHIPMENT-N -> DEMO-2026-N in its lab copy,
-- records before/after hashes, and preserves the original manifest source bytes.
-- The canonical expediente CHECK and engine stay exact and enabled. No production
-- manifest, engine validator, trigger, financial amount or identity rule changes.

-- The canonical organization trigger provisions its own categories/CRM defaults.
INSERT INTO public.organizations(id,nombre,rfc,activo) VALUES
 ('00000000-0000-4000-8000-000000000001','SYNTHETIC behavior tenant 1','',true),
 ('00000000-0000-4000-8000-000000000002','SYNTHETIC behavior tenant 2','',true);
INSERT INTO auth.users(id,email,deleted_at,banned_until)
 VALUES('40000000-0000-4000-8000-000000000001','synthetic-sponsor@example.invalid',NULL,NULL);
-- The canonical membership INSERT trigger mirrors admin_org into user_roles.
INSERT INTO public.organization_members(id,organization_id,user_id,role)
 VALUES('50000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001','admin_org');
INSERT INTO financial_compile_fixture.auth_context(singleton,subject_user_id,role_name,jwt_claims)
 VALUES(true,'40000000-0000-4000-8000-000000000001','authenticated',
  '{"role":"authenticated","fixture":"SYNTHETIC"}'::jsonb);
DO $membership$
BEGIN
 IF (SELECT count(*) FROM public.user_roles
  WHERE user_id='40000000-0000-4000-8000-000000000001' AND role='admin_org')<>1 THEN
  RAISE EXCEPTION 'FINANCIAL_BEHAVIOR_CANONICAL_MEMBERSHIP_MIRROR_REQUIRED';
 END IF;
END $membership$;

INSERT INTO public.presupuesto_categorias(id,organization_id,nombre,tipo_contable)
 VALUES('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
  'Sin categoría','CostoDirectoEmbarque');
INSERT INTO public.configuracion(id,organization_id,categoria,clave,valor,descripcion)
 VALUES('90000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
  'contabilidad','cierre_periodo_fecha','null'::jsonb,'SYNTHETIC open-period fixture');

-- Authentic helper creates and registers explicit IDs. No manual registry INSERT.
CREATE TEMP TABLE financial_client_bindings AS
 SELECT k.fixture_key, f.cliente_id, f.contacto_id, f.empresa_id
 FROM (VALUES('cliente.bajio'),('cliente.monterrey'),('cliente.pacifico')) k(fixture_key)
 CROSS JOIN LATERAL demo_fixture_identity.ensure(k.fixture_key) f;

-- Both discriminator and subtype are explicit; canonical normalization runs.
INSERT INTO public.proveedores(id,organization_id,nombre,rfc,categoria,tipo,dias_credito,estado_alta)
 SELECT x.supplier_id,'00000000-0000-4000-8000-000000000001',
  demo_flow_writer.fixture_spec(x.fixture_id)->>'supplierName',
  demo_flow_writer.fixture_spec(x.fixture_id)->>'supplierRFC','Logistico','Transportista',
  (demo_flow_writer.fixture_spec(x.fixture_id)->>'creditDays')::integer,'aprobado'
 FROM pg_temp.financial_fixture_ids x;
INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo,estado,
 tipo_cambio_usd,tipo_cambio_eur)
 SELECT x.shipment_id,'00000000-0000-4000-8000-000000000001',c.cliente_id,x.expediente,
  'Terrestre','Nacional','Confirmado',20,22
 FROM pg_temp.financial_fixture_ids x
 JOIN pg_temp.financial_client_bindings c ON c.fixture_key=x.fixture_key;

-- Manual records are intentionally outside every admitted UUID binding.
INSERT INTO public.proveedores(id,organization_id,nombre,rfc,categoria,tipo,dias_credito,estado_alta) VALUES
 ('10000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001',
  'SYNTHETIC manual sentinel tenant 1','','Logistico','Transportista',0,'aprobado'),
 ('10000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000002',
  'SYNTHETIC manual sentinel tenant 2','','Logistico','Transportista',0,'aprobado');
CREATE TEMP TABLE financial_manual_sentinels (
 schema_name text NOT NULL,table_name text NOT NULL,row_id uuid NOT NULL,
 organization_id uuid NOT NULL,snapshot jsonb NOT NULL,
 PRIMARY KEY(schema_name,table_name,row_id)
);
INSERT INTO pg_temp.financial_manual_sentinels
 SELECT 'public','proveedores',p.id,p.organization_id,to_jsonb(p)
 FROM public.proveedores p
 WHERE p.id IN('10000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000102');

-- Scheduler sponsor approves delegation; it is not a human authenticated by the RPC.
UPDATE financial_compile_fixture.auth_context SET subject_user_id=NULL,role_name='service_role',
 jwt_claims='{"role":"service_role","fixture":"SYNTHETIC"}'::jsonb WHERE singleton;
INSERT INTO demo_flow_writer.control(singleton,enabled_value) VALUES(true,'true');
DO $ready$
BEGIN
 IF auth.uid() IS NOT NULL OR auth.role() IS DISTINCT FROM 'service_role'
 OR auth.jwt()->>'fixture' IS DISTINCT FROM 'SYNTHETIC'
 OR (SELECT count(*) FROM pg_temp.financial_client_bindings)<>3
 OR (SELECT count(*) FROM pg_temp.financial_manual_sentinels)<>2
 OR (SELECT count(DISTINCT organization_id) FROM pg_temp.financial_manual_sentinels)<>2
 OR (SELECT count(*) FROM public.embarques)<>3
 OR (SELECT count(*) FROM public.proveedores)<>5
 OR NOT demo_flow_writer.enabled() THEN
  RAISE EXCEPTION 'FINANCIAL_BEHAVIOR_SYNTHETIC_FIXTURE_INCOMPLETE';
 END IF;
END $ready$;
COMMIT;
SELECT 'FINANCIAL_BEHAVIOR_SYNTHETIC_FIXTURE_COMPLETE';
