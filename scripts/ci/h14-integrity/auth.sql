-- H14 authorization regression. Baseline e302a5a8baee295a5de83adc91265c87cbf45988.
-- Derived from the exercised strict H14 auth fixture; corrected A05 expectation.
-- Preparation only until the reviewed owned runner executes this exact file.
-- All setup is synthetic. No public function, ACL, policy or trigger is changed.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '60s';

DO $$
BEGIN
  IF session_user IS DISTINCT FROM 'postgres' OR current_user IS DISTINCT FROM 'postgres'
     OR current_database() !~ '^h14_auth_[a-f0-9]{32}$'
     OR inet_server_addr() IS NOT NULL
     OR current_setting('unix_socket_directories') NOT IN ('/lab','/var/run/postgresql') THEN
    RAISE EXCEPTION 'H14_AUTH_WRONG_TARGET: isolated owned auth clone required';
  END IF;
END $$;

CREATE TEMP TABLE h14_auth_results(case_id text PRIMARY KEY, payload jsonb NOT NULL) ON COMMIT DROP;

CREATE FUNCTION pg_temp.h14_auth_assert(p_condition boolean, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_condition IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'H14_AUTH_FIXTURE_OR_ASSERTION: %', p_message;
  END IF;
END $$;

-- Same local-role/claims mechanism as supabase/tests/rls/_helpers.sql:16-25,60-68.
-- No SECURITY DEFINER test helper, auth function replacement, or GRANT.
CREATE FUNCTION pg_temp.h14_auth_as_actor(p_actor uuid, p_role text DEFAULT 'authenticated')
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  PERFORM pg_temp.h14_auth_assert(p_role IN ('authenticated','anon'), 'unexpected test connection role');
  PERFORM set_config('request.jwt.claims',
    (jsonb_build_object('role', p_role) || CASE WHEN p_actor IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object('sub', p_actor) END)::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

CREATE FUNCTION pg_temp.h14_auth_as_owner()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, true);
  PERFORM set_config('role', NULL, true);
  RESET ROLE;
END $$;

CREATE FUNCTION pg_temp.h14_auth_actor(p_org uuid, p_role public.app_role, p_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_actor uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.h14_auth_assert(current_user = 'postgres', 'actor setup must run as owner');
  INSERT INTO auth.users(id, email, raw_user_meta_data)
  VALUES (v_actor, 'h14-auth-' || p_label || '-' || v_actor || '@example.invalid',
    '{"skip_auto_org":true}'::jsonb);
  PERFORM pg_temp.h14_auth_assert(EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_actor AND email LIKE '%@example.invalid'
  ), 'strict auth.users insert must exist; no best-effort seed');
  IF p_org IS NOT NULL THEN
    INSERT INTO public.organization_members(organization_id, user_id, role)
    VALUES (p_org, v_actor, p_role);
    PERFORM pg_temp.h14_auth_assert(EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = v_actor AND role = p_role
    ), 'real membership trigger must produce the modern role mirror');
  ELSE
    PERFORM pg_temp.h14_auth_assert(p_role = 'super_admin', 'only platform fixture has no initial membership');
    INSERT INTO public.user_roles(user_id, role) VALUES (v_actor, p_role);
  END IF;
  RETURN v_actor;
END $$;

CREATE FUNCTION pg_temp.h14_auth_embarque(p_org uuid, p_cliente uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_embarque uuid;
BEGIN
  PERFORM pg_temp.h14_auth_assert(current_user = 'postgres' AND auth.uid() IS NULL,
    'owner-only setup without claims; existing creation triggers remain enabled');
  INSERT INTO public.embarques(organization_id, cliente_id, expediente, modo, tipo, estado,
    tipo_cambio_usd, tipo_cambio_eur)
  VALUES (p_org, p_cliente, NULL, 'Marítimo', 'Importación', 'Borrador', 1, 1)
  RETURNING id INTO v_embarque;
  RETURN v_embarque;
END $$;

-- Full rows + tuple identities, read as owner, cover both tenants and the RPC's
-- financial/read and operational/write tables. Nothing is filtered by caller RLS.
CREATE FUNCTION pg_temp.h14_auth_snapshot()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_table text; v_rows jsonb; v_snapshot jsonb := '{}'::jsonb;
BEGIN
  PERFORM pg_temp.h14_auth_assert(current_user = 'postgres', 'snapshots must not use caller RLS');
  FOREACH v_table IN ARRAY ARRAY[
    'organizations','organization_members','user_roles','super_admin_org_activa','clientes',
    'embarques','cotizaciones','conceptos_venta','conceptos_costo','documentos_embarque',
    'notas_embarque','eventos_embarque','embarque_contenedores','seguros_embarque',
    'facturas','proveedor_facturas','pagos_factura','pagos_proveedor','factura_notas_credito',
    'proveedor_notas_credito','comisiones_devengadas','proformas','factura_embarques',
    'conceptos_factura','proforma_conceptos_consolidados','proveedor_facturas_conceptos',
    'comisiones_recalculo_pendiente','liquidaciones_comision','bbva_movimientos',
    'notificaciones_cliente','notificaciones_internas','bitacora_actividad','role_change_log'
  ] LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(jsonb_build_object(''row'',to_jsonb(t),'
      || '''ctid'',t.ctid::text,''xmin'',t.xmin::text) ORDER BY to_jsonb(t)::text,t.ctid::text),'
      || '''[]''::jsonb) FROM public.%I t', v_table) INTO v_rows;
    v_snapshot := v_snapshot || jsonb_build_object(v_table, v_rows);
  END LOOP;
  SELECT coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(u),'ctid',u.ctid::text,
    'xmin',u.xmin::text) ORDER BY u.id), '[]'::jsonb) INTO v_rows FROM auth.users u;
  RETURN v_snapshot || jsonb_build_object('auth_users', v_rows);
END $$;

