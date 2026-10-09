-- selector148: authorized activation after exact destination admission.
-- Same seven-argument RPC, five approved business roles and five header fields.
-- Only its literal gate and authenticated EXECUTE change; no table DDL/data repair.
-- Existing disabled installer and historical migrations are immutable.
-- Release owner controls destination admission, publication and application.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '120s';
LOCK TABLE public.embarques, public.proveedor_facturas, public.conceptos_costo, public.proveedor_facturas_conceptos, public.seguros_embarque IN SHARE ROW EXCLUSIVE MODE;
DO $integrity148$ BEGIN
  IF (
    current_setting('session_replication_role') = 'origin'
    AND (
    WITH expected(name, child, child_id, parent, delete_action) AS (VALUES
      ('pfc_pf_same_org_fk', 'public.proveedor_facturas_conceptos'::regclass, 'proveedor_factura_id', 'public.proveedor_facturas'::regclass, 'c'),
      ('pfc_cc_same_org_fk', 'public.proveedor_facturas_conceptos'::regclass, 'concepto_costo_id', 'public.conceptos_costo'::regclass, 'n'),
      ('cc_shipment_same_org_fk', 'public.conceptos_costo'::regclass, 'embarque_id', 'public.embarques'::regclass, 'c'),
      ('pf_shipment_same_org_fk', 'public.proveedor_facturas'::regclass, 'embarque_id', 'public.embarques'::regclass, 'n'),
      ('insurance_pf_same_org_fk', 'public.seguros_embarque'::regclass, 'proveedor_factura_id', 'public.proveedor_facturas'::regclass, 'r'),
      ('insurance_shipment_same_org_fk', 'public.seguros_embarque'::regclass, 'embarque_id', 'public.embarques'::regclass, 'c')
    )
    SELECT count(*) = 6 AND bool_and((
      c.oid IS NOT NULL AND c.contype = 'f' AND c.convalidated
      AND c.connamespace = 'public'::regnamespace
      AND c.conrelid = x.child AND c.confrelid = x.parent
      AND c.conislocal AND c.coninhcount = 0 AND c.conparentid = 0
      AND NOT c.condeferrable AND NOT c.condeferred
      AND c.confmatchtype = 's' AND c.confupdtype = 'a'
      AND c.confdeltype::text = x.delete_action
      AND c.conkey = ARRAY[ca.attnum, co.attnum]::smallint[]
      AND c.confkey = ARRAY[pa.attnum, po.attnum]::smallint[]
      AND c.confdelsetcols IS NOT DISTINCT FROM
        CASE WHEN x.delete_action = 'n' THEN ARRAY[ca.attnum]::smallint[] ELSE NULL::smallint[] END
      AND co.attnotnull AND po.attnotnull AND pa.attnotnull
      AND NOT ca.attisdropped AND NOT co.attisdropped
      AND NOT pa.attisdropped AND NOT po.attisdropped
      AND ix.indrelid = x.parent AND ix.indisunique AND ix.indisvalid
      AND ix.indisready AND ix.indislive AND ix.indimmediate
      AND ix.indnkeyatts = 2 AND ix.indnatts = 2
      AND ix.indpred IS NULL AND ix.indexprs IS NULL
      AND (SELECT array_agg(k ORDER BY ord) FROM unnest(ix.indkey) WITH ORDINALITY AS a(k,ord)) = ARRAY[pa.attnum,po.attnum]::smallint[]
      AND (SELECT count(*) = 4 AND count(DISTINCT (t.tgrelid,t.tgtype)) = 4 AND bool_and((
        t.tgisinternal AND t.tgenabled IN ('O','A')
        AND t.tgnargs = 0 AND t.tgqual IS NULL
        AND cardinality(t.tgattr::smallint[]) = 0
        AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
        AND NOT t.tgdeferrable AND NOT t.tginitdeferred
        AND t.tgparentid = 0
        AND CASE
          WHEN t.tgrelid = x.child AND t.tgconstrrelid = x.parent AND t.tgtype = 5
            THEN t.tgfoid = 'pg_catalog."RI_FKey_check_ins"()'::regprocedure
          WHEN t.tgrelid = x.child AND t.tgconstrrelid = x.parent AND t.tgtype = 17
            THEN t.tgfoid = 'pg_catalog."RI_FKey_check_upd"()'::regprocedure
          WHEN t.tgrelid = x.parent AND t.tgconstrrelid = x.child AND t.tgtype = 17
            THEN t.tgfoid = 'pg_catalog."RI_FKey_noaction_upd"()'::regprocedure
          WHEN t.tgrelid = x.parent AND t.tgconstrrelid = x.child AND t.tgtype = 9
            THEN t.tgfoid = CASE x.delete_action
              WHEN 'c' THEN 'pg_catalog."RI_FKey_cascade_del"()'::regprocedure
              WHEN 'n' THEN 'pg_catalog."RI_FKey_setnull_del"()'::regprocedure
              WHEN 'r' THEN 'pg_catalog."RI_FKey_restrict_del"()'::regprocedure END
          ELSE false END
      ) IS TRUE) FROM pg_catalog.pg_trigger t WHERE t.tgconstraint = c.oid)
    ) IS TRUE)
    FROM expected x
    LEFT JOIN pg_catalog.pg_constraint c ON c.conrelid = x.child AND c.conname = x.name
    LEFT JOIN pg_catalog.pg_attribute ca ON ca.attrelid = x.child AND ca.attname = x.child_id
    LEFT JOIN pg_catalog.pg_attribute co ON co.attrelid = x.child AND co.attname = 'organization_id'
    LEFT JOIN pg_catalog.pg_attribute pa ON pa.attrelid = x.parent AND pa.attname = 'id'
    LEFT JOIN pg_catalog.pg_attribute po ON po.attrelid = x.parent AND po.attname = 'organization_id'
    LEFT JOIN pg_catalog.pg_index ix ON ix.indexrelid = c.conindid
    )
   AND (
    WITH graph(rel, pk_name) AS (VALUES
      ('public.embarques'::regclass, 'embarques_pkey'),
      ('public.proveedor_facturas'::regclass, 'proveedor_facturas_pkey'),
      ('public.conceptos_costo'::regclass, 'conceptos_costo_pkey'),
      ('public.proveedor_facturas_conceptos'::regclass, 'proveedor_facturas_conceptos_pkey'),
      ('public.seguros_embarque'::regclass, 'seguros_embarque_pkey')
    )
    SELECT count(*) = 5 AND bool_and((
      t.relkind = 'r' AND NOT t.relispartition
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_inherits h WHERE h.inhrelid = g.rel OR h.inhparent = g.rel)
      AND a.attnotnull AND NOT a.attisdropped
      AND c.contype = 'p' AND c.convalidated AND c.conislocal
      AND c.coninhcount = 0 AND c.conparentid = 0
      AND NOT c.condeferrable AND NOT c.condeferred
      AND c.conkey = ARRAY[a.attnum]::smallint[]
      AND ix.indrelid = g.rel AND ix.indisprimary AND ix.indisunique
      AND ix.indisvalid AND ix.indisready AND ix.indislive AND ix.indimmediate
      AND ix.indnkeyatts = 1 AND ix.indnatts = 1
      AND ix.indpred IS NULL AND ix.indexprs IS NULL
      AND (SELECT array_agg(k ORDER BY ord) FROM unnest(ix.indkey) WITH ORDINALITY AS key(k,ord)) = ARRAY[a.attnum]::smallint[]
    ) IS TRUE)
    FROM graph g
    LEFT JOIN pg_catalog.pg_class t ON t.oid = g.rel
    LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = g.rel AND a.attname = 'id'
    LEFT JOIN pg_catalog.pg_constraint c ON c.conrelid = g.rel AND c.conname = g.pk_name
    LEFT JOIN pg_catalog.pg_index ix ON ix.indexrelid = c.conindid
  ) AND (
    -- Preserve the original active-policy uniqueness used by the write path.
    SELECT count(*) = 1 AND bool_and((
      ix.indrelid = 'public.seguros_embarque'::regclass
      AND ix.indisunique AND ix.indisvalid AND ix.indisready AND ix.indislive AND ix.indimmediate
      AND ix.indnkeyatts = 1 AND ix.indnatts = 1 AND ix.indexprs IS NULL
      AND (SELECT array_agg(k ORDER BY ord) FROM unnest(ix.indkey) WITH ORDINALITY AS key(k,ord)) = ARRAY[a.attnum]::smallint[]
      AND pg_catalog.pg_get_expr(ix.indpred,ix.indrelid) = '((proveedor_factura_id IS NOT NULL) AND (deleted_at IS NULL))'
    ) IS TRUE)
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_index ix ON ix.indexrelid = c.oid
    JOIN pg_catalog.pg_attribute a ON a.attrelid = ix.indrelid AND a.attname = 'proveedor_factura_id' AND NOT a.attisdropped
    WHERE c.relnamespace = 'public'::regnamespace AND c.relname = 'ux_seguros_embarque_factura_activa'
  )
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'LC_SELECTOR148_INTEGRITY_NOT_READY';
  END IF;
