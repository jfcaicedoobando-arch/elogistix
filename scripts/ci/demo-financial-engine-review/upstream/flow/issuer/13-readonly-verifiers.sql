-- Generated strict read-only projection checks; no live run authorization needed. REVIEW ONLY.
BEGIN;
CREATE FUNCTION demo_flow_writer.verify_identity_readonly(p_lineage uuid) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$
DECLARE v_identity demo_flow_writer.identity_receipts; v_binding demo_flow_writer.bindings;
  v_supplier public.proveedores; v_shipment public.embarques; v_category public.presupuesto_categorias; v_spec jsonb; v_run demo_flow_writer.lineages;
BEGIN
  SELECT * INTO STRICT v_run FROM demo_flow_writer.lineages WHERE id=p_lineage;
  SELECT * INTO STRICT v_identity FROM demo_flow_writer.identity_receipts WHERE lineage_id=v_run.id;
  IF v_identity.source_sha256 IS DISTINCT FROM demo_flow_writer.sha256(to_jsonb(v_identity)-'source_sha256')
     OR v_identity.bindings_sha256 IS DISTINCT FROM (SELECT demo_flow_writer.sha256(jsonb_agg(to_jsonb(b) ORDER BY b.fixture_id))
       FROM demo_flow_writer.bindings b WHERE b.lineage_id=v_run.id) THEN
    RAISE EXCEPTION 'DEMO_IDENTITY_RECEIPT_CONFLICT' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_category FROM public.presupuesto_categorias WHERE id=v_identity.category_id;
  IF NOT FOUND OR v_category.organization_id<>v_run.organization_id OR NOT v_category.activa
     OR v_category.nombre<>'Sin categoría' OR to_jsonb(v_category) IS DISTINCT FROM v_identity.category_snapshot THEN
    RAISE EXCEPTION 'DEMO_CATEGORY_PROVENANCE_CONFLICT' USING ERRCODE='42501'; END IF;
  FOR v_binding IN SELECT * FROM demo_flow_writer.bindings WHERE lineage_id=v_run.id ORDER BY fixture_id LOOP
    v_spec := demo_flow_writer.fixture_spec(v_binding.fixture_id);
    IF v_binding.fixture_sha256 IS DISTINCT FROM demo_flow_writer.sha256(v_spec) THEN
      RAISE EXCEPTION 'DEMO_FIXTURE_CONTENT_CONFLICT' USING ERRCODE='22023'; END IF;
    SELECT * INTO v_supplier FROM public.proveedores WHERE id=v_binding.supplier_id;
    IF NOT FOUND OR v_supplier.organization_id<>v_run.organization_id OR v_supplier.deleted_at IS NOT NULL
       OR v_supplier.estado_alta<>'aprobado'
       OR v_supplier.nombre IS DISTINCT FROM demo_flow_writer.normalized_supplier_name(v_spec->>'supplierName')
       OR v_supplier.rfc IS DISTINCT FROM v_spec->>'supplierRFC'
       OR to_jsonb(v_supplier) IS DISTINCT FROM v_binding.supplier_snapshot THEN
      RAISE EXCEPTION 'DEMO_SUPPLIER_PROVENANCE_CONFLICT' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_shipment FROM public.embarques WHERE id=v_binding.shipment_id;
    IF NOT FOUND OR v_shipment.organization_id<>v_run.organization_id OR v_shipment.deleted_at IS NOT NULL
       OR v_shipment.estado::text='Cancelado' OR v_shipment.expediente IS DISTINCT FROM v_spec->>'shipmentExpediente'
       OR to_jsonb(v_shipment) IS DISTINCT FROM v_binding.shipment_snapshot THEN
      RAISE EXCEPTION 'DEMO_SHIPMENT_PROVENANCE_CONFLICT' USING ERRCODE='42501'; END IF;
    IF (SELECT count(DISTINCT x) FROM unnest(v_binding.concept_ids) x) <> cardinality(v_binding.concept_ids) THEN
      RAISE EXCEPTION 'DEMO_DUPLICATE_CONCEPT_ID' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT x) FROM demo_flow_writer.bindings b CROSS JOIN LATERAL unnest(b.concept_ids) x WHERE lineage_id=v_run.id)<>5 THEN
    RAISE EXCEPTION 'DEMO_DUPLICATE_CONCEPT_ID' USING ERRCODE='22023'; END IF;
END $$;

CREATE FUNCTION demo_flow_writer.verify_fixture_readonly(p_lineage uuid,p_fixture text,p_stage integer) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_lineage uuid; v_binding demo_flow_writer.bindings; v_last demo_flow_writer.events; v_hash text; v_count integer;
BEGIN
  v_lineage := p_lineage;
  SELECT * INTO STRICT v_binding FROM demo_flow_writer.bindings WHERE lineage_id=v_lineage AND fixture_id=p_fixture;
  IF NOT EXISTS(SELECT 1 FROM demo_flow_writer.fixture_claims WHERE lineage_id=v_lineage AND fixture_id=p_fixture AND invoice_id=v_binding.invoice_id) THEN
    RAISE EXCEPTION 'DEMO_CLAIM_PROVENANCE_CONFLICT' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.proveedor_facturas WHERE id=v_binding.invoice_id;
  PERFORM 1 FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id=v_binding.invoice_id ORDER BY id;
  PERFORM 1 FROM public.pagos_proveedor WHERE proveedor_factura_id=v_binding.invoice_id ORDER BY id;
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
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
