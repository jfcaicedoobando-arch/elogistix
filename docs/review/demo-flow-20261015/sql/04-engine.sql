-- LOCAL / UNAPPLIED. Concrete writer for ONLY the three inventoried legacy core fixtures.
BEGIN;
CREATE FUNCTION demo_flow_writer.sha256(p_value jsonb) RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path=pg_catalog AS $$ SELECT encode(sha256(convert_to(p_value::text,'UTF8')),'hex') $$;
CREATE FUNCTION demo_flow_writer.lineage_sha256(p_lineage uuid) RETURNS text LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$
 SELECT demo_flow_writer.sha256(jsonb_build_object('lineage',to_jsonb(l),'identity',to_jsonb(i),
   'bindings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.fixture_id) FROM demo_flow_writer.bindings b WHERE b.lineage_id=l.id)))
 FROM demo_flow_writer.lineages l JOIN demo_flow_writer.identity_receipts i ON i.lineage_id=l.id WHERE l.id=p_lineage;
$$;
CREATE FUNCTION demo_flow_writer.projection_sha256(p_lineage uuid) RETURNS text LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$
 SELECT demo_flow_writer.sha256(jsonb_agg(jsonb_build_object('fixture',e.fixture_id,'event',e.id,'input',e.input_sha256,
   'snapshot',e.snapshot_sha256) ORDER BY e.fixture_id)) FROM (
   SELECT DISTINCT ON(fixture_id) * FROM demo_flow_writer.events WHERE lineage_id=p_lineage ORDER BY fixture_id,ordinal DESC
 ) e;
$$;
-- _normalizar_razon_social is a trigger, not a callable text function. Preserve its exact expression/fallback.
CREATE FUNCTION demo_flow_writer.normalized_supplier_name(p_name text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 IF p_name IS NULL THEN RETURN NULL; END IF;
 BEGIN
  RETURN upper(regexp_replace(btrim(p_name),'\s+',' ','g') COLLATE public."lc_unicode_upper");
 EXCEPTION WHEN undefined_object OR undefined_function THEN
  RETURN upper(regexp_replace(btrim(p_name),'\s+',' ','g'));
 END;
END $$;

CREATE FUNCTION demo_flow_writer.verify_identity(p_run uuid) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$
DECLARE v_identity demo_flow_writer.identity_receipts; v_binding demo_flow_writer.bindings;
  v_supplier public.proveedores; v_shipment public.embarques; v_category public.presupuesto_categorias; v_spec jsonb; v_run demo_flow_writer.lineages;
BEGIN
  v_run := demo_flow_writer.authorize(p_run);
  SELECT * INTO STRICT v_identity FROM demo_flow_writer.identity_receipts WHERE lineage_id=v_run.id;
  IF v_identity.source_sha256 IS DISTINCT FROM demo_flow_writer.sha256(to_jsonb(v_identity)-'source_sha256')
     OR v_identity.bindings_sha256 IS DISTINCT FROM (SELECT demo_flow_writer.sha256(jsonb_agg(to_jsonb(b) ORDER BY b.fixture_id))
       FROM demo_flow_writer.bindings b WHERE b.lineage_id=v_run.id) THEN
    RAISE EXCEPTION 'DEMO_IDENTITY_RECEIPT_CONFLICT' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_category FROM public.presupuesto_categorias WHERE id=v_identity.category_id FOR SHARE;
  IF NOT FOUND OR v_category.organization_id<>v_run.organization_id OR NOT v_category.activa
     OR v_category.nombre<>'Sin categoría' OR to_jsonb(v_category) IS DISTINCT FROM v_identity.category_snapshot THEN
    RAISE EXCEPTION 'DEMO_CATEGORY_PROVENANCE_CONFLICT' USING ERRCODE='42501'; END IF;
  FOR v_binding IN SELECT * FROM demo_flow_writer.bindings WHERE lineage_id=v_run.id ORDER BY fixture_id LOOP
    v_spec := demo_flow_writer.fixture_spec(v_binding.fixture_id);
    IF v_binding.fixture_sha256 IS DISTINCT FROM demo_flow_writer.sha256(v_spec) THEN
      RAISE EXCEPTION 'DEMO_FIXTURE_CONTENT_CONFLICT' USING ERRCODE='22023'; END IF;
    SELECT * INTO v_supplier FROM public.proveedores WHERE id=v_binding.supplier_id FOR SHARE;
    IF NOT FOUND OR v_supplier.organization_id<>v_run.organization_id OR v_supplier.deleted_at IS NOT NULL
       OR v_supplier.estado_alta<>'aprobado'
       OR v_supplier.nombre IS DISTINCT FROM demo_flow_writer.normalized_supplier_name(v_spec->>'supplierName')
       OR v_supplier.rfc IS DISTINCT FROM v_spec->>'supplierRFC'
       OR to_jsonb(v_supplier) IS DISTINCT FROM v_binding.supplier_snapshot THEN
      RAISE EXCEPTION 'DEMO_SUPPLIER_PROVENANCE_CONFLICT' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_shipment FROM public.embarques WHERE id=v_binding.shipment_id FOR SHARE;
    IF NOT FOUND OR v_shipment.organization_id<>v_run.organization_id OR v_shipment.deleted_at IS NOT NULL
       OR v_shipment.estado::text='Cancelado' OR v_shipment.expediente IS DISTINCT FROM v_spec->>'shipmentExpediente'
       OR to_jsonb(v_shipment) IS DISTINCT FROM v_binding.shipment_snapshot THEN
      RAISE EXCEPTION 'DEMO_SHIPMENT_PROVENANCE_CONFLICT' USING ERRCODE='42501'; END IF;
    IF (SELECT count(DISTINCT x) FROM unnest(v_binding.concept_ids) x) <> cardinality(v_binding.concept_ids) THEN
      RAISE EXCEPTION 'DEMO_DUPLICATE_CONCEPT_ID' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT x) FROM demo_flow_writer.bindings b CROSS JOIN LATERAL unnest(b.concept_ids) x WHERE lineage_id=v_run.id)<>5 THEN
    RAISE EXCEPTION 'DEMO_DUPLICATE_CONCEPT_ID' USING ERRCODE='22023'; END IF;
  PERFORM demo_flow_writer.authorize(p_run);
END $$;

CREATE FUNCTION demo_flow_writer.input_sha256(p_lineage uuid,p_fixture text) RETURNS text LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$
  SELECT demo_flow_writer.sha256(jsonb_build_object('run',to_jsonb(r),
    'binding',to_jsonb(b),'identity',to_jsonb(i)))
  FROM demo_flow_writer.lineages r JOIN demo_flow_writer.bindings b ON b.lineage_id=r.id
    JOIN demo_flow_writer.identity_receipts i ON i.lineage_id=r.id WHERE r.id=p_lineage AND b.fixture_id=p_fixture;
$$;
CREATE FUNCTION demo_flow_writer.snapshot(p_invoice uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('invoice',to_jsonb(f),
    'concepts',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.proveedor_facturas_conceptos c
      WHERE c.proveedor_factura_id=f.id),'[]'::jsonb),
    'payments',COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.pagos_proveedor p
      WHERE p.proveedor_factura_id=f.id),'[]'::jsonb)) FROM public.proveedor_facturas f WHERE f.id=p_invoice;
