-- Audit148: coordinated exact documentary coverage, ordinary full-schema writes.
-- Run from the repository root on a disposable schema containing the candidate.
-- All fixtures and pg_temp helpers roll back. No trigger/constraint is disabled.
-- The old audit148_full_coverage_write.sql regression remains independently useful.
BEGIN;
\i supabase/tests/rls/_helpers.sql

CREATE FUNCTION pg_temp.exact148_assert(ok boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END $$;

CREATE FUNCTION pg_temp.exact148_reject(statement text, label text,
  expected text DEFAULT 'LC_SEGURO_COBERTURA_INCOMPLETA')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean := false; message text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF position(expected IN message) = 0 THEN RAISE; END IF;
    rejected := true;
  END;
  PERFORM pg_temp.exact148_assert(rejected, label);
END $$;

CREATE FUNCTION pg_temp.exact148_policy(p_invoice uuid, p_ship uuid, p_org uuid,
  p_premium numeric, p_currency text DEFAULT 'MXN')
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.seguros_embarque(id, organization_id, embarque_id,
    aseguradora, numero_poliza, prima, moneda, vigencia_desde, vigencia_hasta,
    proveedor_factura_id)
  VALUES(result, p_org, p_ship, 'Synthetic exact coverage insurer', result::text,
    p_premium, p_currency, CURRENT_DATE, CURRENT_DATE + 365, p_invoice);
  RETURN result;
END $$;

-- Each case owns one shipment/policy and an independent other shipment. Start
-- from a valid header link, then use ordinary source edits to model legacy drift.
-- Zero budget avoids an unrelated 5% budget guard for extreme allocation cases;
-- it does not bypass allocation eligibility, invoice, policy or tenant guards.
CREATE FUNCTION pg_temp.exact148_fixture(p_org uuid, p_provider uuid,
  p_category uuid, p_client uuid, p_number integer,
  p_invoice_currency text DEFAULT 'MXN', p_premium numeric DEFAULT 100,
  p_premium_currency text DEFAULT 'MXN')
RETURNS TABLE(ship uuid, other_ship uuid, concept uuid, second_concept uuid,
  other_concept uuid, invoice uuid, policy uuid)
LANGUAGE plpgsql AS $$
DECLARE initial_base numeric := greatest(p_premium * 100, 1000);
BEGIN
  ship := gen_random_uuid(); other_ship := gen_random_uuid();
  concept := gen_random_uuid(); second_concept := gen_random_uuid();
  other_concept := gen_random_uuid(); invoice := gen_random_uuid();
  INSERT INTO public.embarques(id, organization_id, cliente_id, expediente,
    modo, tipo, tipo_cambio_usd, tipo_cambio_eur)
  VALUES(ship, p_org, p_client, 'DEMO-2026-' || (1489500 + p_number * 2),
      'Marítimo', 'Importación', 20, 22),
    (other_ship, p_org, p_client, 'DEMO-2026-' || (1489501 + p_number * 2),
      'Marítimo', 'Importación', 20, 22);
  INSERT INTO public.conceptos_costo(id, organization_id, embarque_id,
    proveedor_id, concepto, monto, moneda, origen)
  VALUES(concept, p_org, ship, p_provider, 'Exact allocation A', 0,
      p_invoice_currency::public.moneda, 'manual'),
    (second_concept, p_org, ship, p_provider, 'Exact allocation A2', 0,
      p_invoice_currency::public.moneda, 'manual'),
    (other_concept, p_org, other_ship, p_provider, 'Exact allocation B', 0,
      p_invoice_currency::public.moneda, 'manual');
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id,
    categoria_presupuesto_id, embarque_id, folio_proveedor, moneda,
    subtotal, iva, total, tipo_cambio_usd, estado)
  VALUES(invoice, p_org, p_provider, p_category, ship, invoice::text,
    p_invoice_currency::public.moneda, initial_base, 0, initial_base, 20, 'Vigente');
  policy := pg_temp.exact148_policy(invoice, ship, p_org,
    p_premium, p_premium_currency);
  RETURN NEXT;
