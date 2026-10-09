-- selector148 destination admission, observation only. Never exposes business rows or tenant IDs.
-- Requires the destination's existing tables and read-only catalog/table access.
-- Run separately from activation and preserve the complete result for review.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '120s';
-- This setting never bypasses RLS: PostgreSQL must fail rather than hide rows.
SET LOCAL row_security = off;
WITH function_observation AS (
  SELECT p.*, pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex') AS source_sha256
  FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure('public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)')
), historical_edges AS (
SELECT 'pfc_pf_same_org_fk' AS edge, NOT EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos c LEFT JOIN public.proveedor_facturas p ON p.id=c.proveedor_factura_id WHERE c.proveedor_factura_id IS NOT NULL AND (p.id IS NULL OR c.organization_id IS DISTINCT FROM p.organization_id)) AS clean
UNION ALL
SELECT 'pfc_cc_same_org_fk' AS edge, NOT EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos c LEFT JOIN public.conceptos_costo p ON p.id=c.concepto_costo_id WHERE c.concepto_costo_id IS NOT NULL AND (p.id IS NULL OR c.organization_id IS DISTINCT FROM p.organization_id)) AS clean
UNION ALL
SELECT 'cc_shipment_same_org_fk' AS edge, NOT EXISTS (SELECT 1 FROM public.conceptos_costo c LEFT JOIN public.embarques p ON p.id=c.embarque_id WHERE c.embarque_id IS NOT NULL AND (p.id IS NULL OR c.organization_id IS DISTINCT FROM p.organization_id)) AS clean
UNION ALL
SELECT 'pf_shipment_same_org_fk' AS edge, NOT EXISTS (SELECT 1 FROM public.proveedor_facturas c LEFT JOIN public.embarques p ON p.id=c.embarque_id WHERE c.embarque_id IS NOT NULL AND (p.id IS NULL OR c.organization_id IS DISTINCT FROM p.organization_id)) AS clean
UNION ALL
SELECT 'insurance_pf_same_org_fk' AS edge, NOT EXISTS (SELECT 1 FROM public.seguros_embarque c LEFT JOIN public.proveedor_facturas p ON p.id=c.proveedor_factura_id WHERE c.proveedor_factura_id IS NOT NULL AND (p.id IS NULL OR c.organization_id IS DISTINCT FROM p.organization_id)) AS clean
UNION ALL
SELECT 'insurance_shipment_same_org_fk' AS edge, NOT EXISTS (SELECT 1 FROM public.seguros_embarque c LEFT JOIN public.embarques p ON p.id=c.embarque_id WHERE c.embarque_id IS NOT NULL AND (p.id IS NULL OR c.organization_id IS DISTINCT FROM p.organization_id)) AS clean
)
SELECT jsonb_build_object(
  'checked_at',CURRENT_TIMESTAMP,
  'transaction_read_only',current_setting('transaction_read_only')='on',
  'current_user',CURRENT_USER,
  'session_user',SESSION_USER,
  'row_security_off',current_setting('row_security')='off',
  'current_role_superuser',(SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER),
  'current_role_bypassrls',(SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER),
  'all_graph_relations_rls_inactive',NOT EXISTS (
    SELECT 1 FROM unnest(ARRAY['public.embarques','public.proveedor_facturas','public.conceptos_costo','public.proveedor_facturas_conceptos','public.seguros_embarque']) AS r(name)
    WHERE pg_catalog.row_security_active(r.name::regclass)
  ),
  'session_replication_origin',current_setting('session_replication_role')='origin',
  'function_present',EXISTS(SELECT 1 FROM function_observation),
  'function',coalesce((SELECT jsonb_build_object(
    'source_sha256',p.source_sha256,
    'expected_disabled_source_sha256','8580c9eb0d22ed2ce1dc483de09c406de8bb301b823a2cba92d3002ad6b8c490',
    'expected_enabled_source_sha256','b3f26ef5a798ee04f243c3039ebd5ff0b548b07c75c39ebcba305fd6c4c14dc9',
    'disabled_source_exact',p.source_sha256='8580c9eb0d22ed2ce1dc483de09c406de8bb301b823a2cba92d3002ad6b8c490',
    'enabled_source_exact',p.source_sha256='b3f26ef5a798ee04f243c3039ebd5ff0b548b07c75c39ebcba305fd6c4c14dc9',
    'metadata_exact',(p.pronamespace = 'public'::regnamespace
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
    AND p.proconfig = ARRAY['search_path=pg_catalog, public']::text[]) IS TRUE,
    'disabled_acl_exact',((SELECT count(*) = 1 AND bool_and((
      a.grantor = p.proowner AND a.privilege_type = 'EXECUTE' AND NOT a.is_grantable
      AND a.grantee = p.proowner
    ) IS TRUE) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a)
    AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') IS FALSE
    AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')) IS TRUE,
    'enabled_acl_exact',((SELECT count(*) = 2 AND bool_and((
      a.grantor = p.proowner AND a.privilege_type = 'EXECUTE' AND NOT a.is_grantable
      AND a.grantee IN (p.proowner, 'authenticated'::regrole)
    ) IS TRUE) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a)
    AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') IS TRUE
    AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')) IS TRUE,
    'owner',pg_catalog.pg_get_userbyid(p.proowner),
    'security_definer',p.prosecdef,
    'configuration',p.proconfig,
    'acl',coalesce((SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,'grantor',pg_catalog.pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a),'[]'::jsonb)
  ) FROM function_observation p),'null'::jsonb),
  'six_fk_identity_and_enforcement_ready',((
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
  )) IS TRUE,
  'historical_edges', (SELECT jsonb_object_agg(edge,clean) FROM historical_edges),
  'historical_edges_clean',(SELECT bool_and(clean) FROM historical_edges),
  'organization_columns_nonnull',(NOT EXISTS (SELECT 1 FROM public.embarques WHERE organization_id IS NULL) AND
    NOT EXISTS (SELECT 1 FROM public.proveedor_facturas WHERE organization_id IS NULL) AND
    NOT EXISTS (SELECT 1 FROM public.conceptos_costo WHERE organization_id IS NULL) AND
    NOT EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos WHERE organization_id IS NULL) AND
    NOT EXISTS (SELECT 1 FROM public.seguros_embarque WHERE organization_id IS NULL)),
  'active_policy_unique',NOT EXISTS (SELECT 1 FROM public.seguros_embarque WHERE proveedor_factura_id IS NOT NULL AND deleted_at IS NULL GROUP BY proveedor_factura_id HAVING count(*)>1),
  'fk_catalog',coalesce((SELECT jsonb_agg(jsonb_build_object('name',c.conname,'validated',c.convalidated,'deferrable',c.condeferrable,'definition',pg_catalog.pg_get_constraintdef(c.oid),'ri_trigger_count',(SELECT count(*) FROM pg_catalog.pg_trigger t WHERE t.tgconstraint=c.oid),'ri_triggers_enabled',(SELECT bool_and(t.tgenabled IN ('O','A')) FROM pg_catalog.pg_trigger t WHERE t.tgconstraint=c.oid)) ORDER BY c.conname) FROM pg_catalog.pg_constraint c WHERE c.connamespace='public'::regnamespace AND c.conname=ANY(ARRAY['pfc_pf_same_org_fk','pfc_cc_same_org_fk','cc_shipment_same_org_fk','pf_shipment_same_org_fk','insurance_pf_same_org_fk','insurance_shipment_same_org_fk'])),'[]'::jsonb)
) AS selector148_admission;
COMMIT;
