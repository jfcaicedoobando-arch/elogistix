"""Prepared, unexecuted foreign-invoice adoption denial for the retry review.

The executor supplies the authentic fixture and pg_temp.financial_context, runs
the mutation as the existing owner, snapshots every persistent row, invokes the
real RPC as service_role, checks the exact native denial, and rolls back.  This
module creates no receipt, admission, authorization, financial UUID or bypass.

Concept-ID and payment-ID collisions are intentionally unprepared / NOT_RUN.
Their parent/approval prerequisites must be constructed through canonical paths
before claiming independent coverage of those two bridge branches.
"""

from __future__ import annotations


_INVOICE_TRIGGER_ASSERT = """
 IF EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgrelid='public.proveedor_facturas'::regclass AND NOT tgisinternal
   AND tgenabled IS DISTINCT FROM 'O')
 OR (SELECT count(*) FROM pg_trigger
   WHERE tgrelid='public.proveedor_facturas'::regclass AND NOT tgisinternal
   AND tgname IN('trg_org_proveedor_facturas_embarque_id',
     'trg_org_proveedor_facturas_proveedor_id','trg_proveedor_factura_no_provisional',
     'trg_proveedor_facturas_total_guard','trg_proveedor_facturas_set_fecha_vencimiento',
     'trg_periodo_proveedor_facturas','trg_set_folio_interno_proveedor_factura',
     'trg_proveedor_facturas_dedupe_folio','trg_proveedor_facturas_folio_unico',
     'trg_cierre_financiero'))<>10 THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_CANONICAL_INVOICE_TRIGGERS_REQUIRED';
 END IF;
"""


_MUTATION = """
CREATE TEMP TABLE retry_negative_adoption_invoice_proof AS
 SELECT c.context_id,p.receipt_id,to_jsonb(p) prepared_receipt_snapshot,
   p.payload,b.value binding,NULL::jsonb foreign_invoice_snapshot
 FROM pg_temp.financial_context c
 JOIN demo_flow_writer.server_admissions a ON a.context_id=c.context_id
 JOIN demo_fixture_identity.prepared_receipts p ON p.receipt_id=a.identity_receipt_id
 CROSS JOIN LATERAL jsonb_array_elements(p.payload->'bindings') b(value)
 WHERE b.value->>'fixture_id'='aap-vencida';
DO $retry_negative_adoption_mutation$
DECLARE v record; s jsonb; inserted_id uuid; measured jsonb;
BEGIN
 SELECT * INTO STRICT v FROM pg_temp.retry_negative_adoption_invoice_proof;
 IF EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts
   WHERE context_id=v.context_id)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.fixture_claims
   WHERE invoice_id=(v.binding->>'invoice_id')::uuid) THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_FRESH_UNCLAIMED_CONTEXT_REQUIRED';
 END IF;
 -- This succeeds before the collision: the authentic producer's origin, row
 -- snapshots and all generated UUIDs must already be valid and unoccupied.
 PERFORM demo_flow_writer.verify_identity_receipt(v.receipt_id);
""" + _INVOICE_TRIGGER_ASSERT + """
 s:=demo_flow_writer.fixture_spec(v.binding->>'fixture_id');
 -- The ordinary header INSERT is the canonical engine contract.  Only its ID
 -- comes from the measured prepared receipt.  Equal content is still foreign:
 -- this row has no writer claim, event, approval or execution receipt.
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,proveedor_nombre,
   embarque_id,folio_proveedor,rfc_proveedor,fecha_emision,fecha_vencimiento,dias_credito,
   moneda,subtotal,iva,total,estado,estado_aprobacion,aprobada_por,aprobada_at,created_by,
   categoria_presupuesto_id,origen_carga,notas)
 VALUES((v.binding->>'invoice_id')::uuid,(v.payload->>'organization_id')::uuid,
   (v.binding->>'supplier_id')::uuid,s->>'supplierName',(v.binding->>'shipment_id')::uuid,
   s->>'folio',s->>'rfc',public.fecha_negocio_mx()+(s->>'issuedOffset')::integer,
   public.fecha_negocio_mx()+(s->>'dueOffset')::integer,(s->>'creditDays')::integer,
   'MXN',(s->>'subtotal')::numeric,(s->>'vat')::numeric,(s->>'total')::numeric,
   'Vigente','pendiente',NULL,NULL,NULL,(v.payload->>'category_id')::uuid,
   'manual',s->>'notes') RETURNING id INTO inserted_id;
 SELECT to_jsonb(f) INTO STRICT measured FROM public.proveedor_facturas f
   WHERE f.id=inserted_id;
 IF inserted_id IS DISTINCT FROM (v.binding->>'invoice_id')::uuid
 OR measured->>'estado_aprobacion' IS DISTINCT FROM 'pendiente'
 OR (measured->>'subtotal')::numeric IS DISTINCT FROM (s->>'subtotal')::numeric
 OR (measured->>'iva')::numeric IS DISTINCT FROM (s->>'vat')::numeric
 OR (measured->>'total')::numeric IS DISTINCT FROM (s->>'total')::numeric
 OR measured->>'folio_proveedor' IS DISTINCT FROM s->>'folio'
 OR measured->>'created_by' IS NOT NULL OR measured->>'aprobada_por' IS NOT NULL
 OR measured->>'aprobada_at' IS NOT NULL THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_FOREIGN_INVOICE_NOT_MATERIALIZED';
 END IF;
 UPDATE pg_temp.retry_negative_adoption_invoice_proof
   SET foreign_invoice_snapshot=measured;
END $retry_negative_adoption_mutation$;
"""


_PROOF = """
DO $retry_negative_adoption_proof$
DECLARE v record; measured jsonb;
BEGIN
 SELECT * INTO STRICT v FROM pg_temp.retry_negative_adoption_invoice_proof;
 SELECT to_jsonb(f) INTO STRICT measured FROM public.proveedor_facturas f
   WHERE f.id=(v.binding->>'invoice_id')::uuid;
 IF v.foreign_invoice_snapshot IS NULL
 OR measured IS DISTINCT FROM v.foreign_invoice_snapshot
 OR (SELECT to_jsonb(p) FROM demo_fixture_identity.prepared_receipts p
   WHERE p.receipt_id=v.receipt_id) IS DISTINCT FROM v.prepared_receipt_snapshot
 OR EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts
   WHERE context_id=v.context_id)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.fixture_claims
   WHERE invoice_id=(v.binding->>'invoice_id')::uuid)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.events e
   WHERE e.snapshot->'invoice'->>'id'=v.binding->>'invoice_id') THEN
  RAISE EXCEPTION 'RETRY_NEGATIVE_FOREIGN_INVOICE_CHANGED_OR_ADOPTED';
 END IF;
""" + _INVOICE_TRIGGER_ASSERT + """
END $retry_negative_adoption_proof$;
"""


CASES = (
    {
        "id": "foreign_bound_invoice_id",
        "phase": "fresh",
        "category": "foreign_financial_adoption",
        "mutation_sql": _MUTATION,
        "expected_sqlstate": "23514",
        "expected_message": "DEMO_FINANCIAL_ADOPTION_DENIED",
        "proof_sql": _PROOF,
    },
)
