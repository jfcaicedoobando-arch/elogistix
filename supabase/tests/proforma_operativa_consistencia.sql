-- Ordinary-domain regression suite. Run only against an ephemeral local PG17
-- database with the normal schema/migrations loaded. No role changes or grants.
-- Every fixture, temporary assertion and test trigger is rolled back.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- El alta real toma el lock global de bootstrap antes de los locks de tabla
-- de los triggers de fallo. Las suites paralelas usan el mismo orden.
-- Este actor de coordinación se elimina junto con el fixture al ROLLBACK.
INSERT INTO auth.users(id, email)
VALUES (gen_random_uuid(), 'proforma-fixture-lock-order@example.invalid');

CREATE FUNCTION pg_temp.assert_proforma(p_ok boolean, p_message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PROFORMA_CONSISTENCIA: %', p_message;
  END IF;
END;
$$;

CREATE FUNCTION pg_temp.assert_proforma_flag(p_embarque uuid, p_expected boolean, p_case text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.assert_proforma(
    (SELECT tiene_proforma IS NOT DISTINCT FROM p_expected FROM public.embarques WHERE id = p_embarque),
    p_case);
END;
$$;

-- Fault injection is local to this rollback-only suite and affects only its
-- synthetic shipment. It verifies atomic error propagation, not permissions.
CREATE FUNCTION pg_temp.fail_proforma_flag_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.proforma_fail_shipment', true) = NEW.id::text
     AND NEW.tiene_proforma IS DISTINCT FROM OLD.tiene_proforma THEN
    RAISE EXCEPTION 'PROFORMA_TEST_WRITE_FAILURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_test_proforma_flag_failure BEFORE UPDATE ON public.embarques
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_proforma_flag_write();

DO $test$
DECLARE
  v_org uuid := gen_random_uuid();
  v_cli uuid := gen_random_uuid();
  v_e uuid := gen_random_uuid();
  v_e2 uuid := gen_random_uuid();
  v_p uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_result uuid := gen_random_uuid();
  v_original1 uuid := gen_random_uuid();
  v_original2 uuid := gen_random_uuid();
  v_cv uuid := gen_random_uuid();
  v_cv2 uuid := gen_random_uuid();
  v_ctid tid;
  v_updated timestamptz;
  v_snapshot jsonb := '{"test":"original historical snapshot","total_mxn":116}'::jsonb;
  v_original_rows jsonb;
  v_guc text;
  v_before_guc text;
  v_count integer;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'TEST proforma internal consistency');
  INSERT INTO public.clientes(id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'Synthetic proforma client', 'proforma-consistency@example.invalid');
  INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_e, v_org, v_cli, 'ELPCA90001', 'Marítimo', 'Importación'),
         (v_e2, v_org, v_cli, 'ELPCB90002', 'Marítimo', 'Importación');
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'empty shipment');

  -- Empty drafts do not reserve a shipment. Concept soft-delete alone must
  -- recalculate, including restoration and removal of its last live concept.
  INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre, expediente, numero)
  VALUES (v_p, v_org, v_e, v_cli, 'Synthetic proforma client', 'ELPCA90001', 'TEST-PROFORMA-DRAFT');
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'empty draft');
  INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, proforma_id, descripcion,
    cantidad, precio_unitario, total, moneda, tipo_iva, tasa_iva_aplicada)
  VALUES (v_cv, v_org, v_e, v_p, 'Synthetic service', 1, 100, 100, 'MXN', 'no_objeto', 0);
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'draft with a live concept');
  UPDATE public.conceptos_venta SET deleted_at = clock_timestamp() WHERE id = v_cv;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'soft-delete-only update removes last live concept');
  UPDATE public.conceptos_venta SET deleted_at = NULL WHERE id = v_cv;
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'restoring live concept restores draft flag');
  UPDATE public.conceptos_venta SET proforma_id = NULL WHERE id = v_cv;
  DELETE FROM public.conceptos_venta WHERE id = v_cv;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'unlink/delete last concept');

  UPDATE public.proformas SET estado_aprobacion = 'aprobada' WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'approved operative proforma without concepts');
  UPDATE public.proformas SET estado_cliente = 'rechazada' WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'rejected proforma is not operative');
  INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, proforma_id, descripcion)
  VALUES (v_cv, v_org, v_e, v_p, 'Rejected service');
  v_count := public.liberar_conceptos_de_proforma(v_p);
  PERFORM pg_temp.assert_proforma(v_count = 1, 'rejection releases exactly its linked concept');
  PERFORM pg_temp.assert_proforma((SELECT proforma_id IS NULL AND estado_facturacion = 'pendiente'
    FROM public.conceptos_venta WHERE id = v_cv), 'released concept becomes pending');
  UPDATE public.proformas SET notas = 'Later ordinary metadata update' WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'rejection plus release plus metadata never reactivates');

  INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre,
    expediente, numero, estado_aprobacion)
  VALUES (v_other, v_org, v_e, v_cli, 'Synthetic proforma client', 'ELPCA90001', 'TEST-PROFORMA-OTHER', 'aprobada');
  PERFORM public.liberar_conceptos_de_proforma(v_p);
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'release preserves a different operative proforma');
  UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = v_other;
  PERFORM public.liberar_conceptos_de_proforma(v_p);
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'cancelled alternative is not counted by release');
  UPDATE public.proformas SET estado_cliente = 'aceptada', estado_proforma = 'facturada', estado_aprobacion = 'borrador'
  WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'facturada stays operative even without concepts and legacy draft approval');
  UPDATE public.proformas SET estado_proforma = 'pendiente' WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'return to empty draft clears flag');
  UPDATE public.proformas SET estado_aprobacion = 'aprobada' WHERE id = v_p;
  UPDATE public.proformas SET deleted_at = clock_timestamp() WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'soft-deleted proforma is excluded');
  UPDATE public.proformas SET deleted_at = NULL WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'restored operative proforma');

  -- No-op recomputation must not fire the shipment updated_at trigger. ctid
  -- also detects a needless UPDATE within a transaction where now() is fixed.
  SELECT ctid, updated_at INTO v_ctid, v_updated FROM public.embarques WHERE id = v_e;
  PERFORM public.recompute_embarque_tiene_proforma(v_e);
  UPDATE public.proformas SET notas = 'No change to operative state' WHERE id = v_p;
  PERFORM pg_temp.assert_proforma((SELECT ctid = v_ctid AND updated_at = v_updated
    FROM public.embarques WHERE id = v_e), 'no-op helper and metadata preserve shipment row and timestamp');

  -- Successful nested calls must restore the exact incoming GUC value.
  FOREACH v_guc IN ARRAY ARRAY['off', 'on', '', 'caller-sentinel'] LOOP
    PERFORM set_config('app.bypass_cierre', v_guc, true);
    UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = v_p;
    PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) IS NOT DISTINCT FROM v_guc,
      'cancellation preserves caller bypass value: ' || v_guc);
    UPDATE public.proformas SET estado_proforma = 'pendiente' WHERE id = v_p;
    PERFORM public.recompute_embarque_tiene_proforma(v_e);
    PERFORM public.liberar_conceptos_de_proforma(v_other);
    PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) IS NOT DISTINCT FROM v_guc,
      'helper/release preserves caller bypass value: ' || v_guc);
  END LOOP;
  PERFORM set_config('app.bypass_cierre', 'off', true);

  -- NULL / missing references are harmless and cannot alter another shipment.
  v_before_guc := current_setting('app.bypass_cierre', true);
  PERFORM public.recompute_embarque_tiene_proforma(NULL);
  PERFORM public.recompute_embarque_tiene_proforma(gen_random_uuid());
  UPDATE public.proformas SET embarque_id = NULL WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'move to NULL clears old shipment');
  PERFORM pg_temp.assert_proforma(public.liberar_conceptos_de_proforma(v_p) = 0, 'NULL shipment release with no concepts');
  UPDATE public.proformas SET embarque_id = v_e2 WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e2, true, 'move from NULL recalculates new shipment');
  UPDATE public.proformas SET embarque_id = v_e WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e2, false, 'move recomputes old shipment');
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'move recomputes new shipment');
  PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) IS NOT DISTINCT FROM v_before_guc,
    'NULL/missing references preserve bypass state');

  -- A real statement failure rolls back both the proforma and derived flag.
  PERFORM set_config('test.proforma_fail_shipment', v_e::text, true);
  BEGIN
    UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = v_p;
    RAISE EXCEPTION 'PROFORMA_TEST_EXPECTED_FAILURE_MISSING';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PROFORMA_TEST_WRITE_FAILURE' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'failed recalculation leaves previous flag');
  PERFORM pg_temp.assert_proforma((SELECT estado_proforma = 'pendiente' FROM public.proformas WHERE id = v_p),
    'failed recalculation rolls back proforma mutation');
  PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) = 'off', 'error path restores bypass');
  PERFORM set_config('test.proforma_fail_shipment', '', true);

  -- Only the consolidated result counts. Both independently persisted markers
  -- exclude originals, even when the result is rejected/cancelled/deleted.
  UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = v_p;
  INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre,
    expediente, numero, estado_aprobacion, es_consolidada, proformas_origen)
  VALUES (v_result, v_org, v_e, v_cli, 'Synthetic proforma client', 'ELPCA90001',
    'TEST-PROFORMA-CONSOLIDATED', 'aprobada', true, ARRAY[v_original1, v_original2]);
  INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre,
    expediente, numero, estado_aprobacion, estado_revision, consolidada_en, snapshot_emision)
  VALUES (v_original1, v_org, v_e, v_cli, 'Synthetic proforma client', 'ELPCA90001',
    'TEST-PROFORMA-ORIGINAL1', 'aprobada', 'consolidada', NULL, v_snapshot),
    (v_original2, v_org, v_e, v_cli, 'Synthetic proforma client', 'ELPCA90001',
    'TEST-PROFORMA-ORIGINAL2', 'aprobada', 'pendiente', v_result, v_snapshot);
  SELECT jsonb_agg(to_jsonb(p) ORDER BY id) INTO v_original_rows
  FROM public.proformas p WHERE id IN (v_original1, v_original2);
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'operative consolidated result');
  UPDATE public.proformas SET estado_cliente = 'rechazada' WHERE id = v_result;
  PERFORM public.liberar_conceptos_de_proforma(v_result);
  UPDATE public.proformas SET notas = 'Original metadata changed' WHERE id = v_original1;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'rejected consolidated result does not revive originals');
  UPDATE public.proformas SET estado_cliente = 'aceptada' WHERE id = v_result;
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'accepted consolidated result');
  UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = v_result;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'cancelled consolidated result excludes both legacy markers');
  UPDATE public.proformas SET estado_proforma = 'pendiente', deleted_at = clock_timestamp() WHERE id = v_result;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'deleted consolidated result excludes originals');
  PERFORM pg_temp.assert_proforma(NOT EXISTS (
    SELECT 1 FROM public.proformas p WHERE id IN (v_original1, v_original2)
      AND snapshot_emision IS DISTINCT FROM v_snapshot), 'historical original snapshots never rewritten');
  PERFORM pg_temp.assert_proforma((SELECT to_jsonb(p) = (SELECT x FROM jsonb_array_elements(v_original_rows) x
      WHERE x->>'id' = v_original2::text) FROM public.proformas p WHERE id = v_original2),
    'untouched original row, timestamp and snapshot preserved');

  -- Concept reassignment recalculates both old/new parents with no changes to
  -- unrelated archived original records.
  UPDATE public.proformas SET deleted_at = NULL, estado_aprobacion = 'borrador' WHERE id = v_result;
  INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre, expediente, numero)
  VALUES (gen_random_uuid(), v_org, v_e2, v_cli, 'Synthetic proforma client', 'ELPCB90002', 'TEST-PROFORMA-DRAFT2')
  RETURNING id INTO v_other;
  INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, proforma_id, descripcion)
  VALUES (v_cv2, v_org, v_e, v_result, 'Moved concept');
  UPDATE public.conceptos_venta SET proforma_id = v_other, embarque_id = v_e2 WHERE id = v_cv2;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'concept move clears old draft');
  PERFORM pg_temp.assert_proforma_flag(v_e2, true, 'concept move activates new draft');
  UPDATE public.conceptos_venta SET proforma_id = NULL WHERE id = v_cv2;
  PERFORM pg_temp.assert_proforma_flag(v_e2, false, 'last concept unlink clears target draft');
  RAISE NOTICE 'PASS proforma operative state, release, moves, snapshots, rollback, timestamps and bypass restoration';
