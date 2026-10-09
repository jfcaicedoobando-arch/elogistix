-- Audit129/132/148: costo documentado, NC economica y cobertura de seguros.
-- Local forward candidate over 46: no release number or manifest assignment.
-- REQUIRES the caller's existing transaction and stop-on-error execution.
-- Does not BEGIN or COMMIT: the caller retains transaction ownership.
-- SAVEPOINT fails before persistent changes if run with psql autocommit.
-- PUBLIC/anon must be closed; authenticated must have this owner's direct grant.
-- service_role is never granted/revoked. Unfamiliar ACLs are rejected unchanged.
-- Pre/post snapshots are transaction-local settings, not persistent helpers.
-- Catalog comparison allows ONLY the intended target prosrc change.
SAVEPOINT pnl_exact_acl_forward;
DO $pnl_acl_pre$
DECLARE
  v_oid oid;
  v_owner oid;
  v_authenticated oid;
  v_anon oid;
  v_service oid;
  v_source_hash text;
  v_before jsonb;
  v_after jsonb;
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_capture CONSTANT text := $pnl_catalog$
SELECT pg_catalog.jsonb_build_object(
 'functions', (SELECT jsonb_agg(CASE WHEN p.oid=$1 THEN to_jsonb(p)-'prosrc' ELSE to_jsonb(p) END ORDER BY p.oid) FROM pg_catalog.pg_proc p),
 'relations', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')),
 'attributes', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')),
 'attribute_defaults', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.oid) FROM pg_catalog.pg_attrdef a JOIN pg_catalog.pg_class c ON c.oid=a.adrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')),
 'constraints', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_catalog.pg_constraint c),
 'triggers', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_trigger t),
 'rewrite_rules', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.oid) FROM pg_catalog.pg_rewrite r),
 'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_catalog.pg_policy p),
 'types', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_type t),
 'enums', (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.oid) FROM pg_catalog.pg_enum e),
 'namespaces', (SELECT jsonb_agg(to_jsonb(n) ORDER BY n.oid) FROM pg_catalog.pg_namespace n),
 'dependencies', (SELECT jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)) FROM pg_catalog.pg_depend d),
 'shared_dependencies', (SELECT jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)) FROM pg_catalog.pg_shdepend d),
 'default_acl', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.oid) FROM pg_catalog.pg_default_acl a),
 'roles', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.rolname) FROM pg_catalog.pg_roles r),
 'memberships', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.oid) FROM pg_catalog.pg_auth_members m),
 'target_acl', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE p.oid=$1),
 'target_effective', (SELECT jsonb_agg(jsonb_build_object('role_oid',r.oid,'role',r.rolname,'execute',pg_catalog.has_function_privilege(r.oid,$1,'EXECUTE'),'grant_option',pg_catalog.has_function_privilege(r.oid,$1,'EXECUTE WITH GRANT OPTION')) ORDER BY r.rolname) FROM pg_catalog.pg_roles r)
)
$pnl_catalog$;
BEGIN
  v_oid := pg_catalog.to_regprocedure('public.pnl_financiero_embarque(uuid)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'PNL_ACL_PRECONDITION: target function must already exist';
  END IF;
  SELECT p.* INTO STRICT v_proc FROM pg_catalog.pg_proc p WHERE p.oid=v_oid;
  v_owner := v_proc.proowner;
  v_authenticated := pg_catalog.to_regrole('authenticated');
  v_anon := pg_catalog.to_regrole('anon');
  v_service := pg_catalog.to_regrole('service_role');
  IF current_user <> 'postgres' OR session_user <> current_user
     OR v_owner IS DISTINCT FROM pg_catalog.to_regrole(current_user)::oid THEN
    RAISE EXCEPTION 'PNL_ACL_PRECONDITION: execute as the existing postgres owner/grantor';
  END IF;
  IF v_authenticated IS NULL OR v_anon IS NULL OR v_proc.proacl IS NULL THEN
    RAISE EXCEPTION 'PNL_ACL_PRECONDITION: explicit existing ACL and client roles required';
  END IF;
  IF v_proc.pronamespace <> 'public'::regnamespace
     OR v_proc.prolang <> (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
     OR (to_jsonb(v_proc)-ARRAY['oid','proowner','pronamespace','prolang','proacl','prosrc'])
        IS DISTINCT FROM $pnl_attributes${"probin":null,"procost":100,"prokind":"f","proname":"pnl_financiero_embarque","prorows":0,"pronargs":1,"proconfig":["search_path=public"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["_embarque_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}$pnl_attributes$::jsonb THEN
    RAISE EXCEPTION 'PNL_ACL_PRECONDITION: unexpected target signature or attributes';
  END IF;
  v_source_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_proc.prosrc,'UTF8')),'hex');
  IF v_source_hash NOT IN ('bf2a9ea046b67681338eee2d6e85cee8644cd98ded85e2a818b7753ae4443623','ce2eecd60f462d3b916d0e62051680b2ba00a3f048a87f935b96bda33ff98199','941e6d4ac8c4ee18d3f3e083bb0237051db0df08658b743129800ae91072f7b6') THEN
    RAISE EXCEPTION 'PNL_ACL_PRECONDITION: unreviewed target body';
  END IF;
  -- Require the direct authenticated entry from the EXACT grantor used below.
  -- Inherited access, different grantors, and grant options do not qualify.
  IF (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl) a
      WHERE a.grantee=v_authenticated AND a.grantor=v_owner
        AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) <> 1
     OR (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl) a
      WHERE a.grantee=v_owner AND a.grantor=v_owner
        AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) <> 1 THEN
    RAISE EXCEPTION 'PNL_ACL_PRECONDITION: missing matching direct owner/authenticated grants';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
      WHERE a.grantee=0 OR a.grantee=v_anon)
     OR pg_catalog.has_function_privilege(v_anon,v_oid,'EXECUTE')
     OR pg_catalog.has_function_privilege(v_anon,v_oid,'EXECUTE WITH GRANT OPTION') THEN
    RAISE EXCEPTION 'PNL_ACL_PRECONDITION: PUBLIC and anon must already be closed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
      WHERE a.grantor<>v_owner OR a.is_grantable OR a.privilege_type<>'EXECUTE'
         OR NOT (a.grantee=v_owner OR a.grantee=v_authenticated
                 OR (v_service IS NOT NULL AND a.grantee=v_service))) THEN
    RAISE EXCEPTION 'PNL_ACL_PRECONDITION: unexpected ACL role, grantor or grant option';
  END IF;
  EXECUTE v_capture INTO v_before USING v_oid;
  PERFORM pg_catalog.set_config('librecarga.pnl_exact_acl_snapshot',v_before::text,true);
  PERFORM pg_catalog.set_config('librecarga.pnl_exact_acl_txid',pg_catalog.pg_current_xact_id()::text,true);
