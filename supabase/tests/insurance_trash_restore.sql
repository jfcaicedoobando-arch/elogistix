-- Local candidate regression; real authenticated callers, rollback-only synthetic fixtures.
BEGIN;
\i supabase/tests/rls/_helpers.sql
CREATE FUNCTION pg_temp.ok(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 RAISE NOTICE 'PASS: %',label;
END $$;
CREATE FUNCTION pg_temp.reject(stmt text,expected_state text,expected_message text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE code text; msg text; rejected boolean:=false;
BEGIN
 BEGIN EXECUTE stmt;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;
  IF code <> expected_state OR position(expected_message IN msg)=0 THEN
   RAISE EXCEPTION 'FIXTURE ERROR %: wanted % / %, received % / %',label,expected_state,expected_message,code,msg;
  END IF;
  rejected:=true;
 END;
 PERFORM pg_temp.ok(rejected,label || ' [' || expected_state || ']');
END $$;
CREATE FUNCTION pg_temp.policy(pf uuid,ship uuid,org uuid,premium numeric DEFAULT 100,deleted timestamptz DEFAULT NULL,number text DEFAULT 'Synthetic policy')
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.seguros_embarque(id,organization_id,embarque_id,aseguradora,numero_poliza,prima,moneda,vigencia_desde,vigencia_hasta,proveedor_factura_id,deleted_at)
 VALUES(result,org,ship,'Synthetic insurer',number,premium,'MXN',CURRENT_DATE,CURRENT_DATE+365,pf,deleted);
 RETURN result;
END $$;
CREATE FUNCTION pg_temp.invoice(ship uuid,org uuid,provider uuid,category uuid,base numeric DEFAULT 100)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,embarque_id,folio_proveedor,moneda,subtotal,iva,total,tipo_cambio_usd,estado)
 VALUES(result,org,provider,category,ship,result::text,'MXN',base,base*.16,base*1.16,20,'Vigente');
 RETURN result;
END $$;
DO $cases$
DECLARE
 fx record; viewer uuid:=gen_random_uuid(); operator_id uuid:=gen_random_uuid(); super_id uuid:=gen_random_uuid();
 cli uuid:=gen_random_uuid(); other_cli uuid:=gen_random_uuid(); deleted_cli uuid:=gen_random_uuid();
 prov uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid(); other_prov uuid:=gen_random_uuid(); other_cat uuid:=gen_random_uuid();
 e uuid:=gen_random_uuid(); other_e uuid:=gen_random_uuid(); s uuid; s2 uuid; pf uuid; row_data record; before_row jsonb;
 t timestamptz:=now(); cc uuid:=gen_random_uuid(); independent uuid; failure_case text;
BEGIN
 SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('INSURANCE_TRASH','admin_org');
 PERFORM pg_temp.seed_auth_user(viewer,'trash-viewer@test.local');
 PERFORM pg_temp.seed_auth_user(operator_id,'trash-operator@test.local');
 PERFORM pg_temp.seed_auth_user(super_id,'trash-super@test.local');
 INSERT INTO organization_members(organization_id,user_id,role) VALUES(fx.org_a,viewer,'customer_service'),(fx.org_a,operator_id,'coordinador_logistico');
 INSERT INTO user_roles(user_id,role) VALUES(viewer,'customer_service'),(operator_id,'coordinador_logistico'),(super_id,'super_admin') ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role;
 INSERT INTO clientes(id,organization_id,nombre,email) VALUES(cli,fx.org_a,'Synthetic client','trash@test.local'),(other_cli,fx.org_b,'Other client','trash-other@test.local'),(deleted_cli,fx.org_a,'Restorable client','trash-deleted@test.local');
 INSERT INTO proveedores(id,organization_id,nombre,categoria,tipo) VALUES(prov,fx.org_a,'Synthetic insurer','Logistico','Naviera'),(other_prov,fx.org_b,'Other insurer','Logistico','Naviera');
 INSERT INTO presupuesto_categorias(id,organization_id,nombre) VALUES(cat,fx.org_a,'Insurance'),(other_cat,fx.org_b,'Insurance');
 INSERT INTO embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd) VALUES(e,fx.org_a,cli,'DEMO-2026-158902','Marítimo','Importación',20),(other_e,fx.org_b,other_cli,'DEMO-2026-158903','Marítimo','Importación',20);
 s2:=pg_temp.policy(NULL,other_e,fx.org_b,100,t,'Other org policy');
 PERFORM pg_temp.as_user(fx.admin_a);
 PERFORM pg_temp.ok(current_user='authenticated' AND auth.uid()=fx.admin_a AND has_role(auth.uid(),'admin'),'ordinary authenticated admin_org caller uses unchanged role hierarchy');
 s:=pg_temp.policy(NULL,e,fx.org_a,100,t,'Policy newest');
 UPDATE seguros_embarque SET created_by=fx.admin_a,updated_by=fx.admin_a WHERE id=s;
 independent:=pg_temp.policy(NULL,e,fx.org_a,100,t-interval '1 day','');
 SELECT * INTO STRICT row_data FROM list_trash('seguros_embarque',1,0);
 PERFORM pg_temp.ok(row_data.id=s AND row_data.label='Policy newest' AND row_data.organization_id=fx.org_a,'list uses real numero_poliza and excludes other organization');
 PERFORM pg_temp.ok(row_data.deleted_by IS NULL AND row_data.deleted_by_email IS NULL,'unknown deletion actor stays NULL despite created_by and updated_by');
 SELECT * INTO STRICT row_data FROM list_trash('seguros_embarque',1,1);
 PERFORM pg_temp.ok(row_data.id=independent AND row_data.label='(sin etiqueta)','listing preserves limit offset ordering and empty-label fallback');
 PERFORM pg_temp.ok((SELECT count(*) FROM list_trash('seguros_embarque',0,0))=0,'zero listing limit remains empty');
 PERFORM pg_temp.ok((SELECT total FROM list_trash_counts() WHERE tabla='seguros_embarque')=2,'existing insurance count agrees with list');
 SELECT to_jsonb(x) INTO before_row FROM seguros_embarque x WHERE id=s;
 PERFORM pg_temp.reject(format('UPDATE seguros_embarque SET deleted_at=NULL WHERE id=%L',s),'P0001','LC_RESTORE_DIRECTO','direct restore protection remains in force');
 PERFORM restore_record('seguros_embarque',s);
 PERFORM pg_temp.ok((SELECT deleted_at IS NULL AND (to_jsonb(x)-'deleted_at'-'updated_at')=(before_row-'deleted_at'-'updated_at') FROM seguros_embarque x WHERE id=s),'RPC restores unlinked policy and preserves all business and actor fields');
 PERFORM pg_temp.ok(current_setting('app.papelera_restore',true)='off','successful RPC closes restore gate');
 PERFORM pg_temp.ok((SELECT count(*) FROM list_trash('seguros_embarque',50,0) WHERE id=s)=0 AND (SELECT total FROM list_trash_counts() WHERE tabla='seguros_embarque')=1,'restored policy disappears from list and count');
 PERFORM pg_temp.reject(format('SELECT restore_record(''seguros_embarque'',%L)',s),'P0001','Registro no encontrado en papelera','already active policy cannot be restored twice');
 PERFORM pg_temp.reject(format('SELECT restore_record(''seguros_embarque'',%L)',gen_random_uuid()),'P0001','Registro no encontrado en papelera','missing policy rejected');
 PERFORM pg_temp.reject('SELECT * FROM list_trash(''auth.users'')','P0001','Tabla no permitida','list allowlist unchanged');
 PERFORM pg_temp.reject(format('SELECT restore_record(''auth.users'',%L)',s),'P0001','Tabla no permitida','restore allowlist unchanged');
 -- Non-insurance paths retain truthful deletion actor and generic two-column restore.
 UPDATE clientes SET deleted_at=now() WHERE id=deleted_cli;
 SELECT * INTO STRICT row_data FROM list_trash('clientes') WHERE id=deleted_cli;
 PERFORM pg_temp.ok(row_data.deleted_by=fx.admin_a AND row_data.deleted_by_email='insurance_trash-a@test.local' AND row_data.label=(SELECT nombre FROM clientes WHERE id=deleted_cli),'other entity listing preserves actual deletion actor and label');
 PERFORM restore_record('clientes',deleted_cli);
 PERFORM pg_temp.ok((SELECT deleted_at IS NULL AND deleted_by IS NULL FROM clientes WHERE id=deleted_cli),'generic restore still clears both deletion columns');
 -- Authorization: viewer, other tenant, operator, absent UID, anon, scoped super admin.
 PERFORM pg_temp.as_user(viewer);
 PERFORM pg_temp.reject('SELECT * FROM list_trash(''seguros_embarque'')','P0001','Sólo admin / super_admin','customer_service list denied');
 PERFORM pg_temp.reject(format('SELECT restore_record(''seguros_embarque'',%L)',independent),'P0001','Permisos insuficientes','customer_service restore denied');
 PERFORM pg_temp.as_user(fx.admin_b);
 PERFORM pg_temp.ok((SELECT count(*) FROM list_trash('seguros_embarque'))=1 AND (SELECT id FROM list_trash('seguros_embarque'))=s2,'other tenant only lists its own insurance');
 PERFORM pg_temp.reject(format('SELECT restore_record(''seguros_embarque'',%L)',independent),'P0001','LC_ORG_FUERA_DE_SCOPE','cross-tenant insurance restore denied');
 PERFORM pg_temp.as_user(operator_id);
 PERFORM pg_temp.reject('SELECT * FROM list_trash(''seguros_embarque'')','P0001','Sólo admin / super_admin','coordinador_logistico list remains denied');
 PERFORM restore_record('seguros_embarque',independent);
 PERFORM pg_temp.ok((SELECT deleted_at IS NULL FROM seguros_embarque WHERE id=independent),'coordinador_logistico restore remains allowed by original restore role gate');
 UPDATE seguros_embarque SET deleted_at=now() WHERE id=independent;
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 PERFORM pg_temp.reject('SELECT * FROM list_trash(''seguros_embarque'')','P0001','No autenticado','missing UID list denied');
 PERFORM pg_temp.reject(format('SELECT restore_record(''seguros_embarque'',%L)',independent),'P0001','No autenticado','missing UID restore denied');
 PERFORM set_config('role','anon',true);
 PERFORM pg_temp.reject('SELECT * FROM list_trash(''seguros_embarque'')','42501','permission denied for function list_trash','anonymous list execute denied');
 PERFORM pg_temp.reject(format('SELECT restore_record(''seguros_embarque'',%L)',independent),'42501','permission denied for function restore_record','anonymous restore execute denied');
 PERFORM pg_temp.as_user(super_id);
 PERFORM pg_temp.ok((SELECT count(*) FROM list_trash('seguros_embarque'))=0,'super admin without active organization lists no tenants');
 PERFORM pg_temp.reject(format('SELECT restore_record(''seguros_embarque'',%L)',independent),'P0001','LC_ORG_FUERA_DE_SCOPE','super admin without active organization cannot restore insurance');
 PERFORM set_super_admin_org(fx.org_b);
 PERFORM pg_temp.ok((SELECT count(*) FROM list_trash('seguros_embarque'))=1 AND (SELECT id FROM list_trash('seguros_embarque'))=s2,'super admin listing follows active organization');
 PERFORM pg_temp.reject(format('SELECT restore_record(''seguros_embarque'',%L)',independent),'P0001','LC_ORG_FUERA_DE_SCOPE','super admin wrong active organization cannot restore insurance');
 PERFORM set_super_admin_org(fx.org_a);
 PERFORM restore_record('seguros_embarque',independent);
 PERFORM pg_temp.ok((SELECT deleted_at IS NULL FROM seguros_embarque WHERE id=independent),'super admin matching active organization restores insurance');
 -- Real linked restoration plus complete rollback for every invalid historical link.
 PERFORM pg_temp.as_user(fx.admin_a);
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat);s:=pg_temp.policy(pf,e,fx.org_a);
 UPDATE seguros_embarque SET deleted_at=now() WHERE id=s;
 SELECT to_jsonb(x) INTO before_row FROM seguros_embarque x WHERE id=s;
 PERFORM restore_record('seguros_embarque',s);
 PERFORM pg_temp.ok((SELECT deleted_at IS NULL AND proveedor_factura_id=pf AND (to_jsonb(x)-'deleted_at'-'updated_at')=(before_row-'deleted_at'-'updated_at') FROM seguros_embarque x WHERE id=s),'sufficiently covered linked policy restores with full identity preserved');
 FOREACH failure_case IN ARRAY ARRAY['insufficient','cancelled','deleted','wrong_org','duplicate'] LOOP
  PERFORM pg_temp.as_postgres();
  IF failure_case='wrong_org' THEN pf:=pg_temp.invoice(other_e,fx.org_b,other_prov,other_cat);
  ELSE pf:=pg_temp.invoice(e,fx.org_a,prov,cat); END IF;
  s:=pg_temp.policy(pf,e,fx.org_a,100,now());
  IF failure_case='insufficient' THEN UPDATE proveedor_facturas SET subtotal=60,total=69.6 WHERE id=pf;
  ELSIF failure_case='cancelled' THEN PERFORM pg_temp.as_user(fx.admin_a); PERFORM cancelar_factura_proveedor(pf,'Synthetic invalid restore fixture'); PERFORM pg_temp.as_postgres();
  ELSIF failure_case='deleted' THEN UPDATE proveedor_facturas SET deleted_at=now() WHERE id=pf;
  ELSIF failure_case='duplicate' THEN s2:=pg_temp.policy(pf,e,fx.org_a); END IF;
  SELECT to_jsonb(x) INTO before_row FROM seguros_embarque x WHERE id=s;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.ok(current_setting('app.papelera_restore',true)='off','gate is off before rejected '||failure_case||' restore');
  PERFORM pg_temp.reject(format('SELECT restore_record(''seguros_embarque'',%L)',s),CASE WHEN failure_case='duplicate' THEN '23505' ELSE '23514' END,
   CASE WHEN failure_case='duplicate' THEN 'ux_seguros_embarque_factura_activa' WHEN failure_case='insufficient' THEN 'LC_SEGURO_COBERTURA_INCOMPLETA' ELSE 'LC_SEGURO_FACTURA_INVALIDA' END,'invalid linked restore '||failure_case);
  PERFORM pg_temp.ok((SELECT to_jsonb(x) FROM seguros_embarque x WHERE id=s)=before_row,'rejected '||failure_case||' restore preserves full policy state');
  PERFORM pg_temp.ok(current_setting('app.papelera_restore',true)='off','rejected '||failure_case||' restore rolls back gate');
 END LOOP;
 -- Invoke both the delegating RPC and direct unchanged cascade. Earlier restored concepts must roll back on policy failure.
 FOREACH failure_case IN ARRAY ARRAY['rpc','direct'] LOOP
  PERFORM pg_temp.as_postgres(); e:=gen_random_uuid(); cc:=gen_random_uuid();
  INSERT INTO embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd) VALUES(e,fx.org_a,cli,CASE WHEN failure_case='rpc' THEN 'DEMO-2026-158904' ELSE 'DEMO-2026-158905' END,'Marítimo','Importación',20);
  INSERT INTO conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda) VALUES(cc,fx.org_a,e,prov,'Cascade allocation',100,'MXN');
  pf:=pg_temp.invoice(NULL,fx.org_a,prov,cat);
  INSERT INTO proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto) VALUES(fx.org_a,pf,cc,'Cascade coverage from restored concept',1,100);
  s:=pg_temp.policy(pf,e,fx.org_a);
  independent:=pg_temp.policy(NULL,e,fx.org_a,100,t-interval '1 day');
  UPDATE conceptos_costo SET deleted_at=t,deleted_by=fx.admin_a WHERE id=cc;
  UPDATE seguros_embarque SET deleted_at=t WHERE id=s;
  UPDATE embarques SET deleted_at=t,deleted_by=fx.admin_a WHERE id=e;
  PERFORM pg_temp.as_user(fx.admin_a);
  IF failure_case='rpc' THEN PERFORM restore_record('embarques',e); ELSE PERFORM restaurar_embarque_cascade(e); END IF;
  PERFORM pg_temp.ok((SELECT deleted_at IS NULL FROM embarques WHERE id=e) AND (SELECT deleted_at IS NULL FROM conceptos_costo WHERE id=cc) AND (SELECT deleted_at IS NULL FROM seguros_embarque WHERE id=s),'cascade '||failure_case||' restores concept then allocation-linked policy before header');
  PERFORM pg_temp.ok((SELECT deleted_at=t-interval '1 day' FROM seguros_embarque WHERE id=independent),'cascade '||failure_case||' preserves independent deletion batch');
  PERFORM pg_temp.ok(current_setting('app.papelera_restore',true)='off','cascade '||failure_case||' closes gate');
  UPDATE conceptos_costo SET deleted_at=now() WHERE id=cc;
  UPDATE seguros_embarque SET deleted_at=now() WHERE id=s;
  UPDATE embarques SET deleted_at=now() WHERE id=e;
  UPDATE proveedor_facturas SET subtotal=60,total=69.6 WHERE id=pf;
  PERFORM pg_temp.as_postgres();
  SELECT jsonb_build_object('shipment',(SELECT to_jsonb(x) FROM embarques x WHERE id=e),'policy',(SELECT to_jsonb(x) FROM seguros_embarque x WHERE id=s),'concept',(SELECT to_jsonb(x) FROM conceptos_costo x WHERE id=cc)) INTO before_row;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.reject(CASE WHEN failure_case='rpc' THEN format('SELECT restore_record(''embarques'',%L)',e) ELSE format('SELECT restaurar_embarque_cascade(%L)',e) END,'23514','LC_SEGURO_COBERTURA_INCOMPLETA','cascade '||failure_case||' rejects insufficient insurance coverage');
  PERFORM pg_temp.ok(current_setting('app.papelera_restore',true)='off','cascade '||failure_case||' failure rolls back gate');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.ok(jsonb_build_object('shipment',(SELECT to_jsonb(x) FROM embarques x WHERE id=e),'policy',(SELECT to_jsonb(x) FROM seguros_embarque x WHERE id=s),'concept',(SELECT to_jsonb(x) FROM conceptos_costo x WHERE id=cc))=before_row,'cascade '||failure_case||' failure atomically rolls back earlier concept and all policy/header fields');
 END LOOP;
 PERFORM pg_temp.as_postgres();
END $cases$;
ROLLBACK;
