CREATE TRIGGER trg_guard_aprobacion_proveedor_factura BEFORE UPDATE ON public.proveedor_facturas FOR EACH ROW EXECUTE FUNCTION public.guard_aprobacion_proveedor_factura();
CREATE FUNCTION financial_fixture.snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r record; j jsonb; result jsonb:='{}'; BEGIN
 FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','auth','financial_fixture') AND c.relkind IN ('r','p') ORDER BY 1,2 LOOP
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),''[]''::jsonb) FROM %I.%I x',r.nspname,r.relname) INTO j;
 result:=result||jsonb_build_object(r.nspname||'.'||r.relname,j);
 END LOOP; RETURN result;
END $$;
CREATE FUNCTION financial_fixture.test_case(p_case text,p_role public.app_role,p_error text DEFAULT NULL,p_state text DEFAULT 'P0001') RETURNS text LANGUAGE plpgsql AS $$
DECLARE
 u uuid:='00000000-0000-4000-8000-000000000101';
 other_u uuid:='00000000-0000-4000-8000-000000000102';
 cost_id uuid:='00000000-0000-4000-8000-000000000601';
 incoming_id uuid:='00000000-0000-4000-8000-000000000701';
 o uuid:='00000000-0000-4000-8000-000000000001';
 other_o uuid:='00000000-0000-4000-8000-000000000002';
 f uuid:='00000000-0000-4000-8000-000000000201';
 s uuid:='00000000-0000-4000-8000-000000000301';
 e uuid:='00000000-0000-4000-8000-000000000401';
 c uuid:='00000000-0000-4000-8000-000000000501';
 expected timestamptz:='2026-10-15T00:00:00Z';
 before_all jsonb; before_call jsonb; result public.proveedor_facturas;
 caught boolean:=false; approve boolean:=true; reason text; msg text; code text;
BEGIN
 before_all:=financial_fixture.snapshot();
 BEGIN
 INSERT INTO public.organizations VALUES(o),(other_o);
 INSERT INTO auth.users VALUES(u,'actor@example.invalid');
 INSERT INTO public.user_roles VALUES(u,p_role);
 INSERT INTO public.organization_members VALUES(u,o);
 UPDATE financial_fixture.actor SET user_id=u;
 INSERT INTO public.proveedores VALUES(s,o,'Nacional','SYNTHETIC SUPPLIER');
 INSERT INTO public.embarques VALUES(e,o,'En tránsito',NULL);
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,embarque_id,created_by,proveedor_nombre,folio_proveedor)
 VALUES(f,o,s,e,u,'SYNTHETIC SUPPLIER','SYNTHETIC-UNIT-1');
 INSERT INTO public.proveedor_facturas_conceptos VALUES(c,f,NULL,1,100);
 CASE p_case
 WHEN 'unauthenticated' THEN UPDATE financial_fixture.actor SET user_id=NULL;
 WHEN 'foreign_tenant' THEN DELETE FROM public.organization_members WHERE user_id=u;
 WHEN 'super_admin_foreign' THEN DELETE FROM public.organization_members WHERE user_id=u;
 WHEN 'null_cas' THEN expected:=NULL;
 WHEN 'stale_cas' THEN expected:=expected-interval '1 microsecond';
 WHEN 'no_concepts' THEN DELETE FROM public.proveedor_facturas_conceptos;
 WHEN 'invalid_amounts' THEN UPDATE public.proveedor_facturas_conceptos SET monto=90;
 WHEN 'invalid_tax' THEN UPDATE public.proveedor_facturas SET iva=50;
 WHEN 'cancelled_shipment' THEN UPDATE public.embarques SET estado='Cancelado';
 WHEN 'foreign_shipment' THEN UPDATE public.embarques SET organization_id=other_o;
 WHEN 'unverified_uuid' THEN UPDATE public.proveedor_facturas SET uuid_fiscal='00000000-0000-4000-8000-000000000901';
 WHEN 'already_decided' THEN
 PERFORM set_config('app.aprobando_cxp','1',true);
 UPDATE public.proveedor_facturas SET estado_aprobacion='aprobada';
 PERFORM set_config('app.aprobando_cxp','0',true);
 WHEN 'rejection_no_reason' THEN approve:=false;
 WHEN 'valid_rejection' THEN
 approve:=false;reason:='Synthetic rejection reason';
 INSERT INTO public.conceptos_costo(id,concepto,moneda,monto,embarque_id,origen) VALUES(cost_id,'SYNTHETIC COST','MXN',100,e,'manual');
 UPDATE public.proveedor_facturas_conceptos SET concepto_costo_id=cost_id WHERE id=c;
 INSERT INTO public.embarque_facturas_entrantes(id,proveedor_factura_id,estado,capturado_por,updated_at) VALUES(incoming_id,f,'capturada',u,expected);
 WHEN 'other_creator' THEN
 INSERT INTO auth.users VALUES(other_u,'other-creator@example.invalid');
 INSERT INTO public.organization_members VALUES(other_u,o);
 UPDATE public.proveedor_facturas SET created_by=other_u;
 WHEN 'direct_approval' THEN NULL;
 WHEN 'own_invoice' THEN NULL;
 WHEN 'denied_role' THEN NULL;
 ELSE RAISE EXCEPTION 'Unknown test case %',p_case;
 END CASE;
 before_call:=financial_fixture.snapshot();
 BEGIN
 IF p_case='direct_approval' THEN
 UPDATE public.proveedor_facturas SET estado_aprobacion='aprobada' WHERE id=f;
 ELSE
 result:=demo_flow_writer.human_approval_main(f,approve,reason,expected);
 END IF;
 EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;
 IF p_error IS NULL OR code<>p_state OR left(msg,length(p_error))<>p_error THEN RAISE; END IF;
 caught:=true;
 END;
 IF p_error IS NOT NULL AND NOT caught THEN RAISE EXCEPTION 'Expected error not raised: %',p_error; END IF;
 IF caught THEN
 IF financial_fixture.snapshot() IS DISTINCT FROM before_call THEN RAISE EXCEPTION 'Rejected call changed persistent rows'; END IF;
 ELSE
 IF result.aprobada_por IS DISTINCT FROM u OR result.aprobada_at IS NULL OR result.estado_aprobacion::text IS DISTINCT FROM CASE WHEN approve THEN 'aprobada' ELSE 'rechazada' END THEN RAISE EXCEPTION 'Human approval result invalid'; END IF;
 IF (SELECT count(*) FROM public.bitacora_actividad WHERE usuario_id=u AND entidad_id=f)<>1 THEN RAISE EXCEPTION 'Missing audit row'; END IF;
 IF NOT approve AND (result.estado::text<>'Cancelada' OR result.embarque_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id=f)) THEN RAISE EXCEPTION 'Rejection did not unlink'; END IF;
 IF p_case='valid_rejection' AND (
 NOT EXISTS(SELECT 1 FROM public.embarque_facturas_entrantes WHERE id=incoming_id AND proveedor_factura_id IS NULL AND capturado_por IS NULL AND estado='rechazada' AND rechazo_motivo=reason)
 OR NOT EXISTS(SELECT 1 FROM public.conceptos_costo WHERE id=cost_id AND deleted_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.bitacora_actividad WHERE entidad_id=f AND detalles->>'vinculos_eliminados'='1' AND detalles->>'entrantes_rechazados'='1'))
 THEN RAISE EXCEPTION 'Rejection linked-cost/incoming-document result invalid'; END IF;
 END IF;
 -- Deliberate savepoint rollback proves every scenario leaves fixture rows unchanged.
 RAISE EXCEPTION 'SYNTHETIC_CASE_COMPLETE' USING ERRCODE='P0T99';
 EXCEPTION WHEN SQLSTATE 'P0T99' THEN
 IF SQLERRM<>'SYNTHETIC_CASE_COMPLETE' THEN RAISE; END IF;
 END;
 IF financial_fixture.snapshot() IS DISTINCT FROM before_all THEN RAISE EXCEPTION 'Scenario rollback changed rows'; END IF;
 RETURN p_case||':'||p_role::text;