END $integrity148$;
DO $selector148_before$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=pg_catalog.to_regprocedure('public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)')
      AND (p.pronamespace = 'public'::regnamespace
    AND p.proname = 'seguro_facturas_elegibles'
    AND p.proowner = 'postgres'::regrole
    AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
    AND p.prokind = 'f' AND p.provolatile = 's' AND p.prosecdef
    AND NOT p.proretset AND NOT p.proisstrict AND NOT p.proleakproof
    AND p.proparallel = 'u' AND p.procost = 100 AND p.prorows = 0
    AND p.prosupport = 0
    AND p.prorettype = 'jsonb'::regtype
    AND p.pronargs = 7 AND p.pronargdefaults = 4
    AND p.proargtypes = '2950 1700 25 2950 23 1082 2950'::oidvector
    AND p.proallargtypes IS NULL AND p.proargmodes IS NULL
    AND p.provariadic = 0 AND p.protrftypes IS NULL AND p.prosqlbody IS NULL
    AND p.proargnames = ARRAY['p_embarque_id','p_prima','p_moneda','p_seguro_id','p_limit','p_cursor_fecha','p_cursor_id']::text[]
    AND pg_catalog.pg_get_expr(p.proargdefaults,0) = 'NULL::uuid, 25, NULL::date, NULL::uuid'
    AND p.proconfig = ARRAY['search_path=pg_catalog, public']::text[]) IS TRUE
      AND ((pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')='b3f26ef5a798ee04f243c3039ebd5ff0b548b07c75c39ebcba305fd6c4c14dc9' AND ((SELECT count(*) = 2 AND bool_and((
      a.grantor = p.proowner AND a.privilege_type = 'EXECUTE' AND NOT a.is_grantable
      AND a.grantee IN (p.proowner, 'authenticated'::regrole)
    ) IS TRUE) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a)
    AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') IS TRUE
    AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE'))) OR (pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')='8580c9eb0d22ed2ce1dc483de09c406de8bb301b823a2cba92d3002ad6b8c490' AND ((SELECT count(*) = 1 AND bool_and((
      a.grantor = p.proowner AND a.privilege_type = 'EXECUTE' AND NOT a.is_grantable
      AND a.grantee = p.proowner
    ) IS TRUE) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a)
    AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') IS FALSE
    AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')))) IS TRUE
  ) THEN
    RAISE EXCEPTION 'LC_SELECTOR148_FUNCTION_CONTRACT_DRIFT';
  END IF;