CREATE FUNCTION pg_temp.h14_auth_case(
  p_case text, p_actor uuid, p_embarque uuid, p_expected jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_before jsonb; v_after jsonb; v_context jsonb; v_setup jsonb; v_data jsonb; v_hint_data jsonb;
  v_rpc_attempted boolean:=false;
  v_state text; v_message text; v_hint text; v_detail text;
  v_org uuid; v_resolved_org uuid; v_visible integer;
  v_guard boolean; v_allowed boolean := (p_expected->>'allowed')::boolean;
  v_expected_role text := coalesce(p_expected->>'db_role', 'authenticated');
  v_operation text := coalesce(p_expected->>'operation', 'delete');
  v_missing boolean := coalesce((p_expected->>'missing')::boolean, false);
  v_target_before jsonb; v_target_after jsonb; v_other_before jsonb; v_other_after jsonb;
  v_new_logs jsonb; v_effects_match boolean; v_match boolean; v_fixture_valid boolean;
BEGIN
  PERFORM pg_temp.h14_auth_as_owner();
  SELECT organization_id INTO v_org FROM public.embarques WHERE id = p_embarque;
  PERFORM pg_temp.h14_auth_assert(v_operation IN ('delete','diagnostic','private_helper'), p_case || ': known operation');
  IF v_missing THEN
    PERFORM pg_temp.h14_auth_assert(v_operation='diagnostic' AND v_org IS NULL
      AND NOT EXISTS(SELECT 1 FROM public.embarques WHERE id=p_embarque),p_case||': missing diagnostic target');
  ELSE
    PERFORM pg_temp.h14_auth_assert(EXISTS (
      SELECT 1 FROM public.embarques WHERE id = p_embarque AND deleted_at IS NULL
        AND estado = 'Borrador' AND cerrado_at IS NULL AND cotizacion_id IS NULL
    ), p_case || ': target must be a fresh synthetic clean draft');
  END IF;
  v_setup := jsonb_build_object(
    'memberships', (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.id), '[]'::jsonb)
      FROM public.organization_members m WHERE user_id = p_actor),
    'global_roles', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb)
      FROM public.user_roles r WHERE user_id = p_actor));
  v_before := pg_temp.h14_auth_snapshot();
  PERFORM pg_temp.h14_auth_as_actor(p_actor, v_expected_role);
  v_context := jsonb_build_object('sql_role',current_user,'session_user',session_user,
    'auth_uid',auth.uid(),'claims',nullif(current_setting('request.jwt.claims',true),'')::jsonb);
  v_fixture_valid := current_user = v_expected_role AND auth.uid() IS NOT DISTINCT FROM p_actor;
  IF v_expected_role = 'authenticated' THEN
    v_resolved_org := public.current_user_org_id();
    -- This records the prior nullable expression as a fixture fact. A05 must
    -- now reject even while this independently measured expression is NULL.
    v_guard := public.has_role(auth.uid(),'super_admin') OR
      (v_org = v_resolved_org AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador')));
    SELECT count(*) INTO v_visible FROM public.embarques WHERE id = p_embarque;
    v_context := v_context || jsonb_build_object('resolved_org',v_resolved_org,'legacy_guard_truth',v_guard,
      'global_operator',public.has_role(auth.uid(),'operador'),
      'global_super_admin',public.has_role(auth.uid(),'super_admin'),
      'effective_operator_gate',public.has_any_role_efectivo(auth.uid(),ARRAY['operador']::public.app_role[]),
      'role_resolver_result',public.rol_efectivo(auth.uid(),v_resolved_org),
      'visible_target_count',v_visible);
    v_fixture_valid := v_fixture_valid AND p_expected ?& ARRAY[
      'resolved_org','guard_truth','visible_target_count','global_operator',
      'global_super_admin','effective_operator_gate','role_resolver_result']
      AND (v_resolved_org IS NOT DISTINCT FROM (p_expected->>'resolved_org')::uuid)
      AND (v_guard IS NOT DISTINCT FROM (p_expected->>'guard_truth')::boolean)
      AND (v_visible IS NOT DISTINCT FROM (p_expected->>'visible_target_count')::integer)
      AND ((v_context->>'global_operator')::boolean IS NOT DISTINCT FROM (p_expected->>'global_operator')::boolean)
      AND ((v_context->>'global_super_admin')::boolean IS NOT DISTINCT FROM (p_expected->>'global_super_admin')::boolean)
      AND ((v_context->>'effective_operator_gate')::boolean IS NOT DISTINCT FROM (p_expected->>'effective_operator_gate')::boolean)
      AND ((v_context->>'role_resolver_result') IS NOT DISTINCT FROM (p_expected->>'role_resolver_result'));
  END IF;
  IF v_fixture_valid IS DISTINCT FROM TRUE THEN
    PERFORM pg_temp.h14_auth_as_owner();
    INSERT INTO pg_temp.h14_auth_results VALUES(p_case,jsonb_build_object(
      'case_id',p_case,'matrix_id',split_part(p_case,'-',1),'expected_by_code',p_expected,
      'status','INVALID_FIXTURE','operation',v_operation,'actor_id',p_actor,'target_id',p_embarque,
      'setup_evidence',v_setup,'actor_context',v_context,
      'observed',jsonb_build_object('phase','precondition','rpc_attempted',false,'fixture_valid',false),
      'snapshots',jsonb_build_object('before',v_before,'after',pg_temp.h14_auth_snapshot()),
      'reproduction_complete',false));
    RETURN;
  END IF;
  v_rpc_attempted:=true;
  BEGIN
    CASE v_operation
      WHEN 'diagnostic' THEN v_data:=public.diagnosticar_baja_embarque(p_embarque);
      WHEN 'private_helper' THEN v_data:=public._h14_dependencias_baja_embarque(p_embarque,v_org,true);
      ELSE PERFORM public.eliminar_embarque_completo(p_embarque);
    END CASE;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT,
      v_hint = PG_EXCEPTION_HINT, v_detail = PG_EXCEPTION_DETAIL;
  END;
  PERFORM pg_temp.h14_auth_as_owner();
  v_after := pg_temp.h14_auth_snapshot();
  IF p_expected ? 'hint_equals' THEN v_hint_data:=nullif(v_hint,'')::jsonb; END IF;
  IF v_allowed AND v_operation='diagnostic' THEN
    -- Successful preview is a read: complete zero counts for this clean draft,
    -- correct version/target and no examples or hidden mutation anywhere.
    v_effects_match:=v_before IS NOT DISTINCT FROM v_after
      AND jsonb_typeof(v_data)='object' AND v_data->'version'='1'::jsonb
      AND v_data->>'embarque_id'=p_embarque::text
      AND v_data @> '{"facturas":0,"cxp":0,"pagos_cxc":0,"pagos_cxp":0,"notas_credito_cxc":0,"notas_credito_cxp":0,"comisiones_definitivas":0,"proformas":0,"cerrado":false,"bloqueado":false,"ejemplos_cxc":[],"ejemplos_cxp":[]}'::jsonb
      AND v_data->'ejemplos_cxc'='[]'::jsonb AND v_data->'ejemplos_cxp'='[]'::jsonb
      AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(v_data) k) IS NOT DISTINCT FROM ARRAY[
        'bloqueado','cerrado','comisiones_definitivas','cxp','ejemplos_cxc','ejemplos_cxp','embarque_id','expediente',
        'facturas','notas_credito_cxc','notas_credito_cxp','pagos_cxc','pagos_cxp','proformas','version']::text[]
      AND v_data->>'expediente'='Borrador '||right(p_embarque::text,6);
  ELSIF v_allowed AND v_operation='delete' THEN
    SELECT item->'row' INTO STRICT v_target_before FROM jsonb_array_elements(v_before->'embarques') AS x(item)
      WHERE item->'row'->>'id' = p_embarque::text;
    SELECT item->'row' INTO STRICT v_target_after FROM jsonb_array_elements(v_after->'embarques') AS x(item)
      WHERE item->'row'->>'id' = p_embarque::text;
    SELECT coalesce(jsonb_agg(item ORDER BY item::text),'[]'::jsonb) INTO v_other_before
      FROM jsonb_array_elements(v_before->'embarques') AS x(item) WHERE item->'row'->>'id' <> p_embarque::text;
    SELECT coalesce(jsonb_agg(item ORDER BY item::text),'[]'::jsonb) INTO v_other_after
      FROM jsonb_array_elements(v_after->'embarques') AS x(item) WHERE item->'row'->>'id' <> p_embarque::text;
    SELECT coalesce(jsonb_agg(item ORDER BY item::text),'[]'::jsonb) INTO v_new_logs
      FROM jsonb_array_elements(v_after->'bitacora_actividad') AS x(item)
      WHERE NOT ((v_before->'bitacora_actividad') @> jsonb_build_array(item));
    v_effects_match := (v_target_after->>'deleted_at' IS NOT NULL)
      AND (v_target_after->>'deleted_by' = p_actor::text)
      AND ((v_target_before - ARRAY['deleted_at','deleted_by','updated_at'])
        IS NOT DISTINCT FROM (v_target_after - ARRAY['deleted_at','deleted_by','updated_at']))
      AND (v_other_before IS NOT DISTINCT FROM v_other_after)
      AND ((v_before - ARRAY['embarques','bitacora_actividad'])
        IS NOT DISTINCT FROM (v_after - ARRAY['embarques','bitacora_actividad']))
      AND ((v_after->'bitacora_actividad') @> (v_before->'bitacora_actividad'))
      AND jsonb_array_length(v_new_logs)=1
      AND (SELECT bool_and(item->'row'->>'entidad_id' = p_embarque::text
        AND item->'row'->>'organization_id' = v_org::text
        AND item->'row'->>'usuario_id' = p_actor::text) FROM jsonb_array_elements(v_new_logs) AS x(item));
  ELSE
    v_effects_match := v_before IS NOT DISTINCT FROM v_after AND v_data IS NULL;
  END IF;
  v_match := CASE WHEN v_allowed THEN v_state IS NULL ELSE
    v_state IS NOT DISTINCT FROM p_expected->>'sqlstate'
      AND starts_with(coalesce(v_message,''),p_expected->>'message_prefix')
      AND ((p_expected->>'message_equals') IS NULL OR v_message IS NOT DISTINCT FROM p_expected->>'message_equals')
      AND (CASE WHEN p_expected ? 'hint_equals' THEN v_hint_data IS NOT DISTINCT FROM p_expected->'hint_equals'
        ELSE coalesce(v_hint,'')='' END) AND coalesce(v_detail,'') = '' END
    AND v_effects_match IS TRUE;
  INSERT INTO pg_temp.h14_auth_results VALUES (p_case,jsonb_build_object(
    'case_id',p_case,'matrix_id',split_part(p_case,'-',1),'operation',v_operation,
    'expected_by_code',p_expected,'actor_id',p_actor,'target_id',p_embarque,'target_org',v_org,
    'setup_evidence',v_setup,'actor_context',v_context,
    'observed',jsonb_build_object('sqlstate',coalesce(v_state,'00000'),'message',v_message,'hint',v_hint,'detail',v_detail,
      'data',v_data,'hint_json',v_hint_data,'effects_match_expectation',v_effects_match,
      'snapshot_unchanged',v_before IS NOT DISTINCT FROM v_after,'rpc_attempted',true,'fixture_valid',true),
    'snapshots',jsonb_build_object('before',v_before,'after',v_after),
    'reproduction_complete',v_match IS TRUE,'product_policy_changed',false,
    'reachability_note',coalesce(p_expected->>'reachability_note',
      'Fictional SQL role/claims fixture; no HTTP/JWT-signature or production reachability claim.')));
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT,v_hint=PG_EXCEPTION_HINT,v_detail=PG_EXCEPTION_DETAIL;
  PERFORM pg_temp.h14_auth_as_owner();
  INSERT INTO pg_temp.h14_auth_results VALUES(p_case,jsonb_build_object('case_id',p_case,
    'expected_by_code',p_expected,'operation',v_operation,'status','HARNESS_OR_CONTEXT_ERROR',
    'observed',jsonb_build_object('sqlstate',v_state,'message',v_message,'hint',v_hint,'detail',v_detail,
      'fixture_valid',false,'rpc_attempted',v_rpc_attempted),'reproduction_complete',false));