END $$;
SELECT financial_fixture.test_case('own_invoice',role::public.app_role) FROM unnest(ARRAY['contador','admin','admin_org','super_admin']) role;
SELECT financial_fixture.test_case('other_creator','contador');
SELECT financial_fixture.test_case('super_admin_foreign','super_admin');
SELECT financial_fixture.test_case('denied_role',role::public.app_role,'LC_SOD_VIOLATION:') FROM unnest(ARRAY['viewer','operador','auxiliar_contable','tesorero']) role;
SELECT financial_fixture.test_case('unauthenticated','contador','No autenticado');
SELECT financial_fixture.test_case('foreign_tenant','contador','Factura no encontrada','42501');
SELECT financial_fixture.test_case('null_cas','contador','LC_CONFLICTO_CONCURRENCIA:','PT409');
SELECT financial_fixture.test_case('stale_cas','contador','LC_CONFLICTO_CONCURRENCIA:','PT409');
SELECT financial_fixture.test_case('already_decided','contador','La factura ya fue');
SELECT financial_fixture.test_case('no_concepts','contador','LC_CXP_SIN_CONCEPTOS:');
SELECT financial_fixture.test_case('invalid_amounts','contador','LC_CXP_DESCUADRE:');
SELECT financial_fixture.test_case('invalid_tax','contador','LC_CXP_IVA_IMPLAUSIBLE:');
SELECT financial_fixture.test_case('cancelled_shipment','contador','LC_CXP_EMBARQUE_CANCELADO:');
SELECT financial_fixture.test_case('foreign_shipment','contador','LC_CXP_EMBARQUE_ORG_MISMATCH:');
SELECT financial_fixture.test_case('unverified_uuid','contador','LC_CXP_UUID_NO_VERIFICADO:');
SELECT financial_fixture.test_case('rejection_no_reason','contador','Motivo de rechazo requerido');
SELECT financial_fixture.test_case('valid_rejection','contador');
SELECT financial_fixture.test_case('direct_approval','contador','LC_CXP_APROBACION_DIRECTA:','42501');
SELECT 'SYNTHETIC_HUMAN_24_ASSERTIONS_COMPLETE';