END
$pnl_acl_pre$;

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
  _subtotal numeric; _credit numeric; _net numeric; _net_mxn numeric;
  _credit_mxn numeric; _line_mxn numeric; _detail_sum numeric;
  _income_total numeric := 0; _pending_total numeric := 0;
  _invoice_bad boolean; _invoice_valued boolean; _income_overflow boolean := false;
  _line_name text; _nc_count bigint; _tagged_shipments bigint;
  _invoice_count bigint := 0; _active_nc bigint := 0; _nc_no_base bigint := 0;
  _nc_no_value bigint := 0; _invoice_no_value bigint := 0;
  _proportional bigint := 0; _overflows bigint := 0;
  _income_incomplete boolean;

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

  -- Keep the existing invoice membership and proportional attribution. Every
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
    _invoice_bad := false;
    _factor := NULL; _subtotal := NULL; _net := NULL; _net_mxn := NULL;
    _credit := 0; _nc_count := 0; _tc_doc := NULL; _tagged_shipments := 0;
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
      IF _nc_base IS NULL THEN _nc_no_base := _nc_no_base + 1; END IF;
      BEGIN
        _nc_base_factura := _nc_base_factura * _factor;
        IF _factura_moneda = 'MXN' OR (_tc_doc > 1
          AND _tc_doc::text NOT IN ('NaN','Infinity','-Infinity')) THEN
          _credit_mxn := public.a_mxn(_nc_base_factura,_factura_moneda,_tc_doc,_tc_doc);
        END IF;
        IF _credit_mxn IS NOT NULL AND _credit IS NOT NULL THEN
          _credit := _credit + _nc_base_factura;
        END IF;
      EXCEPTION WHEN numeric_value_out_of_range THEN
        _nc_base_factura := NULL; _credit_mxn := NULL;
        _overflows := _overflows + 1;
      END;
      IF _nc_base IS NOT NULL AND _credit_mxn IS NULL THEN
        _nc_no_value := _nc_no_value + 1;
      END IF;
      _fnc_data := _fnc_data || jsonb_build_array(jsonb_build_object(
        'factura_id',_invoice.id,'monto',_nc_base_factura,
        'monto_mxn',_credit_mxn,'moneda',_factura_moneda));
    END LOOP;
    -- Exact lineage is a separate concern (144). Keep this allocation visible
    -- and provisional instead of describing the existing ratio as exact.
    IF _nc_count > 0 AND _tagged_shipments > 1 THEN
      _proportional := _proportional + 1;
    END IF;
    BEGIN
      IF NOT _invoice_bad THEN
        _net := _subtotal - _credit;
        _net_mxn := public.a_mxn(_net,_factura_moneda,_tc_doc,_tc_doc);
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
    -- Reuse exactly the current positive line attribution; NC rows below use
    -- the same converted base and ratio as the headline, including NULLs.
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
    'concepto','(nota de crédito)','real_mxn',-n.monto_mxn))
    FROM jsonb_to_recordset(_fnc_data) n(monto_mxn numeric)),'[]'::jsonb);
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
  -- Audit 148: the link declares full premium coverage, not payment of debt.
  -- Reuse pf membership and its capped factor before credit notes/payments.
  -- NULL/zero quantities retain audit124/130's legacy effective quantity 1;
  -- negative effective quantities make coverage indeterminate, without changing
  -- the accounting allocation canon or any stored relationship.
  seg_cobertura_base AS (
    SELECT pf.id AS factura_id, pf.moneda AS moneda_factura,
           pf.base_gravable * pf.factor AS base_atribuida,
           public.a_mxn(pf.base_gravable * pf.factor, pf.moneda, pf.tc_doc, pf.tc_doc) AS base_mxn,
           s.moneda::text AS moneda_prima, coalesce(s.prima,0)::numeric AS prima,
           public.a_mxn(coalesce(s.prima,0), s.moneda::text, NULLIF(_tc_usd,0), NULLIF(_tc_eur,0)) AS prima_mxn,
           EXISTS (SELECT 1 FROM pf_asignaciones a WHERE a.factura_id = pf.id
                     AND a.cantidad_efectiva < 0) AS asignacion_indeterminada
    FROM public.seguros_embarque s
    LEFT JOIN pf ON pf.id = s.proveedor_factura_id
    WHERE s.embarque_id = _embarque_id AND s.deleted_at IS NULL
      AND s.proveedor_factura_id IS NOT NULL
  ),
  seg_cobertura AS (
    SELECT b.*, CASE
      WHEN factura_id IS NULL OR base_atribuida IS NULL OR base_atribuida < 0
        THEN 'sin_atribucion'
      WHEN asignacion_indeterminada THEN 'asignacion_indeterminada'
      -- Nominal numeric comparison needs no FX or new tolerance/rounding.
      WHEN moneda_factura = moneda_prima THEN
        CASE WHEN base_atribuida >= prima THEN 'completa' ELSE 'insuficiente' END
      -- a_mxn is authoritative, including its four-decimal FX valuation and
      -- NULL for invalid FX. Missing valuation must never become zero coverage.
      WHEN base_mxn IS NULL OR prima_mxn IS NULL THEN 'sin_valoracion'
      WHEN base_mxn >= prima_mxn THEN 'completa'
      ELSE 'insuficiente'
    END AS estado
    FROM seg_cobertura_base b
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
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated;

DO $pnl_acl_post$
DECLARE
  v_oid oid;
  v_before jsonb;
  v_after jsonb;
  v_source_hash text;
  v_capture CONSTANT text := $pnl_catalog$
SELECT pg_catalog.jsonb_build_object(
 'functions', (SELECT jsonb_agg(CASE WHEN p.oid=$1 THEN to_jsonb(p)-'prosrc' ELSE to_jsonb(p) END ORDER BY p.oid) FROM pg_catalog.pg_proc p),
 'relations', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')),
 'attributes', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')),
 'attribute_defaults', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.oid) FROM pg_catalog.pg_attrdef a JOIN pg_catalog.pg_class c ON c.oid=a.adrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')),
 'constraints', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_catalog.pg_constraint c),
 'triggers', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_trigger t),
 'rewrite_rules', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.oid) FROM pg_catalog.pg_rewrite r),
 'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_catalog.pg_policy p),
 'types', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_type t),
 'enums', (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.oid) FROM pg_catalog.pg_enum e),
 'namespaces', (SELECT jsonb_agg(to_jsonb(n) ORDER BY n.oid) FROM pg_catalog.pg_namespace n),
 'dependencies', (SELECT jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)) FROM pg_catalog.pg_depend d),
 'shared_dependencies', (SELECT jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)) FROM pg_catalog.pg_shdepend d),
 'default_acl', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.oid) FROM pg_catalog.pg_default_acl a),
 'roles', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.rolname) FROM pg_catalog.pg_roles r),
 'memberships', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.oid) FROM pg_catalog.pg_auth_members m),
 'target_acl', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE p.oid=$1),
 'target_effective', (SELECT jsonb_agg(jsonb_build_object('role_oid',r.oid,'role',r.rolname,'execute',pg_catalog.has_function_privilege(r.oid,$1,'EXECUTE'),'grant_option',pg_catalog.has_function_privilege(r.oid,$1,'EXECUTE WITH GRANT OPTION')) ORDER BY r.rolname) FROM pg_catalog.pg_roles r)
)
$pnl_catalog$;
BEGIN
  IF pg_catalog.current_setting('librecarga.pnl_exact_acl_txid',true)
     IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'PNL_ACL_TRANSACTION: pre/post checks must share the caller transaction';
  END IF;
  v_oid := pg_catalog.to_regprocedure('public.pnl_financiero_embarque(uuid)');
  v_before := NULLIF(pg_catalog.current_setting('librecarga.pnl_exact_acl_snapshot',true),'')::jsonb;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'PNL_ACL_TRANSACTION: missing transaction-local catalog snapshot';
  END IF;
  EXECUTE v_capture INTO v_after USING v_oid;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'PNL_ACL_INVARIANT: catalog or privilege changed; atomic forward rolled back';
  END IF;
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')
    INTO v_source_hash FROM pg_catalog.pg_proc p WHERE p.oid=v_oid;
  IF v_source_hash IS DISTINCT FROM 'ce2eecd60f462d3b916d0e62051680b2ba00a3f048a87f935b96bda33ff98199' THEN
    RAISE EXCEPTION 'PNL_BODY_INVARIANT: target body differs; atomic forward rolled back';
  END IF;
  PERFORM pg_catalog.set_config('librecarga.pnl_exact_acl_snapshot','',true);
  PERFORM pg_catalog.set_config('librecarga.pnl_exact_acl_txid','',true);
END
$pnl_acl_post$;
RELEASE SAVEPOINT pnl_exact_acl_forward;
