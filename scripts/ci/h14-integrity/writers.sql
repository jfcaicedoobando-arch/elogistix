-- Strict correction writer and direct-DML regression; all rows are fictitious.
-- A clone is mandatory. Every actual operation runs as an authenticated actor.
\ir ../finance/fixture_helpers.sql
DO $$ BEGIN
  PERFORM pg_temp.h14_fin_assert(current_database() ~ '^h14_writers_[0-9a-f]{32}$'
    AND current_user='postgres' AND session_user='postgres' AND inet_server_addr() IS NULL,
    'owned strict writer clone required');
END $$;
CREATE TEMP TABLE h14_writer_contexts(case_id text PRIMARY KEY,f jsonb NOT NULL,statement text NOT NULL,
  expected_state text NOT NULL,expected_marker text,positive_check text);
CREATE TEMP TABLE h14_writer_results(case_id text PRIMARY KEY,result jsonb NOT NULL);

CREATE FUNCTION pg_temp.h14_writer_prepare(p_case text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE f jsonb; f2 jsonb; e uuid; live uuid; oa uuid; actor uuid; org_b uuid; ca uuid;
  invoice uuid; edge_invoice uuid; supplier uuid; proforma uuid; dead_proforma uuid; dead_invoice uuid; dead_supplier uuid;
  cf uuid; pcc uuid; sale uuid; live_cost uuid; dead_cost uuid; pfc uuid; insurance uuid;
  stmt text; positive text; code text:='23514'; marker text:='LC_EMBARQUE_ELIMINADO'; key text:=p_case;
BEGIN
  PERFORM pg_temp.h14_fin_owner();
  IF p_case IN('W18.payment_history','W19.credit_history','W22.purge_history','W24.deactivate_history_bridge','W33.rr_purge','W34.serializable_purge') THEN
    SELECT e0.id,e0.organization_id,e0.cliente_id INTO STRICT e,oa,ca
      FROM public.embarques e0 JOIN public.clientes c ON c.id=e0.cliente_id
      WHERE c.email='h14-pre-forward-purge-history@example.invalid' AND e0.deleted_at IS NOT NULL;
    SELECT user_id INTO STRICT actor FROM public.organization_members WHERE organization_id=oa AND role='admin_org';
    SELECT id INTO STRICT org_b FROM public.organizations WHERE nombre='H14 FIN H14.pre-forward.purge B';
    SELECT id INTO STRICT invoice FROM public.facturas WHERE embarque_id=e AND deleted_at IS NULL;
    f:=jsonb_build_object('case_key',key,'org_a',oa,'org_b',org_b,'actor_a',actor,'embarque_a',e,'cliente_a',ca);
    IF p_case='W18.payment_history' THEN
      stmt:=format('SELECT pg_temp.h14_fin_customer_payment(%L::jsonb,%L,%L::uuid,10)',f,'new-payment',invoice);
    ELSIF p_case='W19.credit_history' THEN
      stmt:=format('SELECT pg_temp.h14_fin_customer_credit(%L::jsonb,%L,%L::uuid)',f,'new-credit',invoice);
    ELSIF p_case='W24.deactivate_history_bridge' THEN
      stmt:=format('UPDATE public.factura_embarques SET activa=false WHERE factura_id=%L AND embarque_id=%L',invoice,e);
      code:='00000';marker:=NULL;
      positive:=format('SELECT EXISTS(SELECT 1 FROM public.factura_embarques WHERE factura_id=%L AND embarque_id=%L AND activa=false)',invoice,e);
    ELSE
      stmt:=format('SELECT public.purgar_embarque_cascade(%L::uuid)',e);
      marker:='LC_EMBARQUE_BLOQUEADO';
    END IF;
  ELSE
    f:=pg_temp.h14_fin_seed(key);e:=(f->>'embarque_a')::uuid;oa:=(f->>'org_a')::uuid;
    IF p_case IN('W35.service_clean','W36.service_dependencies','W37.service_rr','W38.service_rpc_no_uid') THEN
      f:=f||jsonb_build_object('operation_role','service_role');
      IF p_case='W36.service_dependencies' THEN
        invoice:=pg_temp.h14_fin_invoice(f,'service-dependency',e);
        code:='23514';marker:='LC_EMBARQUE_BLOQUEADO';
      ELSIF p_case='W38.service_rpc_no_uid' THEN code:='42501';marker:='LC_FORBIDDEN';
      ELSIF p_case='W37.service_rr' THEN code:='25001';marker:='LC_EMBARQUE_AISLAMIENTO_NO_SOPORTADO';
      ELSE code:='00000';marker:=NULL;positive:=format('SELECT EXISTS(SELECT 1 FROM public.embarques WHERE id=%L AND deleted_at IS NOT NULL)',e);
      END IF;
      stmt:=CASE WHEN p_case='W38.service_rpc_no_uid' THEN format('SELECT public.eliminar_embarque_completo(%L::uuid)',e)
        ELSE format('UPDATE public.embarques SET deleted_at=now() WHERE id=%L',e) END;
    ELSIF p_case='W23.purge_clean' THEN
      PERFORM pg_temp.h14_fin_delete((f->>'actor_a')::uuid,e,oa);
      stmt:=format('SELECT public.purgar_embarque_cascade(%L::uuid)',e);code:='00000';marker:=NULL;
      positive:=format('SELECT NOT EXISTS(SELECT 1 FROM public.embarques WHERE id=%L)',e);
    ELSE
      live:=pg_temp.h14_fin_second_shipment(f,'live-second');f2:=f||jsonb_build_object('embarque_a',live);
      invoice:=pg_temp.h14_fin_invoice(f,'live-invoice',live,'Borrador');
      IF p_case='W04.bridge_insert' THEN
        edge_invoice:=pg_temp.h14_fin_invoice(f,'live-invoice-new-edge',live,'Borrador');
        PERFORM pg_temp.h14_fin_assert(NOT EXISTS(SELECT 1 FROM public.factura_embarques WHERE factura_id=edge_invoice AND embarque_id=e),'W04 requires a distinct live invoice without the tested bridge');
      END IF;
      supplier:=pg_temp.h14_fin_supplier_invoice(f2,'live-supplier');
      proforma:=pg_temp.h14_fin_proforma(f,'live-proforma',live);
      dead_invoice:=pg_temp.h14_fin_invoice(f,'inactive-invoice',e);
      UPDATE public.facturas SET deleted_at=now() WHERE id=dead_invoice;
      dead_supplier:=pg_temp.h14_fin_supplier_invoice(f,'inactive-supplier');
      UPDATE public.proveedor_facturas SET deleted_at=now() WHERE id=dead_supplier;
      dead_proforma:=pg_temp.h14_fin_proforma(f,'inactive-proforma',e);
      UPDATE public.proformas SET deleted_at=now() WHERE id=dead_proforma;
      INSERT INTO public.factura_embarques(factura_id,embarque_id,organization_id,activa) VALUES(invoice,e,oa,false);
      cf:=pg_temp.h14_fin_uuid(key,'inactive-invoice-concept');
      INSERT INTO public.conceptos_factura(id,organization_id,factura_id,embarque_id,descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada,deleted_at)
        VALUES(cf,oa,invoice,e,'H14 inactive fixture',1,0,0,'MXN','tasa_0',0,now());
      pcc:=pg_temp.h14_fin_uuid(key,'inactive-consolidated-concept');
      INSERT INTO public.proforma_conceptos_consolidados(id,organization_id,proforma_id,embarque_id,descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada,deleted_at)
        VALUES(pcc,oa,proforma,e,'H14 inactive fixture',1,0,0,'MXN','tasa_0',0,now());
      sale:=pg_temp.h14_fin_sale(f,'inactive-source-sale',e,proforma);
      UPDATE public.conceptos_venta SET deleted_at=now() WHERE id=sale;
      live_cost:=pg_temp.h14_fin_uuid(key,'live-cost');dead_cost:=pg_temp.h14_fin_uuid(key,'inactive-cost');
      INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda,deleted_at)
        SELECT live_cost,oa,live,proveedor_id,'H14 linked fixture',100,'MXN',NULL FROM public.proveedor_facturas WHERE id=supplier;
      INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda,deleted_at)
        SELECT dead_cost,oa,e,proveedor_id,'H14 inactive fixture',100,'MXN',now() FROM public.proveedor_facturas WHERE id=supplier;
      pfc:=pg_temp.h14_fin_uuid(key,'live-supplier-concept');
      INSERT INTO public.proveedor_facturas_conceptos(id,organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
        VALUES(pfc,oa,supplier,live_cost,'H14 linked fixture',1,100);
      insurance:=pg_temp.h14_fin_uuid(key,'live-insurance');
      INSERT INTO public.seguros_embarque(id,organization_id,embarque_id,aseguradora,numero_poliza,prima,moneda,vigencia_desde,vigencia_hasta,proveedor_factura_id)
        VALUES(insurance,oa,live,'H14 fictitious','H14 fictitious',100,'MXN',public.fecha_negocio_mx(),public.fecha_negocio_mx()+1,supplier);
      PERFORM pg_temp.h14_fin_delete((f->>'actor_a')::uuid,e,oa);
      PERFORM pg_temp.h14_fin_assert((SELECT deleted_at IS NOT NULL FROM public.embarques WHERE id=e),'clean target must actually be deleted before writer probe');
      CASE p_case
        WHEN 'W01.invoice_insert' THEN stmt:=format('SELECT pg_temp.h14_fin_invoice(%L::jsonb,%L,%L::uuid)',f,'new-invoice',e);
        WHEN 'W02.invoice_move' THEN stmt:=format('UPDATE public.facturas SET embarque_id=%L WHERE id=%L',e,invoice);
        WHEN 'W03.invoice_restore' THEN stmt:=format('UPDATE public.facturas SET deleted_at=NULL WHERE id=%L',dead_invoice);
        WHEN 'W04.bridge_insert' THEN stmt:=format('INSERT INTO public.factura_embarques(factura_id,embarque_id,organization_id,activa) VALUES(%L,%L,%L,true)',edge_invoice,e,oa);
        WHEN 'W05.bridge_activate' THEN stmt:=format('UPDATE public.factura_embarques SET activa=true WHERE factura_id=%L AND embarque_id=%L',invoice,e);
        WHEN 'W06.invoice_concept_insert' THEN stmt:=format('INSERT INTO public.conceptos_factura(organization_id,factura_id,embarque_id,descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada) VALUES(%L,%L,%L,''H14 forbidden'',1,0,0,''MXN'',''tasa_0'',0)',oa,invoice,e);
        WHEN 'W07.invoice_concept_restore' THEN stmt:=format('UPDATE public.conceptos_factura SET deleted_at=NULL WHERE id=%L',cf);
        WHEN 'W08.supplier_move' THEN stmt:=format('UPDATE public.proveedor_facturas SET embarque_id=%L WHERE id=%L',e,supplier);
        WHEN 'W09.supplier_restore' THEN stmt:=format('UPDATE public.proveedor_facturas SET deleted_at=NULL WHERE id=%L',dead_supplier);
        WHEN 'W10.proforma_insert' THEN stmt:=format('SELECT pg_temp.h14_fin_proforma(%L::jsonb,%L,%L::uuid)',f,'new-proforma',e);
        WHEN 'W11.proforma_restore' THEN stmt:=format('UPDATE public.proformas SET deleted_at=NULL WHERE id=%L',dead_proforma);
        WHEN 'W12.consolidated_insert' THEN stmt:=format('INSERT INTO public.proforma_conceptos_consolidados(organization_id,proforma_id,embarque_id,descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada) VALUES(%L,%L,%L,''H14 forbidden'',1,0,0,''MXN'',''tasa_0'',0)',oa,proforma,e);
        WHEN 'W13.consolidated_restore' THEN stmt:=format('UPDATE public.proforma_conceptos_consolidados SET deleted_at=NULL WHERE id=%L',pcc);
        WHEN 'W14.sale_move' THEN stmt:=format('UPDATE public.conceptos_venta SET deleted_at=NULL WHERE id=%L',sale);
        WHEN 'W15.cost_move' THEN stmt:=format('UPDATE public.conceptos_costo SET embarque_id=%L WHERE id=%L',e,live_cost);
        WHEN 'W16.supplier_concept_remap' THEN stmt:=format('UPDATE public.proveedor_facturas_conceptos SET concepto_costo_id=%L WHERE id=%L',dead_cost,pfc);
        WHEN 'W17.insurance_move' THEN stmt:=format('UPDATE public.seguros_embarque SET embarque_id=%L WHERE id=%L',e,insurance);
        WHEN 'W20.direct_update' THEN stmt:=format('UPDATE public.embarques SET deleted_at=now() WHERE id=%L',live);marker:='LC_EMBARQUE_BLOQUEADO';
        WHEN 'W21.direct_delete' THEN stmt:=format('DELETE FROM public.embarques WHERE id=%L',live);marker:='LC_EMBARQUE_BLOQUEADO';
        WHEN 'W25.rr_rpc','W26.serializable_rpc' THEN stmt:=format('SELECT public.eliminar_embarque_completo(%L::uuid)',live);
        WHEN 'W27.rr_writer','W28.serializable_writer' THEN stmt:=format('SELECT pg_temp.h14_fin_proforma(%L::jsonb,%L,%L::uuid)',f,'rr-proforma',live);
        WHEN 'W29.rr_direct_update','W30.serializable_direct_update' THEN stmt:=format('UPDATE public.embarques SET deleted_at=now() WHERE id=%L',live);
        WHEN 'W39.restore_invoice_rpc' THEN stmt:=format('SELECT public.restore_record(''facturas'',%L::uuid)',dead_invoice);
        WHEN 'W40.restore_invoice_concept_rpc' THEN stmt:=format('SELECT public.restore_record(''conceptos_factura'',%L::uuid)',cf);
        WHEN 'W41.restore_supplier_rpc' THEN stmt:=format('SELECT public.restore_record(''proveedor_facturas'',%L::uuid)',dead_supplier);
        WHEN 'W42.restore_proforma_rpc' THEN stmt:=format('SELECT public.restore_record(''proformas'',%L::uuid)',dead_proforma);
        WHEN 'W43.restore_consolidated_rpc' THEN stmt:=format('SELECT public.restore_record(''proforma_conceptos_consolidados'',%L::uuid)',pcc);
        WHEN 'W44.restore_sale_rpc' THEN stmt:=format('SELECT public.restore_record(''conceptos_venta'',%L::uuid)',sale);
        WHEN 'W31.rr_direct_delete','W32.serializable_direct_delete' THEN stmt:=format('DELETE FROM public.embarques WHERE id=%L',live);
        ELSE RAISE EXCEPTION 'unknown H14 writer case %',p_case;
      END CASE;
    END IF;
  END IF;
  IF p_case ~ '^W(25|26|27|28|29|30|31|32|33|34)[.]' THEN code:='25001';marker:='LC_EMBARQUE_AISLAMIENTO_NO_SOPORTADO'; END IF;
  INSERT INTO h14_writer_contexts VALUES(p_case,f,stmt,code,marker,positive);
END $$;

CREATE FUNCTION pg_temp.h14_writer_probe(p_case text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE c record; a0 jsonb; b0 jsonb; a1 jsonb; b1 jsonb; actor jsonb;
 st text:='00000'; msg text; hint text; detail text; ok boolean; positive boolean; phase text:='context';gate_before text;gate_after text;
BEGIN
  PERFORM pg_temp.h14_fin_owner(); SELECT * INTO STRICT c FROM h14_writer_contexts WHERE case_id=p_case;
  a0:=pg_temp.h14_fin_snapshot((c.f->>'org_a')::uuid);b0:=pg_temp.h14_fin_snapshot((c.f->>'org_b')::uuid);
  IF c.f->>'operation_role'='service_role' THEN
    PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
    PERFORM set_config('role','service_role',true);
    actor:=jsonb_build_object('current_user',current_user,'session_user',session_user,'auth_uid',auth.uid());
    PERFORM pg_temp.h14_fin_assert(current_user='service_role' AND auth.uid() IS NULL,'real service_role without UID');
  ELSE
    actor:=pg_temp.h14_fin_actor((c.f->>'actor_a')::uuid);
    PERFORM pg_temp.h14_fin_assert_actor((c.f->>'actor_a')::uuid,(c.f->>'org_a')::uuid);
  END IF;
  gate_before:=coalesce(nullif(current_setting('app.papelera_restore',true),''),'off');
  phase:='actual_statement';
  BEGIN EXECUTE c.statement;
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,hint=PG_EXCEPTION_HINT,detail=PG_EXCEPTION_DETAIL;
  END;
  PERFORM pg_temp.h14_fin_owner();a1:=pg_temp.h14_fin_snapshot((c.f->>'org_a')::uuid);b1:=pg_temp.h14_fin_snapshot((c.f->>'org_b')::uuid);
  gate_after:=coalesce(nullif(current_setting('app.papelera_restore',true),''),'off');
  ok:=st=c.expected_state AND (c.expected_marker IS NULL OR left(msg,length(c.expected_marker))=c.expected_marker) AND b0 IS NOT DISTINCT FROM b1;
  IF p_case IN('W39.restore_invoice_rpc','W40.restore_invoice_concept_rpc','W41.restore_supplier_rpc','W42.restore_proforma_rpc','W43.restore_consolidated_rpc','W44.restore_sale_rpc') THEN ok:=ok AND gate_before='off' AND gate_after='off';END IF;
  IF st<>'00000' THEN ok:=ok AND a0 IS NOT DISTINCT FROM a1;
  ELSE EXECUTE c.positive_check INTO positive;ok:=ok AND positive IS TRUE; END IF;
  RETURN jsonb_build_object('case_id',p_case,'expected_by_code',jsonb_build_object('sqlstate',c.expected_state,'message_prefix',c.expected_marker),
    'reproduction_complete',ok IS TRUE,'observed',jsonb_build_object('phase',phase,'caller',actor,'isolation',current_setting('transaction_isolation'),
      'statement',c.statement,'restore_gate_before',gate_before,'restore_gate_after',gate_after,'sqlstate',st,'message',msg,'hint',hint,'detail',detail,'before_a',a0,'after_a',a1,'before_b',b0,'after_b',b1,
      'rejection_has_zero_partial_effects',CASE WHEN st='00000' THEN NULL ELSE a0 IS NOT DISTINCT FROM a1 AND b0 IS NOT DISTINCT FROM b1 END));
EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;
 PERFORM pg_temp.h14_fin_owner();
 RETURN jsonb_build_object('case_id',p_case,'expected_by_code',jsonb_build_object('context_valid',true),'reproduction_complete',false,
   'observed',jsonb_build_object('phase',phase,'sqlstate',st,'message',msg,'harness_or_fixture_error',true));
END $$;

-- Prepare each case immediately before its probe, retaining earlier observations.
SELECT pg_temp.h14_writer_prepare('W01.invoice_insert');
INSERT INTO h14_writer_results VALUES('W01.invoice_insert',pg_temp.h14_writer_probe('W01.invoice_insert'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W01.invoice_insert';
SELECT pg_temp.h14_writer_prepare('W02.invoice_move');
INSERT INTO h14_writer_results VALUES('W02.invoice_move',pg_temp.h14_writer_probe('W02.invoice_move'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W02.invoice_move';
SELECT pg_temp.h14_writer_prepare('W03.invoice_restore');
INSERT INTO h14_writer_results VALUES('W03.invoice_restore',pg_temp.h14_writer_probe('W03.invoice_restore'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W03.invoice_restore';
SELECT pg_temp.h14_writer_prepare('W04.bridge_insert');
INSERT INTO h14_writer_results VALUES('W04.bridge_insert',pg_temp.h14_writer_probe('W04.bridge_insert'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W04.bridge_insert';
SELECT pg_temp.h14_writer_prepare('W05.bridge_activate');
INSERT INTO h14_writer_results VALUES('W05.bridge_activate',pg_temp.h14_writer_probe('W05.bridge_activate'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W05.bridge_activate';
SELECT pg_temp.h14_writer_prepare('W06.invoice_concept_insert');
INSERT INTO h14_writer_results VALUES('W06.invoice_concept_insert',pg_temp.h14_writer_probe('W06.invoice_concept_insert'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W06.invoice_concept_insert';
SELECT pg_temp.h14_writer_prepare('W07.invoice_concept_restore');
INSERT INTO h14_writer_results VALUES('W07.invoice_concept_restore',pg_temp.h14_writer_probe('W07.invoice_concept_restore'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W07.invoice_concept_restore';
SELECT pg_temp.h14_writer_prepare('W08.supplier_move');
INSERT INTO h14_writer_results VALUES('W08.supplier_move',pg_temp.h14_writer_probe('W08.supplier_move'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W08.supplier_move';
SELECT pg_temp.h14_writer_prepare('W09.supplier_restore');
INSERT INTO h14_writer_results VALUES('W09.supplier_restore',pg_temp.h14_writer_probe('W09.supplier_restore'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W09.supplier_restore';
SELECT pg_temp.h14_writer_prepare('W10.proforma_insert');
INSERT INTO h14_writer_results VALUES('W10.proforma_insert',pg_temp.h14_writer_probe('W10.proforma_insert'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W10.proforma_insert';
SELECT pg_temp.h14_writer_prepare('W11.proforma_restore');
INSERT INTO h14_writer_results VALUES('W11.proforma_restore',pg_temp.h14_writer_probe('W11.proforma_restore'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W11.proforma_restore';
SELECT pg_temp.h14_writer_prepare('W12.consolidated_insert');
INSERT INTO h14_writer_results VALUES('W12.consolidated_insert',pg_temp.h14_writer_probe('W12.consolidated_insert'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W12.consolidated_insert';
SELECT pg_temp.h14_writer_prepare('W13.consolidated_restore');
INSERT INTO h14_writer_results VALUES('W13.consolidated_restore',pg_temp.h14_writer_probe('W13.consolidated_restore'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W13.consolidated_restore';
SELECT pg_temp.h14_writer_prepare('W14.sale_move');
INSERT INTO h14_writer_results VALUES('W14.sale_move',pg_temp.h14_writer_probe('W14.sale_move'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W14.sale_move';
SELECT pg_temp.h14_writer_prepare('W15.cost_move');
INSERT INTO h14_writer_results VALUES('W15.cost_move',pg_temp.h14_writer_probe('W15.cost_move'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W15.cost_move';
SELECT pg_temp.h14_writer_prepare('W16.supplier_concept_remap');
INSERT INTO h14_writer_results VALUES('W16.supplier_concept_remap',pg_temp.h14_writer_probe('W16.supplier_concept_remap'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W16.supplier_concept_remap';
SELECT pg_temp.h14_writer_prepare('W17.insurance_move');
INSERT INTO h14_writer_results VALUES('W17.insurance_move',pg_temp.h14_writer_probe('W17.insurance_move'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W17.insurance_move';
SELECT pg_temp.h14_writer_prepare('W18.payment_history');
INSERT INTO h14_writer_results VALUES('W18.payment_history',pg_temp.h14_writer_probe('W18.payment_history'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W18.payment_history';
SELECT pg_temp.h14_writer_prepare('W19.credit_history');
INSERT INTO h14_writer_results VALUES('W19.credit_history',pg_temp.h14_writer_probe('W19.credit_history'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W19.credit_history';
SELECT pg_temp.h14_writer_prepare('W20.direct_update');
INSERT INTO h14_writer_results VALUES('W20.direct_update',pg_temp.h14_writer_probe('W20.direct_update'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W20.direct_update';
SELECT pg_temp.h14_writer_prepare('W21.direct_delete');
INSERT INTO h14_writer_results VALUES('W21.direct_delete',pg_temp.h14_writer_probe('W21.direct_delete'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W21.direct_delete';
SELECT pg_temp.h14_writer_prepare('W22.purge_history');
INSERT INTO h14_writer_results VALUES('W22.purge_history',pg_temp.h14_writer_probe('W22.purge_history'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W22.purge_history';
SELECT pg_temp.h14_writer_prepare('W23.purge_clean');
INSERT INTO h14_writer_results VALUES('W23.purge_clean',pg_temp.h14_writer_probe('W23.purge_clean'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W23.purge_clean';
SELECT pg_temp.h14_writer_prepare('W24.deactivate_history_bridge');
INSERT INTO h14_writer_results VALUES('W24.deactivate_history_bridge',pg_temp.h14_writer_probe('W24.deactivate_history_bridge'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W24.deactivate_history_bridge';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT count(*)=24 AND bool_and((result->>'reproduction_complete')::boolean IS TRUE) FROM h14_writer_results),'writer regressions failed; observations already emitted'); END $$;
SELECT pg_temp.h14_writer_prepare('W25.rr_rpc');
BEGIN ISOLATION LEVEL REPEATABLE READ;
INSERT INTO h14_writer_results VALUES('W25.rr_rpc',pg_temp.h14_writer_probe('W25.rr_rpc'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W25.rr_rpc';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W25.rr_rpc'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;
SELECT pg_temp.h14_writer_prepare('W26.serializable_rpc');
BEGIN ISOLATION LEVEL SERIALIZABLE;
INSERT INTO h14_writer_results VALUES('W26.serializable_rpc',pg_temp.h14_writer_probe('W26.serializable_rpc'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W26.serializable_rpc';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W26.serializable_rpc'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;
SELECT pg_temp.h14_writer_prepare('W27.rr_writer');
BEGIN ISOLATION LEVEL REPEATABLE READ;
INSERT INTO h14_writer_results VALUES('W27.rr_writer',pg_temp.h14_writer_probe('W27.rr_writer'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W27.rr_writer';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W27.rr_writer'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;
SELECT pg_temp.h14_writer_prepare('W28.serializable_writer');
BEGIN ISOLATION LEVEL SERIALIZABLE;
INSERT INTO h14_writer_results VALUES('W28.serializable_writer',pg_temp.h14_writer_probe('W28.serializable_writer'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W28.serializable_writer';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W28.serializable_writer'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;
SELECT pg_temp.h14_writer_prepare('W29.rr_direct_update');
BEGIN ISOLATION LEVEL REPEATABLE READ;
INSERT INTO h14_writer_results VALUES('W29.rr_direct_update',pg_temp.h14_writer_probe('W29.rr_direct_update'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W29.rr_direct_update';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W29.rr_direct_update'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;
SELECT pg_temp.h14_writer_prepare('W30.serializable_direct_update');
BEGIN ISOLATION LEVEL SERIALIZABLE;
INSERT INTO h14_writer_results VALUES('W30.serializable_direct_update',pg_temp.h14_writer_probe('W30.serializable_direct_update'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W30.serializable_direct_update';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W30.serializable_direct_update'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;
SELECT pg_temp.h14_writer_prepare('W31.rr_direct_delete');
BEGIN ISOLATION LEVEL REPEATABLE READ;
INSERT INTO h14_writer_results VALUES('W31.rr_direct_delete',pg_temp.h14_writer_probe('W31.rr_direct_delete'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W31.rr_direct_delete';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W31.rr_direct_delete'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;
SELECT pg_temp.h14_writer_prepare('W32.serializable_direct_delete');
BEGIN ISOLATION LEVEL SERIALIZABLE;
INSERT INTO h14_writer_results VALUES('W32.serializable_direct_delete',pg_temp.h14_writer_probe('W32.serializable_direct_delete'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W32.serializable_direct_delete';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W32.serializable_direct_delete'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;
SELECT pg_temp.h14_writer_prepare('W33.rr_purge');
BEGIN ISOLATION LEVEL REPEATABLE READ;
INSERT INTO h14_writer_results VALUES('W33.rr_purge',pg_temp.h14_writer_probe('W33.rr_purge'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W33.rr_purge';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W33.rr_purge'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;
SELECT pg_temp.h14_writer_prepare('W34.serializable_purge');
BEGIN ISOLATION LEVEL SERIALIZABLE;
INSERT INTO h14_writer_results VALUES('W34.serializable_purge',pg_temp.h14_writer_probe('W34.serializable_purge'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W34.serializable_purge';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W34.serializable_purge'),'isolation guard failed; observation already emitted'); END $$;
ROLLBACK;

SELECT pg_temp.h14_writer_prepare('W35.service_clean');
SELECT pg_temp.h14_writer_prepare('W36.service_dependencies');
SELECT pg_temp.h14_writer_prepare('W37.service_rr');
SELECT pg_temp.h14_writer_prepare('W38.service_rpc_no_uid');
INSERT INTO h14_writer_results VALUES('W35.service_clean',pg_temp.h14_writer_probe('W35.service_clean'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W35.service_clean';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W35.service_clean'),'service guard failed; observation already emitted'); END $$;
INSERT INTO h14_writer_results VALUES('W36.service_dependencies',pg_temp.h14_writer_probe('W36.service_dependencies'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W36.service_dependencies';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W36.service_dependencies'),'service guard failed; observation already emitted'); END $$;
BEGIN ISOLATION LEVEL REPEATABLE READ;
INSERT INTO h14_writer_results VALUES('W37.service_rr',pg_temp.h14_writer_probe('W37.service_rr'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W37.service_rr';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W37.service_rr'),'service guard failed; observation already emitted'); END $$;
ROLLBACK;
INSERT INTO h14_writer_results VALUES('W38.service_rpc_no_uid',pg_temp.h14_writer_probe('W38.service_rpc_no_uid'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W38.service_rpc_no_uid';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W38.service_rpc_no_uid'),'service guard failed; observation already emitted'); END $$;

-- Official restore RPCs retain their source authorization and temporary gate.
SELECT pg_temp.h14_writer_prepare('W39.restore_invoice_rpc');
INSERT INTO h14_writer_results VALUES('W39.restore_invoice_rpc',pg_temp.h14_writer_probe('W39.restore_invoice_rpc'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W39.restore_invoice_rpc';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W39.restore_invoice_rpc'),'official restore guard failed; observation already emitted'); END $$;
SELECT pg_temp.h14_writer_prepare('W40.restore_invoice_concept_rpc');
INSERT INTO h14_writer_results VALUES('W40.restore_invoice_concept_rpc',pg_temp.h14_writer_probe('W40.restore_invoice_concept_rpc'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W40.restore_invoice_concept_rpc';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W40.restore_invoice_concept_rpc'),'official restore guard failed; observation already emitted'); END $$;
SELECT pg_temp.h14_writer_prepare('W41.restore_supplier_rpc');
INSERT INTO h14_writer_results VALUES('W41.restore_supplier_rpc',pg_temp.h14_writer_probe('W41.restore_supplier_rpc'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W41.restore_supplier_rpc';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W41.restore_supplier_rpc'),'official restore guard failed; observation already emitted'); END $$;
SELECT pg_temp.h14_writer_prepare('W42.restore_proforma_rpc');
INSERT INTO h14_writer_results VALUES('W42.restore_proforma_rpc',pg_temp.h14_writer_probe('W42.restore_proforma_rpc'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W42.restore_proforma_rpc';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W42.restore_proforma_rpc'),'official restore guard failed; observation already emitted'); END $$;
SELECT pg_temp.h14_writer_prepare('W43.restore_consolidated_rpc');
INSERT INTO h14_writer_results VALUES('W43.restore_consolidated_rpc',pg_temp.h14_writer_probe('W43.restore_consolidated_rpc'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W43.restore_consolidated_rpc';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W43.restore_consolidated_rpc'),'official restore guard failed; observation already emitted'); END $$;
SELECT pg_temp.h14_writer_prepare('W44.restore_sale_rpc');
INSERT INTO h14_writer_results VALUES('W44.restore_sale_rpc',pg_temp.h14_writer_probe('W44.restore_sale_rpc'));
SELECT 'H14_RESULT '||result::text FROM h14_writer_results WHERE case_id='W44.restore_sale_rpc';
DO $$ BEGIN PERFORM pg_temp.h14_fin_assert((SELECT (result->>'reproduction_complete')::boolean IS TRUE FROM h14_writer_results WHERE case_id='W44.restore_sale_rpc'),'official restore guard failed; observation already emitted'); END $$;