END $$;

-- Direct authenticated INSERT must fail before a foreign parent lock or state
-- check; no new row, counters, notifications or logs may survive the exception.
CREATE FUNCTION pg_temp.h14_auth_foreign_link(p_case text,p_actor uuid,p_org uuid,p_cliente uuid,
  p_target uuid,p_deleted boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE a jsonb; b jsonb; c jsonb; st text; msg text; h text; d text; ok boolean;
  v_insert_attempted boolean:=false; v_id uuid:=gen_random_uuid(); v_expected text:='LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada';
BEGIN
  PERFORM pg_temp.h14_auth_as_owner();
  PERFORM pg_temp.h14_auth_assert(EXISTS(SELECT 1 FROM public.embarques WHERE id=p_target
    AND organization_id<>p_org AND (deleted_at IS NOT NULL)=p_deleted),p_case||': foreign parent fixture state');
  a:=pg_temp.h14_auth_snapshot();
  PERFORM pg_temp.h14_auth_as_actor(p_actor);
  c:=jsonb_build_object('sql_role',current_user,'auth_uid',auth.uid(),'resolved_org',public.current_user_org_id(),
    'global_operator',public.has_role(auth.uid(),'operador'),'super_admin',public.has_role(auth.uid(),'super_admin'),
    'visible_target_count',(SELECT count(*) FROM public.embarques WHERE id=p_target));
  PERFORM pg_temp.h14_auth_assert(current_user='authenticated' AND auth.uid()=p_actor
    AND public.current_user_org_id()=p_org AND public.has_role(auth.uid(),'operador') IS TRUE
    AND public.has_role(auth.uid(),'super_admin') IS FALSE AND (c->>'visible_target_count')::int=0,
    p_case||': real authenticated actor of A without visibility to B');
  v_insert_attempted:=true;
  BEGIN
    INSERT INTO public.proformas(id,organization_id,numero,cliente_id,cliente_nombre,expediente,embarque_id,
      estado_proforma,estado_aprobacion,estado_cliente,estado_revision,subtotal_mxn,iva_mxn,total_mxn,dias_credito)
    VALUES(v_id,p_org,'H14-AUTH-'||v_id::text,p_cliente,'H14 synthetic A','H14-FICTICIO',p_target,
      'pendiente','borrador','pendiente','pendiente',0,0,0,15);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,h=PG_EXCEPTION_HINT,d=PG_EXCEPTION_DETAIL;
  END;
  PERFORM pg_temp.h14_auth_as_owner(); b:=pg_temp.h14_auth_snapshot();
  ok:=st IS NOT DISTINCT FROM '42501' AND msg IS NOT DISTINCT FROM v_expected
    AND coalesce(h,'')='' AND coalesce(d,'')='' AND a IS NOT DISTINCT FROM b
    AND NOT EXISTS(SELECT 1 FROM public.proformas WHERE id=v_id);
  INSERT INTO pg_temp.h14_auth_results VALUES(p_case,jsonb_build_object('case_id',p_case,'matrix_id','AT',
    'expected_by_code',jsonb_build_object('sqlstate','42501','message_equals',v_expected,'no_payload',true),
    'actor_context',c,'fixture_class',CASE WHEN p_deleted THEN 'foreign-softdeleted-parent' ELSE 'foreign-live-parent' END,
    'observed',jsonb_build_object('sqlstate',coalesce(st,'00000'),'message',msg,'hint',h,'detail',d,
      'insert_attempted',v_insert_attempted,'snapshot_unchanged',a IS NOT DISTINCT FROM b,'inserted_row_absent',NOT EXISTS(SELECT 1 FROM public.proformas WHERE id=v_id)),
    'snapshots',jsonb_build_object('before',a,'after',b),'reproduction_complete',ok IS TRUE));
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,h=PG_EXCEPTION_HINT,d=PG_EXCEPTION_DETAIL;
  PERFORM pg_temp.h14_auth_as_owner();
  INSERT INTO pg_temp.h14_auth_results VALUES(p_case,jsonb_build_object('case_id',p_case,
    'expected_by_code',jsonb_build_object('sqlstate','42501','message_equals',v_expected),
    'status','HARNESS_OR_CONTEXT_ERROR','observed',jsonb_build_object('sqlstate',st,'message',msg,'hint',h,'detail',d,'insert_attempted',v_insert_attempted),
    'reproduction_complete',false));
END $$;
DO $$
DECLARE
  v_org_a uuid := gen_random_uuid(); v_org_b uuid := gen_random_uuid();
  v_cli_a uuid; v_cli_b uuid; v_admin uuid; v_operator uuid; v_reader uuid;
  v_revoked uuid; v_residual uuid; v_wide uuid; v_narrow uuid; v_super uuid;
  v_emb uuid; v_count integer; v_operator_b uuid; v_emb_deleted uuid; v_proforma uuid;
BEGIN
  INSERT INTO public.organizations(id,nombre) VALUES
    (v_org_a,'H14 AUTH synthetic A ' || v_org_a),(v_org_b,'H14 AUTH synthetic B ' || v_org_b);
  INSERT INTO public.clientes(organization_id,nombre,email)
    VALUES(v_org_a,'H14 AUTH synthetic client A','h14-auth-client-a@example.invalid') RETURNING id INTO v_cli_a;
  INSERT INTO public.clientes(organization_id,nombre,email)
    VALUES(v_org_b,'H14 AUTH synthetic client B','h14-auth-client-b@example.invalid') RETURNING id INTO v_cli_b;
  v_admin := pg_temp.h14_auth_actor(v_org_a,'admin_org','revoker');
  v_operator := pg_temp.h14_auth_actor(v_org_a,'coordinador_logistico','operator');
  v_reader := pg_temp.h14_auth_actor(v_org_a,'customer_service','reader');

  v_emb := pg_temp.h14_auth_embarque(v_org_b,v_cli_b);
  PERFORM pg_temp.h14_auth_case('A01-cross-tenant',v_operator,v_emb,jsonb_build_object(
    'allowed',false,'sqlstate','42501','message_prefix','LC_FORBIDDEN:',
    'resolved_org',v_org_a,'guard_truth',false,'visible_target_count',0,
    'global_operator',true,'global_super_admin',false,'effective_operator_gate',true,'role_resolver_result','coordinador_logistico',
    'fixture_class','normal-membership-synthetic-records','policy_pending',false));

  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('A02-reader',v_reader,v_emb,jsonb_build_object(
    'allowed',false,'sqlstate','42501','message_prefix','LC_FORBIDDEN:',
    'resolved_org',v_org_a,'guard_truth',false,'visible_target_count',1,
    'global_operator',false,'global_super_admin',false,'effective_operator_gate',false,'role_resolver_result','customer_service',
    'fixture_class','normal-membership-synthetic-records','policy_pending',false));
  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('A02-operator-control',v_operator,v_emb,jsonb_build_object(
    'allowed',true,'resolved_org',v_org_a,'guard_truth',true,'visible_target_count',1,
    'global_operator',true,'global_super_admin',false,'effective_operator_gate',true,'role_resolver_result','coordinador_logistico',
    'fixture_class','normal-membership-synthetic-records','policy_pending',false));

  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('A03-anon-acl',NULL,v_emb,jsonb_build_object(
    'allowed',false,'db_role','anon','sqlstate','42501',
    'message_prefix','permission denied for function eliminar_embarque_completo',
    'fixture_class','anonymous-sql-role','policy_pending',false));
  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('A03-authenticated-without-sub',NULL,v_emb,jsonb_build_object(
    'allowed',false,'sqlstate','42501','message_prefix','LC_FORBIDDEN:',
    'resolved_org',NULL,'guard_truth',false,'visible_target_count',0,
    'global_operator',false,'global_super_admin',false,'effective_operator_gate',false,'role_resolver_result',NULL,
    'fixture_class','authenticated-sql-role-without-sub','policy_pending',false));

  v_revoked := pg_temp.h14_auth_actor(v_org_a,'coordinador_logistico','normal-revocation');
  PERFORM pg_temp.h14_auth_as_actor(v_admin);
  DELETE FROM public.organization_members WHERE organization_id = v_org_a AND user_id = v_revoked;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM pg_temp.h14_auth_as_owner();
  PERFORM pg_temp.h14_auth_assert(v_count = 1,'A04: authenticated admin must delete exactly one membership');
  PERFORM pg_temp.h14_auth_assert(NOT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=v_revoked)
    AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_revoked),
    'A04: last-member trigger must remove the matching modern mirror');
  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('A04-normal-last-membership-revoked',v_revoked,v_emb,jsonb_build_object(
    'allowed',false,'sqlstate','42501','message_prefix','LC_FORBIDDEN:',
    'resolved_org',NULL,'guard_truth',false,'visible_target_count',0,
    'global_operator',false,'global_super_admin',false,'effective_operator_gate',false,'role_resolver_result',NULL,
    'fixture_class','normal-trigger-revocation-by-authenticated-admin','policy_pending',false));

  v_residual := pg_temp.h14_auth_actor(v_org_a,'coordinador_logistico','owner-artificial-residual');
  PERFORM pg_temp.h14_auth_as_actor(v_admin);
  DELETE FROM public.organization_members WHERE organization_id=v_org_a AND user_id=v_residual;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM pg_temp.h14_auth_as_owner();
  PERFORM pg_temp.h14_auth_assert(v_count = 1
    AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_residual),
    'A05: real revocation must clear mirror before the separate artificial step');
  -- Deliberate owner-only historical drift, AFTER the trigger has done its work.
  INSERT INTO public.user_roles(user_id,role) VALUES(v_residual,'coordinador_logistico');
  PERFORM pg_temp.h14_auth_assert(NOT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=v_residual),
    'A05 artificial residual must not have a membership');
  v_emb := pg_temp.h14_auth_embarque(v_org_b,v_cli_b);
  PERFORM pg_temp.h14_auth_case('A05-owner-artificial-residual',v_residual,v_emb,jsonb_build_object(
    'allowed',false,'sqlstate','42501','message_prefix','LC_FORBIDDEN:',
    'resolved_org',NULL,'guard_truth',NULL,'visible_target_count',0,
    'global_operator',true,'global_super_admin',false,'effective_operator_gate',true,'role_resolver_result','coordinador_logistico',
    'fixture_class','owner-artificial-historical-role-residual','policy_pending',false,
    'reachability_note','Owner reinserts a global role after the real trigger removed it. Asserts corrected rejection with nullable prior guard; artificial setup does not prove normal reachability.'));

  v_wide := pg_temp.h14_auth_actor(v_org_a,'customer_service','owner-global-wide');
  UPDATE public.user_roles SET role='coordinador_logistico' WHERE user_id=v_wide;
  PERFORM pg_temp.h14_auth_assert(EXISTS(SELECT 1 FROM public.organization_members
    WHERE user_id=v_wide AND role='customer_service'),'A06-wide: member role must retain no shipment-delete capability');
  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('A06-owner-global-wider-than-membership',v_wide,v_emb,jsonb_build_object(
    'allowed',true,'resolved_org',v_org_a,'guard_truth',true,'visible_target_count',1,
    'global_operator',true,'global_super_admin',false,'effective_operator_gate',false,'role_resolver_result','customer_service',
    'fixture_class','owner-artificial-global-membership-divergence','policy_pending',true));
  v_narrow := pg_temp.h14_auth_actor(v_org_a,'coordinador_logistico','owner-global-narrow');
  UPDATE public.user_roles SET role='customer_service' WHERE user_id=v_narrow;
  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('A06-owner-global-narrower-than-membership',v_narrow,v_emb,jsonb_build_object(
    'allowed',false,'sqlstate','42501','message_prefix','LC_FORBIDDEN:',
    'resolved_org',v_org_a,'guard_truth',false,'visible_target_count',1,
    'global_operator',false,'global_super_admin',false,'effective_operator_gate',false,'role_resolver_result','coordinador_logistico',
    'fixture_class','owner-artificial-global-membership-divergence','policy_pending',true));

  v_super := pg_temp.h14_auth_actor(NULL,'super_admin','global-super-admin');
  INSERT INTO public.super_admin_org_activa(user_id,organization_id) VALUES(v_super,v_org_a);
  v_emb := pg_temp.h14_auth_embarque(v_org_b,v_cli_b);
  PERFORM pg_temp.h14_auth_case('A07-global-super-admin-other-tenant',v_super,v_emb,jsonb_build_object(
    'allowed',true,'resolved_org',v_org_a,'guard_truth',true,'visible_target_count',0,
    'global_operator',true,'global_super_admin',true,'effective_operator_gate',true,'role_resolver_result','super_admin',
    'fixture_class','global-platform-role-with-explicit-active-tenant','policy_pending',true,
    'reachability_note','Characterizes existing global RPC authorization versus active-tenant RLS. Product/security policy D06 remains pending; not a new access grant.'));

  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('R01-in-org-operator',v_operator,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',true,
    'missing',false,
    'resolved_org',v_org_a,
    'guard_truth',true,
    'visible_target_count',1,
    'global_operator',true,
    'global_super_admin',false,
    'effective_operator_gate',true,
    'role_resolver_result','coordinador_logistico'));

  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('R02-in-org-reader',v_reader,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',false,
    'missing',false,
    'resolved_org',v_org_a,
    'guard_truth',false,
    'visible_target_count',1,
    'global_operator',false,
    'global_super_admin',false,
    'effective_operator_gate',false,
    'role_resolver_result','customer_service',
    'sqlstate','42501',
    'message_prefix','LC_FORBIDDEN:',
    'message_equals','LC_FORBIDDEN: sin acceso al embarque en la organización activa'));

  v_emb := pg_temp.h14_auth_embarque(v_org_b,v_cli_b);
  PERFORM pg_temp.h14_auth_case('R03-cross-tenant',v_operator,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',false,
    'missing',false,
    'resolved_org',v_org_a,
    'guard_truth',false,
    'visible_target_count',0,
    'global_operator',true,
    'global_super_admin',false,
    'effective_operator_gate',true,
    'role_resolver_result','coordinador_logistico',
    'sqlstate','42501',
    'message_prefix','LC_FORBIDDEN:',
    'message_equals','LC_FORBIDDEN: sin acceso al embarque en la organización activa'));

  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('R05-authenticated-without-sub',NULL,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',false,
    'missing',false,
    'resolved_org',NULL,
    'guard_truth',false,
    'visible_target_count',0,
    'global_operator',false,
    'global_super_admin',false,
    'effective_operator_gate',false,
    'role_resolver_result',NULL,
    'sqlstate','42501',
    'message_prefix','LC_FORBIDDEN:',
    'message_equals','LC_FORBIDDEN: sin acceso al embarque en la organización activa'));

  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('R06-normal-revoked',v_revoked,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',false,
    'missing',false,
    'resolved_org',NULL,
    'guard_truth',false,
    'visible_target_count',0,
    'global_operator',false,
    'global_super_admin',false,
    'effective_operator_gate',false,
    'role_resolver_result',NULL,
    'sqlstate','42501',
    'message_prefix','LC_FORBIDDEN:',
    'message_equals','LC_FORBIDDEN: sin acceso al embarque en la organización activa'));

  v_emb := pg_temp.h14_auth_embarque(v_org_b,v_cli_b);
  PERFORM pg_temp.h14_auth_case('R07-owner-artificial-residual',v_residual,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',false,
    'missing',false,
    'resolved_org',NULL,
    'guard_truth',NULL,
    'visible_target_count',0,
    'global_operator',true,
    'global_super_admin',false,
    'effective_operator_gate',true,
    'role_resolver_result','coordinador_logistico',
    'sqlstate','42501',
    'message_prefix','LC_FORBIDDEN:',
    'message_equals','LC_FORBIDDEN: sin acceso al embarque en la organización activa'));

  v_emb := pg_temp.h14_auth_embarque(v_org_b,v_cli_b);
  PERFORM pg_temp.h14_auth_case('R08-super-admin-other-tenant',v_super,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',false,
    'missing',false,
    'resolved_org',v_org_a,
    'guard_truth',true,
    'visible_target_count',0,
    'global_operator',true,
    'global_super_admin',true,
    'effective_operator_gate',true,
    'role_resolver_result','super_admin',
    'sqlstate','42501',
    'message_prefix','LC_FORBIDDEN:',
    'message_equals','LC_FORBIDDEN: sin acceso al embarque en la organización activa'));

  v_emb := pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('R09-super-admin-active-tenant',v_super,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',true,
    'missing',false,
    'resolved_org',v_org_a,
    'guard_truth',true,
    'visible_target_count',1,
    'global_operator',true,
    'global_super_admin',true,
    'effective_operator_gate',true,
    'role_resolver_result','super_admin'));

  v_emb := gen_random_uuid();
  PERFORM pg_temp.h14_auth_case('R10-missing-target',v_operator,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',false,
    'missing',true,
    'resolved_org',v_org_a,
    'guard_truth',NULL,
    'visible_target_count',0,
    'global_operator',true,
    'global_super_admin',false,
    'effective_operator_gate',true,
    'role_resolver_result','coordinador_logistico',
    'sqlstate','42501',
    'message_prefix','LC_FORBIDDEN:',
    'message_equals','LC_FORBIDDEN: sin acceso al embarque en la organización activa'));

  v_emb := gen_random_uuid();
  PERFORM pg_temp.h14_auth_case('R11-reader-missing-target',v_reader,v_emb,jsonb_build_object(
    'operation','diagnostic',
    'allowed',false,
    'missing',true,
    'resolved_org',v_org_a,
    'guard_truth',false,
    'visible_target_count',0,
    'global_operator',false,
    'global_super_admin',false,
    'effective_operator_gate',false,
    'role_resolver_result','customer_service',
    'sqlstate','42501',
    'message_prefix','LC_FORBIDDEN:',
    'message_equals','LC_FORBIDDEN: sin acceso al embarque en la organización activa'));

  v_emb:=pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('R04-anon-acl',NULL,v_emb,jsonb_build_object('operation','diagnostic',
    'allowed',false,'db_role','anon','sqlstate','42501',
    'message_prefix','permission denied for function diagnosticar_baja_embarque',
    'message_equals','permission denied for function diagnosticar_baja_embarque'));
  v_emb:=pg_temp.h14_auth_embarque(v_org_a,v_cli_a);
  PERFORM pg_temp.h14_auth_case('A09-private-helper-denied',v_operator,v_emb,jsonb_build_object('operation','private_helper',
    'allowed',false,'sqlstate','42501','message_prefix','permission denied for function _h14_dependencias_baja_embarque',
    'message_equals','permission denied for function _h14_dependencias_baja_embarque',
    'resolved_org',v_org_a,'guard_truth',true,'visible_target_count',1,
    'global_operator',true,'global_super_admin',false,'effective_operator_gate',true,'role_resolver_result','coordinador_logistico'));

  v_emb:=pg_temp.h14_auth_embarque(v_org_b,v_cli_b);
  PERFORM pg_temp.h14_auth_foreign_link('AT01-foreign-live-parent',v_operator,v_org_a,v_cli_a,v_emb,false);
  v_operator_b:=pg_temp.h14_auth_actor(v_org_b,'coordinador_logistico','foreign-tombstone-operator');
  v_emb_deleted:=pg_temp.h14_auth_embarque(v_org_b,v_cli_b);
  -- Produce the foreign tombstone by the existing authorized mutator with the
  -- real B actor. It is setup for the following negative writer test only.
  PERFORM pg_temp.h14_auth_as_actor(v_operator_b);
  PERFORM pg_temp.h14_auth_assert(current_user='authenticated' AND auth.uid()=v_operator_b
    AND public.current_user_org_id()=v_org_b AND public.has_role(auth.uid(),'operador') IS TRUE
    AND public.has_role(auth.uid(),'super_admin') IS FALSE,'AT02: authorized B tombstone producer');
  PERFORM public.eliminar_embarque_completo(v_emb_deleted);
  PERFORM pg_temp.h14_auth_as_owner();
  PERFORM pg_temp.h14_auth_assert(EXISTS(SELECT 1 FROM public.embarques WHERE id=v_emb_deleted
    AND deleted_at IS NOT NULL AND deleted_by=v_operator_b),'AT02: tombstone must come from real RPC');
  PERFORM pg_temp.h14_auth_foreign_link('AT02-foreign-deleted-parent',v_operator,v_org_a,v_cli_a,v_emb_deleted,true);

  -- Existing Super Admin global mutation authority may see its established
  -- block reasons, but the mutator must not add the new preview folio arrays.
  v_emb:=pg_temp.h14_auth_embarque(v_org_b,v_cli_b); v_proforma:=gen_random_uuid();
  PERFORM pg_temp.h14_auth_as_actor(v_operator_b);
  PERFORM pg_temp.h14_auth_assert(current_user='authenticated' AND auth.uid()=v_operator_b
    AND public.current_user_org_id()=v_org_b AND public.has_role(auth.uid(),'operador') IS TRUE
    AND public.has_role(auth.uid(),'super_admin') IS FALSE,'A07 financial: valid B writer');
  INSERT INTO public.proformas(id,organization_id,numero,cliente_id,cliente_nombre,expediente,embarque_id,
    estado_proforma,estado_aprobacion,estado_cliente,estado_revision,subtotal_mxn,iva_mxn,total_mxn,dias_credito)
  VALUES(v_proforma,v_org_b,'H14-AUTH-'||v_proforma::text,v_cli_b,'H14 synthetic B','H14-FICTICIO',v_emb,
    'pendiente','borrador','pendiente','pendiente',0,0,0,15);
  PERFORM pg_temp.h14_auth_as_owner();
  PERFORM pg_temp.h14_auth_case('A07-global-super-admin-financial-hint',v_super,v_emb,jsonb_build_object(
    'allowed',false,'sqlstate','23514','message_prefix','LC_EMBARQUE_BLOQUEADO:',
    'resolved_org',v_org_a,'guard_truth',true,'visible_target_count',0,
    'global_operator',true,'global_super_admin',true,'effective_operator_gate',true,'role_resolver_result','super_admin',
    'hint_equals',jsonb_build_object('version',1,'embarque_id',v_emb,'expediente','Borrador '||right(v_emb::text,6),
      'facturas',0,'cxp',0,'pagos_cxc',0,'pagos_cxp',0,'notas_credito_cxc',0,'notas_credito_cxp',0,
      'comisiones_definitivas',0,'proformas',1,'cerrado',false,'bloqueado',true,
      'ejemplos_cxc','[]'::jsonb,'ejemplos_cxp','[]'::jsonb)));
