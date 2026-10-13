CREATE OR REPLACE FUNCTION public.seed_demo_organization_guarded(p_skip_ms bigint DEFAULT 600000)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_ultimo timestamptz;
  v_org constant uuid := 'de100000-0000-0000-0000-000000000001'::uuid;
  v_roots oid[];
  v_globals oid[];
  v_graph oid[];
  v_after oid[];
  v_scoped oid[];
  v_fingerprint jsonb;
  v_after_fingerprint jsonb;
  v_relation record;
  v_fk record;
  v_bad boolean;
  v_join text;
  v_graph_sql constant text := $graph$
    WITH RECURSIVE tenant_graph(relid) AS (
      SELECT unnest($1::oid[])
      UNION
      SELECT CASE WHEN fk.conrelid = g.relid THEN fk.confrelid ELSE fk.conrelid END
      FROM tenant_graph g
      JOIN pg_catalog.pg_constraint fk ON fk.contype = 'f'
        AND (fk.conrelid = g.relid OR fk.confrelid = g.relid)
      WHERE NOT (g.relid = ANY($2::oid[]))
    )
    SELECT array_agg(relid ORDER BY relid) FROM tenant_graph
  $graph$;
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_NO_AUTORIZADO: solo service_role o super_admin'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));

  SELECT last_seeded_at INTO v_ultimo FROM public.demo_seed_state WHERE id = true;
  IF v_ultimo IS NOT NULL
     AND (extract(epoch FROM clock_timestamp()) - extract(epoch FROM v_ultimo)) * 1000 < p_skip_ms THEN
    RETURN false;
  END IF;

  -- Forward safety gate. Fail before business DML; never trust RLS-filtered reads.
  -- READ COMMITTED is needed for fresh snapshots after relation locks.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: se requiere READ COMMITTED'
      USING ERRCODE = 'P0001';
  END IF;

  -- All wrapper/core DELETE roots, plus the wrapper pricing UPDATE target.
  -- CI asserts the reviewed core does not mutate an unrepresented tenant root.
  v_roots := ARRAY[
    'public.anticipos_aplicaciones'::regclass::oid,
    'public.anticipos_proveedor'::regclass::oid,
    'public.clientes'::regclass::oid,
    'public.contactos_cliente'::regclass::oid,
    'public.costeo_agentes'::regclass::oid,
    'public.costeo_cargos_fob_agente'::regclass::oid,
    'public.costeo_tarifas'::regclass::oid,
    'public.cotizaciones'::regclass::oid,
    'public.crm_solicitudes_pricing'::regclass::oid,
    'public.embarques'::regclass::oid,
    'public.eventos_embarque'::regclass::oid,
    'public.pagos_proveedor'::regclass::oid,
    'public.proveedor_facturas'::regclass::oid,
    'public.proveedor_facturas_conceptos'::regclass::oid,
    'public.proveedor_notas_credito'::regclass::oid,
    'public.proveedores'::regclass::oid
  ];
  -- Explicitly reviewed shared endpoints; absence of organization_id alone
  -- never qualifies an unknown table as global. Do not traverse through these.
  v_globals := array_remove(ARRAY[
    to_regclass('public.organizations')::oid,
    to_regclass('public.navieras')::oid,
    to_regclass('public.puertos')::oid,
    to_regclass('public.tipos_contenedor')::oid,
    to_regclass('auth.users')::oid
  ], NULL::oid);

  EXECUTE v_graph_sql INTO v_graph USING v_roots, v_globals;
  SELECT array_agg(r ORDER BY r) INTO v_scoped
    FROM unnest(v_graph) AS relations(r) WHERE NOT (r = ANY(v_globals));
  SELECT coalesce(jsonb_agg(to_jsonb(fk) ORDER BY fk.oid), '[]'::jsonb)
    INTO v_fingerprint
    FROM pg_catalog.pg_constraint fk
   WHERE fk.contype = 'f'
     AND (fk.conrelid = ANY(v_scoped) OR fk.confrelid = ANY(v_scoped));

  -- Broad, intentionally conservative maintenance locks. NOWAIT rejects busy
  -- graphs rather than waiting while holding locks on unrelated tenant tables.
  -- Locks last until caller transaction end, including all cleanup/core DML.
  FOR v_relation IN
    SELECT c.oid, n.nspname, c.relname, c.relkind
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE c.oid = ANY(v_graph) ORDER BY c.oid
  LOOP
    IF v_relation.relkind <> 'r'
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i
                   WHERE i.inhrelid = v_relation.oid OR i.inhparent = v_relation.oid)
       OR (v_relation.nspname <> 'public' AND NOT (v_relation.oid = ANY(v_globals))) THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: relacion no soportada %.%',
        v_relation.nspname, v_relation.relname USING ERRCODE = 'P0001';
    END IF;
    EXECUTE format('LOCK TABLE ONLY %I.%I IN SHARE ROW EXCLUSIVE MODE NOWAIT',
      v_relation.nspname, v_relation.relname);
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_locks l
                    WHERE l.pid = pg_backend_pid() AND l.relation = v_relation.oid
                      AND l.mode = 'ShareRowExclusiveLock' AND l.granted) THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: identidad de relacion cambio durante bloqueo'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Static DML/core uses these names. Locking an old renamed OID is not
  -- enough: reject any rename/drop/recreate between discovery and locking.
  IF v_roots IS DISTINCT FROM ARRAY[
    to_regclass('public.anticipos_aplicaciones')::oid,
    to_regclass('public.anticipos_proveedor')::oid,
    to_regclass('public.clientes')::oid,
    to_regclass('public.contactos_cliente')::oid,
    to_regclass('public.costeo_agentes')::oid,
    to_regclass('public.costeo_cargos_fob_agente')::oid,
    to_regclass('public.costeo_tarifas')::oid,
    to_regclass('public.cotizaciones')::oid,
    to_regclass('public.crm_solicitudes_pricing')::oid,
    to_regclass('public.embarques')::oid,
    to_regclass('public.eventos_embarque')::oid,
    to_regclass('public.pagos_proveedor')::oid,
    to_regclass('public.proveedor_facturas')::oid,
    to_regclass('public.proveedor_facturas_conceptos')::oid,
    to_regclass('public.proveedor_notas_credito')::oid,
    to_regclass('public.proveedores')::oid
  ]
     OR v_globals IS DISTINCT FROM array_remove(ARRAY[
    to_regclass('public.organizations')::oid,
    to_regclass('public.navieras')::oid,
    to_regclass('public.puertos')::oid,
    to_regclass('public.tipos_contenedor')::oid,
    to_regclass('auth.users')::oid
  ], NULL::oid) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: identidad de raiz o tabla global cambio'
      USING ERRCODE = 'P0001';
  END IF;

  -- Detect discovery/lock DDL races. Once locked, adding/dropping/changing an
  -- FK on these tables needs a conflicting relation lock. Compare full catalog
  -- records, not only endpoints, so changed actions/operators are not missed.
  EXECUTE v_graph_sql INTO v_after USING v_roots, v_globals;
  SELECT coalesce(jsonb_agg(to_jsonb(fk) ORDER BY fk.oid), '[]'::jsonb)
    INTO v_after_fingerprint
    FROM pg_catalog.pg_constraint fk
   WHERE fk.contype = 'f'
     AND (fk.conrelid = ANY(v_scoped) OR fk.confrelid = ANY(v_scoped));
  IF cardinality(v_graph) <> (SELECT count(*) FROM pg_catalog.pg_class c WHERE c.oid = ANY(v_graph))
     OR v_after IS DISTINCT FROM v_graph
     OR v_after_fingerprint IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: cambio concurrente del grafo FK'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_relation IN
    SELECT c.oid, n.nspname, c.relname, c.relkind
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE c.oid = ANY(v_graph) ORDER BY c.oid
  LOOP
    -- Repeat shape checks under locks (the initial discovery was not locked).
    IF v_relation.relkind <> 'r'
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i
                   WHERE i.inhrelid = v_relation.oid OR i.inhparent = v_relation.oid)
       OR (v_relation.nspname <> 'public' AND NOT (v_relation.oid = ANY(v_globals)))
       OR ((v_relation.oid = ANY(v_globals)) AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = v_relation.oid AND a.attname = 'id'
            AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped))
       OR ((v_relation.oid = ANY(v_globals)) AND EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = v_relation.oid AND a.attname = 'organization_id'
            AND NOT a.attisdropped))
       OR ((v_relation.oid = ANY(v_scoped)) AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = v_relation.oid AND a.attname = 'organization_id'
            AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped)) THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: forma de tabla no soportada %.%',
        v_relation.nspname, v_relation.relname USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- A shared endpoint must never be a child of the tenant graph: deleting a
  -- tenant parent could otherwise mutate shared rows without an ownership key.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint fk
              WHERE fk.contype = 'f' AND fk.conrelid = ANY(v_globals)
                AND fk.confrelid = ANY(v_scoped)) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: tabla global dependiente de empresa'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_fk IN
    SELECT fk.*, cn.nspname AS child_schema, cc.relname AS child_table,
           pn.nspname AS parent_schema, pc.relname AS parent_table
      FROM pg_catalog.pg_constraint fk
      JOIN pg_catalog.pg_class cc ON cc.oid = fk.conrelid
      JOIN pg_catalog.pg_namespace cn ON cn.oid = cc.relnamespace
      JOIN pg_catalog.pg_class pc ON pc.oid = fk.confrelid
      JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace
     WHERE fk.contype = 'f'
       AND fk.conrelid = ANY(v_scoped) AND fk.confrelid = ANY(v_scoped)
     ORDER BY fk.oid
  LOOP
    -- Include self/composite/cyclic and NOT VALID FKs, in either direction.
    -- All reviewed tenant FK keys are UUID with the built-in UUID operator.
    -- Fail closed if a future schema requires another comparison contract.
    IF cardinality(v_fk.conkey) = 0
       OR cardinality(v_fk.conkey) <> cardinality(v_fk.confkey)
       OR cardinality(v_fk.conkey) <> cardinality(v_fk.conpfeqop)
       OR EXISTS (
         SELECT 1
           FROM unnest(v_fk.conkey, v_fk.confkey, v_fk.conpfeqop) AS keys(child_att, parent_att, eqop)
           LEFT JOIN pg_catalog.pg_attribute ca ON ca.attrelid = v_fk.conrelid AND ca.attnum = keys.child_att
           LEFT JOIN pg_catalog.pg_attribute pa ON pa.attrelid = v_fk.confrelid AND pa.attnum = keys.parent_att
          WHERE ca.atttypid IS DISTINCT FROM 'uuid'::regtype::oid
             OR pa.atttypid IS DISTINCT FROM 'uuid'::regtype::oid
             OR ca.attisdropped OR pa.attisdropped
             OR keys.eqop IS DISTINCT FROM 'pg_catalog.=(uuid,uuid)'::regoperator::oid
       ) THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: llave FK no soportada %', v_fk.conname
        USING ERRCODE = 'P0001';
    END IF;
    SELECT string_agg(format('p.%I OPERATOR(pg_catalog.=) c.%I', pa.attname, ca.attname), ' AND ' ORDER BY keys.ord)
      INTO v_join
      FROM unnest(v_fk.conkey, v_fk.confkey) WITH ORDINALITY AS keys(child_att, parent_att, ord)
      JOIN pg_catalog.pg_attribute ca ON ca.attrelid = v_fk.conrelid AND ca.attnum = keys.child_att
      JOIN pg_catalog.pg_attribute pa ON pa.attrelid = v_fk.confrelid AND pa.attnum = keys.parent_att;
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I c JOIN %I.%I p ON %s '
      'WHERE (p.organization_id = $1 AND c.organization_id IS DISTINCT FROM $1) '
      'OR (c.organization_id = $1 AND p.organization_id IS DISTINCT FROM $1))',
      v_fk.child_schema, v_fk.child_table, v_fk.parent_schema, v_fk.parent_table, v_join)
      INTO v_bad USING v_org;
    IF v_bad THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: referencia entre empresas en %', v_fk.conname
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Sentry JAVASCRIPT-REACT-80: agentes creados por visitantes de la demo
  -- (alta provisional) quedaban ligados a proveedores que el reseed borra y
  -- el SET NULL chocaba con proveedor_id NOT NULL. Sólo org demo.
  UPDATE public.crm_solicitudes_pricing SET tarifa_tarifario_id = NULL
   WHERE organization_id = v_org AND tarifa_tarifario_id IS NOT NULL;
  DELETE FROM public.costeo_cargos_fob_agente WHERE organization_id = v_org;
  DELETE FROM public.costeo_tarifas WHERE organization_id = v_org;
  DELETE FROM public.costeo_agentes WHERE organization_id = v_org;

  PERFORM public.seed_demo_organization_core();

  INSERT INTO public.demo_seed_state (id, last_seeded_at)
  VALUES (true, clock_timestamp())
  ON CONFLICT (id) DO UPDATE SET last_seeded_at = excluded.last_seeded_at;

  RETURN true;
END;
$function$;

-- Preserve the historical service_role-only execution contract.
REVOKE ALL ON FUNCTION public.seed_demo_organization_guarded(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_demo_organization_guarded(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.seed_demo_organization_guarded(bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization_guarded(bigint) TO service_role;