END;
$test$;

-- Full-schema closure case: create fixtures in an ordinary closable state,
-- close using the normal RPC, and check business rules without SET ROLE or
-- policy/ACL probes. The user/member are synthetic application data only.
DO $closed$
DECLARE
  v_org uuid := gen_random_uuid(); v_cli uuid := gen_random_uuid(); v_uid uuid := gen_random_uuid();
  v_e uuid := gen_random_uuid(); v_p uuid := gen_random_uuid(); v_cv uuid := gen_random_uuid();
  v_unlinked uuid := gen_random_uuid(); v_snapshot jsonb; v_p_snapshot jsonb;
  v_portal uuid := gen_random_uuid(); v_token uuid := gen_random_uuid(); v_portal_cv uuid := gen_random_uuid();
  v_error text; v_sql text;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'TEST proforma closed shipment');
  INSERT INTO auth.users(id, email) VALUES (v_uid, 'proforma-closure@example.invalid');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (v_org, v_uid, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, 'admin_org')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.clientes(id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'Synthetic closure client', 'proforma-closure-client@example.invalid');
  INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, modo, tipo, estado)
  VALUES (v_e, v_org, v_cli, 'ELPCC90003', 'Marítimo', 'Importación', 'Por liquidar');
  INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre,
    expediente, numero, estado_aprobacion, estado_cliente)
  VALUES (v_p, v_org, v_e, v_cli, 'Synthetic closure client', 'ELPCC90003',
    'ELPCC90003', 'aprobada', 'aceptada');
  INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, proforma_id, descripcion, estado_facturacion)
  VALUES (v_cv, v_org, v_e, v_p, 'Approved service', 'en_proforma'),
         (v_unlinked, v_org, v_e, NULL, 'Unlinked service', 'pendiente');
  INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre,
    expediente, numero, estado_aprobacion, estado_cliente, token_publico, token_expira_at)
  VALUES (v_portal, v_org, v_e, v_cli, 'Synthetic closure client', 'ELPCC90003',
    'TEST-PROFORMA-CLOSED-TOKEN', 'aprobada', 'rechazada', v_token, now() + interval '1 day');
  INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, proforma_id, descripcion)
  VALUES (v_portal_cv, v_org, v_e, v_portal, 'Valid token rejection service');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  PERFORM public.cerrar_embarque(v_e);
  SELECT cerrado_snapshot INTO v_snapshot FROM public.embarques WHERE id = v_e;
  PERFORM pg_temp.assert_proforma(v_snapshot IS NOT NULL, 'closure RPC produced a historical snapshot');
  PERFORM set_config('app.bypass_cierre', 'off', true);

  UPDATE public.proformas SET estado_proforma = 'facturada' WHERE id = v_p;
  PERFORM pg_temp.assert_proforma((SELECT estado_facturacion = 'facturado' FROM public.conceptos_venta WHERE id = v_cv),
    'approved derived facturada status propagates on closed shipment');
  SELECT snapshot_emision INTO v_p_snapshot FROM public.proformas WHERE id = v_p;
  PERFORM pg_temp.assert_proforma(v_p_snapshot IS NOT NULL, 'invoiced proforma snapshot exists');
  PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) = 'off', 'facturada sync restores bypass');
  UPDATE public.proformas SET estado_proforma = 'pendiente' WHERE id = v_p;
  PERFORM pg_temp.assert_proforma((SELECT estado_facturacion = 'en_proforma' FROM public.conceptos_venta WHERE id = v_cv),
    'derived return from facturada propagates on closed shipment');
  UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'closed shipment flag can clear');
  UPDATE public.proformas SET estado_proforma = 'pendiente' WHERE id = v_p;
  PERFORM pg_temp.assert_proforma_flag(v_e, true, 'closed shipment flag can become true');
  PERFORM public.recompute_embarque_tiene_proforma(v_e);
  PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) = 'off', 'flag maintenance restores bypass');
  PERFORM pg_temp.assert_proforma((SELECT cerrado_snapshot = v_snapshot AND estado::text = 'Cerrado'
    FROM public.embarques WHERE id = v_e), 'derived maintenance preserves closure snapshot/state');
  PERFORM pg_temp.assert_proforma((SELECT snapshot_emision = v_p_snapshot FROM public.proformas WHERE id = v_p),
    'derived updates preserve invoiced proforma snapshot');

  PERFORM public.actualizar_estado_cliente_proforma(v_p, 'rechazada', 'Synthetic valid manual rejection');
  PERFORM pg_temp.assert_proforma((SELECT proforma_id IS NULL AND estado_facturacion = 'pendiente'
    FROM public.conceptos_venta WHERE id = v_cv), 'manual rejection releases concept on closed shipment');
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'closed manual rejection clears operative flag');
  PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) = 'off', 'manual rejection restores bypass');
  UPDATE public.proformas SET estado_cliente = 'pendiente' WHERE id = v_portal;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM public.portal_responder_por_token(v_token, 'rechazada', 'Synthetic valid token rejection');
  PERFORM pg_temp.assert_proforma((SELECT proforma_id IS NULL AND estado_facturacion = 'pendiente'
    FROM public.conceptos_venta WHERE id = v_portal_cv), 'valid token rejection releases concept on closed shipment');
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'closed token rejection clears operative flag');
  PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) = 'off', 'token rejection restores bypass');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  BEGIN
    PERFORM public.crear_proforma_atomica(v_org, v_e, v_cli, 'Synthetic closure client', 'ELPCC90003', NULL,
      ARRAY[v_unlinked], 0,0,0,0,0,0,NULL,'TEST',30,0.16,'{}'::jsonb);
    RAISE EXCEPTION 'PROFORMA_TEST_CLOSED_CREATE_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%cerrado%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) = 'off', 'rejected closed creation preserves bypass');

  FOREACH v_sql IN ARRAY ARRAY[
    format('INSERT INTO public.conceptos_venta(organization_id, embarque_id, descripcion) VALUES (%L,%L,%L)', v_org, v_e, 'Must reopen'),
    format('UPDATE public.conceptos_venta SET descripcion = %L WHERE id = %L', 'Must reopen', v_unlinked),
    format('UPDATE public.conceptos_venta SET deleted_at = now() WHERE id = %L', v_unlinked),
    format('DELETE FROM public.conceptos_venta WHERE id = %L', v_unlinked),
    format('UPDATE public.embarques SET notas = %L WHERE id = %L', 'Must reopen', v_e)
  ] LOOP
    v_error := NULL;
    BEGIN
      EXECUTE v_sql;
    EXCEPTION WHEN OTHERS THEN
      v_error := SQLERRM;
    END;
    PERFORM pg_temp.assert_proforma(v_error ILIKE '%cerrado%', 'ordinary closed edit must require reopening: ' || v_sql);
  END LOOP;
  PERFORM pg_temp.assert_proforma((SELECT descripcion = 'Unlinked service' AND deleted_at IS NULL
    FROM public.conceptos_venta WHERE id = v_unlinked), 'blocked normal edits made no changes');
  PERFORM public.reabrir_embarque(v_e, 'proforma-closure@example.invalid', 'Synthetic regression: reopen before editing');
  UPDATE public.conceptos_venta SET descripcion = 'Edited after reopening' WHERE id = v_unlinked;
  UPDATE public.conceptos_venta SET deleted_at = now() WHERE id = v_unlinked;
  PERFORM pg_temp.assert_proforma((SELECT descripcion = 'Edited after reopening' AND deleted_at IS NOT NULL
    FROM public.conceptos_venta WHERE id = v_unlinked), 'normal edit/delete work after reopening');
  RAISE NOTICE 'PASS full-schema closure: derived maintenance allowed, normal edits require reopening';