END $$;

-- Owner-only ACL expectations are explicit, never derived by selecting only the
-- currently closed functions. Public role and PostgREST roles cannot invoke them.
DO $$
DECLARE f text; r text; v_oid regprocedure; acl jsonb:='[]'::jsonb; ok boolean:=true; granted boolean;
  expected_oids bigint[]:='{}'; actual_oids bigint[]; inventory_matches boolean;
BEGIN
  SELECT count(*)=2 AND bool_and(NOT rolsuper AND NOT rolbypassrls) INTO ok
    FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated');
  FOREACH f IN ARRAY ARRAY[
    'public._h14_assert_actor_baja_embarque(uuid)',
    'public._h14_proformas_baja_embarque(uuid,uuid)',
    'public._h14_facturas_baja_embarque(uuid,uuid,uuid[])',
    'public._h14_cxp_baja_embarque(uuid,uuid)',
    'public._h14_embarque_visible_actor_baja(uuid,uuid)',
    'public._h14_documento_bloqueante_baja(uuid,text,uuid)',
    'public._h14_fila_bloqueante_baja(uuid,text,jsonb)',
    'public._h14_dependencias_baja_embarque(uuid,uuid,boolean)',
    'public._h14_mutex_baja_embarque(uuid,boolean)',
    'public._h14_validar_actor_org_baja(uuid)',
    'public._h14_grafo_fila_baja(uuid,text,jsonb)',
    'public._h14_validar_fila_org_baja(uuid,text,jsonb)',
    'public._h14_guard_escritor_baja()',
    'public._h14_guard_baja_embarque()'
  ] LOOP
    v_oid:=to_regprocedure(f);
    expected_oids:=array_append(expected_oids,v_oid::oid::bigint);
    ok:=ok AND v_oid IS NOT NULL;
    FOREACH r IN ARRAY ARRAY['public','anon','authenticated','service_role'] LOOP
      IF v_oid IS NULL THEN
        granted:=NULL;
      ELSIF r='public' THEN
        -- PUBLIC is ACL grantee 0, not a login role. Include the default ACL
        -- when proacl is NULL, which would otherwise hide default EXECUTE.
        SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p
          CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
          WHERE p.oid=v_oid AND a.grantee=0 AND a.privilege_type='EXECUTE') INTO granted;
      ELSE
        granted:=pg_catalog.has_function_privilege(r,v_oid,'EXECUTE');
      END IF;
      ok:=ok AND granted IS FALSE;
      acl:=acl||jsonb_build_array(jsonb_build_object('signature',f,'role',r,'exists',v_oid IS NOT NULL,'can_execute',granted));
    END LOOP;
  END LOOP;
  -- Compare OIDs from the explicit signatures with the entire public prefix.
  -- An extra overload/helper must fail even if it has a restrictive ACL.
  SELECT coalesce(array_agg(value ORDER BY value),'{}'::bigint[]) INTO expected_oids
    FROM unnest(expected_oids) AS u(value);
  SELECT coalesce(array_agg(p.oid::bigint ORDER BY p.oid::bigint),'{}'::bigint[]) INTO actual_oids
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND left(p.proname,5)='_h14_';
  inventory_matches:=cardinality(expected_oids)=14 AND expected_oids IS NOT DISTINCT FROM actual_oids;
  ok:=ok AND inventory_matches;
  INSERT INTO pg_temp.h14_auth_results VALUES('A08-private-helper-acl',jsonb_build_object(
    'case_id','A08-private-helper-acl','matrix_id','A08',
    'expected_by_code',jsonb_build_object('owner_only',true,'exact_private_prefix_count',14,
      'roles_denied',ARRAY['public','anon','authenticated','service_role']),
    'observed',jsonb_build_object('privileges',acl,'expected_prefix_oids',expected_oids,
      'actual_prefix_oids',actual_oids,'exact_prefix_inventory',inventory_matches),'reproduction_complete',ok IS TRUE));
