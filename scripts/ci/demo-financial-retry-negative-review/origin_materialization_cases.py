"""Source-origin and public-row drift cases, prepared for review; SQL NOT_RUN.

Each materialized case requires the executor's real first materialization and
unchanged successful same-context retry, with deferred guards drained.  The
executor then applies one ordinary public-row UPDATE, measures the resulting
row before the negative RPC, checks its native exact error, proves all rows are
preserved, and rolls back.  Immutable private provenance is never rewritten.
"""

from __future__ import annotations


def _origin_snapshot(receipt_ref: str) -> str:
    """Read the immutable producer chain without changing its serialization."""
    return """jsonb_build_object(
 'prepared_receipt',(SELECT to_jsonb(p) FROM demo_fixture_identity.prepared_receipts p
   WHERE p.receipt_id={receipt}),
 'preparation_run',(SELECT to_jsonb(r) FROM demo_fixture_identity.preparation_runs r
   WHERE r.receipt_id={receipt}),
 'preparation_admission',(SELECT to_jsonb(a)
   FROM demo_fixture_identity.preparation_runs r
   JOIN demo_fixture_identity.preparation_admissions a ON a.id=r.admission_id
   WHERE r.receipt_id={receipt}),
 'preparation_bindings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.fixture_id)
   FROM demo_fixture_identity.preparation_runs r
   JOIN demo_fixture_identity.preparation_bindings b ON b.admission_id=r.admission_id
   WHERE r.receipt_id={receipt}))""".format(receipt=receipt_ref)


_SUPPLIER_TRIGGERS = """
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.proveedores'::regclass
   AND NOT tgisinternal AND tgenabled IS DISTINCT FROM 'O')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.proveedores'::regclass
   AND tgname='update_proveedores_updated_at' AND NOT tgisinternal AND tgenabled='O')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgrelid='demo_fixture_identity.prepared_receipts'::regclass
   AND tgname='immutable_preparation_receipt' AND NOT tgisinternal AND tgenabled='O')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgrelid='demo_fixture_identity.preparation_admissions'::regclass
   AND tgname='immutable_admission' AND NOT tgisinternal AND tgenabled='O')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgrelid='demo_fixture_identity.preparation_bindings'::regclass
   AND tgname='immutable_admission_bindings' AND NOT tgisinternal AND tgenabled='O') THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_ORIGIN_TRIGGERS_REQUIRED';
 END IF;
"""


_SUPPLIER_MUTATION = """
CREATE TEMP TABLE retry_negative_supplier_origin_proof AS
 SELECT c.context_id,a.identity_receipt_id receipt_id,b.supplier_id,
   to_jsonb(s) before_snapshot,NULL::jsonb after_snapshot,
   """ + _origin_snapshot("a.identity_receipt_id") + """ origin_snapshot
 FROM pg_temp.financial_context c
 JOIN demo_flow_writer.server_admissions a ON a.context_id=c.context_id
 JOIN demo_flow_writer.authorization_receipts ar ON ar.context_id=c.context_id
 JOIN demo_flow_writer.bindings b ON b.lineage_id=ar.lineage_id
 JOIN public.proveedores s ON s.id=b.supplier_id
 WHERE b.fixture_id='aap-vencida';
DO $retry_negative_supplier_mutation$
DECLARE v record; measured jsonb; affected integer;
BEGIN
 SELECT * INTO STRICT v FROM pg_temp.retry_negative_supplier_origin_proof;
 PERFORM demo_fixture_identity.verify_preparation_origin(v.receipt_id);
""" + _SUPPLIER_TRIGGERS + """
 -- Public provenance dependency remains mutable.  Its admitted immutable
 -- snapshot stays untouched, so the next origin check must observe the drift.
 UPDATE public.proveedores SET dias_credito=dias_credito+1 WHERE id=v.supplier_id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 SELECT to_jsonb(s) INTO STRICT measured FROM public.proveedores s WHERE s.id=v.supplier_id;
 IF affected<>1
 OR (measured->>'dias_credito')::integer IS DISTINCT FROM
   (v.before_snapshot->>'dias_credito')::integer+1
 OR (measured-ARRAY['dias_credito','updated_at']) IS DISTINCT FROM
   (v.before_snapshot-ARRAY['dias_credito','updated_at'])
 OR measured IS NOT DISTINCT FROM v.before_snapshot
 OR """ + _origin_snapshot("v.receipt_id") + """ IS DISTINCT FROM v.origin_snapshot THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_SUPPLIER_DRIFT_NOT_MATERIALIZED';
 END IF;
 UPDATE pg_temp.retry_negative_supplier_origin_proof SET after_snapshot=measured;
END $retry_negative_supplier_mutation$;
"""