$$;
CREATE FUNCTION demo_flow_writer.assert_fixture_values(p_lineage uuid,p_fixture text,p_stage integer) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE r demo_flow_writer.lineages; b demo_flow_writer.bindings; f public.proveedor_facturas;
  i demo_flow_writer.identity_receipts; s jsonb; v_concepts jsonb;
BEGIN
  SELECT * INTO STRICT r FROM demo_flow_writer.lineages WHERE id=p_lineage;
  SELECT * INTO STRICT b FROM demo_flow_writer.bindings WHERE lineage_id=p_lineage AND fixture_id=p_fixture;
  SELECT * INTO STRICT i FROM demo_flow_writer.identity_receipts WHERE lineage_id=p_lineage;
  SELECT * INTO STRICT f FROM public.proveedor_facturas WHERE id=b.invoice_id;
  s:=demo_flow_writer.fixture_spec(p_fixture);
  -- Equality to source literals is a scope assertion, not a replacement financial validator.
  IF (f.organization_id,f.proveedor_id,f.embarque_id,f.categoria_presupuesto_id,f.folio_proveedor,f.rfc_proveedor,
      f.proveedor_nombre,f.moneda::text,f.subtotal,f.iva,f.ieps,f.retenciones,f.total,f.dias_credito,
      f.fecha_emision,f.fecha_vencimiento,f.estado::text,f.origen_carga,f.notas,f.created_by,f.aprobada_por,f.uuid_fiscal)
    IS DISTINCT FROM (r.organization_id,b.supplier_id,b.shipment_id,i.category_id,s->>'folio',s->>'rfc',
      s->>'supplierName','MXN'::text,(s->>'subtotal')::numeric,(s->>'vat')::numeric,0::numeric,0::numeric,(s->>'total')::numeric,
      (s->>'creditDays')::integer,r.business_date+(s->>'issuedOffset')::integer,r.business_date+(s->>'dueOffset')::integer,
      'Vigente'::text,'manual'::text,s->>'notes',NULL::uuid,NULL::uuid,NULL::text)
    OR f.deleted_at IS NOT NULL OR f.estado_aprobacion::text IS DISTINCT FROM (CASE WHEN p_stage>=4 THEN 'aprobada' ELSE 'pendiente' END)
    OR (p_stage>=4 AND f.aprobada_at IS NULL) OR (p_stage<4 AND f.aprobada_at IS NOT NULL) THEN
    RAISE EXCEPTION 'DEMO_SOURCE_FIXTURE_EQUIVALENCE_CONFLICT' USING ERRCODE='23514'; END IF;
  SELECT jsonb_agg(jsonb_build_object('description',c.descripcion,'quantity',c.cantidad,'amount',c.monto) ORDER BY x.ordinality)
    INTO v_concepts FROM unnest(b.concept_ids) WITH ORDINALITY x(id,ordinality)
    JOIN public.proveedor_facturas_conceptos c ON c.id=x.id AND c.proveedor_factura_id=b.invoice_id
      AND c.organization_id=r.organization_id AND c.concepto_costo_id IS NULL AND c.iva=0 AND c.ieps=0;
  IF v_concepts IS DISTINCT FROM s->'concepts' OR
    (SELECT count(*) FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id=b.invoice_id)<>cardinality(b.concept_ids) THEN
    RAISE EXCEPTION 'DEMO_SOURCE_CONCEPT_EQUIVALENCE_CONFLICT' USING ERRCODE='23514'; END IF;
  IF (SELECT count(*) FROM public.pagos_proveedor WHERE proveedor_factura_id=b.invoice_id)<>(CASE WHEN p_stage=5 THEN 1 ELSE 0 END) THEN
    RAISE EXCEPTION 'DEMO_PAYMENT_SCOPE_CONFLICT' USING ERRCODE='42501'; END IF;
  IF p_stage=5 AND NOT EXISTS(SELECT 1 FROM public.pagos_proveedor p WHERE p.id=b.payment_id AND p.proveedor_factura_id=b.invoice_id
    AND p.organization_id=r.organization_id AND p.fecha_pago=r.business_date-3 AND p.monto=20000 AND p.monto_en_moneda_factura=20000
    AND p.moneda='MXN' AND p.metodo_pago='Transferencia' AND p.referencia='DEMO-PAGO-001' AND p.notas='Pago parcial demo'
    AND p.cuenta_bancaria_id IS NULL AND p.lote_id IS NULL AND p.created_by IS NULL AND p.deleted_at IS NULL
    AND NOT p.es_ajuste AND NOT p.es_anticipo_aplicado AND p.client_request_id=p.id) THEN
    RAISE EXCEPTION 'DEMO_SOURCE_PAYMENT_EQUIVALENCE_CONFLICT' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION demo_flow_writer.verify_fixture(p_run uuid,p_fixture text,p_stage integer) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_lineage uuid; v_binding demo_flow_writer.bindings; v_last demo_flow_writer.events; v_hash text; v_count integer;