END $$;

-- Print evidence before the final assertion: failed fixtures and unexpected SQL
-- errors cannot disappear behind a passing process exit or a skipped case.
SELECT 'H14_RESULT '||payload::text FROM pg_temp.h14_auth_results ORDER BY case_id;
SELECT pg_temp.h14_auth_assert((SELECT array_agg(case_id ORDER BY case_id) FROM pg_temp.h14_auth_results)
  IS NOT DISTINCT FROM ARRAY[
    'A01-cross-tenant',
    'A02-operator-control',
    'A02-reader',
    'A03-anon-acl',
    'A03-authenticated-without-sub',
    'A04-normal-last-membership-revoked',
    'A05-owner-artificial-residual',
    'A06-owner-global-narrower-than-membership',
    'A06-owner-global-wider-than-membership',
    'A07-global-super-admin-financial-hint',
    'A07-global-super-admin-other-tenant',
    'A08-private-helper-acl',
    'A09-private-helper-denied',
    'AT01-foreign-live-parent',
    'AT02-foreign-deleted-parent',
    'R01-in-org-operator',
    'R02-in-org-reader',
    'R03-cross-tenant',
    'R04-anon-acl',
    'R05-authenticated-without-sub',
    'R06-normal-revoked',
    'R07-owner-artificial-residual',
    'R08-super-admin-other-tenant',
    'R09-super-admin-active-tenant',
    'R10-missing-target',
    'R11-reader-missing-target']::text[],
  'exactly 26 declared authorization/reader/trigger cases must be emitted, no omissions or duplicates');
SELECT pg_temp.h14_auth_assert((SELECT bool_and((payload->>'reproduction_complete')::boolean IS TRUE)
  FROM pg_temp.h14_auth_results),'H14 authorization contract/context failed; inspect emitted snapshots');
ROLLBACK;
