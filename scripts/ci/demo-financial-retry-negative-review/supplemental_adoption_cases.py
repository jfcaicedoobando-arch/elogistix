"""Independent concept/payment adoption cases: PREPARED, SQL NOT_RUN.

These two fresh cases supplement the delivered nine without modifying their
provider, fixtures, runner, or cases.  Use the same CASES fragment interface and
the existing author's isolated synthetic-lab executor, full table-row snapshots,
exact native RPC rejection, deferred guards, and outer ROLLBACK.

All collision IDs come from the authentic prepared receipt.  Auxiliary invoice
and concept IDs come only from ordinary canonical column DEFAULTs, measured by
RETURNING.  Neither case creates a private claim, lineage, event, or receipt.

Payment prerequisite: the exact synthetic actor fixture and already admitted
scheduler sponsor must exist.  The existing common_approval human branch runs
with that sponsor's synthetic auth_context, canonical roles/membership, live
shipment, source concepts, and measured post-concept invoice version.  It alone
sets its approval guard and writes the canonical human audit.  The auth fixture
is restored before the mandatory second positive verify_identity_receipt call,
immediately before the target INSERT.  This is synthetic actor support, not
external authentication evidence.  Any failed auxiliary guard or source-origin
check stops the case outside the expected-error handler.
"""

from __future__ import annotations


_TRIGGER_ASSERT = """
 IF current_setting('session_replication_role') IS DISTINCT FROM 'origin'
 OR EXISTS(SELECT 1 FROM pg_trigger t WHERE NOT t.tgisinternal
   AND t.tgrelid IN('public.proveedor_facturas'::regclass,
     'public.proveedor_facturas_conceptos'::regclass,'public.pagos_proveedor'::regclass,
     'public.proveedores'::regclass,'public.embarques'::regclass)
   AND t.tgenabled IS DISTINCT FROM 'O')
 OR EXISTS(SELECT 1 FROM (VALUES
   ('public.proveedor_facturas'::regclass,'trg_org_proveedor_facturas_proveedor_id'),
   ('public.proveedor_facturas'::regclass,'trg_org_proveedor_facturas_embarque_id'),
   ('public.proveedor_facturas'::regclass,'trg_proveedor_factura_no_provisional'),
   ('public.proveedor_facturas'::regclass,'trg_proveedor_facturas_total_guard'),
   ('public.proveedor_facturas'::regclass,'trg_guard_aprobacion_proveedor_factura'),
   ('public.proveedor_facturas'::regclass,'trg_cxp_edicion_sensible'),
   ('public.proveedor_facturas'::regclass,'trg_proveedor_facturas_updated'),
   ('public.proveedor_facturas'::regclass,'trg_periodo_proveedor_facturas'),
   ('public.proveedor_facturas_conceptos'::regclass,'trg_cxp_versionar_conceptos'),
   ('public.proveedor_facturas_conceptos'::regclass,'trg_org_pfc_proveedor_factura_id'),
   ('public.proveedor_facturas_conceptos'::regclass,'trg_pfc_validar_vinculo_costo'),
   ('public.pagos_proveedor'::regclass,'pagos_proveedor_requiere_aprobacion'),
   ('public.pagos_proveedor'::regclass,'trg_org_pagos_proveedor_proveedor_factura_id'),
   ('public.pagos_proveedor'::regclass,'trg_pago_proveedor_factura_viva'),
   ('public.pagos_proveedor'::regclass,'trg_pago_proveedor_no_provisional'),
   ('public.pagos_proveedor'::regclass,'trg_pagos_proveedor_guard'),
   ('public.pagos_proveedor'::regclass,'trg_periodo_pagos_proveedor'),
   ('public.pagos_proveedor'::regclass,'trg_00_pago_clasificacion')
 ) needed(relation_id,trigger_name) WHERE NOT EXISTS(SELECT 1 FROM pg_trigger t
   WHERE t.tgrelid=needed.relation_id AND t.tgname=needed.trigger_name
   AND NOT t.tgisinternal AND t.tgenabled='O')) THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_CANONICAL_TRIGGERS_REQUIRED';
 END IF;
"""