BEGIN
  v_lineage := (demo_flow_writer.authorize(p_run)).id;
  PERFORM demo_flow_writer.authorize(p_run);
  SELECT * INTO STRICT v_binding FROM demo_flow_writer.bindings WHERE lineage_id=v_lineage AND fixture_id=p_fixture FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM demo_flow_writer.fixture_claims WHERE lineage_id=v_lineage AND fixture_id=p_fixture AND invoice_id=v_binding.invoice_id) THEN
    RAISE EXCEPTION 'DEMO_CLAIM_PROVENANCE_CONFLICT' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.proveedor_facturas WHERE id=v_binding.invoice_id FOR UPDATE;
  PERFORM 1 FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id=v_binding.invoice_id ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.pagos_proveedor WHERE proveedor_factura_id=v_binding.invoice_id ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.proveedor_notas_credito WHERE proveedor_factura_id=v_binding.invoice_id)
     OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones WHERE proveedor_factura_id=v_binding.invoice_id) THEN
    RAISE EXCEPTION 'DEMO_MANUAL_LINK_CONFLICT' USING ERRCODE='42501'; END IF;
  v_hash := demo_flow_writer.input_sha256(v_lineage,p_fixture);
  SELECT count(*) INTO v_count FROM demo_flow_writer.events WHERE lineage_id=v_lineage AND fixture_id=p_fixture;
  IF v_count<>p_stage OR v_count<>(SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=v_lineage AND fixture_id=p_fixture) THEN
    RAISE EXCEPTION 'DEMO_ACTION_HISTORY_CONFLICT' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM (
    SELECT e.*,lag(id) OVER(ORDER BY ordinal) AS expected_previous,
      row_number() OVER(ORDER BY ordinal) AS expected_ordinal FROM demo_flow_writer.events e WHERE lineage_id=v_lineage AND fixture_id=p_fixture
    ) h LEFT JOIN demo_flow_writer.receipts q ON (q.lineage_id,q.fixture_id,q.action,q.event_id,q.execution_run_id,q.input_sha256,q.snapshot_sha256)
      =(h.lineage_id,h.fixture_id,h.action,h.id,h.execution_run_id,h.input_sha256,h.snapshot_sha256)
    WHERE q.event_id IS NULL OR h.input_sha256 IS DISTINCT FROM v_hash OR h.actor_key<>'demo_generator'
      OR h.ordinal<>h.expected_ordinal OR h.previous_event_id IS DISTINCT FROM h.expected_previous
      OR h.snapshot_sha256 IS DISTINCT FROM demo_flow_writer.sha256(h.snapshot)
      OR h.execution_run_id IS DISTINCT FROM (SELECT initial_run_id FROM demo_flow_writer.lineages WHERE id=v_lineage)
      OR h.action IS DISTINCT FROM (ARRAY['pending_header','concepts','final_version','approved','simulated_payment'])[h.ordinal]
      OR h.snapshot->'invoice'->>'id' IS DISTINCT FROM v_binding.invoice_id::text
      OR h.snapshot->'invoice'->>'organization_id' IS DISTINCT FROM '00000000-0000-4000-8000-000000000001'
      OR h.snapshot->'invoice'->>'created_by' IS NOT NULL OR h.snapshot->'invoice'->>'aprobada_por' IS NOT NULL) THEN
    RAISE EXCEPTION 'DEMO_VERIFIED_HISTORY_CONFLICT' USING ERRCODE='42501'; END IF;
  SELECT * INTO STRICT v_last FROM demo_flow_writer.events WHERE lineage_id=v_lineage AND fixture_id=p_fixture ORDER BY ordinal DESC LIMIT 1;
  IF demo_flow_writer.snapshot(v_binding.invoice_id) IS DISTINCT FROM v_last.snapshot THEN
    RAISE EXCEPTION 'DEMO_DOCUMENT_DIVERGED' USING ERRCODE='PT409'; END IF;
  IF p_stage>=3 THEN PERFORM demo_flow_writer.assert_fixture_values(v_lineage,p_fixture,p_stage); END IF;
  IF p_stage>=4 AND NOT EXISTS (SELECT 1 FROM demo_flow_writer.current_approvals a JOIN demo_flow_writer.events e ON e.id=a.event_id
    WHERE a.invoice_id=v_binding.invoice_id AND a.lineage_id=v_lineage AND a.fixture_id=p_fixture AND e.action='approved'
      AND e.input_sha256=v_hash) THEN
    RAISE EXCEPTION 'DEMO_CURRENT_APPROVAL_CONFLICT' USING ERRCODE='42501'; END IF;
  IF p_stage=5 AND NOT EXISTS (SELECT 1 FROM demo_flow_writer.simulated_payments s JOIN demo_flow_writer.events e ON e.id=s.event_id
    WHERE s.payment_id=v_binding.payment_id AND s.lineage_id=v_lineage AND s.fixture_id=p_fixture AND e.action='simulated_payment'
      AND e.input_sha256=v_hash) THEN
    RAISE EXCEPTION 'DEMO_SIMULATION_PROVENANCE_CONFLICT' USING ERRCODE='42501'; END IF;
  PERFORM demo_flow_writer.authorize(p_run);
