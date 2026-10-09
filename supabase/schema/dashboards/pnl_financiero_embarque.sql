-- Audit 124/129/130: canonical supplier allocation and explicit incomplete costs.
-- Read-only calculation; no historical data rewrite. Existing ACL unchanged.
CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque(_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tc_usd numeric; _tc_eur numeric; _org uuid;
  _base jsonb;
  -- Audit132: local reader state only; no helper/RPC or persisted valuation.
  _invoice record; _note record; _line_income record;
  _nc_conceptos jsonb; _nc_base numeric; _nc_base_factura numeric;
  _nc_moneda text; _nc_tc numeric; _factura_moneda text; _factura_tc numeric;
  _fnc_data jsonb := '[]'; _net_data jsonb := '[]';
  _detail_data jsonb := '{}'; _detail_rows jsonb := '[]';
  _factor numeric; _tagged numeric; _shipment numeric; _tc_doc numeric;
  -- Audit144: read-only attribution; never manufacture historical lineage.
  _nc_line record; _note_credit numeric; _line_credit numeric;
  _running_base numeric; _running_doc numeric; _previous_doc numeric;
  _note_total_doc numeric; _all_credit_doc numeric; _note_credit_mxn numeric; _invoice_credit_mxn numeric;
  _note_detail jsonb; _invoice_proportional boolean;
  _subtotal numeric; _credit numeric; _net numeric; _net_mxn numeric;
  _credit_mxn numeric; _line_mxn numeric; _detail_sum numeric;
  _income_total numeric := 0; _pending_total numeric := 0;
  _invoice_bad boolean; _invoice_valued boolean; _income_overflow boolean := false;
  _line_name text; _nc_count bigint; _tagged_shipments bigint;
  _invoice_count bigint := 0; _active_nc bigint := 0; _nc_no_base bigint := 0;
  _nc_no_value bigint := 0; _invoice_no_value bigint := 0;
  _proportional bigint := 0; _overflows bigint := 0;
  _income_incomplete boolean;
  -- Audit 148 exact documentary coverage; private state, no new callable API.
  _cov_policy record; _cov_invoice record; _cov_org uuid;
  _cov_a numeric; _cov_s numeric; _cov_n numeric; _cov_c numeric;
  _cov_p numeric; _cov_r numeric; _cov_tc numeric; _cov_fx numeric;
  _cov_usd numeric; _cov_eur numeric; _cov_base_mxn numeric;
  _cov_bad boolean; _cov_negative boolean; _cov_full boolean;
  _cov_state text;
  _cov_data jsonb := '[]';

BEGIN
  SELECT COALESCE(tipo_cambio_usd,0), COALESCE(tipo_cambio_eur,0), organization_id
    INTO _tc_usd, _tc_eur, _org
  FROM public.embarques WHERE id = _embarque_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque % no encontrado', _embarque_id;
  END IF;
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND _org IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'Sin acceso al embarque %', _embarque_id USING ERRCODE='42501';
  END IF;

  -- Keep invoice membership and gross attribution; NC lines use exact lineage. Every
  -- numeric operation introduced by the income path is guarded per document;
  -- an unknown NC never silently becomes a valid zero discount.
  FOR _invoice IN
    SELECT fa.* FROM public.facturas fa
    WHERE fa.deleted_at IS NULL
      AND fa.estado::text NOT IN ('Borrador','Cancelada','Sustituida')
      AND (fa.embarque_id = _embarque_id OR EXISTS (
        SELECT 1 FROM public.conceptos_factura cf
        WHERE cf.factura_id = fa.id AND cf.deleted_at IS NULL
          AND cf.embarque_id = _embarque_id))
    ORDER BY fa.id
  LOOP
    _invoice_bad := false; _invoice_proportional := false;
    _factor := NULL; _subtotal := NULL; _net := NULL; _net_mxn := NULL;
    _credit := 0; _all_credit_doc := 0; _invoice_credit_mxn := 0; _nc_count := 0; _tc_doc := NULL; _tagged_shipments := 0;
    _factura_moneda := _invoice.moneda::text;
    _factura_tc := _invoice.tipo_cambio;
    BEGIN
      SELECT coalesce(sum(coalesce(cf.total,0)) FILTER (WHERE cf.embarque_id IS NOT NULL),0),
             coalesce(sum(coalesce(cf.total,0)) FILTER (WHERE cf.embarque_id = _embarque_id),0),
             count(DISTINCT cf.embarque_id)
        INTO _tagged, _shipment, _tagged_shipments
      FROM public.conceptos_factura cf
      WHERE cf.factura_id = _invoice.id AND cf.deleted_at IS NULL;
      _factor := CASE WHEN _tagged > 0 THEN _shipment / _tagged
        WHEN _invoice.embarque_id = _embarque_id THEN 1::numeric ELSE 0::numeric END;
      IF _factor::text IN ('NaN','Infinity','-Infinity')
        OR _tagged::text IN ('NaN','Infinity','-Infinity')
        OR _shipment::text IN ('NaN','Infinity','-Infinity') THEN _factor := NULL; END IF;
    EXCEPTION WHEN numeric_value_out_of_range THEN
      _overflows := _overflows + 1;
    END;
    IF _factor <= 0 THEN CONTINUE; END IF;
    _invoice_count := _invoice_count + 1;
    BEGIN
      SELECT t.tc INTO _tc_doc FROM public.tc_para_documento(
        _invoice.fecha_emision, _factura_moneda, _factura_tc,
        CASE WHEN _factura_moneda = 'EUR' THEN _tc_eur ELSE _tc_usd END) t;
      IF _factor IS NOT NULL AND _invoice.subtotal IS NOT NULL
        AND _invoice.subtotal::text NOT IN ('NaN','Infinity','-Infinity')
        AND _factura_moneda IN ('MXN','USD','EUR')
        AND (_factura_moneda = 'MXN' OR (_tc_doc > 1
          AND _tc_doc::text NOT IN ('NaN','Infinity','-Infinity'))) THEN
        _subtotal := round(_invoice.subtotal * _factor,2);
        -- Validate invoice -> MXN even when no NC exists or its net is zero.
        _net_mxn := public.a_mxn(_subtotal,_factura_moneda,_tc_doc,_tc_doc);
      END IF;
    EXCEPTION WHEN numeric_value_out_of_range THEN
      _subtotal := NULL; _net_mxn := NULL; _overflows := _overflows + 1;
    END;
    _invoice_bad := _net_mxn IS NULL;
    FOR _note IN SELECT n.* FROM public.factura_notas_credito n
      WHERE n.factura_id = _invoice.id AND n.deleted_at IS NULL
        AND n.estado::text IN ('Timbrada','Aplicada') ORDER BY n.id
    LOOP
      _active_nc := _active_nc + 1; _nc_count := _nc_count + 1;
      _nc_conceptos := _note.conceptos;
      _nc_moneda := _note.moneda::text; _nc_tc := _note.tipo_cambio;
-- Local block for an EXISTING PL/pgSQL reader. This is not a new function/RPC.
-- Input: _nc_conceptos jsonb. Output: _nc_base numeric (NULL = unknown).
-- The NC draft persists its discount in precio_unitario; never discount twice.
-- Non-economic metadata (taxes, description, lineage) does not set this base.
<<credit132_parse_base>>
DECLARE
  _line jsonb;
  _q_text text;
  _p_text text;
  _q numeric;
  _p numeric;
  _sum numeric := 0;
  _decimal constant text := '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$';
BEGIN
  _nc_base := NULL;
  IF jsonb_typeof(_nc_conceptos) IS DISTINCT FROM 'array' THEN
    EXIT credit132_parse_base;
  END IF;
  IF jsonb_array_length(_nc_conceptos) = 0 THEN
    EXIT credit132_parse_base;
  END IF;
  FOR _line IN SELECT value FROM jsonb_array_elements(_nc_conceptos) LOOP
    IF jsonb_typeof(_line) IS DISTINCT FROM 'object'
      OR coalesce(jsonb_typeof(_line->'cantidad'),'null') NOT IN ('number','string')
      OR coalesce(jsonb_typeof(_line->'precio_unitario'),'null') NOT IN ('number','string') THEN
      EXIT credit132_parse_base;
    END IF;
    _q_text := btrim(_line->>'cantidad');
    _p_text := btrim(_line->>'precio_unitario');
    IF _q_text !~ _decimal OR _p_text !~ _decimal THEN
      EXIT credit132_parse_base;
    END IF;
    _q := _q_text::numeric;
    _p := _p_text::numeric;
    IF _q <= 0 OR _p < 0 THEN
      EXIT credit132_parse_base;
    END IF;
    -- Match subtotalLinea: round AFTER multiplication, separately per line.
    -- Cast, multiplication, rounding and total overflow all fail closed below.
    _sum := _sum + round(_q * _p, 2);
  END LOOP;
  _nc_base := _sum;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    _nc_base := NULL;
END credit132_parse_base;
-- Local block for an EXISTING PL/pgSQL reader. This is not a new function/RPC.
-- Inputs: _nc_base numeric, _nc_moneda text, _nc_tc numeric,
--         _factura_moneda text, _factura_tc numeric.
-- Output: _nc_base_factura numeric. NULL must propagate into incompleteness.
-- The existing helper returns 0 for invalid TC: validate BEFORE calling it.
<<credit132_convert_base>>
BEGIN
  _nc_base_factura := NULL;
  IF _nc_base IS NULL OR _nc_base < 0
    OR _nc_base::text IN ('NaN','Infinity','-Infinity')
    OR coalesce(_nc_moneda,'') NOT IN ('MXN','USD','EUR')
    OR coalesce(_factura_moneda,'') NOT IN ('MXN','USD','EUR') THEN
    EXIT credit132_convert_base;
  END IF;
  IF _nc_moneda <> _factura_moneda THEN
    IF _nc_moneda <> 'MXN' AND (
      _nc_tc IS NULL OR _nc_tc <= 1
      OR _nc_tc::text IN ('NaN','Infinity','-Infinity')) THEN
      EXIT credit132_convert_base;
    END IF;
    IF _factura_moneda <> 'MXN' AND (
      _factura_tc IS NULL OR _factura_tc <= 1
      OR _factura_tc::text IN ('NaN','Infinity','-Infinity')) THEN
      EXIT credit132_convert_base;
    END IF;
  END IF;
  _nc_base_factura := public.nc_convertida_a_moneda_factura(
    _nc_base, _nc_moneda, _nc_tc, _factura_moneda, _factura_tc);
EXCEPTION
  WHEN numeric_value_out_of_range THEN
    _nc_base_factura := NULL;
END credit132_convert_base;

      _credit_mxn := NULL;
      _note_credit := 0; _note_credit_mxn := 0; _note_detail := '[]';
      _note_total_doc := _nc_base_factura;
      _running_base := 0; _previous_doc := 0;
      IF _nc_base IS NULL THEN _nc_no_base := _nc_no_base + 1; END IF;
      BEGIN
        -- The reviewed132 parser/conversion above validate the WHOLE note first.
        -- An invalid line never leaves a partially credited, apparently known NC.
        IF _nc_base_factura IS NOT NULL THEN
          FOR _nc_line IN
            SELECT cf.id AS source_id, cf.embarque_id,
                   lower(trim(coalesce(nullif(cf.descripcion,''),'(sin concepto)'))) AS concepto,
                   round((l->>'cantidad')::numeric * (l->>'precio_unitario')::numeric,2) AS base
            FROM jsonb_array_elements(_nc_conceptos) WITH ORDINALITY AS lines(l,position)
            LEFT JOIN public.conceptos_factura cf
              ON cf.id = CASE WHEN lower(btrim(l->>'concepto_factura_id'))
                   ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 THEN lower(btrim(l->>'concepto_factura_id'))::uuid END
              AND cf.factura_id = _invoice.id AND cf.organization_id = _org
              AND _invoice.organization_id = _org AND _note.organization_id = _org
              AND cf.deleted_at IS NULL AND cf.embarque_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM public.embarques e
                WHERE e.id = cf.embarque_id AND e.organization_id = _org AND e.deleted_at IS NULL)
            ORDER BY lines.position
          LOOP
            -- Cumulative conversion preserves132's full converted note exactly.
            -- Never round/convert each tiny line independently then add it up.
            _running_base := _running_base + _nc_line.base;
            _running_doc := CASE WHEN _running_base = _nc_base THEN _nc_base_factura
              ELSE public.nc_convertida_a_moneda_factura(
                _running_base,_nc_moneda,_nc_tc,_factura_moneda,_factura_tc) END;
            _line_credit := CASE WHEN _nc_line.source_id IS NULL
              THEN _running_doc * _factor - _previous_doc * _factor
              ELSE _running_doc - _previous_doc END;
            _line_mxn := NULL;
            IF _factura_moneda = 'MXN' OR (_tc_doc > 1
              AND _tc_doc::text NOT IN ('NaN','Infinity','-Infinity')) THEN
              -- Allocate the rounded GLOBAL invoice debit before shipment filtering.
              -- All line debits telescope to132's full converted invoice net; tiny
              -- FX residues follow persisted JSON order instead of being duplicated.
              _line_mxn := (public.a_mxn(_invoice.subtotal-_all_credit_doc-_previous_doc,_factura_moneda,_tc_doc,_tc_doc)
                - public.a_mxn(_invoice.subtotal-_all_credit_doc-_running_doc,_factura_moneda,_tc_doc,_tc_doc))
                * CASE WHEN _nc_line.source_id IS NULL THEN _factor ELSE 1::numeric END;
            END IF;
            _previous_doc := _running_doc;
            IF _nc_line.source_id IS NULL THEN
              -- Missing, malformed, orphaned or inconsistent lineage stays provisional.
              -- This also warns for a legacy single-shipment invoice: its concept is unknown.
              _invoice_proportional := true;
            ELSIF _nc_line.embarque_id <> _embarque_id THEN
              CONTINUE; -- The selected credit must never reduce a different shipment.
            END IF;
            _note_credit := _note_credit + _line_credit;
            _note_credit_mxn := _note_credit_mxn + _line_mxn;
            _note_detail := _note_detail || jsonb_build_array(jsonb_build_object(
              'concepto',CASE WHEN _nc_line.source_id IS NULL THEN '(nota de crédito)' ELSE _nc_line.concepto END,
              'monto_mxn',_line_mxn));
          END LOOP;
          _nc_base_factura := _note_credit;
          IF _note_credit IS NOT NULL AND (_factura_moneda = 'MXN' OR (_tc_doc > 1
            AND _tc_doc::text NOT IN ('NaN','Infinity','-Infinity'))) THEN
            _credit_mxn := _note_credit_mxn;
          END IF;
          IF _credit_mxn IS NOT NULL AND _credit IS NOT NULL THEN
            DECLARE
              next_credit numeric; next_mxn numeric; next_all numeric;
            BEGIN
              -- Publish all accumulators together only after every sum succeeds.
              next_credit := _credit + _note_credit;
              next_mxn := _invoice_credit_mxn + _note_credit_mxn;
              next_all := _all_credit_doc + _note_total_doc;
              _credit := next_credit; _invoice_credit_mxn := next_mxn; _all_credit_doc := next_all;
            END;
          END IF;
        END IF;
      EXCEPTION WHEN numeric_value_out_of_range THEN
        _nc_base_factura := NULL; _credit_mxn := NULL;
        _overflows := _overflows + 1;
      END;
      IF _nc_base IS NOT NULL AND _credit_mxn IS NULL THEN
        _nc_no_value := _nc_no_value + 1;
      END IF;
      IF _credit_mxn IS NULL THEN
        -- Discard partial details if any conversion/operation was indeterminate.
        _note_detail := jsonb_build_array(jsonb_build_object(
          'concepto','(nota de crédito)','monto_mxn',NULL));
      END IF;
      _fnc_data := _fnc_data || _note_detail;
    END LOOP;
    IF _invoice_proportional THEN _proportional := _proportional + 1; END IF;
    BEGIN
      IF NOT _invoice_bad THEN
        _net := _subtotal - _credit;
        _net_mxn := public.a_mxn(_subtotal,_factura_moneda,_tc_doc,_tc_doc) - _invoice_credit_mxn;
        _income_total := _income_total + _net_mxn;
      END IF;
    EXCEPTION WHEN numeric_value_out_of_range THEN
      _net := NULL; _net_mxn := NULL; _invoice_bad := true;
      _income_overflow := true; _overflows := _overflows + 1;
    END;
    _net_data := _net_data || jsonb_build_array(jsonb_build_object(
      'id',_invoice.id,'moneda',_factura_moneda,'estado',_invoice.estado,
      'tc_doc',_tc_doc,'monto',_net,'monto_mxn',_net_mxn));
    BEGIN
      IF _invoice.estado::text IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar') THEN
        IF _invoice_bad THEN _pending_total := NULL;
        ELSE _pending_total := _pending_total + public.a_mxn(
          public.saldo_factura(_invoice.id) * _factor,_factura_moneda,_tc_doc,_tc_doc);
          IF _pending_total::text IN ('NaN','Infinity','-Infinity') THEN
            _pending_total := NULL; _invoice_bad := true;
          END IF;
        END IF;
      END IF;
    EXCEPTION WHEN numeric_value_out_of_range THEN
      _pending_total := NULL; _invoice_bad := true; _overflows := _overflows + 1;
    END;
    -- Preserve positive line attribution; attributed NC details below reconcile
    -- to the same exact/provisional debit as the headline, including NULLs.
    _invoice_valued := NOT _invoice_bad;
    FOR _line_income IN
      SELECT lower(trim(coalesce(nullif(cf.descripcion,''),'(sin concepto)'))) AS concepto,
             cf.total, cf.embarque_id
      FROM public.conceptos_factura cf
      WHERE cf.factura_id = _invoice.id AND cf.deleted_at IS NULL
        AND (cf.embarque_id = _embarque_id OR cf.embarque_id IS NULL)
    LOOP
      _line_mxn := NULL;
      BEGIN
        IF coalesce(_line_income.total,0)::text IN ('NaN','Infinity','-Infinity') THEN
          _invoice_bad := true;
        END IF;
        IF _invoice_valued AND coalesce(_line_income.total,0)::text
          NOT IN ('NaN','Infinity','-Infinity') THEN
          _line_mxn := public.a_mxn(coalesce(_line_income.total,0)
            * CASE WHEN _line_income.embarque_id = _embarque_id THEN 1::numeric ELSE _factor END,
            _factura_moneda,_tc_doc,_tc_doc);
        END IF;
      EXCEPTION WHEN numeric_value_out_of_range THEN
        _invoice_bad := true; _overflows := _overflows + 1;
      END;
      _detail_rows := _detail_rows || jsonb_build_array(jsonb_build_object(
        'concepto',_line_income.concepto,'real_mxn',_line_mxn));
    END LOOP;
    IF _invoice_bad THEN _invoice_no_value := _invoice_no_value + 1; END IF;
  END LOOP;
  _detail_rows := _detail_rows || coalesce((SELECT jsonb_agg(jsonb_build_object(
    'concepto',n.concepto,'real_mxn',-n.monto_mxn))
    FROM jsonb_to_recordset(_fnc_data) n(concepto text,monto_mxn numeric)),'[]'::jsonb);
  FOR _line_income IN SELECT * FROM jsonb_to_recordset(_detail_rows)
    AS x(concepto text,real_mxn numeric)
  LOOP
    _line_name := _line_income.concepto;
    BEGIN
      _detail_sum := CASE WHEN _detail_data ? _line_name
        THEN (_detail_data->>_line_name)::numeric ELSE 0::numeric END;
      _detail_sum := _detail_sum + _line_income.real_mxn;
    EXCEPTION WHEN numeric_value_out_of_range THEN
      _detail_sum := NULL; _income_overflow := true; _overflows := _overflows + 1;
    END;
    _detail_data := jsonb_set(_detail_data,ARRAY[_line_name],coalesce(to_jsonb(_detail_sum),'null'::jsonb));
  END LOOP;
  IF _income_overflow THEN _income_total := NULL; END IF;
  _income_incomplete := _nc_no_base > 0 OR _nc_no_value > 0
    OR _invoice_no_value > 0 OR _proportional > 0 OR _overflows > 0;
  -- Insurance coverage is isolated per policy. Existing supplier cost,
  -- credit-note, debt and detail CTEs below keep their original arithmetic.
  _cov_usd := _tc_usd; _cov_eur := _tc_eur; _cov_org := _org;
  FOR _cov_policy IN SELECT s.* FROM public.seguros_embarque s
    WHERE s.embarque_id = _embarque_id AND s.deleted_at IS NULL
      AND s.proveedor_factura_id IS NOT NULL
    ORDER BY s.id
  LOOP
  -- The reader and existing write trigger use this identical decision block.
  -- B*S/A remains a rational until comparison. No quotient establishes
  -- membership or complete coverage; accounting factors remain unchanged.
  _cov_state := 'sin_atribucion'; _cov_base_mxn := NULL;
  _cov_c := NULL; _cov_n := NULL; _cov_tc := NULL; _cov_full := false;
  <<exact_coverage>>
  BEGIN
    SELECT pf.* INTO _cov_invoice FROM public.proveedor_facturas pf
      WHERE pf.id = _cov_policy.proveedor_factura_id
        AND pf.organization_id = _cov_org
        AND pf.deleted_at IS NULL AND pf.estado::text NOT IN ('Borrador','Cancelada');
    IF NOT FOUND THEN EXIT exact_coverage; END IF;
    IF _cov_invoice.subtotal IS NULL
      OR _cov_invoice.subtotal::text IN ('NaN','Infinity','-Infinity') THEN
      EXIT exact_coverage;
    END IF;
    IF _cov_invoice.subtotal < 0 THEN EXIT exact_coverage; END IF;
    _cov_p := _cov_policy.prima;
    IF _cov_p IS NULL OR _cov_p::text IN ('NaN','Infinity','-Infinity') THEN
      _cov_state := 'sin_valoracion'; EXIT exact_coverage;
    END IF;
    IF _cov_p < 0 THEN _cov_state := 'sin_valoracion'; EXIT exact_coverage; END IF;
    -- Validate BEFORE arithmetic. PostgreSQL numeric multiplication can silently
    -- round at scale 16383; unsupported intermediate scale is unknown/rejected,
    -- never epsilon or a rounded product. Integer-digit overflow is caught below.
    SELECT coalesce(bool_or(pfc.monto::text IN ('NaN','Infinity','-Infinity')
             OR coalesce(nullif(pfc.cantidad,0),1)::text IN ('NaN','Infinity','-Infinity')
             OR scale(pfc.monto)+scale(coalesce(nullif(pfc.cantidad,0),1)) > 16383),false),
           coalesce(bool_or(coalesce(nullif(pfc.cantidad,0),1) < 0),false)
      INTO _cov_bad, _cov_negative
      FROM public.proveedor_facturas_conceptos pfc
      JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
      WHERE pfc.proveedor_factura_id = _cov_invoice.id
        AND cc.deleted_at IS NULL AND cc.organization_id = _cov_org
        AND cc.origen <> 'ajuste_factura_proveedor'
        AND (pfc.monto > 0 OR pfc.monto::text IN ('NaN','Infinity','-Infinity'));
    IF _cov_bad THEN _cov_state := 'sin_valoracion'; EXIT exact_coverage; END IF;
    IF _cov_negative THEN _cov_state := 'asignacion_indeterminada'; EXIT exact_coverage; END IF;
    SELECT coalesce(sum(pfc.monto * coalesce(nullif(pfc.cantidad,0),1)),0),
           coalesce(sum(pfc.monto * coalesce(nullif(pfc.cantidad,0),1))
             FILTER (WHERE cc.embarque_id = _cov_policy.embarque_id),0)
      INTO _cov_a, _cov_s
      FROM public.proveedor_facturas_conceptos pfc
      JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
      WHERE pfc.proveedor_factura_id = _cov_invoice.id
        AND cc.deleted_at IS NULL AND cc.organization_id = _cov_org
        AND cc.origen <> 'ajuste_factura_proveedor' AND pfc.monto > 0;
    IF _cov_a > 0 AND _cov_s > 0 THEN
      -- Cancel identities symbolically before any potentially large product.
      IF _cov_invoice.subtotal >= _cov_a THEN _cov_c := _cov_s;
      ELSIF _cov_s = _cov_a THEN _cov_c := _cov_invoice.subtotal;
      ELSE
        IF scale(_cov_invoice.subtotal)+scale(_cov_s) > 16383 THEN
          _cov_state := 'sin_valoracion'; EXIT exact_coverage;
        END IF;
        _cov_n := _cov_invoice.subtotal * _cov_s;
      END IF;
    ELSIF _cov_a = 0 AND _cov_invoice.embarque_id = _cov_policy.embarque_id THEN
      _cov_c := _cov_invoice.subtotal;
    ELSE EXIT exact_coverage;
    END IF;
    IF _cov_invoice.moneda::text = _cov_policy.moneda::text THEN
      IF _cov_c IS NOT NULL THEN _cov_full := _cov_c >= _cov_p;
      ELSE
        IF scale(_cov_p)+scale(_cov_a) > 16383 THEN
          _cov_state := 'sin_valoracion'; EXIT exact_coverage;
        END IF;
        _cov_full := _cov_n >= _cov_p * _cov_a;
      END IF;
      _cov_state := CASE WHEN _cov_full THEN 'completa' ELSE 'insuficiente' END;
      -- Nominal eligibility needs no FX. Keep the existing separate diagnostic
      -- that a nominally complete link can still have unvalued accounting cost.
      BEGIN
        SELECT t.tc INTO _cov_tc FROM public.tc_para_documento(
          _cov_invoice.fecha_emision,_cov_invoice.moneda::text,_cov_invoice.tipo_cambio_usd,
          CASE WHEN _cov_invoice.moneda::text = 'EUR' THEN _cov_eur ELSE _cov_usd END) t;
        IF _cov_invoice.moneda::text = 'MXN' OR (_cov_tc > 1
          AND _cov_tc::text NOT IN ('NaN','Infinity','-Infinity')) THEN
          _cov_base_mxn := public.a_mxn(coalesce(_cov_c,
            _cov_invoice.subtotal * (_cov_s / nullif(_cov_a,0))),
            _cov_invoice.moneda::text,_cov_tc,_cov_tc);
          IF _cov_base_mxn::text IN ('NaN','Infinity','-Infinity') THEN _cov_base_mxn := NULL; END IF;
        END IF;
      EXCEPTION WHEN numeric_value_out_of_range OR division_by_zero THEN _cov_base_mxn := NULL;
      END;
      EXIT exact_coverage;
    END IF;
    _cov_state := 'sin_valoracion';
    _cov_fx := CASE WHEN _cov_policy.moneda::text = 'EUR' THEN _cov_eur ELSE _cov_usd END;
    IF _cov_policy.moneda::text <> 'MXN' AND (_cov_fx IS NULL
      OR _cov_fx::text IN ('NaN','Infinity','-Infinity') OR _cov_fx <= 1) THEN EXIT exact_coverage; END IF;
    IF _cov_policy.moneda::text <> 'MXN' AND scale(_cov_p)+scale(_cov_fx) > 16383 THEN EXIT exact_coverage; END IF;
    _cov_r := public.a_mxn(_cov_p,_cov_policy.moneda::text,nullif(_cov_usd,0),nullif(_cov_eur,0));
    IF _cov_r IS NULL OR _cov_r::text IN ('NaN','Infinity','-Infinity') THEN EXIT exact_coverage; END IF;
    -- Premium is stored numeric(14,2); a_mxn foreign output is on the 4-place
    -- grid. Check the precondition rather than silently rely on future schema.
    IF _cov_r <> round(_cov_r,4) THEN EXIT exact_coverage; END IF;
    SELECT t.tc INTO _cov_tc FROM public.tc_para_documento(
      _cov_invoice.fecha_emision,_cov_invoice.moneda::text,_cov_invoice.tipo_cambio_usd,
      CASE WHEN _cov_invoice.moneda::text = 'EUR' THEN _cov_eur ELSE _cov_usd END) t;
    IF _cov_invoice.moneda::text <> 'MXN' AND (_cov_tc IS NULL
      OR _cov_tc::text IN ('NaN','Infinity','-Infinity') OR _cov_tc <= 1) THEN EXIT exact_coverage; END IF;
    IF _cov_c IS NOT NULL THEN
      IF _cov_invoice.moneda::text <> 'MXN' AND scale(_cov_c)+scale(_cov_tc) > 16383 THEN EXIT exact_coverage; END IF;
      _cov_base_mxn := public.a_mxn(_cov_c,_cov_invoice.moneda::text,_cov_tc,_cov_tc);
      IF _cov_base_mxn IS NULL OR _cov_base_mxn::text IN ('NaN','Infinity','-Infinity') THEN EXIT exact_coverage; END IF;
      _cov_full := _cov_base_mxn >= _cov_r;
    ELSIF _cov_invoice.moneda::text = 'MXN' THEN
      IF scale(_cov_r)+scale(_cov_a) > 16383 THEN EXIT exact_coverage; END IF;
      _cov_full := _cov_n >= _cov_r * _cov_a;
      -- This private value is only checked for NULL; no amount is exposed.
      _cov_base_mxn := _cov_invoice.subtotal * (_cov_s / _cov_a);
    ELSIF _cov_invoice.moneda::text IN ('USD','EUR') THEN
      IF scale(_cov_n)+scale(_cov_tc) > 16383
        OR scale(_cov_r)+scale(_cov_a) > 16383 THEN EXIT exact_coverage; END IF;
      -- EXACT inverse of existing round(nonnegative MXN,4), half away from 0.
      -- 20000 is twice the currency grid; it is not a new monetary tolerance.
      _cov_full := _cov_r <= 0 OR 20000 * _cov_n * _cov_tc >= (20000 * _cov_r - 1) * _cov_a;
      _cov_base_mxn := public.a_mxn(_cov_invoice.subtotal * (_cov_s / _cov_a),
        _cov_invoice.moneda::text,_cov_tc,_cov_tc);
    ELSE EXIT exact_coverage;
    END IF;
    _cov_state := CASE WHEN _cov_full THEN 'completa' ELSE 'insuficiente' END;
  EXCEPTION WHEN numeric_value_out_of_range OR division_by_zero THEN
    -- One unrepresentable coverage may not abort all other P&L documents.
    -- The existing writer turns this same unknown state into its coverage error.
    _cov_state := 'sin_valoracion'; _cov_base_mxn := NULL;
  END exact_coverage;
    _cov_data := _cov_data || jsonb_build_array(jsonb_build_object(
      'estado',_cov_state,'base_mxn',_cov_base_mxn));
  END LOOP;
  WITH
  -- P1 (v13.823.274): el presupuesto usa EXCLUSIVAMENTE el T/C congelado del
  -- embarque (misma base que la pestaña Costos). Antes se derivaba del DOF de
  -- ETA/ETD, por lo que el presupuesto cambiaba al mover la ETA.
  cv AS (
    SELECT lower(trim(coalesce(descripcion,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(total,0)::numeric AS monto,
           CASE WHEN UPPER(moneda::text) = 'EUR' THEN NULLIF(_tc_eur,0) ELSE NULLIF(_tc_usd,0) END AS tc_doc
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(monto,0)::numeric AS monto,
           proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           CASE WHEN UPPER(moneda::text) = 'EUR' THEN NULLIF(_tc_eur,0) ELSE NULLIF(_tc_usd,0) END AS tc_doc
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  seg AS (
    SELECT 'seguro de carga'::text AS concepto, moneda::text AS moneda,
           coalesce(prima,0)::numeric AS monto,
           NULL::uuid AS proveedor_id, aseguradora AS proveedor_nombre,
           CASE WHEN UPPER(moneda::text) = 'EUR' THEN NULLIF(_tc_eur,0) ELSE NULLIF(_tc_usd,0) END AS tc_doc
    FROM public.seguros_embarque s
    WHERE s.embarque_id = _embarque_id AND s.deleted_at IS NULL
      -- An existing link is never replaced with a guessed premium/residual.
      -- Its current coverage is diagnosed below from the same canonical pf.
      AND s.proveedor_factura_id IS NULL
  ),
  -- C29 (v13.823.381): una factura fusionada puede cubrir VARIOS embarques
  -- (`factura_embarques` + `conceptos_factura.embarque_id`). Antes se filtraba
  -- por `facturas.embarque_id`, así que el total completo caía en el embarque
  -- del header y los demás quedaban en cero.
  --
  -- Regla de atribución (sólo lectura; no cambia importes guardados):
  --   * Si la factura tiene líneas etiquetadas con embarque, el factor de este
  --     embarque = (líneas de este embarque) / (líneas etiquetadas). La suma de
  --     los factores de todos los embarques es 1, así que el total no se
  --     duplica ni se infla entre P&L.
  --   * Si NO tiene líneas etiquetadas (facturas legacy), se usa el embarque
  --     del header con factor 1 (comportamiento anterior).
  -- Los importes de nivel factura (nota de crédito y saldo) se reparten con el
  -- MISMO factor: es una asignación proporcional explícita a los importes de
  -- las líneas, no un dato fiscal nuevo.
  f_neto AS (
    SELECT * FROM jsonb_to_recordset(_net_data) AS x(id uuid,moneda text,estado text,
      tc_doc numeric,monto numeric,monto_mxn numeric)
  ),
  -- Audit 124/130: allocations and fiscal lines are two representations of
  -- the same expense. Allocations define membership; the header is a fallback
  -- only when there are no active, non-budget-adjustment allocations.
  pf_cand AS (
    SELECT pf.id, pf.proveedor_id, coalesce(pf.proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           pf.embarque_id, pf.total, pf.subtotal::numeric AS base_gravable,
           pf.moneda::text AS moneda, pf.estado::text AS estado,
           (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, pf.moneda::text,
             pf.tipo_cambio_usd, CASE WHEN pf.moneda::text = 'EUR' THEN _tc_eur ELSE _tc_usd END) t) AS tc_doc
    FROM public.proveedor_facturas pf
    WHERE pf.deleted_at IS NULL AND pf.organization_id = _org
      AND pf.estado::text NOT IN ('Borrador','Cancelada')
      AND (pf.embarque_id = _embarque_id OR EXISTS (
        SELECT 1 FROM public.proveedor_facturas_conceptos pfc
        JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
        WHERE pfc.proveedor_factura_id = pf.id AND cc.embarque_id = _embarque_id
          AND cc.deleted_at IS NULL AND cc.origen <> 'ajuste_factura_proveedor'))
  ),
  pf_asignaciones AS (
    SELECT pfc.proveedor_factura_id AS factura_id, cc.embarque_id,
           lower(trim(coalesce(nullif(pfc.descripcion,''),cc.concepto,'(sin concepto)'))) AS concepto,
           pfc.monto * coalesce(nullif(pfc.cantidad,0),1) AS monto,
           coalesce(nullif(pfc.cantidad,0),1) AS cantidad_efectiva
    FROM public.proveedor_facturas_conceptos pfc
    JOIN pf_cand pf ON pf.id = pfc.proveedor_factura_id
    JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
    WHERE cc.deleted_at IS NULL AND cc.organization_id = _org
      AND cc.origen <> 'ajuste_factura_proveedor'
      AND pfc.monto > 0
  ),
  pf_reparto AS (
    SELECT pf.*,
           coalesce((SELECT sum(a.monto) FROM pf_asignaciones a WHERE a.factura_id = pf.id),0) AS asignado,
           coalesce((SELECT sum(a.monto) FROM pf_asignaciones a WHERE a.factura_id = pf.id
             AND a.embarque_id = _embarque_id),0) AS asignado_embarque
    FROM pf_cand pf
  ),
  -- Partial allocation is not permission to expand it. Unassigned residue
  -- remains unassigned, even with an inbox/header origin, and qualifies profit.
  -- A fiscal edit can reduce the invoice below its preserved allocations. Cap
  -- that provisional split proportionally so cost/credit/debt never exceed the
  -- document, without mutating links or treating the distribution as complete.
  pf AS (
    SELECT p.*, CASE WHEN asignado > 0 THEN asignado_embarque / greatest(base_gravable,asignado)
                    WHEN embarque_id = _embarque_id THEN 1::numeric ELSE 0::numeric END AS factor
    FROM pf_reparto p
    WHERE asignado_embarque > 0 OR (asignado = 0 AND embarque_id = _embarque_id)
  ),
  -- Coverage decisions are exact and guarded above, independent of rounded
  -- accounting factors. Aggregate diagnostics retain their existing contract.
  seg_cobertura AS (
    SELECT * FROM jsonb_to_recordset(_cov_data) AS x(estado text,base_mxn numeric)
  ),
  pnc AS (
    -- Expense base is explicit, not gross credit / a guessed tax rate.
    -- Legacy credits without base remain unvalued and qualify the result.
    SELECT n.proveedor_factura_id,
           public.monto_pago_en_moneda_factura(n.subtotal, n.moneda::text, n.tipo_cambio, pf.moneda)
             * pf.factor AS base,
           CASE WHEN n.moneda::text = 'MXN' THEN n.subtotal
                WHEN n.tipo_cambio_mxn > 0 THEN n.subtotal * n.tipo_cambio_mxn END * pf.factor AS base_mxn,
           pf.moneda
    FROM public.proveedor_notas_credito n JOIN pf ON pf.id = n.proveedor_factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  pf_neto AS (
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado, pf.tc_doc,
           pf.base_gravable * pf.factor
             - coalesce((SELECT sum(base) FROM pnc WHERE proveedor_factura_id = pf.id),0) AS monto,
           public.a_mxn(pf.base_gravable * pf.factor, pf.moneda, pf.tc_doc, pf.tc_doc)
             - coalesce((SELECT sum(base_mxn) FROM pnc WHERE proveedor_factura_id = pf.id),0) AS monto_mxn
    FROM pf
  ),
  pf_saldo AS (
    SELECT pf.id, pf.moneda, pf.estado, pf.tc_doc,
           GREATEST(pf.total
             - coalesce((SELECT sum(public.monto_pago_en_moneda_factura(n.monto, n.moneda::text, n.tipo_cambio, pf.moneda))
                 FROM public.proveedor_notas_credito n WHERE n.proveedor_factura_id = pf.id
                   AND n.deleted_at IS NULL AND n.estado::text = 'Aplicada'),0)
             - coalesce((SELECT sum(pp.monto_en_moneda_factura) FROM public.pagos_proveedor pp
                 WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL),0), 0) * pf.factor AS saldo
    FROM pf
  ),
  pf_detalle AS (
    -- Allocated lines replace fiscal lines, and never include budget adjustments.
    -- Apply the same cap as the headline; partial allocations are not expanded.
    SELECT pf.id, a.concepto, pf.moneda, pf.tc_doc,
           a.monto * pf.base_gravable / greatest(pf.base_gravable,pf.asignado) AS monto
    FROM pf JOIN pf_asignaciones a ON a.factura_id = pf.id
    WHERE a.embarque_id = _embarque_id
    UNION ALL
    -- Fiscal monto is a unit amount: quantity is applied exactly once.
    SELECT pf.id, lower(trim(coalesce(nullif(pfc.descripcion,''),'(sin concepto)'))),
           pf.moneda, pf.tc_doc, pfc.monto * coalesce(nullif(pfc.cantidad,0),1)
    FROM pf JOIN public.proveedor_facturas_conceptos pfc ON pfc.proveedor_factura_id = pf.id
    WHERE pf.asignado = 0 AND pfc.concepto_costo_id IS NULL
    UNION ALL
    -- Reconcile missing/partial fiscal detail explicitly to the document base.
    SELECT pf.id, '(factura completa / base sin detalle)'::text, pf.moneda, pf.tc_doc,
           pf.base_gravable - coalesce((SELECT sum(pfc.monto * coalesce(nullif(pfc.cantidad,0),1))
             FROM public.proveedor_facturas_conceptos pfc
             WHERE pfc.proveedor_factura_id = pf.id AND pfc.concepto_costo_id IS NULL),0)
    FROM pf WHERE pf.asignado = 0
  ),
  -- Audit 129: a premium or an unrelated invoice cannot document an active
  -- operational concept. Only its explicit positive effective allocation to a
  -- current canonical supplier invoice establishes documentary presence.
  -- This does not compare the invoiced amount with the budget or alter 124/130.
  cc_documentacion AS (
    SELECT EXISTS (
      SELECT 1 FROM public.proveedor_facturas_conceptos pfc
      JOIN pf ON pf.id = pfc.proveedor_factura_id
      WHERE pfc.concepto_costo_id = c.id AND pfc.monto > 0
        AND pfc.monto * coalesce(nullif(pfc.cantidad,0),1) > 0
    ) AS documentado
    FROM public.conceptos_costo c
    WHERE c.embarque_id = _embarque_id AND c.organization_id = _org
      AND c.deleted_at IS NULL AND c.origen <> 'ajuste_factura_proveedor'
  ),
  estado_costos AS (
    SELECT CASE WHEN (NOT EXISTS (SELECT 1 FROM pf) AND NOT EXISTS (SELECT 1 FROM seg))
      OR EXISTS (SELECT 1 FROM cc_documentacion WHERE NOT documentado)
      OR EXISTS (SELECT 1 FROM pnc WHERE base IS NULL OR base_mxn IS NULL)
      OR EXISTS (SELECT 1 FROM pf WHERE asignado > 0 AND abs(base_gravable - asignado) > 0.01)
      OR EXISTS (SELECT 1 FROM pf WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      OR EXISTS (SELECT 1 FROM seg WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      OR EXISTS (SELECT 1 FROM seg_cobertura WHERE estado <> 'completa' OR base_mxn IS NULL)
      THEN 'incompleto' ELSE 'completo' END AS estado
  ),
  totales AS (
    SELECT
      _income_total AS venta_real_mxn,
      (SELECT coalesce(sum(monto_mxn),0) FROM pf_neto)
        + (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM seg) AS costo_real_mxn
  )
  SELECT jsonb_build_object(
    'embarque_id', _embarque_id,
    'tipo_cambio_usd', _tc_usd,
    'tipo_cambio_eur', _tc_eur,
    'estado_costos', (SELECT estado FROM estado_costos),
    'estado_ingresos', CASE WHEN _income_incomplete THEN 'incompleto' ELSE 'completo' END,
    'ingresos_documentacion', jsonb_build_object(
      'evaluada',true,'facturas',_invoice_count,'notas_credito_activas',_active_nc,
      'notas_credito_sin_base',_nc_no_base,'notas_credito_sin_valoracion',_nc_no_value,
      'facturas_sin_valoracion',_invoice_no_value,'repartos_provisionales',_proportional,
      'desbordamientos',_overflows
    ),
    -- Aggregate presence only; no guessed links, budget equality or identities.
    'costos_documentacion', jsonb_build_object(
      'evaluada', true,
      'conceptos', (SELECT count(*) FROM cc_documentacion),
      'documentados', (SELECT count(*) FROM cc_documentacion WHERE documentado),
      'sin_documentar', (SELECT count(*) FROM cc_documentacion WHERE NOT documentado)
    ),
    -- Additive aggregate only: no new invoice/policy identities or candidates.
    'seguros_cobertura', jsonb_build_object(
      'evaluada', true,
      'vinculados', (SELECT count(*) FROM seg_cobertura),
      'completos', (SELECT count(*) FROM seg_cobertura WHERE estado = 'completa'),
      'inconsistentes', (SELECT count(*) FROM seg_cobertura WHERE estado <> 'completa'),
      'sin_atribucion', (SELECT count(*) FROM seg_cobertura WHERE estado = 'sin_atribucion'),
      'asignacion_indeterminada', (SELECT count(*) FROM seg_cobertura WHERE estado = 'asignacion_indeterminada'),
      'sin_valoracion', (SELECT count(*) FROM seg_cobertura WHERE estado = 'sin_valoracion'),
      'insuficientes', (SELECT count(*) FROM seg_cobertura WHERE estado = 'insuficiente')
    ),
    'notas_credito_sin_base', (SELECT count(*) FROM pnc WHERE base IS NULL OR base_mxn IS NULL),
    'costo_sin_asignar_mxn', (SELECT coalesce(sum(public.a_mxn(greatest(base_gravable-asignado,0), moneda,tc_doc,tc_doc)),0) FROM pf WHERE asignado > 0),
    'facturas_sobreasignadas', (SELECT count(*) FROM pf WHERE asignado > base_gravable + 0.01),
    'costo_sobreasignado_mxn', (SELECT coalesce(sum(public.a_mxn(greatest(asignado-base_gravable,0), moneda,tc_doc,tc_doc)),0) FROM pf WHERE asignado > 0),
    'tc_por_documento', true,
    'excluidos_sin_tc', (
      (SELECT count(*) FROM cv WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      + (SELECT count(*) FROM cc WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      + (SELECT count(*) FROM f_neto WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      + (SELECT count(*) FROM pf_neto WHERE moneda <> 'MXN' AND tc_doc IS NULL)
    ),
    'venta', jsonb_build_object(
      'presupuestada_mxn', (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM cv),
      'real_mxn', t.venta_real_mxn,
      'pdte_cobro_mxn', _pending_total
    ),
    'costo', jsonb_build_object(
      'presupuestado_mxn', (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM cc),
      'real_mxn', t.costo_real_mxn,
      'pdte_pago_mxn', (SELECT coalesce(sum(public.a_mxn(saldo, moneda, tc_doc, tc_doc)),0)
                         FROM pf_saldo)
    ),
    'utilidad_mxn', NULL,
    'por_concepto', (
      SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.real_mxn DESC NULLS LAST, x.presupuestada_mxn DESC), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup),0) AS presupuestada_mxn,
               CASE WHEN count(*) FILTER (WHERE real IS NULL)>0 THEN NULL
                 ELSE coalesce(sum(real),0) END AS real_mxn
        FROM (
          SELECT concepto,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc) AS presup,
                 0::numeric AS real FROM cv
          UNION ALL
          SELECT d.key, 0::numeric, (d.value #>> '{}')::numeric
          FROM jsonb_each(_detail_data) d
        ) u GROUP BY concepto
      ) x
    ),
    'por_concepto_costo', (
      SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY (x.presupuestado_mxn + x.real_mxn) DESC), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup),0) AS presupuestado_mxn,
               coalesce(sum(real),0) AS real_mxn
        FROM (
          SELECT concepto,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc) AS presup,
                 0::numeric AS real FROM cc
          UNION ALL
          SELECT concepto, 0::numeric, public.a_mxn(monto, moneda, tc_doc, tc_doc)
          FROM pf_detalle WHERE monto <> 0
          UNION ALL
          SELECT '(nota de crédito proveedor)'::text, 0::numeric,
                 -pnc.base_mxn
          FROM pnc JOIN pf ON pf.id = pnc.proveedor_factura_id
          UNION ALL
          SELECT concepto, 0::numeric,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc)
          FROM seg
        ) u GROUP BY concepto
      ) x
    ),
    'por_proveedor', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT proveedor_id, proveedor_nombre,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0) AS real_mxn,
               coalesce(sum(facturas_count),0) AS facturas_count
        FROM (
          SELECT proveedor_id, proveedor_nombre,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc) AS presup_mxn,
                 0::numeric AS real_mxn, 0 AS facturas_count FROM cc
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 monto_mxn, 1 FROM pf_neto
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc), 1 FROM seg
        ) u GROUP BY proveedor_id, proveedor_nombre
      ) x
    )
  ) INTO _base FROM totales t;
  BEGIN
    IF NOT _income_incomplete AND _base->>'estado_costos' = 'completo' THEN
      _net := round((_base#>>'{venta,real_mxn}')::numeric - (_base#>>'{costo,real_mxn}')::numeric,2);
      _base := _base || jsonb_build_object('utilidad_mxn',_net,'margen_real_pct',
        CASE WHEN (_base#>>'{venta,real_mxn}')::numeric > 0
          THEN _net / (_base#>>'{venta,real_mxn}')::numeric * 100 ELSE NULL END);
    ELSE
      _base := _base || jsonb_build_object('margen_real_pct',NULL);
    END IF;
  EXCEPTION WHEN numeric_value_out_of_range THEN
    _base := _base || jsonb_build_object('utilidad_mxn',NULL,'margen_real_pct',NULL,
      'estado_ingresos','incompleto');
    _base := jsonb_set(_base,'{ingresos_documentacion,desbordamientos}',to_jsonb(_overflows+1));
  END;
  RETURN _base;
END;
$function$;

REVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated, service_role;