END $$;

CREATE FUNCTION pg_temp.exact148_line(p_org uuid, p_invoice uuid,
  p_concept uuid, p_amount numeric, p_quantity numeric DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.proveedor_facturas_conceptos(id, organization_id,
    proveedor_factura_id, concepto_costo_id, descripcion, monto, cantidad)
  VALUES(result, p_org, p_invoice, p_concept, 'Synthetic exact allocation',
    p_amount, p_quantity);
  RETURN result;
END $$;

-- Check the legacy reader first, then an INSERT and effective relink UPDATE
-- with the same financial inputs. A private exception rolls the successful
-- probes back too, so the original policy survives every parity assertion.
CREATE FUNCTION pg_temp.exact148_pair(p_ship uuid, p_policy uuid,
  p_state text, p_label text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb; diagnostic jsonb; source public.seguros_embarque%ROWTYPE;
  inserted uuid; old_count bigint; before_update jsonb;
BEGIN
  SELECT * INTO STRICT source FROM public.seguros_embarque WHERE id = p_policy;
  result := public.pnl_financiero_embarque(p_ship);
  diagnostic := result->'seguros_cobertura';
  PERFORM pg_temp.exact148_assert(diagnostic @> jsonb_build_object(
    'evaluada', true, 'vinculados', 1,
    'completos', CASE WHEN p_state = 'completa' THEN 1 ELSE 0 END,
    'inconsistentes', CASE WHEN p_state = 'completa' THEN 0 ELSE 1 END,
    'sin_atribucion', CASE WHEN p_state = 'sin_atribucion' THEN 1 ELSE 0 END,
    'asignacion_indeterminada', CASE WHEN p_state = 'asignacion_indeterminada' THEN 1 ELSE 0 END,
    'sin_valoracion', CASE WHEN p_state = 'sin_valoracion' THEN 1 ELSE 0 END,
    'insuficientes', CASE WHEN p_state = 'insuficiente' THEN 1 ELSE 0 END),
    p_label || ': exact reader classification ' || p_state);
  IF p_state <> 'completa' THEN
    PERFORM pg_temp.exact148_assert(result->>'estado_costos' = 'incompleto'
      AND result->'utilidad_mxn' = 'null'::jsonb,
      p_label || ': uncertain/insufficient coverage never confirms profit');
  END IF;
  BEGIN
    UPDATE public.seguros_embarque SET deleted_at = clock_timestamp() WHERE id = p_policy;
    SELECT count(*) INTO old_count FROM public.seguros_embarque;
    IF p_state = 'completa' THEN
      inserted := pg_temp.exact148_policy(source.proveedor_factura_id, p_ship,
        source.organization_id, source.prima, source.moneda);
      PERFORM pg_temp.exact148_assert(inserted IS NOT NULL,
        p_label || ': writer INSERT accepts exact coverage');
    ELSE
      PERFORM pg_temp.exact148_reject(format(
        'SELECT pg_temp.exact148_policy(%L,%L,%L,%L,%L)',
        source.proveedor_factura_id, p_ship, source.organization_id,
        source.prima, source.moneda), p_label || ': writer INSERT rejects');
      PERFORM pg_temp.exact148_assert((SELECT count(*) FROM public.seguros_embarque) = old_count,
        p_label || ': failed INSERT is atomic');
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P1480', MESSAGE = 'rollback exact148 INSERT probe';
  EXCEPTION WHEN SQLSTATE 'P1480' THEN NULL;
  END;
  BEGIN
    UPDATE public.seguros_embarque SET proveedor_factura_id = NULL WHERE id = p_policy;
    SELECT to_jsonb(s) INTO before_update FROM public.seguros_embarque s WHERE id = p_policy;
    IF p_state = 'completa' THEN
      UPDATE public.seguros_embarque SET proveedor_factura_id = source.proveedor_factura_id
        WHERE id = p_policy;
      PERFORM pg_temp.exact148_assert((SELECT proveedor_factura_id = source.proveedor_factura_id
        FROM public.seguros_embarque WHERE id = p_policy),
        p_label || ': writer relink accepts exact coverage');
    ELSE
      PERFORM pg_temp.exact148_reject(format(
        'UPDATE public.seguros_embarque SET proveedor_factura_id=%L WHERE id=%L',
        source.proveedor_factura_id, p_policy), p_label || ': writer relink rejects');
      PERFORM pg_temp.exact148_assert((SELECT to_jsonb(s) FROM public.seguros_embarque s
        WHERE id = p_policy) = before_update, p_label || ': failed relink preserves entire row');
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P1480', MESSAGE = 'rollback exact148 UPDATE probe';
  EXCEPTION WHEN SQLSTATE 'P1480' THEN NULL;
  END;
  PERFORM pg_temp.exact148_assert((SELECT proveedor_factura_id = source.proveedor_factura_id
    AND deleted_at IS NULL FROM public.seguros_embarque WHERE id = p_policy),
    p_label || ': original explicit link retained');
  RETURN result;
END $$;

DO $cases$
DECLARE orgs record; f record; c record;
  provider uuid := gen_random_uuid(); category uuid := gen_random_uuid();
  client uuid := gen_random_uuid(); n integer := 0; line uuid; credit uuid;
  p jsonb; before_row jsonb; stamp timestamptz; special numeric; currency text;
BEGIN
  SELECT * INTO STRICT orgs FROM pg_temp.seed_org_pair('EXACT148', 'admin_org');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, tipo)
  VALUES(provider, orgs.org_a, 'Synthetic exact coverage supplier', 'Logistico', 'Naviera');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre)
  VALUES(category, orgs.org_a, 'Synthetic exact coverage');
  INSERT INTO public.clientes(id, organization_id, nombre, email)
  VALUES(client, orgs.org_a, 'Synthetic exact coverage client', 'exact148@test.local');
  PERFORM pg_temp.as_user(orgs.admin_a);

  -- Expected answers come from exact rational inequalities, not the candidate's
  -- quotient or a test-side epsilon. The first eight include every SQL review
  -- counterexample, including integer-only nominal and FX failures.
  FOR c IN SELECT * FROM (VALUES
    ('reported_noncap_equality', 200.01::numeric, 100::numeric, 200::numeric, 100::numeric, 'MXN', 'MXN', 20::numeric, 'completa'),
    ('ordinary_cap_equality', 150, 100, 200, 75, 'MXN', 'MXN', 20, 'completa'),
    ('fiscal_discount_below_cent', 199.99, 100, 200, 100, 'MXN', 'MXN', 20, 'insuficiente'),
    ('false_accept_integer_inputs', 100, 10000000000000000000, 10000000000000000001, 100, 'MXN', 'MXN', 20, 'insuficiente'),
    ('false_accept_fractional_inputs', 100.01, 100000.01, 100010.01000100000001, 100, 'MXN', 'MXN', 20, 'insuficiente'),
    ('fx_tie_false_reject', 99.99995, 100, 600, 100, 'USD', 'MXN', 6, 'completa'),
    ('fx_tie_false_reject_integers', 100, 1999999, 12000000, 100, 'USD', 'MXN', 6, 'completa'),
    ('fx_below_tie_false_accept', 99.99995, 10000000000000000000, 20000000000000000001, 100, 'USD', 'MXN', 2, 'insuficiente'),
    ('fx_above_tie', 99.999950000001, 100, 600, 100, 'USD', 'MXN', 6, 'completa'),
    ('eur_tie_uses_same_round4_contract', 99.99995, 100, 600, 100, 'EUR', 'MXN', 6, 'completa'),
    ('partial_membership_not_expanded_accept', 200, 100, 100, 100, 'MXN', 'MXN', 20, 'completa'),
    ('partial_membership_not_expanded_reject', 200, 100, 100, 100.01, 'MXN', 'MXN', 20, 'insuficiente'),
    ('all_allocations_same_shipment_cancel_denominator', 100, 200, 200, 100, 'MXN', 'MXN', 20, 'completa'),
    ('eligible_positive_attribution_zero_premium', 100, 1, 200, 0, 'MXN', 'MXN', 20, 'completa'),
    ('mxn_invoice_foreign_premium_at_frozen_fx', 2000, 2000, 2000, 100, 'MXN', 'USD', 20, 'completa'),
    ('mxn_invoice_has_no_round4_epsilon', 1999.999999, 2000, 2000, 100, 'MXN', 'USD', 20, 'insuficiente')
  ) AS cases(label, b, s, a, premium, invoice_currency, premium_currency, tc, expected)
  LOOP
    n := n + 1;
    SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider,
      category, client, n, c.invoice_currency, c.premium, c.premium_currency);
    UPDATE public.proveedor_facturas SET embarque_id = NULL, subtotal = c.b,
      iva = c.b * .16, total = c.b * 1.16, tipo_cambio_usd = c.tc WHERE id = f.invoice;
    PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, c.s);
    IF c.a > c.s THEN
      PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.other_concept, c.a - c.s);
    END IF;
    p := pg_temp.exact148_pair(f.ship, f.policy, c.expected, c.label);
    IF c.label = 'fiscal_discount_below_cent' THEN
      PERFORM pg_temp.exact148_assert((SELECT total > 200 AND subtotal = 199.99
        FROM public.proveedor_facturas WHERE id = f.invoice),
        'tax-inclusive total cannot repair a fiscal-base shortfall');
    END IF;
  END LOOP;

  -- Sum full-precision effective amounts across distinct concepts before any
  -- cap. Neither per-line rounding nor quantity applied twice is acceptable.
  FOR c IN SELECT * FROM (VALUES
    ('distinct_concepts_cent_split', 99.99::numeric, 1::numeric, .01::numeric, 1::numeric),
    ('distinct_concepts_subcent_split', 33.3333, 1, 66.6667, 1),
    ('quantity_applied_once', 25, 2, 25, 2),
    ('zero_quantity_retains_effective_one', 50, 0, 50, 1)
  ) AS cases(label, m1, q1, m2, q2)
  LOOP
    n := n + 1;
    SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n);
    UPDATE public.proveedor_facturas SET embarque_id = NULL, subtotal = 100, total = 100 WHERE id = f.invoice;
    PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, c.m1, c.q1);
    PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.second_concept, c.m2, c.q2);
    p := pg_temp.exact148_pair(f.ship, f.policy, 'completa', c.label);
    PERFORM pg_temp.exact148_assert((p#>>'{costo,real_mxn}')::numeric = 100,
      c.label || ': one invoice cost without independent premium');
  END LOOP;

  -- Same-currency coverage remains nominal with absent/invalid document AND
  -- shipment FX. A date before all legitimate DOF records prevents fallback.
  FOREACH currency IN ARRAY ARRAY['USD', 'EUR'] LOOP
    FOREACH special IN ARRAY ARRAY[0::numeric, 1::numeric, 'NaN'::numeric, 'Infinity'::numeric] LOOP
      n := n + 1;
      SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider,
        category, client, n, currency, 100, currency);
      -- Isolate missing accounting FX from audit129's undocumented-concept gate.
      UPDATE public.conceptos_costo SET deleted_at = clock_timestamp()
        WHERE id IN (f.concept, f.second_concept);
      -- Shipment CHECK requires >0 when present; NULL is its missing-FX value.
      UPDATE public.embarques SET tipo_cambio_usd = nullif(special, 0),
        tipo_cambio_eur = nullif(special, 0) WHERE id = f.ship;
      UPDATE public.proveedor_facturas SET subtotal = 100, total = 100,
        tipo_cambio_usd = special, fecha_emision = DATE '0001-01-01' WHERE id = f.invoice;
      IF special <= 1 THEN
        PERFORM pg_temp.exact148_assert((SELECT tc IS NULL FROM public.tc_para_documento(
          DATE '0001-01-01', currency, special, special)), 'missing-FX fixture has no DOF fallback');
      END IF;
      p := pg_temp.exact148_pair(f.ship, f.policy, 'completa',
        'nominal ' || currency || ' with invalid FX ' || special::text);
      PERFORM pg_temp.exact148_assert(p->>'estado_costos' = 'incompleto'
        AND p->'utilidad_mxn' = 'null'::jsonb,
        'complete nominal coverage does not manufacture an accounting FX valuation');
    END LOOP;
  END LOOP;

  -- Cross-currency unknown FX fails closed for both the invoice and premium.
  FOR c IN SELECT * FROM (VALUES
    ('missing_invoice_fx', 'USD', 'MXN', 0::numeric, 0::numeric),
    ('nan_invoice_fx', 'USD', 'MXN', 'NaN'::numeric, 20),
    ('infinite_invoice_fx', 'USD', 'MXN', 'Infinity'::numeric, 20),
    ('missing_premium_fx', 'MXN', 'USD', 20, 0),
    ('nan_premium_fx', 'MXN', 'USD', 20, 'NaN'::numeric),
    ('infinite_premium_fx', 'MXN', 'USD', 20, 'Infinity'::numeric)
  ) AS cases(label, invoice_currency, premium_currency, doc_fx, ship_fx)
  LOOP
    n := n + 1;
    SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider,
      category, client, n, c.invoice_currency, 100, c.premium_currency);
    UPDATE public.embarques SET tipo_cambio_usd = nullif(c.ship_fx, 0) WHERE id = f.ship;
    UPDATE public.proveedor_facturas SET tipo_cambio_usd = c.doc_fx,
      fecha_emision = DATE '0001-01-01' WHERE id = f.invoice;
    p := pg_temp.exact148_pair(f.ship, f.policy, 'sin_valoracion', c.label);
  END LOOP;

  -- Negative effective quantity wins even if it cancels the allocation sum
  -- to zero and a header fallback would otherwise appear to cover premium zero.
  n := n + 1;
  SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n, 'MXN', 0);
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, 100, 1);
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.second_concept, 100, -1);
  p := pg_temp.exact148_pair(f.ship, f.policy, 'asignacion_indeterminada',
    'negative quantity cancellation does not revive header fallback');

  n := n + 1;
  SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n, 'MXN', 0);
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.other_concept, 1);
  p := pg_temp.exact148_pair(f.ship, f.policy, 'sin_atribucion',
    'zero premium cannot revive header excluded by positive allocations elsewhere');

  -- Numeric special values are admitted by the unconstrained allocation schema.
  -- Exercise real reader/trigger operands without inserting invalid invoice
  -- totals (those are independently prohibited by total consistency CHECK).
  FOR c IN SELECT * FROM (VALUES
    ('nan_allocation_amount', 'NaN'::numeric, 1::numeric),
    ('infinite_allocation_amount', 'Infinity'::numeric, 1),
    ('negative_infinite_allocation_amount', '-Infinity'::numeric, 1),
    ('nan_effective_quantity', 100, 'NaN'::numeric),
    ('infinite_effective_quantity', 100, 'Infinity'::numeric),
    ('negative_infinite_effective_quantity', 100, '-Infinity'::numeric)
  ) AS cases(label, amount, quantity)
  LOOP
    n := n + 1;
    SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n);
    PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, c.amount, c.quantity);
    p := pg_temp.exact148_pair(f.ship, f.policy, 'sin_valoracion', c.label);
  END LOOP;
  n := n + 1;
  SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n);
  SELECT to_jsonb(s) INTO before_row FROM public.seguros_embarque s WHERE id = f.policy;
  PERFORM pg_temp.exact148_reject(format(
    'UPDATE public.seguros_embarque SET prima=''NaN''::numeric WHERE id=%L', f.policy),
    'premium NaN rejected before numeric comparison');
  PERFORM pg_temp.exact148_assert((SELECT to_jsonb(s) FROM public.seguros_embarque s
    WHERE id = f.policy) = before_row, 'premium NaN rejection preserves entire policy');

  -- Exact intermediate scale is bounded by PostgreSQL numeric's 16383 limit.
  -- Values are tiny rather than expensive large random fixtures. These tests
  -- distinguish a supported boundary, forbidden silent product rounding and
  -- symbolic cancellation that avoids an unnecessary product altogether.
  FOR c IN SELECT * FROM (VALUES
    ('numerator_scale16383_supported', 1e-8192::numeric, 1e-8191::numeric, 2e-8191::numeric, 'completa'),
    ('numerator_scale18000_unknown', 1e-9000, 1e-9000, 2e-9000, 'sin_valoracion'),
    ('direct_cancellation_avoids_scale18000', 1e-9000, 1e-9000, 1e-9000, 'completa')
  ) AS cases(label, b, s, a, expected)
  LOOP
    n := n + 1;
    SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n, 'MXN', 0);
    UPDATE public.proveedor_facturas SET subtotal = c.b, total = c.b WHERE id = f.invoice;
    PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, c.s);
    IF c.a > c.s THEN
      PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.other_concept, c.a - c.s);
    END IF;
    p := pg_temp.exact148_pair(f.ship, f.policy, c.expected, c.label);
  END LOOP;
  FOR c IN SELECT * FROM (VALUES
    ('allocation_product_scale16383_supported', 1e-8191::numeric, 'completa'),
    ('allocation_product_scale16384_unknown', 1e-8192::numeric, 'sin_valoracion')
  ) AS cases(label, quantity, expected)
  LOOP
    n := n + 1;
    SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n, 'MXN', 0);
    PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, 1e-8192, c.quantity);
    p := pg_temp.exact148_pair(f.ship, f.policy, c.expected, c.label);
  END LOOP;

  -- Only the new comparison P*A overflows. Accounting's selected-line B*S,
  -- total A and legacy ratios remain representable, so the whole reader must
  -- return a conservative diagnostic rather than abort on coverage arithmetic.
  n := n + 1;
  SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider,
    category, client, n, 'MXN', 999999999999.99);
  UPDATE public.proveedor_facturas SET subtotal = 100, total = 100 WHERE id = f.invoice;
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, 1);
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.other_concept, 1e131065 - 1);
  p := pg_temp.exact148_pair(f.ship, f.policy, 'sin_valoracion',
    'comparison overflow is per-coverage unknown without aborting P&L');

  -- An applied credit lowers accounting cost/debt, never documentary coverage.
  n := n + 1;
  SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n);
  UPDATE public.proveedor_facturas SET embarque_id = NULL, subtotal = 100,
    iva = 16, total = 116 WHERE id = f.invoice;
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, 33.3333);
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.second_concept, 66.6667);
  credit := gen_random_uuid();
  INSERT INTO public.proveedor_notas_credito(id, organization_id,
    proveedor_factura_id, fecha, monto, subtotal, moneda, estado)
  VALUES(credit, orgs.org_a, f.invoice, CURRENT_DATE, 58, 50, 'MXN', 'Borrador');
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada' WHERE id = credit;
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada' WHERE id = credit;
  p := pg_temp.exact148_pair(f.ship, f.policy, 'completa', 'applied NC preserves gross documentary base');
  PERFORM pg_temp.exact148_assert((p#>>'{costo,real_mxn}')::numeric = 50
    AND (p#>>'{costo,pdte_pago_mxn}')::numeric = 58,
    'applied NC changes cost/debt once without residual insurance premium');

  -- Actual fiscal edit after a valid policy: unchanged allocations are capped
  -- to the new subtotal; tax does not hide the shortfall and the link remains.
  n := n + 1;
  SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n);
  UPDATE public.proveedor_facturas SET embarque_id = NULL, subtotal = 200.01,
    iva = 32.0016, total = 232.0116 WHERE id = f.invoice;
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, 100);
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.other_concept, 100);
  p := pg_temp.exact148_pair(f.ship, f.policy, 'completa', 'pre-discount equality');
  UPDATE public.proveedor_facturas SET subtotal = 199.99, iva = 31.9984, total = 231.9884 WHERE id = f.invoice;
  p := pg_temp.exact148_pair(f.ship, f.policy, 'insuficiente', 'actual fiscal reduction caps preserved allocations');

  -- A real allocation-only cascade: invoice header is NULL and both linked
  -- concepts must restore BEFORE the policy, while the shipment is still deleted.
  n := n + 1;
  SELECT * INTO STRICT f FROM pg_temp.exact148_fixture(orgs.org_a, provider, category, client, n);
  UPDATE public.proveedor_facturas SET embarque_id = NULL, subtotal = 100, total = 100 WHERE id = f.invoice;
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.concept, 33.3333);
  PERFORM pg_temp.exact148_line(orgs.org_a, f.invoice, f.second_concept, 66.6667);
  stamp := clock_timestamp();
  UPDATE public.conceptos_costo SET deleted_at = stamp WHERE id IN (f.concept, f.second_concept);
  UPDATE public.seguros_embarque SET deleted_at = stamp WHERE id = f.policy;
  UPDATE public.embarques SET deleted_at = stamp WHERE id = f.ship;
  PERFORM public.restaurar_embarque_cascade(f.ship);
  PERFORM pg_temp.exact148_assert((SELECT deleted_at IS NULL FROM public.embarques WHERE id = f.ship)
    AND (SELECT deleted_at IS NULL AND proveedor_factura_id = f.invoice FROM public.seguros_embarque WHERE id = f.policy)
    AND (SELECT count(*) = 2 FROM public.conceptos_costo WHERE id IN (f.concept, f.second_concept) AND deleted_at IS NULL)
    AND (SELECT embarque_id IS NULL FROM public.proveedor_facturas WHERE id = f.invoice)
    AND (SELECT count(*) = 2 FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = f.invoice AND concepto_costo_id IN (f.concept, f.second_concept)),
    'allocation-only real cascade restores all dependencies without inventing header membership');
  p := pg_temp.exact148_pair(f.ship, f.policy, 'completa', 'allocation-only cascade reader/writer parity');
  stamp := clock_timestamp();
  UPDATE public.conceptos_costo SET deleted_at = stamp WHERE id IN (f.concept, f.second_concept);
  UPDATE public.seguros_embarque SET deleted_at = stamp WHERE id = f.policy;
  UPDATE public.embarques SET deleted_at = stamp WHERE id = f.ship;
  UPDATE public.proveedor_facturas SET subtotal = 60, total = 60 WHERE id = f.invoice;
  PERFORM pg_temp.as_postgres();
  SELECT jsonb_build_object(
    'shipment', (SELECT to_jsonb(e) FROM public.embarques e WHERE id = f.ship),
    'policy', (SELECT to_jsonb(s) FROM public.seguros_embarque s WHERE id = f.policy),
    'concepts', (SELECT jsonb_agg(to_jsonb(cc) ORDER BY id) FROM public.conceptos_costo cc
      WHERE id IN (f.concept, f.second_concept))) INTO before_row;
  PERFORM pg_temp.as_user(orgs.admin_a);
  PERFORM pg_temp.exact148_reject(format('SELECT public.restaurar_embarque_cascade(%L)', f.ship),
    'insufficient allocation-only cascade rejects after concepts are tentatively restored');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.exact148_assert(jsonb_build_object(
    'shipment', (SELECT to_jsonb(e) FROM public.embarques e WHERE id = f.ship),
    'policy', (SELECT to_jsonb(s) FROM public.seguros_embarque s WHERE id = f.policy),
    'concepts', (SELECT jsonb_agg(to_jsonb(cc) ORDER BY id) FROM public.conceptos_costo cc
      WHERE id IN (f.concept, f.second_concept))) = before_row,
    'failed allocation-only cascade rolls back both concepts, policy and shipment');
  RAISE NOTICE 'PASS: exact coverage suite completed % isolated fixtures', n;
END $cases$;
ROLLBACK;