END $$;

CREATE FUNCTION demo_flow_writer.record_action(p_run uuid,p_fixture text,p_action text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_lineage uuid; v_binding demo_flow_writer.bindings; v_ordinal integer; v_event uuid; v_previous uuid; v_input text; v_snapshot jsonb;
BEGIN
  v_lineage := (demo_flow_writer.authorize(p_run)).id;
  PERFORM demo_flow_writer.authorize(p_run);
  SELECT * INTO STRICT v_binding FROM demo_flow_writer.bindings WHERE lineage_id=v_lineage AND fixture_id=p_fixture FOR UPDATE;
  v_ordinal := array_position(ARRAY['pending_header','concepts','final_version','approved','simulated_payment'],p_action);
  IF v_ordinal IS NULL OR (v_ordinal=5 AND p_fixture<>'ofc-parcial') OR
    (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=v_lineage AND fixture_id=p_fixture)<>v_ordinal-1 THEN
    RAISE EXCEPTION 'DEMO_ACTION_ORDER_CONFLICT' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_previous FROM demo_flow_writer.events WHERE lineage_id=v_lineage AND fixture_id=p_fixture ORDER BY ordinal DESC LIMIT 1;
  v_input := demo_flow_writer.input_sha256(v_lineage,p_fixture);
  v_snapshot := demo_flow_writer.snapshot(v_binding.invoice_id);
  INSERT INTO demo_flow_writer.events(lineage_id,execution_run_id,fixture_id,action,ordinal,input_sha256,snapshot,snapshot_sha256,previous_event_id)
    VALUES(v_lineage,p_run,p_fixture,p_action,v_ordinal,v_input,v_snapshot,demo_flow_writer.sha256(v_snapshot),v_previous) RETURNING id INTO v_event;
  INSERT INTO demo_flow_writer.receipts(lineage_id,execution_run_id,fixture_id,action,event_id,input_sha256,snapshot_sha256)
    VALUES(v_lineage,p_run,p_fixture,p_action,v_event,v_input,demo_flow_writer.sha256(v_snapshot));
  RETURN v_event;
END $$;

CREATE FUNCTION demo_flow_writer.verify_approval_candidate(p_run uuid,p_fixture text,p_invoice uuid,p_expected timestamptz) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_lineage uuid; v_binding demo_flow_writer.bindings; v_invoice public.proveedor_facturas;
BEGIN
  v_lineage := (demo_flow_writer.authorize(p_run)).id;
  SELECT * INTO STRICT v_binding FROM demo_flow_writer.bindings WHERE lineage_id=v_lineage AND fixture_id=p_fixture FOR UPDATE;
  IF v_binding.invoice_id IS DISTINCT FROM p_invoice THEN RAISE EXCEPTION 'DEMO_APPROVAL_SCOPE' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.proveedor_facturas WHERE id=p_invoice FOR UPDATE;
  PERFORM demo_flow_writer.verify_identity(p_run);
  PERFORM demo_flow_writer.verify_fixture(p_run,p_fixture,3);
  SELECT * INTO STRICT v_invoice FROM public.proveedor_facturas WHERE id=p_invoice FOR UPDATE;
  IF v_invoice.created_by IS NOT NULL OR v_invoice.aprobada_por IS NOT NULL OR v_invoice.aprobada_at IS NOT NULL
    OR v_invoice.estado_aprobacion<>'pendiente' OR v_invoice.deleted_at IS NOT NULL
    OR v_invoice.updated_at IS DISTINCT FROM p_expected OR p_expected IS NULL THEN
    RAISE EXCEPTION 'DEMO_APPROVAL_CAS_CONFLICT' USING ERRCODE='PT409'; END IF;
END $$;

CREATE FUNCTION demo_flow_writer.execute(p_run uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$
DECLARE v_run demo_flow_writer.lineages; v_binding demo_flow_writer.bindings; v_identity demo_flow_writer.identity_receipts;
  v_fixture text; v_spec jsonb; v_concept jsonb; v_n integer; v_invoice public.proveedor_facturas; v_payment public.pagos_proveedor;
  v_event uuid; v_count integer;
BEGIN
  -- The public no-argument core and this direct internal entry both have a zero-mutation off path.
  IF NOT demo_flow_writer.enabled() THEN RETURN '{"status":"disabled"}'::jsonb; END IF;
  v_run := demo_flow_writer.authorize(p_run);
  -- Existing human edits lock the invoice before their shipment trigger. Keep that order on replay.
  PERFORM 1 FROM public.proveedor_facturas f JOIN demo_flow_writer.bindings b ON b.invoice_id=f.id
    WHERE b.lineage_id=v_run.id ORDER BY f.id FOR UPDATE OF f;
  PERFORM demo_flow_writer.verify_identity(p_run);
  SELECT * INTO STRICT v_identity FROM demo_flow_writer.identity_receipts WHERE lineage_id=v_run.id;
  SELECT count(*) INTO v_count FROM demo_flow_writer.receipts WHERE lineage_id=v_run.id;
  IF v_count<>0 THEN
    -- Atomic whole-run execution never commits a partial chain. Replay requires exact physical/history state.
    IF v_count<>13 THEN RAISE EXCEPTION 'DEMO_PARTIAL_RUN_CONFLICT' USING ERRCODE='42501'; END IF;
    PERFORM demo_flow_writer.verify_fixture(p_run,'aap-vencida',4);
    PERFORM demo_flow_writer.verify_fixture(p_run,'ttn-vigente',4);
    PERFORM demo_flow_writer.verify_fixture(p_run,'ofc-parcial',5);
    RETURN jsonb_build_object('status','replayed','run_id',p_run,'lineage_id',v_run.id);
  END IF;
  IF EXISTS (SELECT 1 FROM demo_flow_writer.fixture_claims WHERE lineage_id<>v_run.id) THEN
    RAISE EXCEPTION 'DEMO_CORE_FIXTURE_ALREADY_OWNED: no new copies or automatic cross-run adoption' USING ERRCODE='42501'; END IF;
  IF v_run.business_date IS DISTINCT FROM public.fecha_negocio_mx() THEN
    RAISE EXCEPTION 'DEMO_NEW_RUN_BUSINESS_DATE_CONFLICT' USING ERRCODE='23514'; END IF;
  -- No document is adopted, even if its content/name/RFC happens to match perfectly.
  IF EXISTS (SELECT 1 FROM demo_flow_writer.bindings b JOIN public.proveedor_facturas f ON f.id=b.invoice_id WHERE b.lineage_id=v_run.id)
    OR EXISTS (SELECT 1 FROM demo_flow_writer.bindings b JOIN public.proveedor_facturas_conceptos c ON c.id=ANY(b.concept_ids) WHERE b.lineage_id=v_run.id)
    OR EXISTS (SELECT 1 FROM demo_flow_writer.bindings b JOIN public.pagos_proveedor p ON p.id=b.payment_id WHERE b.lineage_id=v_run.id) THEN
    RAISE EXCEPTION 'DEMO_EXISTING_MANUAL_ID_CONFLICT' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.proveedor_facturas f WHERE f.organization_id=v_run.organization_id
      AND f.folio_proveedor IN ('SYNTHETIC-INVOICE-1','SYNTHETIC-INVOICE-2','SYNTHETIC-INVOICE-3')) THEN
    RAISE EXCEPTION 'DEMO_EXISTING_MANUAL_REFERENCE_CONFLICT: reject ambiguity, never adopt by folio' USING ERRCODE='42501'; END IF;
  INSERT INTO demo_flow_writer.fixture_claims(fixture_id,lineage_id,invoice_id)
    SELECT fixture_id,lineage_id,invoice_id FROM demo_flow_writer.bindings WHERE lineage_id=v_run.id;
  FOREACH v_fixture IN ARRAY ARRAY['aap-vencida','ttn-vigente','ofc-parcial'] LOOP
    v_run := demo_flow_writer.authorize(p_run);
    SELECT * INTO STRICT v_binding FROM demo_flow_writer.bindings WHERE lineage_id=v_run.id AND fixture_id=v_fixture FOR UPDATE;
    v_spec := demo_flow_writer.fixture_spec(v_fixture);
    INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,proveedor_nombre,embarque_id,folio_proveedor,rfc_proveedor,
      fecha_emision,fecha_vencimiento,dias_credito,moneda,subtotal,iva,total,estado,estado_aprobacion,
      aprobada_por,aprobada_at,created_by,categoria_presupuesto_id,origen_carga,notas)
    VALUES(v_binding.invoice_id,v_run.organization_id,v_binding.supplier_id,v_spec->>'supplierName',v_binding.shipment_id,
      v_spec->>'folio',v_spec->>'rfc',v_run.business_date+(v_spec->>'issuedOffset')::integer,
      v_run.business_date+(v_spec->>'dueOffset')::integer,(v_spec->>'creditDays')::integer,
      'MXN', (v_spec->>'subtotal')::numeric,(v_spec->>'vat')::numeric,(v_spec->>'total')::numeric,
      'Vigente','pendiente',NULL,NULL,NULL,v_identity.category_id,'manual',v_spec->>'notes') RETURNING * INTO v_invoice;
    PERFORM demo_flow_writer.record_action(p_run,v_fixture,'pending_header');
    v_n:=0;
    FOR v_concept IN SELECT value FROM jsonb_array_elements(v_spec->'concepts') LOOP
      v_n:=v_n+1;
      INSERT INTO public.proveedor_facturas_conceptos(id,organization_id,proveedor_factura_id,descripcion,cantidad,monto)
        VALUES(v_binding.concept_ids[v_n],v_run.organization_id,v_binding.invoice_id,v_concept->>'description',
          (v_concept->>'quantity')::numeric,(v_concept->>'amount')::numeric);
    END LOOP;
    PERFORM demo_flow_writer.record_action(p_run,v_fixture,'concepts');
    SELECT * INTO STRICT v_invoice FROM public.proveedor_facturas WHERE id=v_binding.invoice_id FOR UPDATE;
    -- This exact revision includes every concept trigger. No stale pre-concept approval/CAS timestamp.
    PERFORM demo_flow_writer.record_action(p_run,v_fixture,'final_version');
    v_invoice:=demo_flow_writer.common_approval(v_binding.invoice_id,true,NULL,v_invoice.updated_at,p_run,v_fixture);
    IF v_fixture='ofc-parcial' THEN
      PERFORM demo_flow_writer.verify_fixture(p_run,v_fixture,4);
      PERFORM demo_flow_writer.authorize(p_run);
      -- Ordinary INSERT: guard_pago_proveedor and all canonical approval/date/tax/period/saldo triggers stay intact.
      -- No RPC, SELECT trigger function, bank account, real movement, REP, timbrado, adjustment or bypass.
      INSERT INTO public.pagos_proveedor(id,organization_id,proveedor_factura_id,fecha_pago,monto,moneda,metodo_pago,referencia,notas,
        created_by,cuenta_bancaria_id,lote_id,client_request_id,es_ajuste,es_anticipo_aplicado)
      VALUES(v_binding.payment_id,v_run.organization_id,v_binding.invoice_id,v_run.business_date-3,20000,'MXN',
        'Transferencia','DEMO-PAGO-001','Pago parcial demo',NULL,NULL,NULL,v_binding.payment_id,false,false) RETURNING * INTO v_payment;
      IF v_payment.cuenta_bancaria_id IS NOT NULL OR v_payment.created_by IS NOT NULL OR v_payment.es_ajuste
         OR v_payment.monto_en_moneda_factura IS DISTINCT FROM 20000::numeric
         OR EXISTS (SELECT 1 FROM public.bbva_movimientos m WHERE m.pago_proveedor_id=v_payment.id) THEN
        RAISE EXCEPTION 'DEMO_PAYMENT_SIMULATION_CONFLICT' USING ERRCODE='23514'; END IF;
      v_event:=demo_flow_writer.record_action(p_run,v_fixture,'simulated_payment');
      INSERT INTO demo_flow_writer.simulated_payments(payment_id,lineage_id,fixture_id,event_id)
        VALUES(v_payment.id,v_run.id,v_fixture,v_event);
    END IF;
    PERFORM demo_flow_writer.verify_fixture(p_run,v_fixture,CASE WHEN v_fixture='ofc-parcial' THEN 5 ELSE 4 END);
  END LOOP;
  PERFORM demo_flow_writer.authorize(p_run);
  RETURN jsonb_build_object('status','executed','run_id',p_run,'lineage_id',v_run.id,'invoices',3,'simulated_payments',1);