_BOUND_IDS = """
 SELECT array_agg(x.id) INTO bound_ids FROM (
   SELECT (b.value->>'invoice_id')::uuid id FROM jsonb_array_elements(v.payload->'bindings') b(value)
   UNION ALL SELECT (b.value->>'payment_id')::uuid
     FROM jsonb_array_elements(v.payload->'bindings') b(value)
     WHERE b.value->>'payment_id' IS NOT NULL
   UNION ALL SELECT x.value::uuid FROM jsonb_array_elements(v.payload->'bindings') b(value)
     CROSS JOIN LATERAL jsonb_array_elements_text(b.value->'concept_ids') x(value)
 ) x;
 IF cardinality(bound_ids) IS DISTINCT FROM 9
 OR array_position(bound_ids,NULL) IS NOT NULL
 OR (SELECT count(DISTINCT x) FROM unnest(bound_ids) x)<>9 THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_NINE_PREPARED_FINANCIAL_IDS_REQUIRED';
 END IF;
"""


_NO_PRIVATE_MATERIALIZATION = """
 IF EXISTS(SELECT 1 FROM demo_flow_writer.runs)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.lineages)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.bindings)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.identity_receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.fixture_claims)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.events)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.current_approvals)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.simulated_payments)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.execution_receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints) THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_FRESH_NO_PRIVATE_MATERIALIZATION_REQUIRED';
 END IF;
"""


_AUXILIARY_HEADER = """
 -- The canonical engine header contract with id omitted: the table's ordinary
 -- UUID DEFAULT supplies the unrelated parent ID, measured by RETURNING.
 INSERT INTO public.proveedor_facturas(organization_id,proveedor_id,proveedor_nombre,
   embarque_id,folio_proveedor,rfc_proveedor,fecha_emision,fecha_vencimiento,dias_credito,
   moneda,subtotal,iva,total,estado,estado_aprobacion,aprobada_por,aprobada_at,created_by,
   categoria_presupuesto_id,origen_carga,notas)
 VALUES((v.payload->>'organization_id')::uuid,(v.binding->>'supplier_id')::uuid,
   s->>'supplierName',(v.binding->>'shipment_id')::uuid,s->>'folio',s->>'rfc',
   public.fecha_negocio_mx()+(s->>'issuedOffset')::integer,
   public.fecha_negocio_mx()+(s->>'dueOffset')::integer,(s->>'creditDays')::integer,
   'MXN',(s->>'subtotal')::numeric,(s->>'vat')::numeric,(s->>'total')::numeric,
   'Vigente','pendiente',NULL,NULL,NULL,(v.payload->>'category_id')::uuid,
   'manual',s->>'notes') RETURNING id INTO parent_id;
 IF parent_id IS NULL OR parent_id=ANY(bound_ids) THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_UNBOUND_DEFAULT_PARENT_REQUIRED';
 END IF;
"""


