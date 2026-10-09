(
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
  )