END $$;

-- Read-only readiness: a recent legacy marker must never invoke the operational writer.
CREATE FUNCTION demo_flow_writer.verify_materialized(p_run uuid) RETURNS demo_flow_writer.lineages
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE v_lineage demo_flow_writer.lineages;
BEGIN
  v_lineage:=demo_flow_writer.authorize(p_run);
  PERFORM 1 FROM public.proveedor_facturas f JOIN demo_flow_writer.bindings b ON b.invoice_id=f.id
    WHERE b.lineage_id=v_lineage.id ORDER BY f.id FOR UPDATE OF f;
  PERFORM demo_flow_writer.verify_identity(p_run);
  IF (SELECT count(*) FROM demo_flow_writer.events WHERE lineage_id=v_lineage.id)<>13
    OR (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=v_lineage.id)<>13
    OR (SELECT count(*) FROM demo_flow_writer.fixture_claims WHERE lineage_id=v_lineage.id)<>3 THEN
    RAISE EXCEPTION 'DEMO_RECENT_NOT_VERIFIED' USING ERRCODE='42501'; END IF;
  PERFORM demo_flow_writer.verify_fixture(p_run,'aap-vencida',4);
  PERFORM demo_flow_writer.verify_fixture(p_run,'ttn-vigente',4);
  PERFORM demo_flow_writer.verify_fixture(p_run,'ofc-parcial',5);
  PERFORM demo_flow_writer.authorize(p_run);
  RETURN v_lineage;