_HUMAN_APPROVAL = """
 -- Both ordinary concepts are auxiliary DEFAULT IDs, never bound IDs.  The
 -- original live shipment avoids the unbacked-expense threshold branch.
 FOR item IN SELECT value FROM jsonb_array_elements(s->'concepts') LOOP
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,
    descripcion,cantidad,monto)
  VALUES((v.payload->>'organization_id')::uuid,parent_id,item->>'description',
    (item->>'quantity')::numeric,(item->>'amount')::numeric) RETURNING id INTO auxiliary_id;
  IF auxiliary_id IS NULL OR auxiliary_id=ANY(bound_ids) THEN
   RAISE EXCEPTION 'RETRY_SUPPLEMENT_UNBOUND_DEFAULT_CONCEPT_REQUIRED';
  END IF;
  auxiliary_ids:=array_append(auxiliary_ids,auxiliary_id);
 END LOOP;
 IF cardinality(auxiliary_ids) IS DISTINCT FROM jsonb_array_length(s->'concepts') THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_AUXILIARY_SOURCE_CONCEPTS_REQUIRED';
 END IF;
 SELECT * INTO STRICT saved_auth FROM financial_compile_fixture.auth_context WHERE singleton;
 IF saved_auth.subject_user_id IS NOT NULL OR saved_auth.role_name IS DISTINCT FROM 'service_role'
 OR saved_auth.jwt_claims->>'fixture' IS DISTINCT FROM 'SYNTHETIC'
 OR v.sponsor_user_id IS NULL
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v.sponsor_user_id
   AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))
 OR NOT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.user_id=v.sponsor_user_id
   AND m.organization_id=(v.payload->>'organization_id')::uuid
   AND m.role::text IN('admin_org','admin','super_admin'))
 OR NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=v.sponsor_user_id
   AND r.role::text IN('admin_org','admin','super_admin')) THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_EXISTING_SYNTHETIC_SPONSOR_REQUIRED';
 END IF;
 -- This changes only the existing lab's explicit synthetic auth adapter.  No
 -- external principal, role grant, or membership is created.  The canonical
 -- human helper owns its app.aprobando_cxp setting and financial validations.
 UPDATE financial_compile_fixture.auth_context
 SET subject_user_id=v.sponsor_user_id,role_name='authenticated',
   jwt_claims=jsonb_build_object('role','authenticated','fixture','SYNTHETIC') WHERE singleton;
 IF auth.uid() IS DISTINCT FROM v.sponsor_user_id OR auth.role() IS DISTINCT FROM 'authenticated'
 OR auth.jwt()->>'fixture' IS DISTINCT FROM 'SYNTHETIC' THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_SYNTHETIC_HUMAN_CONTEXT_REQUIRED';
 END IF;
 SELECT * INTO STRICT invoice_version FROM public.proveedor_facturas WHERE id=parent_id FOR UPDATE;
 approved:=demo_flow_writer.common_approval(parent_id,true,NULL,invoice_version.updated_at,NULL,NULL);
 UPDATE financial_compile_fixture.auth_context SET subject_user_id=saved_auth.subject_user_id,
   role_name=saved_auth.role_name,jwt_claims=saved_auth.jwt_claims WHERE singleton;
 IF approved.id IS DISTINCT FROM parent_id OR approved.estado_aprobacion::text IS DISTINCT FROM 'aprobada'
 OR approved.aprobada_por IS DISTINCT FROM v.sponsor_user_id OR approved.aprobada_at IS NULL
 OR (SELECT to_jsonb(a) FROM financial_compile_fixture.auth_context a WHERE singleton)
   IS DISTINCT FROM v.auth_snapshot
 OR auth.uid() IS NOT NULL OR auth.role() IS DISTINCT FROM 'service_role'
 OR (SELECT count(*) FROM public.bitacora_actividad a WHERE a.entidad_id=parent_id
   AND a.accion='aprobar_factura_proveedor' AND a.fuente_evento='rpc_aprobar_factura_proveedor'
   AND a.usuario_id=v.sponsor_user_id AND a.organization_id=(v.payload->>'organization_id')::uuid)<>1 THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_CANONICAL_HUMAN_APPROVAL_REQUIRED';
 END IF;
"""


_TARGET_CONCEPT = """
 target_id:=(v.binding->'concept_ids'->>0)::uuid;
 item:=s->'concepts'->0;
 INSERT INTO public.proveedor_facturas_conceptos(id,organization_id,proveedor_factura_id,
   descripcion,cantidad,monto)
 VALUES(target_id,(v.payload->>'organization_id')::uuid,parent_id,item->>'description',
   (item->>'quantity')::numeric,(item->>'amount')::numeric);
 SELECT to_jsonb(c) INTO STRICT target_row FROM public.proveedor_facturas_conceptos c WHERE c.id=target_id;
 IF target_row->>'descripcion' IS DISTINCT FROM item->>'description'
 OR (target_row->>'cantidad')::numeric IS DISTINCT FROM (item->>'quantity')::numeric
 OR (target_row->>'monto')::numeric IS DISTINCT FROM (item->>'amount')::numeric THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_SOURCE_CONCEPT_NOT_INSERTED';
 END IF;
"""


