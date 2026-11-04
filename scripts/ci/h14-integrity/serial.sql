-- H14 correction serial regression, strict owned clone only.
-- Expected counts derive from fictional fixture facts, not from the production collector.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='5s';
\ir fixture_helpers.sql

CREATE FUNCTION pg_temp.h14_fin_expected(p_case text,p_variant text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER AS $$
DECLARE h jsonb:='{}'; allowed boolean:=false; fs text; fm text; ft text; fc text;
BEGIN
  -- Fixture facts, independent of the production graph query. Existing state
  -- exceptions remain unchanged; newly active indirect paths must block.
  CASE p_case
    WHEN 'B01','B02','E01','E05','H04' THEN allowed:=true;
    WHEN 'X01','X02','X03','X08','X10','X11' THEN h:='{"cxp":1}';
    WHEN 'X09' THEN h:='{"pagos_cxc":1}';
    WHEN 'X12' THEN h:='{"facturas":21,"pagos_cxc":1}';
    WHEN 'X13' THEN h:='{"facturas":21,"notas_credito_cxc":1}';
    WHEN 'X04','X05' THEN h:='{"proformas":1}';
    WHEN 'L01','L04','L05','X06','X07' THEN h:='{"facturas":1}';
    WHEN 'L02' THEN h:='{"facturas":1,"pagos_cxc":1,"notas_credito_cxc":1}';
    WHEN 'L03' THEN
      IF p_variant='inactive' THEN allowed:=true; ELSE h:='{"facturas":1}'; END IF;
    WHEN 'E02' THEN h:=CASE p_variant WHEN 'pagada' THEN '{"facturas":1,"pagos_cxc":1}'::jsonb ELSE '{"facturas":1}'::jsonb END;
    WHEN 'E03' THEN h:=jsonb_build_object('cxp',1,'pagos_cxp',CASE WHEN p_variant='pagada' THEN 1 ELSE 0 END);
    WHEN 'E04' THEN h:='{"proformas":1}';
    WHEN 'E06' THEN
      fs:='23502'; ft:=CASE p_variant WHEN 'factura_null' THEN 'facturas' WHEN 'proforma_null' THEN 'proformas' ELSE 'proveedor_facturas' END;
      fc:=CASE WHEN p_variant='proforma_null' THEN 'estado_proforma' ELSE 'estado' END;
    WHEN 'E07' THEN
      IF p_variant LIKE 'cxc_%' THEN
        h:=jsonb_build_object('notas_credito_cxc',CASE WHEN p_variant='cxc_live' THEN 1 ELSE 0 END);
        allowed:=p_variant='cxc_deleted';
      ELSE h:=jsonb_build_object('cxp',1,'notas_credito_cxp',CASE WHEN p_variant='cxp_live' THEN 1 ELSE 0 END);
      END IF;
    WHEN 'E08' THEN
      fs:='P0001'; fm:=CASE p_variant WHEN 'payment' THEN 'LC_FACTURA_DELETE_CON_PAGOS' ELSE 'LC_FACTURA_DELETE_CON_NC' END;
    WHEN 'P01' THEN h:=jsonb_build_object('facturas',21,CASE p_variant WHEN 'payment' THEN 'pagos_cxc' ELSE 'notas_credito_cxc' END,1);
    WHEN 'P02' THEN h:='{"facturas":6}';
    WHEN 'H01' THEN h:='{"cerrado":true}';
    WHEN 'H02' THEN h:=jsonb_build_object('facturas',1,'pagos_cxc',1,'comisiones_definitivas',CASE WHEN p_variant='no_definitiva' THEN 0 ELSE 1 END);
    ELSE RAISE EXCEPTION 'H14 unknown regression case %',p_case;
  END CASE;
  h:='{"facturas":0,"cxp":0,"pagos_cxc":0,"pagos_cxp":0,"notas_credito_cxc":0,"notas_credito_cxp":0,"comisiones_definitivas":0,"proformas":0,"cerrado":false}'::jsonb||h;
  RETURN jsonb_build_object('sqlstate',CASE WHEN fs IS NOT NULL THEN NULL WHEN allowed THEN '00000' ELSE '23514' END,
    'rpc_attempt_expected',fs IS NULL,'message_prefix',CASE WHEN allowed THEN NULL ELSE 'LC_EMBARQUE_BLOQUEADO' END,
    'counts',h,'fixture_error_sqlstate',fs,'fixture_error_prefix',fm,'fixture_error_table',ft,'fixture_error_column',fc,
    'expectation_source','authorized_H14_preserve_active_links','state_policies_changed',false);
END $$;

CREATE FUNCTION pg_temp.h14_assert_diagnostic(d jsonb,expected jsonb,target uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE key text; expected_blocked boolean;
BEGIN
  PERFORM pg_temp.h14_fin_assert(jsonb_typeof(d)='object','diagnostic must be an object');
  PERFORM pg_temp.h14_fin_assert(d->'version'='1'::jsonb AND (d->>'embarque_id')::uuid=target,'diagnostic version/target');
  FOREACH key IN ARRAY ARRAY['facturas','cxp','pagos_cxc','pagos_cxp','notas_credito_cxc','notas_credito_cxp','comisiones_definitivas','proformas','cerrado'] LOOP
    PERFORM pg_temp.h14_fin_assert(d->key IS NOT DISTINCT FROM expected->key,'diagnostic independent count mismatch: '||key);
  END LOOP;
  expected_blocked:=expected->>'cerrado'='true' OR EXISTS(SELECT 1 FROM jsonb_each(expected) j(k,v) WHERE k<>'cerrado' AND (v::text)::int>0);
  PERFORM pg_temp.h14_fin_assert((d->>'bloqueado')::boolean IS NOT DISTINCT FROM expected_blocked,'diagnostic blocked flag');
  PERFORM pg_temp.h14_fin_assert(jsonb_typeof(d->'ejemplos_cxc')='array' AND jsonb_typeof(d->'ejemplos_cxp')='array','separate example arrays');
  PERFORM pg_temp.h14_fin_assert(jsonb_array_length(d->'ejemplos_cxc')=least(20,(expected->>'facturas')::int)
    AND jsonb_array_length(d->'ejemplos_cxp')=least(20,(expected->>'cxp')::int),'example limit independent from full counts');
  PERFORM pg_temp.h14_fin_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements((d->'ejemplos_cxc')||(d->'ejemplos_cxp')) x
    WHERE jsonb_typeof(x)<>'object' OR NOT(x ?& ARRAY['id','folio','estado']) OR jsonb_typeof(x->'id')<>'string'),'example shape');
  PERFORM pg_temp.h14_fin_assert((SELECT count(*)=count(DISTINCT x->>'id') FROM jsonb_array_elements(d->'ejemplos_cxc') x)
    AND (SELECT count(*)=count(DISTINCT x->>'id') FROM jsonb_array_elements(d->'ejemplos_cxp') x),'examples deduplicate invoice IDs');