_SUPPLIER_PROOF = """
DO $retry_negative_supplier_proof$
DECLARE v record; measured jsonb;
BEGIN
 SELECT * INTO STRICT v FROM pg_temp.retry_negative_supplier_origin_proof;
 SELECT to_jsonb(s) INTO STRICT measured FROM public.proveedores s WHERE s.id=v.supplier_id;
 IF v.after_snapshot IS NULL OR measured IS DISTINCT FROM v.after_snapshot
 OR measured IS NOT DISTINCT FROM v.before_snapshot
 OR """ + _origin_snapshot("v.receipt_id") + """ IS DISTINCT FROM v.origin_snapshot THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_SUPPLIER_ORIGIN_CHANGED_AFTER_DENIAL';
 END IF;
""" + _SUPPLIER_TRIGGERS + """
END $retry_negative_supplier_proof$;
"""


_FOLIO_TRIGGERS = """
 IF EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgrelid='public.proveedor_facturas'::regclass AND NOT tgisinternal
   AND tgenabled IS DISTINCT FROM 'O')
 OR (SELECT count(*) FROM pg_trigger
   WHERE tgrelid='public.proveedor_facturas'::regclass AND NOT tgisinternal
   AND tgname IN('trg_cxp_edicion_sensible','trg_proveedor_facturas_updated',
     'trg_proveedor_facturas_dedupe_folio','trg_proveedor_facturas_folio_unico',
     'trg_cierre_financiero','trg_periodo_proveedor_facturas'))<>6 THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_CANONICAL_FOLIO_TRIGGERS_REQUIRED';
 END IF;
"""