END $selector148_before$;
CREATE OR REPLACE FUNCTION public.seguro_facturas_elegibles(
  p_embarque_id uuid, p_prima numeric, p_moneda text,
  p_seguro_id uuid DEFAULT NULL, p_limit integer DEFAULT 25,
  p_cursor_fecha date DEFAULT NULL, p_cursor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $selector148$
DECLARE
  -- Reviewed source change required; never a caller-controlled GUC/parameter.
  _selector148_enabled CONSTANT boolean := true; -- ENABLEMENT_GATE
  _uid uuid := auth.uid();
  _org uuid;
  _premium numeric(14,2);
  _candidate record;
  _items jsonb := '[]'::jsonb;
  _last_cursor jsonb := NULL;
  _has_more boolean := false;
  _seen integer := 0;
  _returned integer := 0;
  _cov_policy public.seguros_embarque%ROWTYPE;
  _cov_invoice public.proveedor_facturas%ROWTYPE;
  _cov_org uuid;
  _cov_usd numeric; _cov_eur numeric;
  _cov_state text; _cov_base_mxn numeric;
  _cov_c numeric; _cov_n numeric; _cov_tc numeric; _cov_full boolean;
  _cov_p numeric; _cov_a numeric; _cov_s numeric; _cov_r numeric; _cov_fx numeric;
  _cov_bad boolean; _cov_negative boolean;
BEGIN
  IF NOT _selector148_enabled THEN
    RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE';
  END IF;
  -- Positive exact audience prevents operador + viewer/finance from composing
  -- an unauthorized entitlement. Existing read/write helper semantics remain.
  IF _uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _uid
      AND ur.role = ANY(ARRAY['admin','admin_org','super_admin',
        'coordinador_logistico','gerente_operaciones']::public.app_role[])
  ) OR NOT public.has_any_role(_uid, ARRAY['viewer']::public.app_role[])
    OR NOT public.has_any_role(_uid, ARRAY['admin','operador','super_admin']::public.app_role[])
  THEN RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE'; END IF;
  _org := public.current_user_org_id();
  IF _org IS NULL OR public.rls_tenant_scope_ok(_org) IS NOT TRUE THEN
    RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE';
  END IF;
  -- Fail closed if any exact validated FK, its unique parent key, or any RI
  -- trigger stops enforcing this all-row invariant. No row values are scanned
  -- or disclosed by this catalog precondition. It is not a remote attestation.
  IF (
    current_setting('session_replication_role') = 'origin'
    AND (
    WITH expected(name, child, child_id, parent, delete_action) AS (VALUES
      ('pfc_pf_same_org_fk', 'public.proveedor_facturas_conceptos'::regclass, 'proveedor_factura_id', 'public.proveedor_facturas'::regclass, 'c'),
      ('pfc_cc_same_org_fk', 'public.proveedor_facturas_conceptos'::regclass, 'concepto_costo_id', 'public.conceptos_costo'::regclass, 'n'),
      ('cc_shipment_same_org_fk', 'public.conceptos_costo'::regclass, 'embarque_id', 'public.embarques'::regclass, 'c'),
      ('pf_shipment_same_org_fk', 'public.proveedor_facturas'::regclass, 'embarque_id', 'public.embarques'::regclass, 'n'),
      ('insurance_pf_same_org_fk', 'public.seguros_embarque'::regclass, 'proveedor_factura_id', 'public.proveedor_facturas'::regclass, 'r'),
      ('insurance_shipment_same_org_fk', 'public.seguros_embarque'::regclass, 'embarque_id', 'public.embarques'::regclass, 'c')
    )
    SELECT count(*) = 6 AND bool_and((
      c.oid IS NOT NULL AND c.contype = 'f' AND c.convalidated
      AND c.connamespace = 'public'::regnamespace
      AND c.conrelid = x.child AND c.confrelid = x.parent
      AND c.conislocal AND c.coninhcount = 0 AND c.conparentid = 0
      AND NOT c.condeferrable AND NOT c.condeferred
      AND c.confmatchtype = 's' AND c.confupdtype = 'a'
      AND c.confdeltype::text = x.delete_action
      AND c.conkey = ARRAY[ca.attnum, co.attnum]::smallint[]
      AND c.confkey = ARRAY[pa.attnum, po.attnum]::smallint[]
      AND c.confdelsetcols IS NOT DISTINCT FROM
        CASE WHEN x.delete_action = 'n' THEN ARRAY[ca.attnum]::smallint[] ELSE NULL::smallint[] END
      AND co.attnotnull AND po.attnotnull AND pa.attnotnull
      AND NOT ca.attisdropped AND NOT co.attisdropped
      AND NOT pa.attisdropped AND NOT po.attisdropped
      AND ix.indrelid = x.parent AND ix.indisunique AND ix.indisvalid
      AND ix.indisready AND ix.indislive AND ix.indimmediate
      AND ix.indnkeyatts = 2 AND ix.indnatts = 2
      AND ix.indpred IS NULL AND ix.indexprs IS NULL
      AND (SELECT array_agg(k ORDER BY ord) FROM unnest(ix.indkey) WITH ORDINALITY AS a(k,ord)) = ARRAY[pa.attnum,po.attnum]::smallint[]
      AND (SELECT count(*) = 4 AND count(DISTINCT (t.tgrelid,t.tgtype)) = 4 AND bool_and((
        t.tgisinternal AND t.tgenabled IN ('O','A')
        AND t.tgnargs = 0 AND t.tgqual IS NULL
        AND cardinality(t.tgattr::smallint[]) = 0
        AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
        AND NOT t.tgdeferrable AND NOT t.tginitdeferred
        AND t.tgparentid = 0
        AND CASE
          WHEN t.tgrelid = x.child AND t.tgconstrrelid = x.parent AND t.tgtype = 5
            THEN t.tgfoid = 'pg_catalog."RI_FKey_check_ins"()'::regprocedure
          WHEN t.tgrelid = x.child AND t.tgconstrrelid = x.parent AND t.tgtype = 17
            THEN t.tgfoid = 'pg_catalog."RI_FKey_check_upd"()'::regprocedure
          WHEN t.tgrelid = x.parent AND t.tgconstrrelid = x.child AND t.tgtype = 17
            THEN t.tgfoid = 'pg_catalog."RI_FKey_noaction_upd"()'::regprocedure
          WHEN t.tgrelid = x.parent AND t.tgconstrrelid = x.child AND t.tgtype = 9
            THEN t.tgfoid = CASE x.delete_action
              WHEN 'c' THEN 'pg_catalog."RI_FKey_cascade_del"()'::regprocedure
              WHEN 'n' THEN 'pg_catalog."RI_FKey_setnull_del"()'::regprocedure
              WHEN 'r' THEN 'pg_catalog."RI_FKey_restrict_del"()'::regprocedure END
          ELSE false END
      ) IS TRUE) FROM pg_catalog.pg_trigger t WHERE t.tgconstraint = c.oid)
    ) IS TRUE)
    FROM expected x
    LEFT JOIN pg_catalog.pg_constraint c ON c.conrelid = x.child AND c.conname = x.name
    LEFT JOIN pg_catalog.pg_attribute ca ON ca.attrelid = x.child AND ca.attname = x.child_id
    LEFT JOIN pg_catalog.pg_attribute co ON co.attrelid = x.child AND co.attname = 'organization_id'
    LEFT JOIN pg_catalog.pg_attribute pa ON pa.attrelid = x.parent AND pa.attname = 'id'
    LEFT JOIN pg_catalog.pg_attribute po ON po.attrelid = x.parent AND po.attname = 'organization_id'
    LEFT JOIN pg_catalog.pg_index ix ON ix.indexrelid = c.conindid
    )
   AND (
    WITH graph(rel, pk_name) AS (VALUES
      ('public.embarques'::regclass, 'embarques_pkey'),
      ('public.proveedor_facturas'::regclass, 'proveedor_facturas_pkey'),
      ('public.conceptos_costo'::regclass, 'conceptos_costo_pkey'),
      ('public.proveedor_facturas_conceptos'::regclass, 'proveedor_facturas_conceptos_pkey'),
      ('public.seguros_embarque'::regclass, 'seguros_embarque_pkey')
    )
    SELECT count(*) = 5 AND bool_and((
      t.relkind = 'r' AND NOT t.relispartition
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_inherits h WHERE h.inhrelid = g.rel OR h.inhparent = g.rel)
      AND a.attnotnull AND NOT a.attisdropped
      AND c.contype = 'p' AND c.convalidated AND c.conislocal
      AND c.coninhcount = 0 AND c.conparentid = 0
      AND NOT c.condeferrable AND NOT c.condeferred
      AND c.conkey = ARRAY[a.attnum]::smallint[]
      AND ix.indrelid = g.rel AND ix.indisprimary AND ix.indisunique
      AND ix.indisvalid AND ix.indisready AND ix.indislive AND ix.indimmediate
      AND ix.indnkeyatts = 1 AND ix.indnatts = 1
      AND ix.indpred IS NULL AND ix.indexprs IS NULL
      AND (SELECT array_agg(k ORDER BY ord) FROM unnest(ix.indkey) WITH ORDINALITY AS key(k,ord)) = ARRAY[a.attnum]::smallint[]
    ) IS TRUE)
    FROM graph g
    LEFT JOIN pg_catalog.pg_class t ON t.oid = g.rel
    LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = g.rel AND a.attname = 'id'
    LEFT JOIN pg_catalog.pg_constraint c ON c.conrelid = g.rel AND c.conname = g.pk_name
    LEFT JOIN pg_catalog.pg_index ix ON ix.indexrelid = c.conindid
  ) AND (
    -- Preserve the original active-policy uniqueness used by the write path.
    SELECT count(*) = 1 AND bool_and((
      ix.indrelid = 'public.seguros_embarque'::regclass
      AND ix.indisunique AND ix.indisvalid AND ix.indisready AND ix.indislive AND ix.indimmediate
      AND ix.indnkeyatts = 1 AND ix.indnatts = 1 AND ix.indexprs IS NULL
      AND (SELECT array_agg(k ORDER BY ord) FROM unnest(ix.indkey) WITH ORDINALITY AS key(k,ord)) = ARRAY[a.attnum]::smallint[]
      AND pg_catalog.pg_get_expr(ix.indpred,ix.indrelid) = '((proveedor_factura_id IS NOT NULL) AND (deleted_at IS NULL))'
    ) IS TRUE)
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_index ix ON ix.indexrelid = c.oid
    JOIN pg_catalog.pg_attribute a ON a.attrelid = ix.indrelid AND a.attname = 'proveedor_factura_id' AND NOT a.attisdropped
    WHERE c.relnamespace = 'public'::regnamespace AND c.relname = 'ux_seguros_embarque_factura_activa'
  )
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE';
  END IF;
  -- The viewer + exact tenant gates reproduce both current PF and shipment
  -- policies. No super-admin bypass of the active tenant restriction.
  SELECT e.tipo_cambio_usd, e.tipo_cambio_eur INTO _cov_usd, _cov_eur
    FROM public.embarques e WHERE e.id = p_embarque_id
      AND e.organization_id = _org AND e.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE'; END IF;
  IF p_seguro_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.seguros_embarque s WHERE s.id = p_seguro_id
      AND s.organization_id = _org AND s.embarque_id = p_embarque_id
      AND s.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE'; END IF;
  IF p_prima IS NULL OR p_prima::text IN ('NaN','Infinity','-Infinity')
    OR p_moneda IS NULL OR p_moneda NOT IN ('MXN','USD','EUR')
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR (p_cursor_fecha IS NULL) <> (p_cursor_id IS NULL)
    OR (p_cursor_fecha IS NOT NULL AND (NOT isfinite(p_cursor_fecha)
      OR p_cursor_fecha NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'))
  THEN RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE'; END IF;
  _premium := p_prima; -- matches seguros_embarque.prima numeric(14,2)
  IF _premium < 0 THEN RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE'; END IF;

  -- CONTAINMENT ONLY, NOT permission to enable this endpoint. A generic failure
  -- can reveal one bit about corruption. A verified clean global invariant and
  -- reviewed persistent preservation contract remain separate release gates.
  -- STABLE gives these checks and the exact block one statement snapshot; there
  -- is no preflight-to-read gap inside a call. Future calls recheck. No canonical
  -- rows are silently filtered by pfc.organization_id or other-shipment status.
  IF EXISTS (
    SELECT 1 FROM public.proveedor_facturas pf
    LEFT JOIN public.embarques e ON e.id = pf.embarque_id
    WHERE pf.organization_id = _org AND pf.deleted_at IS NULL
      AND pf.estado::text NOT IN ('Borrador','Cancelada')
      AND pf.embarque_id IS NOT NULL
      AND (e.id IS NULL OR e.organization_id IS DISTINCT FROM _org)
  ) OR EXISTS (
    SELECT 1 FROM public.proveedor_facturas pf
    JOIN public.proveedor_facturas_conceptos pfc ON pfc.proveedor_factura_id = pf.id
      AND pfc.concepto_costo_id IS NOT NULL
    LEFT JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
    LEFT JOIN public.embarques e ON e.id = cc.embarque_id
    WHERE pf.organization_id = _org AND pf.deleted_at IS NULL
      AND pf.estado::text NOT IN ('Borrador','Cancelada')
      AND (pfc.organization_id IS DISTINCT FROM _org OR cc.id IS NULL
        OR cc.organization_id IS DISTINCT FROM _org OR e.id IS NULL
        OR e.organization_id IS DISTINCT FROM _org)
  ) OR EXISTS (
    SELECT 1 FROM public.proveedor_facturas pf
    JOIN public.seguros_embarque s ON s.proveedor_factura_id = pf.id
    LEFT JOIN public.embarques e ON e.id = s.embarque_id
    WHERE pf.organization_id = _org AND pf.deleted_at IS NULL
      AND pf.estado::text NOT IN ('Borrador','Cancelada') AND s.deleted_at IS NULL
      AND (s.organization_id IS DISTINCT FROM _org OR e.id IS NULL
        OR e.organization_id IS DISTINCT FROM _org)
  ) THEN RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE'; END IF;

  _cov_org := _org;
  _cov_policy.embarque_id := p_embarque_id;
  _cov_policy.organization_id := _org;
  _cov_policy.prima := _premium;
  _cov_policy.moneda := p_moneda;
  FOR _candidate IN
    SELECT pf.id, pf.fecha_emision
    FROM public.proveedor_facturas pf
    WHERE pf.organization_id = _org AND pf.deleted_at IS NULL
      AND pf.estado::text NOT IN ('Borrador','Cancelada')
      AND (p_cursor_id IS NULL OR (pf.fecha_emision, pf.id) < (p_cursor_fecha, p_cursor_id))
      AND (pf.embarque_id = p_embarque_id OR EXISTS (
        SELECT 1 FROM public.proveedor_facturas_conceptos pfc
        JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
        WHERE pfc.proveedor_factura_id = pf.id AND cc.embarque_id = p_embarque_id
          AND cc.organization_id = _org AND cc.deleted_at IS NULL
          AND cc.origen <> 'ajuste_factura_proveedor' AND pfc.monto > 0
      ))
      AND NOT EXISTS (
        SELECT 1 FROM public.seguros_embarque s
        WHERE s.proveedor_factura_id = pf.id AND s.deleted_at IS NULL
          AND (p_seguro_id IS NULL OR s.id <> p_seguro_id)
      )
    ORDER BY pf.fecha_emision DESC, pf.id DESC
  LOOP
    IF NOT isfinite(_candidate.fecha_emision) OR _candidate.fecha_emision
      NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31' THEN
      RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE';
    END IF;
    _seen := _seen + 1;
    -- Work budget never produces false completion or a rejected-row cursor.
    -- A request exceeding it fails wholly, without returning partial items.
    IF _seen > 10000 THEN RAISE EXCEPTION 'LC_SELECTOR148_NO_DISPONIBLE'; END IF;
    _cov_policy.proveedor_factura_id := _candidate.id;
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
    IF _cov_state = 'completa' THEN
      IF _returned = p_limit THEN _has_more := true; EXIT; END IF;
      _items := _items || jsonb_build_array(jsonb_build_object(
        'id', _cov_invoice.id, 'folio_interno', _cov_invoice.folio_interno,
        'proveedor_nombre', _cov_invoice.proveedor_nombre,
        'subtotal', _cov_invoice.subtotal::text, 'moneda', _cov_invoice.moneda::text));
      _returned := _returned + 1;
      _last_cursor := jsonb_build_object('fecha_emision', _candidate.fecha_emision, 'id', _candidate.id);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('items', _items,
    'next_cursor', CASE WHEN _has_more THEN _last_cursor ELSE NULL END);
EXCEPTION WHEN query_canceled OR OTHERS THEN
  -- Do not expose invoice/assignment/policy identities, diagnostics or counts.
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LC_SELECTOR148_NO_DISPONIBLE';
END;
$selector148$;
ALTER FUNCTION public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid) IS 'LOCAL INTEGRATED selector148 candidate. Exact six-FK enforcement required; independent review and destination checks remain. Not a release input.';
GRANT EXECUTE ON FUNCTION public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid) TO authenticated;
DO $selector148_after$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=pg_catalog.to_regprocedure('public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)')
      AND (p.pronamespace = 'public'::regnamespace
    AND p.proname = 'seguro_facturas_elegibles'
    AND p.proowner = 'postgres'::regrole
    AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
    AND p.prokind = 'f' AND p.provolatile = 's' AND p.prosecdef
    AND NOT p.proretset AND NOT p.proisstrict AND NOT p.proleakproof
    AND p.proparallel = 'u' AND p.procost = 100 AND p.prorows = 0
    AND p.prosupport = 0
    AND p.prorettype = 'jsonb'::regtype
    AND p.pronargs = 7 AND p.pronargdefaults = 4
    AND p.proargtypes = '2950 1700 25 2950 23 1082 2950'::oidvector
    AND p.proallargtypes IS NULL AND p.proargmodes IS NULL
    AND p.provariadic = 0 AND p.protrftypes IS NULL AND p.prosqlbody IS NULL
    AND p.proargnames = ARRAY['p_embarque_id','p_prima','p_moneda','p_seguro_id','p_limit','p_cursor_fecha','p_cursor_id']::text[]
    AND pg_catalog.pg_get_expr(p.proargdefaults,0) = 'NULL::uuid, 25, NULL::date, NULL::uuid'
    AND p.proconfig = ARRAY['search_path=pg_catalog, public']::text[]) IS TRUE
      AND ((pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')='b3f26ef5a798ee04f243c3039ebd5ff0b548b07c75c39ebcba305fd6c4c14dc9' AND ((SELECT count(*) = 2 AND bool_and((
      a.grantor = p.proowner AND a.privilege_type = 'EXECUTE' AND NOT a.is_grantable
      AND a.grantee IN (p.proowner, 'authenticated'::regrole)
    ) IS TRUE) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a)
    AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') IS TRUE
    AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')))) IS TRUE
  ) THEN
    RAISE EXCEPTION 'LC_SELECTOR148_FUNCTION_CONTRACT_DRIFT';
  END IF;
END $selector148_after$;
COMMIT;