END $$;


DO $$ BEGIN
  PERFORM pg_temp.h14_fin_assert(current_database() ~ '^h14_finance_[0-9a-f]{32}$',
    'finance suite only accepts its disposable finance clone');
  PERFORM pg_temp.h14_fin_assert(inet_server_addr() IS NULL, 'TCP must remain disabled');
  PERFORM pg_temp.h14_fin_assert(current_setting('unix_socket_directories') IN('/lab','/var/run/postgresql'),'expected /lab socket only');
  PERFORM pg_temp.h14_fin_assert(current_user='postgres' AND session_user='postgres','strict owner setup connection required');
  PERFORM pg_temp.h14_fin_assert((SELECT prosecdef IS FALSE FROM pg_proc WHERE oid='pg_temp.h14_fin_delete(uuid,uuid,uuid)'::regprocedure),
    'test wrapper must remain SECURITY INVOKER');
END $$;

CREATE FUNCTION pg_temp.h14_fin_run(p_case text,p_variant text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  key text:=p_case||'.'||p_variant; exp jsonb:=pg_temp.h14_fin_expected(p_case,p_variant);
  f jsonb; oa uuid:=pg_temp.h14_fin_uuid(p_case||'.'||p_variant,'org-a');
  ob uuid:=pg_temp.h14_fin_uuid(p_case||'.'||p_variant,'org-b');
  fixture_a jsonb; fixture_b jsonb; a0 jsonb; b0 jsonb; a1 jsonb; b1 jsonb;
  obs jsonb; caller jsonb; hint_json jsonb; ok boolean; unchanged boolean; financial_same boolean;
  st text; msg text; hint text; detail text; et text; ec text; en text;
  phase text:='fixture'; producer jsonb; prod0 jsonb; prod1 jsonb;
  created jsonb; made uuid; producer_ok boolean; target uuid; changed jsonb; other_a_same boolean; t text;
  ids0 jsonb; ids1 jsonb; diagnostic jsonb; diagnostic_caller jsonb; diagnostic_unchanged boolean;
BEGIN
  PERFORM pg_temp.h14_fin_owner();
  fixture_a:=pg_temp.h14_fin_snapshot(oa); fixture_b:=pg_temp.h14_fin_snapshot(ob);
  BEGIN
    f:=pg_temp.h14_fin_fixture(p_case,p_variant);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,hint=PG_EXCEPTION_HINT,detail=PG_EXCEPTION_DETAIL,
      et=TABLE_NAME,ec=COLUMN_NAME,en=CONSTRAINT_NAME;
    PERFORM pg_temp.h14_fin_owner();
    a1:=pg_temp.h14_fin_snapshot(oa); b1:=pg_temp.h14_fin_snapshot(ob);
    ok:=(exp->>'fixture_error_sqlstate') IS NOT NULL AND st IS NOT DISTINCT FROM exp->>'fixture_error_sqlstate'
      AND ((exp->>'fixture_error_prefix') IS NULL OR left(msg,length(exp->>'fixture_error_prefix'))=exp->>'fixture_error_prefix')
      AND ((exp->>'fixture_error_table') IS NULL OR et IS NOT DISTINCT FROM exp->>'fixture_error_table')
      AND ((exp->>'fixture_error_column') IS NULL OR ec IS NOT DISTINCT FROM exp->>'fixture_error_column')
      AND a1 IS NOT DISTINCT FROM fixture_a AND b1 IS NOT DISTINCT FROM fixture_b;
    RETURN jsonb_build_object('case_id',key,'matrix_id',p_case,'tier','S','expected_by_code',exp,
      'fixture_class','fixture_rejected_by_real_constraint','fixture_valid',false,'policy_pending',false,
      'status',CASE WHEN ok THEN 'EXPECTED_INVALID_FIXTURE_RECORDED' ELSE 'UNEXPECTED_FIXTURE_ERROR' END,
      'reproduction_complete',ok,'observed',jsonb_build_object('phase','fixture','sqlstate',st,'message',msg,'hint',hint,'detail',detail,
        'table_name',et,'column_name',ec,'constraint_name',en,
        'rpc_attempted',false,'before_a',fixture_a,'after_a',a1,'before_b',fixture_b,'after_b',b1,
        'zero_fixture_partial_effects',a1 IS NOT DISTINCT FROM fixture_a AND b1 IS NOT DISTINCT FROM fixture_b));
  END;

  IF p_case='L05' THEN
    phase:='producer'; prod0:=pg_temp.h14_fin_snapshot(oa);
    caller:=pg_temp.h14_fin_actor((f->>'actor_a')::uuid);
    PERFORM pg_temp.h14_fin_assert_actor((f->>'actor_a')::uuid,oa);
    st:='00000'; msg:=NULL; hint:=NULL; detail:=NULL;
    BEGIN
      SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO created
      FROM public.convertir_proformas_a_factura(
        ARRAY(SELECT jsonb_array_elements_text(f->'proforma_ids'))::uuid[],(f->>'series_id')::uuid,
        'PPD','99','G03',15,'H14 conversion ficticia local; no emitir ni enviar',(f->>'producer_request_id')::uuid) r;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,hint=PG_EXCEPTION_HINT,detail=PG_EXCEPTION_DETAIL,
        et=TABLE_NAME,ec=COLUMN_NAME,en=CONSTRAINT_NAME;
    END;
    PERFORM pg_temp.h14_fin_owner(); prod1:=pg_temp.h14_fin_snapshot(oa);
    producer:=jsonb_build_object('caller',caller,'sqlstate',st,'message',msg,'hint',hint,'detail',detail,
      'table_name',et,'column_name',ec,'constraint_name',en,
      'returned_rows',created,'before_a',prod0,'after_a',prod1);
    IF st<>'00000' THEN
      RETURN jsonb_build_object('case_id',key,'matrix_id',p_case,'tier','S','expected_by_code',exp||'{"producer_sqlstate":"00000"}',
        'fixture_class','producer_failed_without_external_services','fixture_valid',true,'policy_pending',false,
        'status','PRODUCER_ERROR_DELETE_NOT_ATTEMPTED','reproduction_complete',false,
        'observed',jsonb_build_object('phase','producer','producer',producer,'delete_attempted',false));
    END IF;
    SELECT (x->>'id')::uuid INTO made FROM jsonb_array_elements(created) x LIMIT 1;
    producer_ok:=jsonb_array_length(created)=1
      AND EXISTS(SELECT 1 FROM public.facturas WHERE id=made AND embarque_id=(f->>'embarque_a')::uuid
        AND estado='Borrador' AND uuid_fiscal IS NULL AND facturapi_id IS NULL)
      AND (SELECT array_agg(embarque_id ORDER BY embarque_id)=ARRAY(SELECT x FROM unnest(ARRAY[(f->>'embarque_a')::uuid,(f->>'second_embarque_id')::uuid]) u(x) ORDER BY x)
        AND bool_and(activa) FROM public.factura_embarques WHERE factura_id=made)
      AND (SELECT count(*)=2 FROM public.proformas WHERE id=ANY(ARRAY(SELECT jsonb_array_elements_text(f->'proforma_ids'))::uuid[])
        AND estado_proforma='facturada' AND factura_id=made)
      AND (SELECT count(*)=2 AND count(DISTINCT proforma_id_origen)=2 FROM public.conceptos_factura WHERE factura_id=made AND deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM public.conceptos_factura cf WHERE factura_id=made AND (
        cf.proforma_id_origen IS NULL OR NOT(cf.proforma_id_origen=ANY(ARRAY(SELECT jsonb_array_elements_text(f->'proforma_ids'))::uuid[]))
        OR cf.embarque_id IS DISTINCT FROM CASE WHEN cf.proforma_id_origen=(f->'proforma_ids'->>0)::uuid
          THEN (f->>'embarque_a')::uuid ELSE (f->>'second_embarque_id')::uuid END));
    producer:=producer||jsonb_build_object('header_bridge_sources_verified',producer_ok,
      'claims_limited_to_local_conversion',true);
    IF producer_ok IS DISTINCT FROM TRUE THEN
      RETURN jsonb_build_object('case_id',key,'matrix_id',p_case,'tier','S','expected_by_code',exp,
        'fixture_class','producer_contract_different','fixture_valid',true,'policy_pending',false,
        'status','PRODUCER_CONTRACT_MISMATCH','reproduction_complete',false,
        'observed',jsonb_build_object('phase','producer','producer',producer,'delete_attempted',false));
    END IF;
    f:=f||jsonb_build_object('invoice_ids',jsonb_build_array(made),'fixture_class','real_local_conversion_producer_no_issue_or_send');
  END IF;

  phase:='delete'; target:=(f->>'target_embarque_id')::uuid;
  a0:=pg_temp.h14_fin_snapshot(oa); b0:=pg_temp.h14_fin_snapshot(ob);
  phase:='diagnostic'; diagnostic_caller:=pg_temp.h14_fin_actor((f->>'actor_a')::uuid);
  PERFORM pg_temp.h14_fin_assert_actor((f->>'actor_a')::uuid,oa);
  diagnostic:=public.diagnosticar_baja_embarque(target);
  PERFORM pg_temp.h14_fin_owner();
  PERFORM pg_temp.h14_assert_diagnostic(diagnostic,exp->'counts',target);
  IF p_case IN('X12','X13') THEN
    PERFORM pg_temp.h14_fin_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(diagnostic->'ejemplos_cxc') r
      WHERE r->>'id'=f->>'outside_canonical_examples_id'),'child must remain outside the actual canonical example sample');
  END IF;
  diagnostic_unchanged:=a0 IS NOT DISTINCT FROM pg_temp.h14_fin_snapshot(oa)
    AND b0 IS NOT DISTINCT FROM pg_temp.h14_fin_snapshot(ob);
  PERFORM pg_temp.h14_fin_assert(diagnostic_unchanged,'diagnostic must not mutate any fixture row');
  exp:=exp||jsonb_build_object('hint_equals',diagnostic);
  phase:='delete';
  obs:=pg_temp.h14_fin_delete((f->>'actor_a')::uuid,target,oa);
  a1:=pg_temp.h14_fin_snapshot(oa); b1:=pg_temp.h14_fin_snapshot(ob);
  unchanged:=a0 IS NOT DISTINCT FROM a1 AND b0 IS NOT DISTINCT FROM b1;
  financial_same:=pg_temp.h14_fin_financial(a0) IS NOT DISTINCT FROM pg_temp.h14_fin_financial(a1);
  other_a_same:=pg_temp.h14_fin_other_operatives(a0,target,CASE WHEN p_case='B02' THEN (f->>'cotizacion_id')::uuid ELSE NULL END)
    IS NOT DISTINCT FROM pg_temp.h14_fin_other_operatives(a1,target,CASE WHEN p_case='B02' THEN (f->>'cotizacion_id')::uuid ELSE NULL END);
  BEGIN hint_json:=nullif(obs->>'hint','')::jsonb; EXCEPTION WHEN OTHERS THEN hint_json:=NULL; END;
  ok:=obs->>'sqlstate'=exp->>'sqlstate' AND b0 IS NOT DISTINCT FROM b1 AND financial_same AND other_a_same;
  IF exp->>'sqlstate'='23514' THEN
    ok:=ok AND left(obs->>'message',length(exp->>'message_prefix'))=exp->>'message_prefix'
      AND (hint_json IS NOT DISTINCT FROM (exp->'hint_equals')) AND unchanged;
  ELSE
    ok:=ok AND EXISTS(SELECT 1 FROM public.embarques WHERE id=target AND deleted_at IS NOT NULL AND deleted_by=(f->>'actor_a')::uuid)
      AND (SELECT count(*)=1 AND bool_and(usuario_id=(f->>'actor_a')::uuid AND organization_id=oa)
        FROM public.bitacora_actividad WHERE entidad_id=target AND accion='eliminar_embarque')
      AND EXISTS(SELECT 1 FROM public.bitacora_actividad WHERE entidad_id=target AND accion='eliminar_embarque'
        AND entidad_nombre=CASE WHEN p_case='B01' THEN 'Borrador '||right(target::text,6) ELSE entidad_nombre END);
    FOREACH t IN ARRAY ARRAY['conceptos_venta','conceptos_costo','documentos_embarque','notas_embarque','eventos_embarque','embarque_contenedores','seguros_embarque'] LOOP
      SELECT coalesce(jsonb_agg(x->'row'->'id' ORDER BY x->'row'->>'id'),'[]'::jsonb) INTO ids0
        FROM jsonb_array_elements(a0->t) x WHERE (x->'row'->>'embarque_id')::uuid=target;
      SELECT coalesce(jsonb_agg(x->'row'->'id' ORDER BY x->'row'->>'id'),'[]'::jsonb) INTO ids1
        FROM jsonb_array_elements(a1->t) x WHERE (x->'row'->>'embarque_id')::uuid=target;
      ok:=ok AND ids0 IS NOT DISTINCT FROM ids1;
      ok:=ok AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a1->t) x
        WHERE (x->'row'->>'embarque_id')::uuid=target AND (
          x->'row'->>'deleted_at' IS NULL OR (t<>'seguros_embarque' AND (x->'row'->>'deleted_by')::uuid IS DISTINCT FROM (f->>'actor_a')::uuid)));
    END LOOP;
    IF p_case='B02' THEN
      ok:=ok AND EXISTS(SELECT 1 FROM public.cotizaciones WHERE id=(f->>'cotizacion_id')::uuid AND estado='Aceptada' AND embarque_id IS NULL)
        AND EXISTS(SELECT 1 FROM public.embarques WHERE id=target AND cotizacion_id IS NULL)
        AND NOT EXISTS(SELECT 1 FROM public.conceptos_venta WHERE embarque_id=target AND deleted_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM public.conceptos_costo WHERE embarque_id=target AND deleted_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM public.documentos_embarque WHERE embarque_id=target AND deleted_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM public.notas_embarque WHERE embarque_id=target AND deleted_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM public.eventos_embarque WHERE embarque_id=target AND deleted_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM public.embarque_contenedores WHERE embarque_id=target AND deleted_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM public.seguros_embarque WHERE embarque_id=target AND deleted_at IS NULL);
    END IF;
  END IF;
  IF p_case='P01' THEN ok:=ok AND (f->>'outside_observed_after_child')::boolean IS TRUE; END IF;
  SELECT coalesce(jsonb_agg(x.key),'[]'::jsonb) INTO changed FROM jsonb_each(a0) x WHERE x.value IS DISTINCT FROM a1->x.key;
  RETURN jsonb_build_object('case_id',key,'matrix_id',p_case,'tier','S','expected_by_code',exp,
    'fixture_class',f->>'fixture_class','fixture_valid',true,'manifest',f,'policy_pending',false,
    'status',CASE WHEN ok IS TRUE THEN 'REGRESSION_CONTRACT_CONFIRMED' ELSE 'REGRESSION_CONTRACT_FAILED' END,
    'reproduction_complete',ok IS TRUE,'observed',obs||jsonb_build_object('phase',phase,'hint_json',hint_json,'diagnostic',diagnostic,'diagnostic_caller',diagnostic_caller,'diagnostic_unchanged',diagnostic_unchanged,
      'before_a',a0,'after_a',a1,'before_b',b0,'after_b',b1,'changed_tables_a',changed,
      'no_partial_effects_on_rejection',CASE WHEN obs->>'sqlstate'='00000' THEN NULL ELSE unchanged END,
      'financial_rows_unchanged_by_delete',financial_same,'other_tenant_unchanged',b0 IS NOT DISTINCT FROM b1,
      'other_operatives_same_tenant_unchanged',other_a_same,'hint_exact_match',(hint_json IS NOT DISTINCT FROM (exp->'hint_equals')),
      'producer',producer));
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,hint=PG_EXCEPTION_HINT,detail=PG_EXCEPTION_DETAIL,
    et=TABLE_NAME,ec=COLUMN_NAME,en=CONSTRAINT_NAME;
  PERFORM pg_temp.h14_fin_owner();
  RETURN jsonb_build_object('case_id',key,'matrix_id',p_case,'tier','S','expected_by_code',exp,
    'fixture_class','harness_or_context_error','policy_pending',false,'status','HARNESS_OR_CONTEXT_ERROR',
    'reproduction_complete',false,'observed',jsonb_build_object('phase',phase,'sqlstate',st,'message',msg,'hint',hint,'detail',detail,
      'table_name',et,'column_name',ec,'constraint_name',en));