END $fn$;
CREATE FUNCTION demo_flow_writer.execute_active_command() RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$ DECLARE v_run uuid; BEGIN
  IF NOT demo_flow_writer.enabled() THEN RETURN '{"status":"disabled"}'::jsonb; END IF;
  -- Direct core cannot select an organization/actor/run from public payload or infer an identity.
  IF NOT demo_flow_writer.entry_gate() THEN RETURN '{"status":"disabled"}'::jsonb; END IF;
  SELECT run_id INTO v_run FROM demo_flow_writer.active_command WHERE singleton FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_PROTECTED_COMMAND_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN demo_flow_writer.execute(v_run);
END $$;
CREATE FUNCTION demo_flow_writer.verified_event_actor(p_event uuid) RETURNS text LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$
  SELECT 'Generador de demo'::text FROM demo_flow_writer.events e JOIN demo_flow_writer.lineages r ON r.id=e.lineage_id
  JOIN demo_flow_writer.runs origin_run ON origin_run.id=e.execution_run_id AND origin_run.lineage_id=e.lineage_id
  JOIN demo_flow_writer.bindings b ON (b.lineage_id,b.fixture_id)=(e.lineage_id,e.fixture_id)
  JOIN demo_flow_writer.fixture_claims c ON (c.lineage_id,c.fixture_id,c.invoice_id)=(b.lineage_id,b.fixture_id,b.invoice_id)
  JOIN demo_flow_writer.receipts q ON (q.lineage_id,q.fixture_id,q.action,q.event_id,q.execution_run_id,q.input_sha256,q.snapshot_sha256)
    =(e.lineage_id,e.fixture_id,e.action,e.id,e.execution_run_id,e.input_sha256,e.snapshot_sha256)
  JOIN demo_flow_writer.identity_receipts i ON i.lineage_id=r.id
  WHERE e.id=p_event AND r.organization_id='00000000-0000-4000-8000-000000000001' AND r.manifest_version='seed-core-cxp-v1'
    AND r.manifest_sha256=demo_flow_writer.manifest_sha256() AND b.fixture_sha256=demo_flow_writer.sha256(demo_flow_writer.fixture_spec(b.fixture_id))
    AND origin_run.purpose='initial' AND origin_run.id=r.initial_run_id
    AND e.created_at>=origin_run.not_before AND e.created_at<origin_run.issued_expires_at
    AND origin_run.lineage_sha256=demo_flow_writer.lineage_sha256(e.lineage_id)
    AND e.actor_key='demo_generator' AND e.input_sha256=demo_flow_writer.input_sha256(e.lineage_id,e.fixture_id)
    AND i.source_sha256=demo_flow_writer.sha256(to_jsonb(i)-'source_sha256')
    AND i.bindings_sha256=(SELECT demo_flow_writer.sha256(jsonb_agg(to_jsonb(b2) ORDER BY b2.fixture_id)) FROM demo_flow_writer.bindings b2 WHERE b2.lineage_id=r.id)
    AND e.snapshot->'invoice'->>'id'=b.invoice_id::text AND e.snapshot->'invoice'->>'organization_id'=r.organization_id::text;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