_TARGET_PAYMENT = """
 target_id:=(v.binding->>'payment_id')::uuid;
 item:=s->'payment';
 INSERT INTO public.pagos_proveedor(id,organization_id,proveedor_factura_id,fecha_pago,
   monto,moneda,metodo_pago,referencia,notas,created_by,cuenta_bancaria_id,lote_id,
   client_request_id,es_ajuste,es_anticipo_aplicado)
 VALUES(target_id,(v.payload->>'organization_id')::uuid,parent_id,
   public.fecha_negocio_mx()+(item->>'dateOffset')::integer,(item->>'amount')::numeric,
   (item->>'currency')::public.moneda,item->>'method',item->>'reference',item->>'notes',
   NULL,NULL,NULL,target_id,false,false);
 SELECT to_jsonb(p) INTO STRICT target_row FROM public.pagos_proveedor p WHERE p.id=target_id;
 IF (target_row->>'fecha_pago')::date IS DISTINCT FROM
     public.fecha_negocio_mx()+(item->>'dateOffset')::integer
 OR (target_row->>'monto')::numeric IS DISTINCT FROM (item->>'amount')::numeric
 OR (target_row->>'monto_en_moneda_factura')::numeric IS DISTINCT FROM (item->>'amount')::numeric
 OR target_row->>'moneda' IS DISTINCT FROM item->>'currency'
 OR target_row->>'metodo_pago' IS DISTINCT FROM item->>'method'
 OR target_row->>'referencia' IS DISTINCT FROM item->>'reference'
 OR target_row->>'notas' IS DISTINCT FROM item->>'notes'
 OR target_row->>'cuenta_bancaria_id' IS NOT NULL OR target_row->>'lote_id' IS NOT NULL
 OR target_row->>'created_by' IS NOT NULL
 OR (target_row->>'es_ajuste')::boolean IS DISTINCT FROM false
 OR (target_row->>'es_anticipo_aplicado')::boolean IS DISTINCT FROM false
 OR (target_row->>'client_request_id')::uuid IS DISTINCT FROM target_id
 OR EXISTS(SELECT 1 FROM public.bbva_movimientos m WHERE m.pago_proveedor_id=target_id) THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_SOURCE_PAYMENT_NOT_INSERTED';
 END IF;
"""