END $$;

-- Exercise the official restoration paths against the pre-forward tombstone.
-- The deliberate outer subtransaction rollback preserves that historical
-- rowset for the other suites, including after the successful restore case.
CREATE FUNCTION pg_temp.h14_fin_restore_run(p_case text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  e uuid; oa uuid; ob uuid; actor uuid; cost uuid; supplier uuid; invoice uuid; insurance uuid;
  episode timestamptz; baseline_a jsonb; baseline_b jsonb; a0 jsonb; b0 jsonb; a1 jsonb; b1 jsonb;
  caller jsonb; observed jsonb; st text:='00000'; msg text; hint text; detail text;
  gate_before text; gate_after text; expected_state text; expected_marker text;
  ok boolean:=false; parent_and_cost_live boolean; financial_same boolean; restored_rollback boolean;
  phase text:='historical_fixture'; statement text;
BEGIN
  PERFORM pg_temp.h14_fin_owner();
  SELECT e0.id,e0.organization_id,e0.deleted_at INTO STRICT e,oa,episode
    FROM public.embarques e0 JOIN public.clientes c ON c.id=e0.cliente_id
    WHERE c.email='h14-pre-forward-purge-history@example.invalid' AND e0.deleted_at IS NOT NULL;
  SELECT user_id INTO STRICT actor FROM public.organization_members WHERE organization_id=oa AND role='admin_org';
  SELECT id INTO STRICT ob FROM public.organizations WHERE nombre='H14 FIN H14.pre-forward.purge B';
  SELECT id INTO STRICT invoice FROM public.facturas WHERE embarque_id=e AND deleted_at IS NULL;
  SELECT cc.id,pf.id INTO STRICT cost,supplier FROM public.conceptos_costo cc
    JOIN public.proveedor_facturas_conceptos pfc ON pfc.concepto_costo_id=cc.id
    JOIN public.proveedor_facturas pf ON pf.id=pfc.proveedor_factura_id
    WHERE cc.embarque_id=e AND cc.deleted_at=episode AND pf.deleted_at IS NULL;
  PERFORM pg_temp.h14_fin_assert(episode IS NOT NULL,'restoration needs a real pre-forward deletion episode');
  baseline_a:=pg_temp.h14_fin_snapshot(oa);baseline_b:=pg_temp.h14_fin_snapshot(ob);
  expected_state:=CASE WHEN p_case='R01.restore_history_positive' THEN '00000' ELSE '23514' END;
  expected_marker:=CASE p_case WHEN 'R02.reject_child_restore_still_dead' THEN 'LC_EMBARQUE_ELIMINADO'
    WHEN 'R03.restore_failure_atomic' THEN 'LC_SEGURO_COBERTURA_INCOMPLETA' END;
  PERFORM pg_temp.h14_fin_assert(p_case IN('R01.restore_history_positive','R02.reject_child_restore_still_dead','R03.restore_failure_atomic'),
    'unknown restoration case');
  BEGIN
    IF p_case='R03.restore_failure_atomic' THEN
      -- A deleted policy is valid historical input. Its live provider invoice
      -- covers100, while the policy requires200; the real coverage trigger
      -- must reject reactivation after the parent and cost have been visited.
      insurance:=pg_temp.h14_fin_uuid(p_case,'insufficient-policy');
      INSERT INTO public.seguros_embarque(id,organization_id,embarque_id,aseguradora,numero_poliza,
        vigencia_desde,vigencia_hasta,prima,moneda,proveedor_factura_id,deleted_at)
        VALUES(insurance,oa,e,'H14 fictitious','H14 restore atomicity',public.fecha_negocio_mx(),
          public.fecha_negocio_mx()+1,200,'MXN',supplier,episode);
      PERFORM pg_temp.h14_fin_assert((SELECT subtotal=100 AND moneda::text='MXN' FROM public.proveedor_facturas WHERE id=supplier),
        'coverage failure must derive from the independent fixture amounts');
    END IF;
    a0:=pg_temp.h14_fin_snapshot(oa);b0:=pg_temp.h14_fin_snapshot(ob);
    caller:=pg_temp.h14_fin_actor(actor);PERFORM pg_temp.h14_fin_assert_actor(actor,oa);
    gate_before:=coalesce(nullif(current_setting('app.papelera_restore',true),''),'off');
    statement:=CASE p_case
      WHEN 'R01.restore_history_positive' THEN format('SELECT public.restaurar_embarque_cascade(%L::uuid)',e)
      WHEN 'R02.reject_child_restore_still_dead' THEN format('SELECT public.restore_record(''conceptos_costo'',%L::uuid)',cost)
      ELSE format('SELECT public.restore_record(''embarques'',%L::uuid)',e) END;
    phase:='official_restore';
    BEGIN EXECUTE statement;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,hint=PG_EXCEPTION_HINT,detail=PG_EXCEPTION_DETAIL;
    END;
    PERFORM pg_temp.h14_fin_owner();
    a1:=pg_temp.h14_fin_snapshot(oa);b1:=pg_temp.h14_fin_snapshot(ob);
    gate_after:=coalesce(nullif(current_setting('app.papelera_restore',true),''),'off');
    parent_and_cost_live:=EXISTS(SELECT 1 FROM public.embarques WHERE id=e AND deleted_at IS NULL AND deleted_by IS NULL)
      AND EXISTS(SELECT 1 FROM public.conceptos_costo WHERE id=cost AND deleted_at IS NULL AND deleted_by IS NULL);
    financial_same:=pg_temp.h14_fin_financial(a0) IS NOT DISTINCT FROM pg_temp.h14_fin_financial(a1);
    ok:=st=expected_state AND gate_before='off' AND gate_after='off' AND financial_same AND b0 IS NOT DISTINCT FROM b1;
    IF expected_state='00000' THEN
      ok:=ok AND parent_and_cost_live
        AND pg_temp.h14_fin_other_operatives(a0,e) IS NOT DISTINCT FROM pg_temp.h14_fin_other_operatives(a1,e)
        AND EXISTS(SELECT 1 FROM public.facturas WHERE id=invoice AND deleted_at IS NULL)
        AND EXISTS(SELECT 1 FROM public.proveedor_facturas WHERE id=supplier AND deleted_at IS NULL);
    ELSE
      ok:=ok AND left(msg,length(expected_marker))=expected_marker
        AND a0 IS NOT DISTINCT FROM a1 AND parent_and_cost_live IS FALSE;
    END IF;
    observed:=jsonb_build_object('phase',phase,'caller',caller,'statement',statement,
      'sqlstate',st,'message',msg,'hint',hint,'detail',detail,'restore_gate_before',gate_before,'restore_gate_after',gate_after,
      'parent_and_cost_live',parent_and_cost_live,'financial_rows_unchanged',financial_same,
      'before_a',a0,'after_a',a1,'before_b',b0,'after_b',b1,
      'no_partial_effects_on_rejection',CASE WHEN st='00000' THEN NULL ELSE a0 IS NOT DISTINCT FROM a1 AND b0 IS NOT DISTINCT FROM b1 END);
    RAISE EXCEPTION USING ERRCODE='ZH140',MESSAGE='H14 rollback-only restoration observation';
  EXCEPTION WHEN SQLSTATE 'ZH140' THEN NULL;
  END;
  PERFORM pg_temp.h14_fin_owner();
  restored_rollback:=baseline_a IS NOT DISTINCT FROM pg_temp.h14_fin_snapshot(oa)
    AND baseline_b IS NOT DISTINCT FROM pg_temp.h14_fin_snapshot(ob);
  RETURN jsonb_build_object('case_id',p_case,'expected_by_code',jsonb_build_object('sqlstate',expected_state,
    'message_prefix',expected_marker,'preserve_financial_history',true,'outer_fixture_rollback',true),
    'reproduction_complete',ok IS TRUE AND restored_rollback,'observed',observed||jsonb_build_object(
      'pre_forward_history_preserved_by_outer_rollback',restored_rollback));
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,hint=PG_EXCEPTION_HINT,detail=PG_EXCEPTION_DETAIL;
  PERFORM pg_temp.h14_fin_owner();
  RETURN jsonb_build_object('case_id',p_case,'expected_by_code',jsonb_build_object('context_valid',true),
    'reproduction_complete',false,'observed',jsonb_build_object('phase',phase,'sqlstate',st,'message',msg,
      'hint',hint,'detail',detail,'harness_or_fixture_error',true));
END $$;

CREATE TEMP TABLE h14_fin_results(case_id text PRIMARY KEY,result jsonb NOT NULL);
INSERT INTO h14_fin_results VALUES ('B01.base',pg_temp.h14_fin_run('B01','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='B01.base';
INSERT INTO h14_fin_results VALUES ('B02.base',pg_temp.h14_fin_run('B02','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='B02.base';
INSERT INTO h14_fin_results VALUES ('L01.draft',pg_temp.h14_fin_run('L01','draft'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='L01.draft';
INSERT INTO h14_fin_results VALUES ('L01.issued',pg_temp.h14_fin_run('L01','issued'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='L01.issued';
INSERT INTO h14_fin_results VALUES ('L02.active',pg_temp.h14_fin_run('L02','active'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='L02.active';
INSERT INTO h14_fin_results VALUES ('L03.active',pg_temp.h14_fin_run('L03','active'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='L03.active';
INSERT INTO h14_fin_results VALUES ('L03.inactive',pg_temp.h14_fin_run('L03','inactive'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='L03.inactive';
INSERT INTO h14_fin_results VALUES ('L04.concept',pg_temp.h14_fin_run('L04','concept'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='L04.concept';
INSERT INTO h14_fin_results VALUES ('L05.producer',pg_temp.h14_fin_run('L05','producer'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='L05.producer';
INSERT INTO h14_fin_results VALUES ('E01.cancelada',pg_temp.h14_fin_run('E01','cancelada'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E01.cancelada';
INSERT INTO h14_fin_results VALUES ('E01.sustituida',pg_temp.h14_fin_run('E01','sustituida'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E01.sustituida';
INSERT INTO h14_fin_results VALUES ('E02.pagada',pg_temp.h14_fin_run('E02','pagada'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E02.pagada';
INSERT INTO h14_fin_results VALUES ('E02.cero',pg_temp.h14_fin_run('E02','cero'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E02.cero';
INSERT INTO h14_fin_results VALUES ('E03.cancelada',pg_temp.h14_fin_run('E03','cancelada'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E03.cancelada';
INSERT INTO h14_fin_results VALUES ('E03.pagada',pg_temp.h14_fin_run('E03','pagada'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E03.pagada';
INSERT INTO h14_fin_results VALUES ('E04.borrador',pg_temp.h14_fin_run('E04','borrador'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E04.borrador';
INSERT INTO h14_fin_results VALUES ('E04.aprobada',pg_temp.h14_fin_run('E04','aprobada'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E04.aprobada';
INSERT INTO h14_fin_results VALUES ('E05.cancelada',pg_temp.h14_fin_run('E05','cancelada'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E05.cancelada';
INSERT INTO h14_fin_results VALUES ('E05.facturada',pg_temp.h14_fin_run('E05','facturada'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E05.facturada';
INSERT INTO h14_fin_results VALUES ('E06.factura_null',pg_temp.h14_fin_run('E06','factura_null'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E06.factura_null';
INSERT INTO h14_fin_results VALUES ('E06.proforma_null',pg_temp.h14_fin_run('E06','proforma_null'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E06.proforma_null';
INSERT INTO h14_fin_results VALUES ('E06.proveedor_null',pg_temp.h14_fin_run('E06','proveedor_null'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E06.proveedor_null';
INSERT INTO h14_fin_results VALUES ('E07.cxc_live',pg_temp.h14_fin_run('E07','cxc_live'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E07.cxc_live';
INSERT INTO h14_fin_results VALUES ('E07.cxc_deleted',pg_temp.h14_fin_run('E07','cxc_deleted'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E07.cxc_deleted';
INSERT INTO h14_fin_results VALUES ('E07.cxp_live',pg_temp.h14_fin_run('E07','cxp_live'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E07.cxp_live';
INSERT INTO h14_fin_results VALUES ('E07.cxp_deleted',pg_temp.h14_fin_run('E07','cxp_deleted'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E07.cxp_deleted';
INSERT INTO h14_fin_results VALUES ('E08.payment',pg_temp.h14_fin_run('E08','payment'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E08.payment';
INSERT INTO h14_fin_results VALUES ('E08.credit',pg_temp.h14_fin_run('E08','credit'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='E08.credit';
INSERT INTO h14_fin_results VALUES ('P01.credit',pg_temp.h14_fin_run('P01','credit'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='P01.credit';
INSERT INTO h14_fin_results VALUES ('P01.payment',pg_temp.h14_fin_run('P01','payment'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='P01.payment';
INSERT INTO h14_fin_results VALUES ('P02.base',pg_temp.h14_fin_run('P02','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='P02.base';
INSERT INTO h14_fin_results VALUES ('H01.cerrado',pg_temp.h14_fin_run('H01','cerrado'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='H01.cerrado';
INSERT INTO h14_fin_results VALUES ('H01.cerrado_at',pg_temp.h14_fin_run('H01','cerrado_at'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='H01.cerrado_at';
INSERT INTO h14_fin_results VALUES ('H02.definitiva',pg_temp.h14_fin_run('H02','definitiva'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='H02.definitiva';
INSERT INTO h14_fin_results VALUES ('H02.no_definitiva',pg_temp.h14_fin_run('H02','no_definitiva'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='H02.no_definitiva';
INSERT INTO h14_fin_results VALUES ('H02.definitiva_borrada',pg_temp.h14_fin_run('H02','definitiva_borrada'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='H02.definitiva_borrada';
INSERT INTO h14_fin_results VALUES ('H04.cancelado',pg_temp.h14_fin_run('H04','cancelado'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='H04.cancelado';


INSERT INTO h14_fin_results VALUES ('X01.base',pg_temp.h14_fin_run('X01','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X01.base';
INSERT INTO h14_fin_results VALUES ('X02.base',pg_temp.h14_fin_run('X02','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X02.base';
INSERT INTO h14_fin_results VALUES ('X03.base',pg_temp.h14_fin_run('X03','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X03.base';
INSERT INTO h14_fin_results VALUES ('X04.base',pg_temp.h14_fin_run('X04','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X04.base';
INSERT INTO h14_fin_results VALUES ('X05.base',pg_temp.h14_fin_run('X05','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X05.base';
INSERT INTO h14_fin_results VALUES ('X06.base',pg_temp.h14_fin_run('X06','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X06.base';
INSERT INTO h14_fin_results VALUES ('X07.base',pg_temp.h14_fin_run('X07','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X07.base';

INSERT INTO h14_fin_results VALUES ('X08.base',pg_temp.h14_fin_run('X08','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X08.base';
INSERT INTO h14_fin_results VALUES ('X09.base',pg_temp.h14_fin_run('X09','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X09.base';
INSERT INTO h14_fin_results VALUES ('X10.base',pg_temp.h14_fin_run('X10','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X10.base';
INSERT INTO h14_fin_results VALUES ('X11.base',pg_temp.h14_fin_run('X11','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X11.base';
INSERT INTO h14_fin_results VALUES ('X12.base',pg_temp.h14_fin_run('X12','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X12.base';
INSERT INTO h14_fin_results VALUES ('X13.base',pg_temp.h14_fin_run('X13','base'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='X13.base';

INSERT INTO h14_fin_results VALUES ('R01.restore_history_positive',pg_temp.h14_fin_restore_run('R01.restore_history_positive'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='R01.restore_history_positive';
INSERT INTO h14_fin_results VALUES ('R02.reject_child_restore_still_dead',pg_temp.h14_fin_restore_run('R02.reject_child_restore_still_dead'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='R02.reject_child_restore_still_dead';
INSERT INTO h14_fin_results VALUES ('R03.restore_failure_atomic',pg_temp.h14_fin_restore_run('R03.restore_failure_atomic'));
SELECT 'H14_RESULT '||result::text FROM h14_fin_results WHERE case_id='R03.restore_failure_atomic';

DO $$ BEGIN
  PERFORM pg_temp.h14_fin_assert((SELECT count(*)=53 FROM h14_fin_results),'all 50 finance and three restoration variants must be recorded');
  PERFORM pg_temp.h14_fin_assert((SELECT bool_and((result->>'reproduction_complete')::boolean IS TRUE) FROM h14_fin_results),
    'correction contract/context/fixture failed; inspect H14_RESULT');
END $$;
ROLLBACK;

-- Independent rollback-only scale/equivalence transaction; one declared observation.
\ir scale-equivalence.sql
-- Full public reader at the authenticated 8 s budget, with unrelated history.
\ir reader-budget.sql