_FOLIO_MUTATION = """
CREATE TEMP TABLE retry_negative_materialized_folio_proof AS
 SELECT c.context_id,a.identity_receipt_id receipt_id,b.lineage_id,b.fixture_id,b.invoice_id,
   to_jsonb(f) before_snapshot,NULL::jsonb after_snapshot,
   f.folio_proveedor||'-retry-negative-drift' expected_folio,
   e.id last_event_id,to_jsonb(e) last_event_snapshot,
   """ + _origin_snapshot("a.identity_receipt_id") + """ origin_snapshot
 FROM pg_temp.financial_context c
 JOIN demo_flow_writer.server_admissions a ON a.context_id=c.context_id
 JOIN demo_flow_writer.authorization_receipts ar ON ar.context_id=c.context_id
 JOIN demo_flow_writer.bindings b ON b.lineage_id=ar.lineage_id
 JOIN public.proveedor_facturas f ON f.id=b.invoice_id
 JOIN LATERAL (SELECT * FROM demo_flow_writer.events e
   WHERE e.lineage_id=b.lineage_id AND e.fixture_id=b.fixture_id
   ORDER BY e.ordinal DESC LIMIT 1) e ON true
 WHERE b.fixture_id='aap-vencida';
DO $retry_negative_folio_mutation$
DECLARE v record; measured jsonb; affected integer;
BEGIN
 SELECT * INTO STRICT v FROM pg_temp.retry_negative_materialized_folio_proof;
 PERFORM demo_fixture_identity.verify_preparation_origin(v.receipt_id);
 IF v.before_snapshot->>'estado_aprobacion' IS DISTINCT FROM 'aprobada'
 OR demo_flow_writer.snapshot(v.invoice_id) IS DISTINCT FROM
   v.last_event_snapshot->'snapshot' THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_VERIFIED_MATERIALIZATION_REQUIRED';
 END IF;
""" + _FOLIO_TRIGGERS + """
 -- The canonical sensitive-edit guard resets approval and the version trigger
 -- advances updated_at.  No private event/receipt is edited or removed.
 UPDATE public.proveedor_facturas SET folio_proveedor=v.expected_folio WHERE id=v.invoice_id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 SELECT to_jsonb(f) INTO STRICT measured FROM public.proveedor_facturas f WHERE f.id=v.invoice_id;
 IF affected<>1 OR measured->>'folio_proveedor' IS DISTINCT FROM v.expected_folio
 OR measured->>'estado_aprobacion' IS DISTINCT FROM 'pendiente'
 OR measured->>'aprobada_por' IS NOT NULL OR measured->>'aprobada_at' IS NOT NULL
 OR (measured->>'aprobacion_heredada')::boolean IS DISTINCT FROM false
 OR (measured->>'updated_at')::timestamptz<=(v.before_snapshot->>'updated_at')::timestamptz
 OR (measured-ARRAY['folio_proveedor','updated_at','estado_aprobacion',
     'aprobada_por','aprobada_at','aprobacion_heredada']) IS DISTINCT FROM
   (v.before_snapshot-ARRAY['folio_proveedor','updated_at','estado_aprobacion',
     'aprobada_por','aprobada_at','aprobacion_heredada'])
 OR demo_flow_writer.snapshot(v.invoice_id) IS NOT DISTINCT FROM
   v.last_event_snapshot->'snapshot'
 OR (SELECT to_jsonb(e) FROM demo_flow_writer.events e WHERE e.id=v.last_event_id)
   IS DISTINCT FROM v.last_event_snapshot
 OR """ + _origin_snapshot("v.receipt_id") + """ IS DISTINCT FROM v.origin_snapshot THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_PUBLIC_DOCUMENT_DRIFT_NOT_MATERIALIZED';
 END IF;
 UPDATE pg_temp.retry_negative_materialized_folio_proof SET after_snapshot=measured;
END $retry_negative_folio_mutation$;
"""


_FOLIO_PROOF = """
DO $retry_negative_folio_proof$
DECLARE v record; measured jsonb;
BEGIN
 SELECT * INTO STRICT v FROM pg_temp.retry_negative_materialized_folio_proof;
 SELECT to_jsonb(f) INTO STRICT measured FROM public.proveedor_facturas f WHERE f.id=v.invoice_id;
 IF v.after_snapshot IS NULL OR measured IS DISTINCT FROM v.after_snapshot
 OR measured IS NOT DISTINCT FROM v.before_snapshot
 OR (SELECT to_jsonb(e) FROM demo_flow_writer.events e WHERE e.id=v.last_event_id)
   IS DISTINCT FROM v.last_event_snapshot
 OR """ + _origin_snapshot("v.receipt_id") + """ IS DISTINCT FROM v.origin_snapshot THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_PUBLIC_DOCUMENT_CHANGED_AFTER_DENIAL';
 END IF;
""" + _FOLIO_TRIGGERS + """
END $retry_negative_folio_proof$;
"""


CASES = (
    {
        "id": "mutable_supplier_origin_drift",
        "phase": "materialized",
        "category": "origin_drift",
        "mutation_sql": _SUPPLIER_MUTATION,
        "expected_sqlstate": "23514",
        "expected_message": "DEMO_ADMITTED_SUPPLIER_DRIFT",
        "proof_sql": _SUPPLIER_PROOF,
    },
    {
        "id": "materialized_invoice_folio_drift",
        "phase": "materialized",
        "category": "materialization_drift",
        "mutation_sql": _FOLIO_MUTATION,
        "expected_sqlstate": "PT409",
        "expected_message": "DEMO_DOCUMENT_DIVERGED",
        "proof_sql": _FOLIO_PROOF,
    },
)