def _collision_proof(kind: str) -> str:
    concepts, payments = (1, 0) if kind == "concept" else (0, 1)
    target_table = "proveedor_facturas_conceptos" if kind == "concept" else "pagos_proveedor"
    expected_target = "(v.binding->'concept_ids'->>0)::uuid" if kind == "concept" else "(v.binding->>'payment_id')::uuid"
    return _BOUND_IDS + _NO_PRIVATE_MATERIALIZATION + """
 IF NOT v.initial_verified OR NOT v.pretarget_verified
 OR v.pre_target_rows IS NULL OR v.post_target_rows IS NULL
 OR v.pre_target_rows IS NOT DISTINCT FROM v.post_target_rows
 OR pg_temp.financial_snapshot() IS DISTINCT FROM v.post_target_rows
 OR v.auxiliary_invoice_id IS NULL OR v.auxiliary_invoice_id=ANY(bound_ids)
 OR EXISTS(SELECT 1 FROM unnest(v.auxiliary_concept_ids) x WHERE x=ANY(bound_ids))
 OR (SELECT count(*) FROM public.proveedor_facturas f
   WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(v.payload->'bindings') b(value)
     WHERE f.id=(b.value->>'invoice_id')::uuid))<>0
 OR (SELECT count(*) FROM public.proveedor_facturas_conceptos c
   WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(v.payload->'bindings') b(value)
     CROSS JOIN LATERAL jsonb_array_elements_text(b.value->'concept_ids') x(value)
     WHERE c.id=x.value::uuid))<>__CONCEPT_COUNT__
 OR (SELECT count(*) FROM public.pagos_proveedor p
   WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(v.payload->'bindings') b(value)
     WHERE p.id=(b.value->>'payment_id')::uuid))<>__PAYMENT_COUNT__
 OR v.target_id IS NULL OR v.target_snapshot IS NULL
 OR v.target_id IS DISTINCT FROM __EXPECTED_TARGET__
 OR (SELECT to_jsonb(t) FROM public.__TARGET_TABLE__ t WHERE t.id=v.target_id)
   IS DISTINCT FROM v.target_snapshot
 OR (v.target_snapshot->>'proveedor_factura_id')::uuid IS DISTINCT FROM v.auxiliary_invoice_id
 OR (v.target_snapshot->>'organization_id')::uuid IS DISTINCT FROM (v.payload->>'organization_id')::uuid
 OR demo_flow_writer.snapshot(v.auxiliary_invoice_id) IS DISTINCT FROM v.auxiliary_document_snapshot
 OR (SELECT to_jsonb(p) FROM demo_fixture_identity.prepared_receipts p WHERE p.receipt_id=v.receipt_id)
   IS DISTINCT FROM v.prepared_receipt_snapshot
 OR (SELECT to_jsonb(a) FROM financial_compile_fixture.auth_context a WHERE singleton)
   IS DISTINCT FROM v.auth_snapshot
 OR current_setting('request.jwt.claims',true) IS DISTINCT FROM v.request_claims_snapshot
 OR auth.uid() IS NOT NULL OR auth.role() IS DISTINCT FROM 'service_role'
 OR (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)
   FROM public.bitacora_actividad a WHERE a.entidad_id=v.auxiliary_invoice_id)
   IS DISTINCT FROM v.approval_audit_snapshot THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_INDEPENDENT_COLLISION_OR_ROWS_CHANGED';
 END IF;
 -- This origin verifier excludes financial occupancy.  It must still succeed
 -- after the collision: an earlier source/admission drift cannot mask adoption.
 PERFORM demo_fixture_identity.verify_preparation_origin(v.receipt_id);
""".replace("__CONCEPT_COUNT__", str(concepts)).replace("__PAYMENT_COUNT__", str(payments)).replace(
        "__TARGET_TABLE__", target_table
    ).replace("__EXPECTED_TARGET__", expected_target) + _TRIGGER_ASSERT