END;
$closed$;
-- Exercise the actual consolidation RPC, including its pre-existing closed
-- shipment allowance. The failure happens inside the scoped concept relink.
CREATE FUNCTION pg_temp.fail_proforma_concept_relink() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.proforma_fail_concept', true) = NEW.id::text
     AND NEW.proforma_id IS DISTINCT FROM OLD.proforma_id THEN
    RAISE EXCEPTION 'PROFORMA_TEST_RELINK_FAILURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_test_proforma_concept_failure BEFORE UPDATE ON public.conceptos_venta
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_proforma_concept_relink();

DO $consolidation$
DECLARE
  v_org uuid := gen_random_uuid(); v_cli uuid := gen_random_uuid(); v_uid uuid := gen_random_uuid();
  v_e uuid; v_p1 uuid; v_p2 uuid; v_cv1 uuid; v_cv2 uuid; v_result public.proformas;
  v_guc text; v_case integer := 0; v_count integer; v_detail_count integer;
  v_snapshot1 jsonb := '{"test":"frozen first source","total_mxn":100}'::jsonb;
  v_snapshot2 jsonb := '{"test":"frozen second source","total_mxn":150}'::jsonb;
  v_sources_before jsonb; v_concepts_before jsonb; v_closure_before jsonb;
  v_deleted_before jsonb; v_deleted_tid tid; v_deleted_updated timestamptz;
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('app.bypass_cierre', 'off', true);
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'TEST actual proforma consolidation');
  INSERT INTO auth.users(id, email) VALUES (v_uid, 'proforma-consolidation@example.invalid');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (v_org, v_uid, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, 'admin_org')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.clientes(id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'Synthetic consolidation client', 'proforma-consolidation-client@example.invalid');

  FOREACH v_guc IN ARRAY ARRAY['off', 'on'] LOOP
    v_case := v_case + 1;
    v_e := gen_random_uuid(); v_p1 := gen_random_uuid(); v_p2 := gen_random_uuid();
    v_cv1 := gen_random_uuid(); v_cv2 := gen_random_uuid();
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('app.bypass_cierre', 'off', true);
    INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, modo, tipo, estado)
    VALUES (v_e, v_org, v_cli, 'ELPCR' || (91000 + v_case), 'Marítimo', 'Importación', 'Por liquidar');
    INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre,
      expediente, numero, estado_aprobacion, subtotal_mxn, total_mxn, snapshot_emision)
    VALUES (v_p1, v_org, v_e, v_cli, 'Synthetic consolidation client', 'ELPCR' || (91000 + v_case),
      'TEST-CONSOLIDATE-A-' || v_case, 'aprobada', 100, 100, v_snapshot1),
      (v_p2, v_org, v_e, v_cli, 'Synthetic consolidation client', 'ELPCR' || (91000 + v_case),
      'TEST-CONSOLIDATE-B-' || v_case, 'aprobada', 150, 150, v_snapshot2);
    INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, proforma_id, descripcion,
      cantidad, precio_unitario, total, moneda, aplica_iva, tipo_iva, tasa_iva_aplicada, estado_facturacion)
    VALUES (v_cv1, v_org, v_e, v_p1, 'First consolidation service', 1, 100, 100, 'MXN', true, 'tasa_0', 0, 'en_proforma'),
      (v_cv2, v_org, v_e, v_p2, 'Second consolidation service', 1, 150, 150, 'MXN', true, 'tasa_0', 0, 'en_proforma');
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
    PERFORM public.cerrar_embarque(v_e);
    SELECT cerrado_snapshot INTO v_closure_before FROM public.embarques WHERE id = v_e;
    SELECT jsonb_agg(to_jsonb(p) ORDER BY id) INTO v_sources_before FROM public.proformas p WHERE id IN (v_p1, v_p2);
    SELECT jsonb_agg(to_jsonb(cv) ORDER BY id) INTO v_concepts_before FROM public.conceptos_venta cv WHERE id IN (v_cv1, v_cv2);
    SELECT count(*) INTO v_count FROM public.proformas WHERE organization_id = v_org;
    SELECT count(*) INTO v_detail_count FROM public.proforma_conceptos_consolidados WHERE organization_id = v_org;
    PERFORM set_config('app.bypass_cierre', v_guc, true);
    PERFORM set_config('test.proforma_fail_concept', v_cv1::text, true);
    BEGIN
      PERFORM public.consolidar_proformas(v_e, v_cli, 'Synthetic consolidation client',
        'ELPCR' || (91000 + v_case), NULL, 'TEST', 30, v_org, ARRAY[v_p1, v_p2]);
      RAISE EXCEPTION 'PROFORMA_TEST_EXPECTED_RELINK_FAILURE_MISSING';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'PROFORMA_TEST_RELINK_FAILURE' THEN RAISE; END IF;
    END;
    PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) = v_guc,
      'failed consolidation restores caller bypass ' || v_guc);
    PERFORM pg_temp.assert_proforma((SELECT count(*) = v_count FROM public.proformas WHERE organization_id = v_org),
      'failed consolidation leaves no result proforma');
    PERFORM pg_temp.assert_proforma((SELECT count(*) = v_detail_count FROM public.proforma_conceptos_consolidados WHERE organization_id = v_org),
      'failed consolidation leaves no consolidated detail');
    PERFORM pg_temp.assert_proforma((SELECT jsonb_agg(to_jsonb(p) ORDER BY id) = v_sources_before
      FROM public.proformas p WHERE id IN (v_p1, v_p2)), 'failed consolidation restores complete original rows');
    PERFORM pg_temp.assert_proforma((SELECT jsonb_agg(to_jsonb(cv) ORDER BY id) = v_concepts_before
      FROM public.conceptos_venta cv WHERE id IN (v_cv1, v_cv2)), 'failed consolidation restores complete concept rows');
    PERFORM pg_temp.assert_proforma_flag(v_e, true, 'failed consolidation preserves operative originals');
    PERFORM set_config('test.proforma_fail_concept', '', true);

    v_result := public.consolidar_proformas(v_e, v_cli, 'Synthetic consolidation client',
      'ELPCR' || (91000 + v_case), NULL, 'TEST', 30, v_org, ARRAY[v_p1, v_p2]);
    PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) = v_guc,
      'successful consolidation restores caller bypass ' || v_guc);
    PERFORM pg_temp.assert_proforma(v_result.id IS NOT NULL AND v_result.es_consolidada
      AND v_result.estado_revision = 'aprobada' AND v_result.subtotal_mxn = 250
      AND v_result.iva_mxn = 0 AND v_result.total_mxn = 250
      AND v_result.proformas_origen = ARRAY[v_p1, v_p2], 'actual consolidation result has source identity and correct amounts');
    PERFORM pg_temp.assert_proforma((SELECT count(*) = 2 FROM public.conceptos_venta
      WHERE id IN (v_cv1, v_cv2) AND proforma_id = v_result.id), 'actual consolidation relinks both live concepts');
    PERFORM pg_temp.assert_proforma((SELECT count(*) = 2 FROM public.proforma_conceptos_consolidados
      WHERE proforma_id = v_result.id AND organization_id = v_org), 'actual consolidation creates both result detail lines');
    PERFORM pg_temp.assert_proforma((SELECT count(*) = 2 FROM public.proformas
      WHERE id IN (v_p1, v_p2) AND estado_revision = 'consolidada' AND consolidada_en = v_result.id),
      'actual consolidation marks both originals as historical');
    PERFORM pg_temp.assert_proforma((SELECT snapshot_emision = v_snapshot1 AND total_mxn = 100 FROM public.proformas WHERE id = v_p1)
      AND (SELECT snapshot_emision = v_snapshot2 AND total_mxn = 150 FROM public.proformas WHERE id = v_p2),
      'actual consolidation preserves original snapshots and amounts');
    PERFORM pg_temp.assert_proforma_flag(v_e, true, 'actual consolidated result is operative');
    UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = v_result.id;
    UPDATE public.proformas SET notas = 'Historical source metadata after result cancellation' WHERE id = v_p1;
    PERFORM pg_temp.assert_proforma_flag(v_e, false, 'cancelling actual result never reactivates originals');
    PERFORM pg_temp.assert_proforma((SELECT cerrado_snapshot = v_closure_before AND estado::text = 'Cerrado'
      FROM public.embarques WHERE id = v_e), 'actual consolidation preserves closed shipment snapshot and state');
    PERFORM pg_temp.assert_proforma(current_setting('app.bypass_cierre', true) = v_guc,
      'result cancellation preserves caller bypass ' || v_guc);
  END LOOP;

  -- Release processes live rows only. This records current restore semantics:
  -- the archived link is retained, but a rejected proforma never becomes operative.
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('app.bypass_cierre', 'off', true);
  v_e := gen_random_uuid(); v_p1 := gen_random_uuid(); v_cv1 := gen_random_uuid(); v_cv2 := gen_random_uuid();
  INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_e, v_org, v_cli, 'ELPCR91999', 'Marítimo', 'Importación');
  INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre,
    expediente, numero, estado_aprobacion, estado_cliente)
  VALUES (v_p1, v_org, v_e, v_cli, 'Synthetic consolidation client', 'ELPCR91999',
    'TEST-RELEASE-ARCHIVED-CONCEPT', 'aprobada', 'rechazada');
  INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, proforma_id, descripcion, estado_facturacion, deleted_at)
  VALUES (v_cv1, v_org, v_e, v_p1, 'Live concept to release', 'en_proforma', NULL),
    (v_cv2, v_org, v_e, v_p1, 'Archived concept must remain untouched', 'en_proforma', now() - interval '1 day');
  SELECT to_jsonb(cv), ctid, updated_at INTO v_deleted_before, v_deleted_tid, v_deleted_updated
  FROM public.conceptos_venta cv WHERE id = v_cv2;
  PERFORM pg_temp.assert_proforma(public.liberar_conceptos_de_proforma(v_p1) = 1, 'release counts only its live concept');
  PERFORM pg_temp.assert_proforma((SELECT proforma_id IS NULL AND estado_facturacion = 'pendiente'
    FROM public.conceptos_venta WHERE id = v_cv1), 'live concept released normally beside archived concept');
  PERFORM pg_temp.assert_proforma((SELECT to_jsonb(cv) = v_deleted_before AND ctid = v_deleted_tid
      AND updated_at IS NOT DISTINCT FROM v_deleted_updated FROM public.conceptos_venta cv WHERE id = v_cv2),
    'release leaves archived row, link, state and timestamp completely unchanged');
  UPDATE public.conceptos_venta SET deleted_at = NULL WHERE id = v_cv2;
  PERFORM pg_temp.assert_proforma((SELECT proforma_id = v_p1 AND estado_facturacion = 'en_proforma'
    FROM public.conceptos_venta WHERE id = v_cv2), 'restore preserves the archived link under existing behavior');
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'restored concept on rejected proforma remains nonoperative');
  UPDATE public.proformas SET estado_cliente = 'aceptada', estado_proforma = 'cancelada' WHERE id = v_p1;
  UPDATE public.conceptos_venta SET deleted_at = now() WHERE id = v_cv2;
  SELECT to_jsonb(cv), ctid, updated_at INTO v_deleted_before, v_deleted_tid, v_deleted_updated
  FROM public.conceptos_venta cv WHERE id = v_cv2;
  PERFORM pg_temp.assert_proforma(public.liberar_conceptos_de_proforma(v_p1) = 0, 'cancelled release excludes its only archived concept');
  PERFORM pg_temp.assert_proforma((SELECT to_jsonb(cv) = v_deleted_before AND ctid = v_deleted_tid
      AND updated_at IS NOT DISTINCT FROM v_deleted_updated FROM public.conceptos_venta cv WHERE id = v_cv2),
    'cancelled release also preserves the complete archived concept row');
  UPDATE public.conceptos_venta SET deleted_at = NULL WHERE id = v_cv2;
  PERFORM pg_temp.assert_proforma((SELECT proforma_id = v_p1 AND estado_facturacion = 'en_proforma'
    FROM public.conceptos_venta WHERE id = v_cv2), 'restore retains archived link on cancelled parent under existing behavior');
  PERFORM pg_temp.assert_proforma_flag(v_e, false, 'restored concept on cancelled proforma remains nonoperative');
  RAISE NOTICE 'PASS actual consolidation RPC on closed shipments, off/on/error restoration, historical snapshots and archived release';
END;
$consolidation$;
ROLLBACK;