def _mutation(kind: str, fixture_id: str) -> str:
    table = "retry_supplemental_" + kind + "_adoption_proof"
    auxiliary = _HUMAN_APPROVAL if kind == "payment" else ""
    target = _TARGET_PAYMENT if kind == "payment" else _TARGET_CONCEPT
    return """
CREATE TEMP TABLE __PROOF_TABLE__ AS
 SELECT c.context_id,p.receipt_id,p.payload,to_jsonb(p) prepared_receipt_snapshot,b.value binding,
   policy.sponsor_user_id,
   (SELECT to_jsonb(a) FROM financial_compile_fixture.auth_context a WHERE singleton) auth_snapshot,
   current_setting('request.jwt.claims',true) request_claims_snapshot,
   NULL::uuid auxiliary_invoice_id,'{}'::uuid[] auxiliary_concept_ids,
   NULL::jsonb auxiliary_document_snapshot,NULL::jsonb approval_audit_snapshot,
   NULL::uuid target_id,NULL::jsonb target_snapshot,NULL::jsonb pre_target_rows,
   NULL::jsonb post_target_rows,false initial_verified,false pretarget_verified
 FROM pg_temp.financial_context c
 JOIN demo_flow_writer.server_admissions a ON a.context_id=c.context_id
 JOIN demo_flow_writer.scheduler_approvals policy ON policy.id=a.scheduler_approval_id
 JOIN demo_fixture_identity.prepared_receipts p ON p.receipt_id=a.identity_receipt_id
 CROSS JOIN LATERAL jsonb_array_elements(p.payload->'bindings') b(value)
 WHERE b.value->>'fixture_id'='__FIXTURE_ID__';
DO $retry_supplemental_mutation$
DECLARE v record; s jsonb; item jsonb; bound_ids uuid[]; parent_id uuid; auxiliary_id uuid;
 auxiliary_ids uuid[]:='{}'; target_id uuid; target_row jsonb; before_target jsonb;
 saved_auth financial_compile_fixture.auth_context; invoice_version public.proveedor_facturas;
 approved public.proveedor_facturas;
BEGIN
 SELECT * INTO STRICT v FROM pg_temp.__PROOF_TABLE__;
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('role') IS DISTINCT FROM 'none'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('listen_addresses')<>'' OR inet_server_addr() IS NOT NULL
 OR auth.uid() IS NOT NULL OR auth.role() IS DISTINCT FROM 'service_role'
 OR auth.jwt()->>'fixture' IS DISTINCT FROM 'SYNTHETIC' THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_FRESH_SYNTHETIC_OWNER_REQUIRED';
 END IF;
__NO_PRIVATE__
__TRIGGERS__
__BOUND_IDS__
 -- First positive check: valid original context before auxiliary construction.
 PERFORM demo_flow_writer.verify_identity_receipt(v.receipt_id);
 s:=demo_flow_writer.fixture_spec(v.binding->>'fixture_id');
__AUXILIARY_HEADER__
__AUXILIARY_APPROVAL__
 -- Mandatory second positive check after every auxiliary trigger/approval and
 -- after restoring auth_context, immediately before the target ID insertion.
 -- A failed auxiliary-origin guard is fatal; there is no exception handler here.
 PERFORM demo_flow_writer.verify_identity_receipt(v.receipt_id);
 before_target:=pg_temp.financial_snapshot();
__TARGET_INSERT__
 UPDATE pg_temp.__PROOF_TABLE__ SET auxiliary_invoice_id=parent_id,
   auxiliary_concept_ids=auxiliary_ids,auxiliary_document_snapshot=demo_flow_writer.snapshot(parent_id),
   approval_audit_snapshot=(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)
     FROM public.bitacora_actividad a WHERE a.entidad_id=parent_id),
   target_id=(target_row->>'id')::uuid,target_snapshot=target_row,pre_target_rows=before_target,
   post_target_rows=pg_temp.financial_snapshot(),initial_verified=true,pretarget_verified=true;
 SELECT * INTO STRICT v FROM pg_temp.__PROOF_TABLE__;
__COLLISION_PROOF__
END $retry_supplemental_mutation$;
""".replace("__PROOF_TABLE__", table).replace("__FIXTURE_ID__", fixture_id).replace(
        "__NO_PRIVATE__", _NO_PRIVATE_MATERIALIZATION
    ).replace("__TRIGGERS__", _TRIGGER_ASSERT).replace("__BOUND_IDS__", _BOUND_IDS).replace(
        "__AUXILIARY_HEADER__", _AUXILIARY_HEADER
    ).replace("__AUXILIARY_APPROVAL__", auxiliary).replace("__TARGET_INSERT__", target).replace(
        "__COLLISION_PROOF__", _collision_proof(kind)
    )


def _proof(kind: str) -> str:
    return """
DO $retry_supplemental_proof$
DECLARE v record; bound_ids uuid[];
BEGIN
 SELECT * INTO STRICT v FROM pg_temp.retry_supplemental___KIND___adoption_proof;
__COLLISION_PROOF__
END $retry_supplemental_proof$;
""".replace("__KIND__", kind).replace("__COLLISION_PROOF__", _collision_proof(kind))


CASES = (
    {
        "id": "foreign_bound_concept_id",
        "phase": "fresh",
        "category": "independent_foreign_concept_adoption",
        "mutation_sql": _mutation("concept", "aap-vencida"),
        "expected_sqlstate": "23514",
        "expected_message": "DEMO_FINANCIAL_ADOPTION_DENIED",
        "proof_sql": _proof("concept"),
    },
    {
        "id": "foreign_bound_payment_id",
        "phase": "fresh",
        "category": "independent_foreign_payment_adoption",
        "mutation_sql": _mutation("payment", "ofc-parcial"),
        "expected_sqlstate": "23514",
        "expected_message": "DEMO_FINANCIAL_ADOPTION_DENIED",
        "proof_sql": _proof("payment"),
    },
)
