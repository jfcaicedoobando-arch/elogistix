-- H14: preserve active financial history across shipment deletion paths.
-- Forward-only, atomic, exact reviewed pre/post images; no data rewrite or RLS change.
-- Apply the entire transaction. Migration preparation does not authorize remote use.
BEGIN;
CREATE TEMP TABLE h14_baja_metadata_before ON COMMIT DROP AS
SELECT p.oid, to_jsonb(p) - 'prosrc' AS metadata
FROM pg_catalog.pg_proc p WHERE p.oid IN ('public.eliminar_embarque_completo(uuid)'::regprocedure, 'public.purgar_embarque_cascade(uuid)'::regprocedure);
DO $preconditions$
DECLARE r record; p pg_catalog.pg_proc%ROWTYPE;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public._h14_proformas_baja_embarque(uuid, uuid)',ARRAY['c482aed858f0867f2cc93493e6926183']::text[],false,'s','uuid[]',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_facturas_baja_embarque(uuid, uuid, uuid[])',ARRAY['db78cf6b6d6e779cb32c2dd75c8b256f']::text[],false,'s','uuid[]',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_cxp_baja_embarque(uuid, uuid)',ARRAY['b85dd06656791db267e3552c40bd7fce']::text[],false,'s','uuid[]',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_assert_actor_baja_embarque(uuid)',ARRAY['1da5a4e081d57adef053a576f4c536a6']::text[],false,'v','uuid',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_embarque_visible_actor_baja(uuid, uuid)',ARRAY['40b4d51e1dc5b0a06fcb26aedb0632ff']::text[],true,'s','boolean',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_validar_fila_org_baja(uuid, text, jsonb)',ARRAY['8f7da44666159764023b6e04f00f7c62']::text[],true,'v','void',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_validar_actor_org_baja(uuid)',ARRAY['a92da91f961255b75b7f0f47106e61b7']::text[],true,'v','void',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_mutex_baja_embarque(uuid, boolean)',ARRAY['f34e87ceed50aa6e92539ca37fa98684']::text[],true,'v','void',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_documento_bloqueante_baja(uuid, text, uuid)',ARRAY['167f84f94eae112f04468b4b2305b1af']::text[],false,'s','boolean',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_grafo_fila_baja(uuid, text, jsonb)',ARRAY['0c02adc787940c3af8a4418484fb4c2c']::text[],false,'s','uuid[]',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_fila_bloqueante_baja(uuid, text, jsonb)',ARRAY['b90d268966cb5a13497b45c470546009']::text[],false,'s','boolean',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_dependencias_baja_embarque(uuid, uuid, boolean)',ARRAY['2c3f605ce82bba1419c44c5650746f90']::text[],false,'v','jsonb',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_guard_escritor_baja()',ARRAY['1890e8cb452c5dad98a23b99b0c4300e']::text[],true,'v','trigger',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_guard_baja_embarque()',ARRAY['9cdcb03d59701b5eb691b420e8e1cf2d']::text[],true,'v','trigger',ARRAY['postgres=X/postgres']::text[]),
    ('public.diagnosticar_baja_embarque(uuid)',ARRAY['e47d56141992d3afb0d3c81f50191fda']::text[],true,'v','jsonb',ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]),
    ('public.eliminar_embarque_completo(uuid)',ARRAY['e66c05becee10cb05816519539f1b69d','f603355293c0d33598d12fdc44cb9b26']::text[],true,'v','void',ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]),
    ('public.purgar_embarque_cascade(uuid)',ARRAY['f533510aa9fd814aa071a638135c82c9','05e482ef7cea9f8cf6d2a3c812a908c6','d03f859c24b0a83097c095730823bde5']::text[],true,'v','void',ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[])
  ) v(signature, body_hashes, definer, volatility, return_type, acl) LOOP
    SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure(r.signature);
    IF NOT FOUND THEN
      IF r.signature IN ('public.eliminar_embarque_completo(uuid)', 'public.purgar_embarque_cascade(uuid)') THEN
        RAISE EXCEPTION 'H14_PREFLIGHT: missing existing mutation signature %', r.signature;
      END IF;
      CONTINUE;
    END IF;
    IF NOT (md5(p.prosrc) = ANY(r.body_hashes)) OR p.proowner <> 'postgres'::regrole
      OR p.prosecdef IS DISTINCT FROM r.definer OR p.provolatile::text <> r.volatility
      OR p.prorettype <> pg_catalog.to_regtype(r.return_type)
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
      OR (SELECT array_agg(a::text ORDER BY a::text) FROM unnest(p.proacl) a) IS DISTINCT FROM r.acl THEN
      RAISE EXCEPTION 'H14_PREFLIGHT: source, owner, ACL or metadata differs for %', r.signature;
    END IF;
  END LOOP;
END;
$preconditions$;

DO $trigger_preconditions$
DECLARE r record; t pg_catalog.pg_trigger%ROWTYPE;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.facturas','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.factura_embarques','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.conceptos_factura','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.proformas','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.proforma_conceptos_consolidados','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.conceptos_venta','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.proveedor_facturas','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.proveedor_facturas_conceptos','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.conceptos_costo','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.seguros_embarque','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.pagos_factura','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.factura_notas_credito','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.pagos_proveedor','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.proveedor_notas_credito','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.comisiones_devengadas','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.embarque_facturas_entrantes','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.embarque_garantias_contenedor','a00_h14_guard_escritura','public._h14_guard_escritor_baja()',31),
    ('public.embarques','a00_h14_guard_baja','public._h14_guard_baja_embarque()',27)
  ) v(table_name, trigger_name, signature, kind) LOOP
    SELECT * INTO t FROM pg_catalog.pg_trigger
      WHERE tgrelid = pg_catalog.to_regclass(r.table_name) AND tgname = r.trigger_name;
    IF FOUND AND (t.tgfoid IS DISTINCT FROM pg_catalog.to_regprocedure(r.signature)::oid
      OR t.tgtype <> r.kind OR t.tgenabled <> 'O' OR t.tgisinternal OR t.tgnargs <> 0
      OR t.tgconstraint <> 0 OR t.tgdeferrable OR t.tginitdeferred OR t.tgqual IS NOT NULL
      OR t.tgoldtable IS NOT NULL OR t.tgnewtable IS NOT NULL OR t.tgargs <> ''::bytea
      OR t.tgattr::text <> '' OR t.tgparentid <> 0) THEN
      RAISE EXCEPTION 'H14_PREFLIGHT: existing trigger differs on %', r.table_name;
    END IF;
  END LOOP;
END;
$trigger_preconditions$;

-- Internal lineage resolver. A historical source can still support a live
-- invoice; document states are filtered by the collector, not erased here.
CREATE OR REPLACE FUNCTION public._h14_proformas_baja_embarque(p_embarque_id uuid, p_org uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE relacionadas(id) AS (
    SELECT p.id
    FROM public.proformas p
    WHERE p.organization_id = p_org
      AND (p.embarque_id = p_embarque_id
        OR p_embarque_id = ANY(COALESCE(p.embarques_ids, ARRAY[]::uuid[]))
        OR EXISTS (
          SELECT 1 FROM public.proforma_conceptos_consolidados pc
          WHERE pc.proforma_id = p.id AND pc.organization_id = p_org
            AND pc.embarque_id = p_embarque_id AND pc.deleted_at IS NULL)
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id AND cv.organization_id = p_org
            AND cv.embarque_id = p_embarque_id AND cv.deleted_at IS NULL))
    UNION
    SELECT padre.id
    FROM relacionadas r
    JOIN public.proformas fuente ON fuente.id = r.id AND fuente.organization_id = p_org
    JOIN public.proformas padre ON padre.organization_id = p_org
      AND (fuente.consolidada_en = padre.id
        OR fuente.id = ANY(COALESCE(padre.proformas_origen, ARRAY[]::uuid[])))
  )
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[]) FROM relacionadas;
$function$;
REVOKE ALL ON FUNCTION public._h14_proformas_baja_embarque(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- All related invoice IDs, including historical headers, so existing live
-- payments/credits are counted even when their parent is cancelled/deleted.
CREATE OR REPLACE FUNCTION public._h14_facturas_baja_embarque(p_embarque_id uuid, p_org uuid, p_proformas uuid[])
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(f.id ORDER BY f.id), ARRAY[]::uuid[])
  FROM public.facturas f
  WHERE f.organization_id = p_org
    AND (f.embarque_id = p_embarque_id
      OR f.proforma_id = ANY(p_proformas)
      OR EXISTS (
        SELECT 1 FROM public.factura_embarques fe
        WHERE fe.factura_id = f.id AND fe.organization_id = p_org
          AND fe.embarque_id = p_embarque_id AND fe.activa IS TRUE)
      OR EXISTS (
        SELECT 1 FROM public.conceptos_factura cf
        WHERE cf.factura_id = f.id AND cf.organization_id = p_org
          AND cf.deleted_at IS NULL
          AND (cf.embarque_id = p_embarque_id OR cf.proforma_id_origen = ANY(p_proformas)))
      OR EXISTS (
        SELECT 1 FROM public.proformas p
        WHERE p.organization_id = p_org AND p.id = ANY(p_proformas)
          AND f.id IN (p.factura_id, p.factura_secundaria_id)));
$function$;
REVOKE ALL ON FUNCTION public._h14_facturas_baja_embarque(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated, service_role;

-- Structural membership for deletion, independent of amounts. This does not
-- change effective allocations, debt, closing, P&L or financial attribution.
CREATE OR REPLACE FUNCTION public._h14_cxp_baja_embarque(p_embarque_id uuid, p_org uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(pf.id ORDER BY pf.id), ARRAY[]::uuid[])
  FROM public.proveedor_facturas pf
  WHERE pf.organization_id = p_org
    AND (pf.embarque_id = p_embarque_id
      OR EXISTS (
        SELECT 1 FROM public.proveedor_facturas_conceptos pc
        JOIN public.conceptos_costo cc ON cc.id = pc.concepto_costo_id
          AND cc.organization_id = p_org
        WHERE pc.proveedor_factura_id = pf.id AND pc.organization_id = p_org
          AND cc.embarque_id = p_embarque_id)
      OR EXISTS (
        SELECT 1 FROM public.seguros_embarque s
        WHERE s.proveedor_factura_id = pf.id AND s.organization_id = p_org
          AND s.embarque_id = p_embarque_id AND s.deleted_at IS NULL)
      OR EXISTS (
        SELECT 1 FROM public.embarque_facturas_entrantes e
        WHERE e.proveedor_factura_id = pf.id AND e.organization_id = p_org
          AND e.embarque_id = p_embarque_id AND e.deleted_at IS NULL)
      OR EXISTS (
        SELECT 1 FROM public.embarque_garantias_contenedor g
        WHERE g.proveedor_factura_id = pf.id AND g.organization_id = p_org
          AND g.embarque_id = p_embarque_id AND g.deleted_at IS NULL));
$function$;
REVOKE ALL ON FUNCTION public._h14_cxp_baja_embarque(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._h14_assert_actor_baja_embarque(p_embarque_id uuid)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: permisos insuficientes para eliminar embarques' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id INTO v_org FROM public.embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  IF (public.has_role(v_uid, 'super_admin'::public.app_role)
    OR (v_org = public.current_user_org_id()
      AND (public.has_role(v_uid, 'admin'::public.app_role)
        OR public.has_role(v_uid, 'operador'::public.app_role)))) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: permisos insuficientes para eliminar embarques (se requiere rol admin u operador de la organización del embarque)'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_org;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_assert_actor_baja_embarque(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Preserve the existing staff, client and freight-agent shipment read scopes.
-- This is admission/visibility, never a replacement for a table write policy.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_embarque_visible_actor_baja(p_org uuid, p_embarque uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := COALESCE(NULLIF(current_setting('role', true), 'none'), SESSION_USER::text);
  v_uid uuid := auth.uid();
BEGIN
  IF v_role IN ('postgres', 'service_role') THEN RETURN true; END IF;
  IF public.has_role(v_uid, 'super_admin'::public.app_role) IS TRUE THEN RETURN true; END IF;
  IF p_org = public.current_user_org_id() AND public.has_role(v_uid, 'viewer'::public.app_role) IS TRUE THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.embarques e
    WHERE e.id = p_embarque AND e.organization_id = p_org AND e.deleted_at IS NULL
      AND ((public.has_role(v_uid, 'cliente'::public.app_role) IS TRUE
        AND e.cliente_id IN (SELECT public.current_user_client_ids()))
      OR (public.has_role(v_uid, 'agente_carga'::public.app_role) IS TRUE
        AND p_org = public.current_agente_org()
        AND public.current_agente_id() IS NOT NULL AND e.agente_id = public.current_agente_id()))
  );
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_embarque_visible_actor_baja(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Validate candidate references before acquiring any org/parent lock. Missing
-- and cross-tenant references intentionally have the same non-disclosing error.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_validar_fila_org_baja(p_org uuid, p_tabla text, p_fila jsonb)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_col text;
  v_parent text;
  v_id uuid;
  v_ids uuid[];
  v_ok boolean;
  v_parent_row jsonb;
  v_target uuid;
  v_role text := COALESCE(NULLIF(current_setting('role', true), 'none'), SESSION_USER::text);
  v_restringido boolean;
BEGIN
  PERFORM public._h14_validar_actor_org_baja(p_org);
  IF p_fila IS NULL THEN RETURN; END IF;
  IF (p_fila->>'organization_id')::uuid IS DISTINCT FROM p_org THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  v_restringido := v_role NOT IN ('postgres', 'service_role')
    AND public.has_role(auth.uid(), 'super_admin'::public.app_role) IS NOT TRUE
    AND public.has_role(auth.uid(), 'viewer'::public.app_role) IS NOT TRUE;
  IF v_restringido AND p_tabla IN ('facturas', 'proformas') AND (
    public.has_role(auth.uid(), 'cliente'::public.app_role) IS NOT TRUE
    OR (p_fila->>'cliente_id')::uuid IS NULL
    OR (p_fila->>'cliente_id')::uuid NOT IN (SELECT public.current_user_client_ids())
    OR p_fila->>'deleted_at' IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  FOR v_col, v_parent IN
    SELECT c, t FROM (VALUES
      ('embarque_id', 'embarques'),
      ('factura_id', 'facturas'),
      ('factura_secundaria_id', 'facturas'),
      ('proveedor_factura_id', 'proveedor_facturas'),
      ('proforma_id', 'proformas'),
      ('proforma_id_origen', 'proformas'),
      ('consolidada_en', 'proformas'),
      ('concepto_costo_id', 'conceptos_costo'),
      ('pago_factura_id', 'pagos_factura'),
      ('embarque_contenedor_id', 'embarque_contenedores')
    ) AS refs(c, t)
  LOOP
    v_id := NULLIF(p_fila->>v_col, '')::uuid;
    IF v_id IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1 AND organization_id = $2)', v_parent)
      INTO v_ok USING v_id, p_org;
    IF v_ok IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
    END IF;
    IF v_restringido THEN
      IF v_parent = 'embarques' THEN
        v_ok := public._h14_embarque_visible_actor_baja(p_org, v_id);
      ELSE
        EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE id = $1 AND organization_id = $2', v_parent)
          INTO v_parent_row USING v_id, p_org;
        v_ok := false;
        IF v_parent IN ('facturas', 'proformas') THEN
          v_ok := public.has_role(auth.uid(), 'cliente'::public.app_role) IS TRUE
            AND (v_parent_row->>'cliente_id')::uuid IN (SELECT public.current_user_client_ids())
            AND v_parent_row->>'deleted_at' IS NULL;
        END IF;
        FOR v_target IN SELECT unnest(public._h14_grafo_fila_baja(p_org, v_parent, v_parent_row)) LOOP
          IF public._h14_embarque_visible_actor_baja(p_org, v_target) IS NOT TRUE THEN v_ok := false; EXIT; END IF;
        END LOOP;
        -- Other parent tables have no canonical external SELECT policy. A
        -- visible shipment alone must not make their hidden documents visible.
      END IF;
      IF v_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;
  FOR v_col, v_parent IN
    SELECT c, t FROM (VALUES ('embarques_ids', 'embarques'), ('proformas_origen', 'proformas')) AS refs(c, t)
  LOOP
    SELECT COALESCE(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_ids
    FROM jsonb_array_elements_text(COALESCE(NULLIF(p_fila->v_col, 'null'::jsonb), '[]'::jsonb)) AS a(x)
    WHERE x IS NOT NULL;
    IF cardinality(v_ids) = 0 THEN CONTINUE; END IF;
    EXECUTE format('SELECT NOT EXISTS (SELECT 1 FROM unnest($1::uuid[]) AS u(id) WHERE NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.id = u.id AND p.organization_id = $2))', v_parent)
      INTO v_ok USING v_ids, p_org;
    IF v_ok IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
    END IF;
    IF v_restringido THEN
      FOR v_id IN SELECT unnest(v_ids) LOOP
        IF v_parent = 'embarques' THEN
          v_ok := public._h14_embarque_visible_actor_baja(p_org, v_id);
        ELSE
          SELECT to_jsonb(p) INTO v_parent_row FROM public.proformas p WHERE p.id = v_id AND p.organization_id = p_org;
          v_ok := public.has_role(auth.uid(), 'cliente'::public.app_role) IS TRUE
            AND (v_parent_row->>'cliente_id')::uuid IN (SELECT public.current_user_client_ids())
            AND v_parent_row->>'deleted_at' IS NULL;
          FOR v_target IN SELECT unnest(public._h14_grafo_fila_baja(p_org, v_parent, v_parent_row)) LOOP
            IF public._h14_embarque_visible_actor_baja(p_org, v_target) IS NOT TRUE THEN v_ok := false; EXIT; END IF;
          END LOOP;
        END IF;
        IF v_ok IS NOT TRUE THEN
          RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_validar_fila_org_baja(uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Internal admission check only. Existing table/RPC permissions still decide
-- whether the caller may write; this helper never grants a write capability.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_validar_actor_org_baja(p_org uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := COALESCE(NULLIF(current_setting('role', true), 'none'), SESSION_USER::text);
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF p_org IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  -- SET ROLE authenticated is still authenticated when session_user is postgres
  -- in the isolated tests. Only a genuine effective database owner/service role
  -- skips JWT admission; RC, mutex, references and tombstones remain mandatory.
  IF v_role IN ('postgres', 'service_role') THEN RETURN; END IF;
  v_org := public.current_user_org_id();
  IF v_role <> 'authenticated' OR v_uid IS NULL OR (
    public.has_role(v_uid, 'super_admin'::public.app_role) IS NOT TRUE
    AND (v_org IS NULL OR v_org IS DISTINCT FROM p_org)
  ) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_validar_actor_org_baja(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The graph can initially have no shipment. This org anchor is acquired before
-- resolving it. Hash collisions only add contention; they never merge tenants.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_mutex_baja_embarque(p_org uuid, p_esperar boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key bigint;
BEGIN
  PERFORM public._h14_validar_actor_org_baja(p_org);
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'LC_EMBARQUE_AISLAMIENTO_NO_SOPORTADO: esta operación requiere una transacción READ COMMITTED'
      USING ERRCODE = '25001';
  END IF;
  v_key := hashtextextended('librecarga:h14:grafo-financiero:' || p_org::text, 0);
  IF p_esperar IS TRUE THEN
    PERFORM pg_advisory_xact_lock(v_key);
  ELSIF pg_try_advisory_xact_lock(v_key) IS NOT TRUE THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: los vínculos financieros se están actualizando; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_mutex_baja_embarque(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- Private read helpers. STABLE preserves the statement snapshot; writers call
-- them only after the org mutex, and candidate records overlay changed links.
CREATE OR REPLACE FUNCTION public._h14_documento_bloqueante_baja(p_org uuid, p_tipo text, p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT CASE p_tipo
    WHEN 'facturas' THEN EXISTS (SELECT 1 FROM public.facturas f WHERE f.id = p_id AND f.organization_id = p_org
      AND ((f.deleted_at IS NULL AND f.estado NOT IN ('Cancelada', 'Sustituida'))
        OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.factura_id = f.id AND p.organization_id = p_org AND p.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM public.factura_notas_credito n WHERE n.factura_id = f.id AND n.organization_id = p_org AND n.deleted_at IS NULL)))
    WHEN 'proveedor_facturas' THEN EXISTS (SELECT 1 FROM public.proveedor_facturas f WHERE f.id = p_id AND f.organization_id = p_org
      AND (f.deleted_at IS NULL
        OR EXISTS (SELECT 1 FROM public.pagos_proveedor p WHERE p.proveedor_factura_id = f.id AND p.organization_id = p_org AND p.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM public.proveedor_notas_credito n WHERE n.proveedor_factura_id = f.id AND n.organization_id = p_org AND n.deleted_at IS NULL)))
    ELSE false END;
$function$;
REVOKE ALL ON FUNCTION public._h14_documento_bloqueante_baja(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._h14_grafo_fila_baja(p_org uuid, p_tabla text, p_fila jsonb)
RETURNS uuid[]
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid := (p_fila->>'id')::uuid;
  v_targets uuid[] := ARRAY[]::uuid[];
  v_direct uuid[] := ARRAY[]::uuid[];
  v_parent jsonb;
  v_parent_id uuid;
  v_proformas uuid[];
  v_extra uuid[];
BEGIN
  IF p_fila IS NULL THEN RETURN v_targets; END IF;
  v_direct := ARRAY[(p_fila->>'embarque_id')::uuid];
  IF p_tabla = 'embarques' THEN v_direct := ARRAY[v_id]; END IF;
  SELECT v_direct || COALESCE(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_direct
  FROM jsonb_array_elements_text(COALESCE(NULLIF(p_fila->'embarques_ids', 'null'::jsonb), '[]'::jsonb)) AS a(x);

  IF p_tabla = 'proformas' THEN
    -- Follow sources downwards, using the candidate's complete row instead of
    -- its old stored header/arrays. Never expand unrelated sibling sources.
    WITH RECURSIVE filas AS MATERIALIZED (
      SELECT p.* FROM public.proformas p WHERE p.organization_id = p_org AND p.id IS DISTINCT FROM v_id
      UNION ALL SELECT (jsonb_populate_record(NULL::public.proformas, p_fila)).*
    ), fuentes(id) AS (
      SELECT v_id
      UNION
      SELECT hijo.id FROM fuentes r JOIN filas padre ON padre.id = r.id
      JOIN filas hijo ON hijo.organization_id = p_org
        AND (hijo.consolidada_en = padre.id OR hijo.id = ANY(COALESCE(padre.proformas_origen, ARRAY[]::uuid[])))
    ), targets AS (
      SELECT p.embarque_id AS id FROM filas p JOIN fuentes s ON s.id = p.id
      UNION SELECT unnest(COALESCE(p.embarques_ids, ARRAY[]::uuid[])) FROM filas p JOIN fuentes s ON s.id = p.id
      UNION SELECT pc.embarque_id FROM public.proforma_conceptos_consolidados pc JOIN fuentes s ON s.id = pc.proforma_id
        WHERE pc.organization_id = p_org AND pc.deleted_at IS NULL
      UNION SELECT cv.embarque_id FROM public.conceptos_venta cv JOIN fuentes s ON s.id = cv.proforma_id
        WHERE cv.organization_id = p_org AND cv.deleted_at IS NULL
    ) SELECT COALESCE(array_agg(DISTINCT id ORDER BY id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_targets FROM targets;
  ELSIF p_tabla = 'facturas' THEN
    SELECT COALESCE(array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_proformas FROM (
      SELECT (p_fila->>'proforma_id')::uuid AS id
      UNION SELECT cf.proforma_id_origen FROM public.conceptos_factura cf
        WHERE cf.factura_id = v_id AND cf.organization_id = p_org AND cf.deleted_at IS NULL
      UNION SELECT p.id FROM public.proformas p WHERE p.organization_id = p_org
        AND v_id IN (p.factura_id, p.factura_secundaria_id)
    ) q;
    SELECT COALESCE(array_agg(DISTINCT id ORDER BY id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_targets FROM (
      SELECT unnest(v_direct) AS id
      UNION SELECT fe.embarque_id FROM public.factura_embarques fe
        WHERE fe.factura_id = v_id AND fe.organization_id = p_org AND fe.activa IS TRUE
      UNION SELECT cf.embarque_id FROM public.conceptos_factura cf
        WHERE cf.factura_id = v_id AND cf.organization_id = p_org AND cf.deleted_at IS NULL
    ) q;
    -- Invert the directed lineage from the invoice's proforma roots. A source
    -- reaches a root through consolidada_en or the parent's proformas_origen.
    -- Do not call the per-shipment resolver across every shipment in the org.
    IF cardinality(v_proformas) > 0 THEN
      WITH RECURSIVE familia(id) AS (
        SELECT p.id FROM public.proformas p
        WHERE p.organization_id = p_org AND p.id = ANY(v_proformas)
        UNION
        SELECT hijo.id FROM familia r
        JOIN public.proformas padre ON padre.id = r.id AND padre.organization_id = p_org
        JOIN public.proformas hijo ON hijo.organization_id = p_org
          AND (hijo.consolidada_en = padre.id
            OR hijo.id = ANY(COALESCE(padre.proformas_origen, ARRAY[]::uuid[])))
      ), anclas(id) AS (
        SELECT p.embarque_id FROM public.proformas p JOIN familia f ON f.id = p.id
          WHERE p.organization_id = p_org
        UNION SELECT unnest(COALESCE(p.embarques_ids, ARRAY[]::uuid[]))
          FROM public.proformas p JOIN familia f ON f.id = p.id WHERE p.organization_id = p_org
        UNION SELECT pc.embarque_id FROM public.proforma_conceptos_consolidados pc
          JOIN familia f ON f.id = pc.proforma_id
          WHERE pc.organization_id = p_org AND pc.deleted_at IS NULL
        UNION SELECT cv.embarque_id FROM public.conceptos_venta cv JOIN familia f ON f.id = cv.proforma_id
          WHERE cv.organization_id = p_org AND cv.deleted_at IS NULL
      )
      SELECT COALESCE(array_agg(DISTINCT e.id ORDER BY e.id), ARRAY[]::uuid[]) INTO v_extra
      FROM anclas a JOIN public.embarques e ON e.id = a.id AND e.organization_id = p_org;
      v_targets := v_targets || v_extra;
    END IF;
  ELSIF p_tabla = 'proveedor_facturas' THEN
    SELECT COALESCE(array_agg(DISTINCT id ORDER BY id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_targets FROM (
      SELECT unnest(v_direct) AS id
      UNION SELECT cc.embarque_id FROM public.proveedor_facturas_conceptos pc
        JOIN public.conceptos_costo cc ON cc.id = pc.concepto_costo_id AND cc.organization_id = p_org
        WHERE pc.proveedor_factura_id = v_id AND pc.organization_id = p_org
      UNION SELECT s.embarque_id FROM public.seguros_embarque s
        WHERE s.proveedor_factura_id = v_id AND s.organization_id = p_org AND s.deleted_at IS NULL
      UNION SELECT d.embarque_id FROM public.embarque_facturas_entrantes d
        WHERE d.proveedor_factura_id = v_id AND d.organization_id = p_org AND d.deleted_at IS NULL
      UNION SELECT g.embarque_id FROM public.embarque_garantias_contenedor g
        WHERE g.proveedor_factura_id = v_id AND g.organization_id = p_org AND g.deleted_at IS NULL
    ) q;
  ELSE
    v_targets := v_direct;
    IF p_tabla IN ('factura_embarques', 'conceptos_factura', 'pagos_factura', 'factura_notas_credito') THEN
      SELECT to_jsonb(f) INTO v_parent FROM public.facturas f
        WHERE f.id = (p_fila->>'factura_id')::uuid AND f.organization_id = p_org;
      v_targets := v_targets || public._h14_grafo_fila_baja(p_org, 'facturas', v_parent);
    ELSIF p_tabla IN ('proveedor_facturas_conceptos', 'pagos_proveedor', 'proveedor_notas_credito',
      'seguros_embarque', 'embarque_facturas_entrantes', 'embarque_garantias_contenedor') THEN
      SELECT to_jsonb(f) INTO v_parent FROM public.proveedor_facturas f
        WHERE f.id = (p_fila->>'proveedor_factura_id')::uuid AND f.organization_id = p_org;
      v_targets := v_targets || public._h14_grafo_fila_baja(p_org, 'proveedor_facturas', v_parent);
    END IF;
    IF p_tabla IN ('conceptos_venta', 'proforma_conceptos_consolidados', 'conceptos_factura') THEN
      v_parent_id := CASE WHEN p_tabla = 'conceptos_factura' THEN (p_fila->>'proforma_id_origen')::uuid ELSE (p_fila->>'proforma_id')::uuid END;
      SELECT to_jsonb(p) INTO v_parent FROM public.proformas p WHERE p.id = v_parent_id AND p.organization_id = p_org;
      v_targets := v_targets || public._h14_grafo_fila_baja(p_org, 'proformas', v_parent);
    END IF;
    IF p_tabla = 'proveedor_facturas_conceptos' THEN
      SELECT ARRAY[cc.embarque_id] INTO v_extra FROM public.conceptos_costo cc
        WHERE cc.id = (p_fila->>'concepto_costo_id')::uuid AND cc.organization_id = p_org;
      v_targets := v_targets || COALESCE(v_extra, ARRAY[]::uuid[]);
    ELSIF p_tabla = 'conceptos_costo' THEN
      FOR v_parent IN SELECT to_jsonb(f) FROM public.proveedor_facturas f
        JOIN public.proveedor_facturas_conceptos pc ON pc.proveedor_factura_id = f.id AND pc.organization_id = p_org
        WHERE pc.concepto_costo_id = v_id AND f.organization_id = p_org
      LOOP v_targets := v_targets || public._h14_grafo_fila_baja(p_org, 'proveedor_facturas', v_parent); END LOOP;
    END IF;
  END IF;
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_targets FROM unnest(v_targets) AS u(id);
  RETURN v_targets;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_grafo_fila_baja(uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._h14_fila_bloqueante_baja(p_org uuid, p_tabla text, p_fila jsonb)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid := (p_fila->>'id')::uuid;
  v_parent jsonb;
  v_live boolean := p_fila->>'deleted_at' IS NULL;
  v_result boolean;
BEGIN
  IF p_fila IS NULL THEN RETURN false; END IF;
  CASE p_tabla
    WHEN 'facturas' THEN RETURN (v_live AND COALESCE(p_fila->>'estado', '') NOT IN ('Cancelada', 'Sustituida'))
      OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.factura_id = v_id AND p.organization_id = p_org AND p.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.factura_notas_credito n WHERE n.factura_id = v_id AND n.organization_id = p_org AND n.deleted_at IS NULL);
    WHEN 'proveedor_facturas' THEN RETURN v_live
      OR EXISTS (SELECT 1 FROM public.pagos_proveedor p WHERE p.proveedor_factura_id = v_id AND p.organization_id = p_org AND p.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.proveedor_notas_credito n WHERE n.proveedor_factura_id = v_id AND n.organization_id = p_org AND n.deleted_at IS NULL);
    WHEN 'factura_embarques' THEN RETURN COALESCE((p_fila->>'activa')::boolean, false)
      AND public._h14_documento_bloqueante_baja(p_org, 'facturas', (p_fila->>'factura_id')::uuid);
    WHEN 'conceptos_factura' THEN RETURN v_live
      AND public._h14_documento_bloqueante_baja(p_org, 'facturas', (p_fila->>'factura_id')::uuid);
    WHEN 'proveedor_facturas_conceptos' THEN RETURN public._h14_documento_bloqueante_baja(p_org, 'proveedor_facturas', (p_fila->>'proveedor_factura_id')::uuid);
    WHEN 'seguros_embarque', 'embarque_facturas_entrantes', 'embarque_garantias_contenedor' THEN RETURN v_live
      AND public._h14_documento_bloqueante_baja(p_org, 'proveedor_facturas', (p_fila->>'proveedor_factura_id')::uuid);
    WHEN 'pagos_factura', 'factura_notas_credito', 'pagos_proveedor', 'proveedor_notas_credito' THEN RETURN v_live;
    WHEN 'comisiones_devengadas' THEN RETURN COALESCE((p_fila->>'definitiva')::boolean, false);
    WHEN 'conceptos_costo' THEN RETURN EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos pc
      WHERE pc.concepto_costo_id = v_id AND pc.organization_id = p_org
        AND public._h14_documento_bloqueante_baja(p_org, 'proveedor_facturas', pc.proveedor_factura_id));
    WHEN 'conceptos_venta', 'proforma_conceptos_consolidados' THEN
      IF NOT v_live THEN RETURN false; END IF;
      SELECT to_jsonb(p) INTO v_parent FROM public.proformas p WHERE p.id = (p_fila->>'proforma_id')::uuid AND p.organization_id = p_org;
      RETURN public._h14_fila_bloqueante_baja(p_org, 'proformas', v_parent);
    WHEN 'proformas' THEN
      IF v_live AND COALESCE(p_fila->>'estado_proforma', 'pendiente') NOT IN ('cancelada', 'facturada') THEN RETURN true; END IF;
      WITH RECURSIVE filas AS MATERIALIZED (
        SELECT p.* FROM public.proformas p WHERE p.organization_id = p_org AND p.id IS DISTINCT FROM v_id
        UNION ALL SELECT (jsonb_populate_record(NULL::public.proformas, p_fila)).*
      ), ancestros(id) AS (
        SELECT v_id
        UNION
        SELECT padre.id FROM ancestros r JOIN filas fuente ON fuente.id = r.id
        JOIN filas padre ON padre.organization_id = p_org
          AND (fuente.consolidada_en = padre.id OR fuente.id = ANY(COALESCE(padre.proformas_origen, ARRAY[]::uuid[])))
      ), facturas AS (
        SELECT f.id FROM public.facturas f WHERE f.organization_id = p_org
          AND (f.proforma_id IN (SELECT id FROM ancestros)
            OR EXISTS (SELECT 1 FROM public.conceptos_factura cf WHERE cf.factura_id = f.id
              AND cf.organization_id = p_org AND cf.deleted_at IS NULL AND cf.proforma_id_origen IN (SELECT id FROM ancestros))
            OR EXISTS (SELECT 1 FROM filas p WHERE p.id IN (SELECT id FROM ancestros) AND f.id IN (p.factura_id, p.factura_secundaria_id)))
      ) SELECT EXISTS (SELECT 1 FROM facturas f WHERE public._h14_documento_bloqueante_baja(p_org, 'facturas', f.id)) INTO v_result;
      RETURN v_result;
    ELSE RETURN false;
  END CASE;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_fila_bloqueante_baja(uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- One SQL snapshot for preview/counts/examples. The VOLATILE call is issued
-- after the mutex/row lock by the final validators, so it does not inherit the
-- initiating DML statement's pre-wait snapshot.
CREATE OR REPLACE FUNCTION public._h14_dependencias_baja_embarque(p_embarque_id uuid, p_org uuid, p_ejemplos boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_incoherente boolean;
BEGIN
  WITH emb AS MATERIALIZED (
    SELECT id, expediente, estado, cerrado_at FROM public.embarques
    WHERE id = p_embarque_id AND organization_id = p_org
  ), proforma_ids AS MATERIALIZED (
    SELECT public._h14_proformas_baja_embarque(p_embarque_id, p_org) AS ids
  ), factura_ids AS MATERIALIZED (
    SELECT public._h14_facturas_baja_embarque(p_embarque_id, p_org, p.ids) AS ids FROM proforma_ids p
  ), cxp_ids AS MATERIALIZED (
    SELECT public._h14_cxp_baja_embarque(p_embarque_id, p_org) AS ids
  ), motivos AS (
    SELECT
      (SELECT count(*) FROM public.facturas f, factura_ids ids
        WHERE f.id = ANY(ids.ids) AND f.organization_id = p_org AND f.deleted_at IS NULL
          AND f.estado NOT IN ('Cancelada', 'Sustituida')) AS facturas,
      (SELECT count(*) FROM public.proveedor_facturas f, cxp_ids ids
        WHERE f.id = ANY(ids.ids) AND f.organization_id = p_org AND f.deleted_at IS NULL) AS cxp,
      (SELECT count(*) FROM public.pagos_factura p, factura_ids ids
        WHERE (p.factura_id = ANY(ids.ids) OR p.embarque_id = p_embarque_id)
          AND p.organization_id = p_org AND p.deleted_at IS NULL) AS pagos_cxc,
      (SELECT count(*) FROM public.pagos_proveedor p, cxp_ids ids
        WHERE p.proveedor_factura_id = ANY(ids.ids) AND p.organization_id = p_org AND p.deleted_at IS NULL) AS pagos_cxp,
      (SELECT count(*) FROM public.factura_notas_credito n, factura_ids ids
        WHERE n.factura_id = ANY(ids.ids) AND n.organization_id = p_org AND n.deleted_at IS NULL) AS notas_credito_cxc,
      (SELECT count(*) FROM public.proveedor_notas_credito n, cxp_ids ids
        WHERE n.proveedor_factura_id = ANY(ids.ids) AND n.organization_id = p_org AND n.deleted_at IS NULL) AS notas_credito_cxp,
      (SELECT count(*) FROM public.comisiones_devengadas c
        WHERE c.embarque_id = p_embarque_id AND c.organization_id = p_org AND c.definitiva IS TRUE) AS comisiones_definitivas,
      (SELECT count(*) FROM public.proformas p, proforma_ids ids
        WHERE p.id = ANY(ids.ids) AND p.organization_id = p_org AND p.deleted_at IS NULL
          AND COALESCE(p.estado_proforma, 'pendiente') NOT IN ('cancelada', 'facturada')) AS proformas
  ), incoherencia AS (
    -- Simple-ID historical FKs are not composite tenant constraints. Do not
    -- turn an invalid active reference into "no dependency" by filtering it
    -- out of the tenant-safe result. Only this boolean is consumed; no foreign
    -- ID, amount, folio or count becomes part of the public payload.
    SELECT
      EXISTS (SELECT 1 FROM public.facturas f WHERE f.embarque_id = p_embarque_id
        AND f.organization_id IS DISTINCT FROM p_org
        AND public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id))
      OR EXISTS (SELECT 1 FROM public.proformas p WHERE
        (p.embarque_id = p_embarque_id OR p_embarque_id = ANY(COALESCE(p.embarques_ids, ARRAY[]::uuid[])))
        AND p.organization_id IS DISTINCT FROM p_org
        AND (public._h14_fila_bloqueante_baja(p.organization_id, 'proformas', to_jsonb(p))
          OR EXISTS (SELECT 1 FROM public.facturas f WHERE
            (f.proforma_id = p.id OR f.id IN (p.factura_id, p.factura_secundaria_id)
              OR EXISTS (SELECT 1 FROM public.conceptos_factura cf WHERE cf.factura_id = f.id
                AND cf.proforma_id_origen = p.id AND cf.deleted_at IS NULL))
            AND public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id))))
      OR EXISTS (SELECT 1 FROM public.proformas padre, proforma_ids ids
        WHERE padre.organization_id IS DISTINCT FROM p_org
          AND (COALESCE(padre.proformas_origen, ARRAY[]::uuid[]) && ids.ids
            OR padre.id IN (SELECT p.consolidada_en FROM public.proformas p WHERE p.id = ANY(ids.ids)))
          AND public._h14_fila_bloqueante_baja(padre.organization_id, 'proformas', to_jsonb(padre)))
      OR EXISTS (SELECT 1 FROM public.facturas f, proforma_ids ids
        WHERE f.organization_id IS DISTINCT FROM p_org
          AND (f.proforma_id = ANY(ids.ids)
            OR EXISTS (SELECT 1 FROM public.proformas p WHERE p.id = ANY(ids.ids)
              AND f.id IN (p.factura_id, p.factura_secundaria_id))
            OR EXISTS (SELECT 1 FROM public.conceptos_factura cf WHERE cf.factura_id = f.id
              AND cf.deleted_at IS NULL AND cf.proforma_id_origen = ANY(ids.ids)))
          AND public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id))
      OR EXISTS (SELECT 1 FROM public.comisiones_devengadas c WHERE c.embarque_id = p_embarque_id
        AND c.organization_id IS DISTINCT FROM p_org AND c.definitiva IS TRUE)
      OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.embarque_id = p_embarque_id
        AND p.organization_id IS DISTINCT FROM p_org AND p.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.pagos_factura p JOIN public.facturas f ON f.id = p.factura_id, factura_ids ids
        WHERE (f.id = ANY(ids.ids) OR f.embarque_id = p_embarque_id) AND p.deleted_at IS NULL
          AND (p.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org))
      OR EXISTS (SELECT 1 FROM public.factura_notas_credito n JOIN public.facturas f ON f.id = n.factura_id, factura_ids ids
        WHERE (f.id = ANY(ids.ids) OR f.embarque_id = p_embarque_id) AND n.deleted_at IS NULL
          AND (n.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org))
      OR EXISTS (SELECT 1 FROM public.pagos_proveedor p JOIN public.proveedor_facturas f ON f.id = p.proveedor_factura_id, cxp_ids ids
        WHERE (f.id = ANY(ids.ids) OR f.embarque_id = p_embarque_id) AND p.deleted_at IS NULL
          AND (p.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org))
      OR EXISTS (SELECT 1 FROM public.proveedor_notas_credito n JOIN public.proveedor_facturas f ON f.id = n.proveedor_factura_id, cxp_ids ids
        WHERE (f.id = ANY(ids.ids) OR f.embarque_id = p_embarque_id) AND n.deleted_at IS NULL
          AND (n.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org))
      OR EXISTS (SELECT 1 FROM public.factura_embarques fe JOIN public.facturas f ON f.id = fe.factura_id
        WHERE fe.embarque_id = p_embarque_id AND fe.activa IS TRUE
          AND (fe.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org)
          AND (public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id)
            OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.factura_id = f.id AND p.deleted_at IS NULL)
            OR EXISTS (SELECT 1 FROM public.factura_notas_credito n WHERE n.factura_id = f.id AND n.deleted_at IS NULL)))
      OR EXISTS (SELECT 1 FROM public.conceptos_factura cf JOIN public.facturas f ON f.id = cf.factura_id, proforma_ids ids
        WHERE (cf.embarque_id = p_embarque_id OR cf.proforma_id_origen = ANY(ids.ids)) AND cf.deleted_at IS NULL
          AND (cf.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org)
          AND (public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id)
            OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.factura_id = f.id AND p.deleted_at IS NULL)
            OR EXISTS (SELECT 1 FROM public.factura_notas_credito n WHERE n.factura_id = f.id AND n.deleted_at IS NULL)))
      OR EXISTS (SELECT 1 FROM public.proforma_conceptos_consolidados pc JOIN public.proformas p ON p.id = pc.proforma_id
        WHERE pc.embarque_id = p_embarque_id AND pc.deleted_at IS NULL
          AND (pc.organization_id IS DISTINCT FROM p_org OR p.organization_id IS DISTINCT FROM p_org)
          AND public._h14_fila_bloqueante_baja(p.organization_id, 'proformas', to_jsonb(p)))
      OR EXISTS (SELECT 1 FROM public.conceptos_venta cv JOIN public.proformas p ON p.id = cv.proforma_id
        WHERE cv.embarque_id = p_embarque_id AND cv.deleted_at IS NULL
          AND (cv.organization_id IS DISTINCT FROM p_org OR p.organization_id IS DISTINCT FROM p_org)
          AND public._h14_fila_bloqueante_baja(p.organization_id, 'proformas', to_jsonb(p)))
      OR EXISTS (SELECT 1 FROM public.embarque_facturas_entrantes e JOIN public.proveedor_facturas f ON f.id = e.proveedor_factura_id
        WHERE e.embarque_id = p_embarque_id AND e.deleted_at IS NULL
          AND (e.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org)
          AND public._h14_documento_bloqueante_baja(f.organization_id, 'proveedor_facturas', f.id))
      OR EXISTS (SELECT 1 FROM public.embarque_garantias_contenedor g JOIN public.proveedor_facturas f ON f.id = g.proveedor_factura_id
        WHERE g.embarque_id = p_embarque_id AND g.deleted_at IS NULL
          AND (g.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org)
          AND public._h14_documento_bloqueante_baja(f.organization_id, 'proveedor_facturas', f.id)) AS presente
  )
  SELECT jsonb_build_object(
    'version', 1, 'embarque_id', p_embarque_id,
    'expediente', COALESCE(NULLIF(btrim(COALESCE(e.expediente, '')), ''), 'Borrador ' || right(p_embarque_id::text, 6)),
    'facturas', m.facturas, 'cxp', m.cxp, 'pagos_cxc', m.pagos_cxc, 'pagos_cxp', m.pagos_cxp,
    'notas_credito_cxc', m.notas_credito_cxc, 'notas_credito_cxp', m.notas_credito_cxp,
    'comisiones_definitivas', m.comisiones_definitivas, 'proformas', m.proformas,
    'cerrado', e.estado = 'Cerrado' OR e.cerrado_at IS NOT NULL,
    'bloqueado', m.facturas > 0 OR m.cxp > 0 OR m.pagos_cxc > 0 OR m.pagos_cxp > 0
      OR m.notas_credito_cxc > 0 OR m.notas_credito_cxp > 0 OR m.comisiones_definitivas > 0
      OR m.proformas > 0 OR e.estado = 'Cerrado' OR e.cerrado_at IS NOT NULL,
    'ejemplos_cxc', CASE WHEN p_ejemplos IS TRUE THEN (
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.folio NULLS LAST, x.id), '[]'::jsonb)
      FROM (SELECT f.id, f.numero AS folio, f.estado::text AS estado
        FROM public.facturas f, factura_ids ids
        WHERE f.id = ANY(ids.ids) AND f.organization_id = p_org AND f.deleted_at IS NULL
          AND f.estado NOT IN ('Cancelada', 'Sustituida')
        ORDER BY f.numero NULLS LAST, f.id LIMIT 20) x) ELSE '[]'::jsonb END,
    'ejemplos_cxp', CASE WHEN p_ejemplos IS TRUE THEN (
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.folio NULLS LAST, x.id), '[]'::jsonb)
      FROM (SELECT f.id, f.folio_proveedor AS folio, f.estado::text AS estado
        FROM public.proveedor_facturas f, cxp_ids ids
        WHERE f.id = ANY(ids.ids) AND f.organization_id = p_org AND f.deleted_at IS NULL
        ORDER BY f.folio_proveedor NULLS LAST, f.id LIMIT 20) x) ELSE '[]'::jsonb END)
  , i.presente INTO v_result, v_incoherente
  FROM emb e CROSS JOIN motivos m CROSS JOIN incoherencia i;
  IF v_incoherente IS TRUE THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_dependencias_baja_embarque(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- All relationship writers share the org anchor, including an empty graph.
-- No session flag or trigger-depth bypass can opt out of this invariant.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_guard_escritor_baja()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END;
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END;
  v_org uuid;
  v_old_org uuid := (v_old->>'organization_id')::uuid;
  v_new_org uuid := (v_new->>'organization_id')::uuid;
  v_keys text[];
  v_old_projection jsonb;
  v_new_projection jsonb;
  v_old_targets uuid[];
  v_new_targets uuid[];
  v_targets uuid[];
  v_validar uuid[];
  v_old_activa boolean;
  v_new_activa boolean;
  v_restaurar boolean;
  v_reactivar boolean := false;
  v_target uuid;
  v_deleted timestamptz;
BEGIN
  v_keys := CASE TG_TABLE_NAME
    WHEN 'facturas' THEN ARRAY['id','organization_id','embarque_id','proforma_id','deleted_at','estado']
    WHEN 'proveedor_facturas' THEN ARRAY['id','organization_id','embarque_id','deleted_at','estado']
    WHEN 'factura_embarques' THEN ARRAY['organization_id','factura_id','embarque_id','activa']
    WHEN 'conceptos_factura' THEN ARRAY['id','organization_id','factura_id','embarque_id','proforma_id_origen','deleted_at']
    WHEN 'proformas' THEN ARRAY['id','organization_id','embarque_id','embarques_ids','proformas_origen','consolidada_en','factura_id','factura_secundaria_id','deleted_at','estado_proforma']
    WHEN 'proforma_conceptos_consolidados' THEN ARRAY['id','organization_id','proforma_id','embarque_id','deleted_at']
    WHEN 'conceptos_venta' THEN ARRAY['id','organization_id','proforma_id','embarque_id','deleted_at']
    WHEN 'conceptos_costo' THEN ARRAY['id','organization_id','embarque_id','deleted_at']
    WHEN 'proveedor_facturas_conceptos' THEN ARRAY['id','organization_id','proveedor_factura_id','concepto_costo_id']
    WHEN 'seguros_embarque' THEN ARRAY['id','organization_id','embarque_id','proveedor_factura_id','deleted_at']
    WHEN 'embarque_facturas_entrantes' THEN ARRAY['id','organization_id','embarque_id','proveedor_factura_id','deleted_at']
    WHEN 'embarque_garantias_contenedor' THEN ARRAY['id','organization_id','embarque_id','proveedor_factura_id','deleted_at']
    WHEN 'pagos_factura' THEN ARRAY['id','organization_id','factura_id','embarque_id','deleted_at']
    WHEN 'factura_notas_credito' THEN ARRAY['id','organization_id','factura_id','deleted_at']
    WHEN 'pagos_proveedor' THEN ARRAY['id','organization_id','proveedor_factura_id','deleted_at']
    WHEN 'proveedor_notas_credito' THEN ARRAY['id','organization_id','proveedor_factura_id','deleted_at']
    WHEN 'comisiones_devengadas' THEN ARRAY['id','organization_id','embarque_id','factura_id','pago_factura_id','definitiva']
    ELSE NULL END;
  IF v_keys IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(k, v_old->k), jsonb_object_agg(k, v_new->k)
      INTO v_old_projection, v_new_projection FROM unnest(v_keys) AS u(k);
    IF v_old_projection IS NOT DISTINCT FROM v_new_projection THEN RETURN NEW; END IF;
  END IF;
  -- A document cannot migrate across tenants through this relationship guard.
  IF TG_OP = 'UPDATE' AND v_old_org IS DISTINCT FROM v_new_org THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  v_org := COALESCE(v_new_org, v_old_org);
  -- Do admission and composite-FK checks before any advisory/parent lock.
  PERFORM public._h14_validar_fila_org_baja(v_org, TG_TABLE_NAME, v_old);
  PERFORM public._h14_validar_fila_org_baja(v_org, TG_TABLE_NAME, v_new);
  PERFORM public._h14_mutex_baja_embarque(v_org, false);
  -- Resolve again after the mutex: a source could have moved while admission
  -- ran. All relevant writers now share this anchor, even with no targets.
  PERFORM public._h14_validar_fila_org_baja(v_org, TG_TABLE_NAME, v_old);
  PERFORM public._h14_validar_fila_org_baja(v_org, TG_TABLE_NAME, v_new);
  v_old_targets := public._h14_grafo_fila_baja(v_org, TG_TABLE_NAME, v_old);
  v_new_targets := public._h14_grafo_fila_baja(v_org, TG_TABLE_NAME, v_new);
  v_old_activa := public._h14_fila_bloqueante_baja(v_org, TG_TABLE_NAME, v_old);
  v_new_activa := public._h14_fila_bloqueante_baja(v_org, TG_TABLE_NAME, v_new);
  v_restaurar := TG_OP = 'UPDATE' AND v_old->>'deleted_at' IS NOT NULL AND v_new->>'deleted_at' IS NULL;
  IF TG_OP = 'UPDATE' THEN
    v_reactivar := CASE TG_TABLE_NAME
      WHEN 'facturas' THEN v_old->>'estado' IN ('Cancelada', 'Sustituida')
        AND v_new->>'estado' NOT IN ('Cancelada', 'Sustituida')
      WHEN 'proformas' THEN v_old->>'estado_proforma' IN ('cancelada', 'facturada')
        AND COALESCE(v_new->>'estado_proforma', 'pendiente') NOT IN ('cancelada', 'facturada')
      ELSE false END;
  END IF;
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id), ARRAY[]::uuid[]) INTO v_targets
    FROM unnest(v_old_targets || v_new_targets) AS u(id) WHERE id IS NOT NULL;
  BEGIN
    PERFORM 1 FROM public.embarques e WHERE e.organization_id = v_org AND e.id = ANY(v_targets)
      ORDER BY e.id FOR NO KEY UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: los vínculos financieros se están actualizando; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END;
  IF (SELECT count(*) FROM public.embarques e WHERE e.organization_id = v_org AND e.id = ANY(v_targets))
     IS DISTINCT FROM cardinality(v_targets)::bigint THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  IF TG_OP <> 'DELETE' AND v_new_activa IS TRUE THEN
    IF TG_OP = 'INSERT' OR v_old_activa IS NOT TRUE OR v_restaurar IS TRUE OR v_reactivar IS TRUE THEN
      v_validar := v_new_targets;
    ELSE
      SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO v_validar
        FROM unnest(v_new_targets) AS u(id) WHERE NOT (id = ANY(v_old_targets));
    END IF;
    FOREACH v_target IN ARRAY v_validar LOOP
      SELECT e.deleted_at INTO v_deleted FROM public.embarques e
        WHERE e.id = v_target AND e.organization_id = v_org;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
      END IF;
      IF v_deleted IS NOT NULL THEN
        RAISE EXCEPTION 'LC_EMBARQUE_ELIMINADO: no se pueden crear o activar vínculos financieros con un embarque eliminado'
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_guard_escritor_baja() FROM PUBLIC, anon, authenticated, service_role;

-- Direct table writes must not bypass the RPC predicate. This trigger changes
-- no children, quotes or audit rows: those existing effects remain in the RPC.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_guard_baja_embarque()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_motivos jsonb;
  v_sql_role text := COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text);
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  -- A trusted SQL server role already has table authority. SET ROLE
  -- authenticated in an owner session remains authenticated here.
  IF v_sql_role IN ('postgres', 'service_role') THEN
    v_org := OLD.organization_id;
  ELSE
    v_org := public._h14_assert_actor_baja_embarque(OLD.id);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: la baja requiere una organización estable; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END IF;
  -- The initiating table statement already owns the row lock. Never wait for
  -- the org mutex in the reverse order of the deletion RPC.
  PERFORM public._h14_mutex_baja_embarque(v_org, false);
  IF v_sql_role NOT IN ('postgres', 'service_role') THEN
    PERFORM public._h14_assert_actor_baja_embarque(OLD.id);
  END IF;
  v_motivos := public._h14_dependencias_baja_embarque(OLD.id, v_org,
    v_org = public.current_user_org_id());
  IF v_motivos IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque' USING ERRCODE = '42501';
  END IF;
  IF (v_motivos->>'bloqueado')::boolean IS TRUE THEN
    RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO: el embarque % tiene dependencias fiscales o está cerrado', v_motivos->>'expediente'
      USING HINT = v_motivos::text, ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_guard_baja_embarque() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.diagnosticar_baja_embarque(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_activa uuid := public.current_user_org_id();
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  -- The existing global Super Admin mutation authority is not a new read grant.
  -- Gate before lookup: missing, foreign and invisible IDs have the same error.
  IF (v_uid IS NOT NULL AND v_activa IS NOT NULL
    AND (public.has_role(v_uid, 'super_admin'::public.app_role)
      OR public.has_role(v_uid, 'admin'::public.app_role)
      OR public.has_role(v_uid, 'operador'::public.app_role))
    AND public.has_any_role(v_uid, ARRAY['viewer'::public.app_role])
    AND (NOT public.has_role(v_uid, 'super_admin'::public.app_role)
      OR public.rls_tenant_scope_ok(v_activa))) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque en la organización activa' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id INTO v_org FROM public.embarques
    WHERE id = p_embarque_id AND organization_id = v_activa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque en la organización activa' USING ERRCODE = '42501';
  END IF;
  PERFORM public._h14_assert_actor_baja_embarque(p_embarque_id);
  v_result := public._h14_dependencias_baja_embarque(p_embarque_id, v_org, true);
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque en la organización activa' USING ERRCODE = '42501';
  END IF;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.diagnosticar_baja_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diagnosticar_baja_embarque(uuid) TO authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.eliminar_embarque_completo(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_uemail text;
  v_now timestamptz := now();
  v_id uuid;
  v_expediente text;
  v_label text;
  v_org uuid;
  v_org_mutex uuid;
  v_cotizacion_id uuid;
  v_estado text;
  v_cerrado_at timestamptz;
  v_remaining integer;
  v_motivos jsonb;
BEGIN
  -- Authorize before looking at lock state. Preserve existing legacy-role and
  -- global Super Admin authority, rejecting a nullable guard explicitly.
  v_org_mutex := public._h14_assert_actor_baja_embarque(p_embarque_id);
  PERFORM public._h14_mutex_baja_embarque(v_org_mutex, true);
  SELECT id, expediente, organization_id, cotizacion_id, estado::text, cerrado_at
    INTO v_id, v_expediente, v_org, v_cotizacion_id, v_estado, v_cerrado_at
    FROM public.embarques WHERE id = p_embarque_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  IF v_org IS DISTINCT FROM v_org_mutex THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: el embarque cambió de organización; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END IF;
  -- A waiter must recheck roles and use a new RC snapshot after acquiring locks.
  PERFORM public._h14_assert_actor_baja_embarque(p_embarque_id);
  v_motivos := public._h14_dependencias_baja_embarque(p_embarque_id, v_org,
    v_org = public.current_user_org_id());
  IF v_motivos IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque' USING ERRCODE = '42501';
  END IF;
  v_label := v_motivos->>'expediente';
  IF (v_motivos->>'bloqueado')::boolean IS TRUE THEN
    RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO: el embarque % tiene dependencias fiscales o está cerrado', v_label
      USING HINT = v_motivos::text, ERRCODE = '23514';
  END IF;

  UPDATE public.conceptos_venta        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.conceptos_costo        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.documentos_embarque    SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.notas_embarque         SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.eventos_embarque       SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.embarque_contenedores  SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.seguros_embarque       SET deleted_at = v_now                    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.embarques
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE id = p_embarque_id AND deleted_at IS NULL;

  IF v_cotizacion_id IS NOT NULL THEN
    SELECT count(*) INTO v_remaining
    FROM public.embarques
    WHERE cotizacion_id = v_cotizacion_id AND deleted_at IS NULL;

    IF v_remaining = 0 THEN
      UPDATE public.cotizaciones
         SET estado = 'Aceptada',
             embarque_id = NULL,
             updated_at = now()
       WHERE id = v_cotizacion_id
         AND (estado <> 'Aceptada' OR embarque_id IS NOT NULL);

      UPDATE public.embarques
         SET cotizacion_id = NULL
       WHERE id = p_embarque_id
         AND cotizacion_id IS NOT NULL;
    END IF;
  END IF;

  BEGIN
    SELECT email INTO v_uemail FROM auth.users WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_uemail := NULL;
  END;

  IF v_uid IS NOT NULL THEN
    INSERT INTO public.bitacora_actividad
      (usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id)
    VALUES
      (v_uid, v_uemail, 'eliminar_embarque', 'embarques', p_embarque_id, v_label,
       jsonb_build_object(
         'cotizacion_revertida', (v_cotizacion_id IS NOT NULL AND v_remaining = 0),
         'estado_previo', v_estado
       ),
       v_org);
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.eliminar_embarque_completo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_embarque_completo(uuid) TO authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.purgar_embarque_cascade(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_org_mutex uuid;
  v_deleted_at timestamptz;
  v_motivos jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT organization_id, deleted_at INTO v_org, v_deleted_at FROM public.embarques
    WHERE id = p_embarque_id AND deleted_at IS NOT NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Sólo embarques en papelera pueden purgarse'; END IF;
  IF (public.has_role(v_uid, 'super_admin'::public.app_role)
    OR (v_org = public.current_user_org_id() AND public.has_role(v_uid, 'admin'::public.app_role))) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Sólo admin / super_admin pueden purgar';
  END IF;
  v_org_mutex := v_org;
  PERFORM public._h14_mutex_baja_embarque(v_org_mutex, true);
  SELECT organization_id, deleted_at INTO v_org, v_deleted_at FROM public.embarques
    WHERE id = p_embarque_id AND deleted_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sólo embarques en papelera pueden purgarse'; END IF;
  IF v_org IS DISTINCT FROM v_org_mutex THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: el embarque cambió de organización; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END IF;
  IF (public.has_role(v_uid, 'super_admin'::public.app_role)
    OR (v_org = public.current_user_org_id() AND public.has_role(v_uid, 'admin'::public.app_role))) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Sólo admin / super_admin pueden purgar';
  END IF;
  -- Check BEFORE purging any source anchors, otherwise the final parent DELETE
  -- could observe a graph already stripped by this same transaction.
  v_motivos := public._h14_dependencias_baja_embarque(p_embarque_id, v_org,
    v_org = public.current_user_org_id());
  IF v_motivos IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque' USING ERRCODE = '42501';
  END IF;
  IF (v_motivos->>'bloqueado')::boolean IS TRUE THEN
    RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO: el embarque % tiene dependencias fiscales o está cerrado', v_motivos->>'expediente'
      USING HINT = v_motivos::text, ERRCODE = '23514';
  END IF;
  -- Borrar físicamente hijos del mismo lote
  DELETE FROM public.conceptos_venta       WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.conceptos_costo       WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.documentos_embarque   WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.notas_embarque        WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.eventos_embarque      WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.embarque_contenedores WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.facturas              WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.seguros_embarque      WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;

  DELETE FROM public.embarques WHERE id = p_embarque_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.purgar_embarque_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purgar_embarque_cascade(uuid) TO authenticated, service_role, postgres;

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.facturas;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.facturas FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.factura_embarques;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.factura_embarques FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.conceptos_factura;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.conceptos_factura FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.proformas;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.proformas FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.proforma_conceptos_consolidados;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.proforma_conceptos_consolidados FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.conceptos_venta;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.conceptos_venta FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.proveedor_facturas;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.proveedor_facturas FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.proveedor_facturas_conceptos;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.proveedor_facturas_conceptos FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.conceptos_costo;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.conceptos_costo FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.seguros_embarque;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.seguros_embarque FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.pagos_factura;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.pagos_factura FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.factura_notas_credito;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.factura_notas_credito FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.pagos_proveedor;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.pagos_proveedor FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.proveedor_notas_credito;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.proveedor_notas_credito FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.comisiones_devengadas;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.comisiones_devengadas FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.embarque_facturas_entrantes;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.embarque_facturas_entrantes FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_escritura ON public.embarque_garantias_contenedor;
CREATE TRIGGER a00_h14_guard_escritura BEFORE INSERT OR UPDATE OR DELETE ON public.embarque_garantias_contenedor FOR EACH ROW EXECUTE FUNCTION public._h14_guard_escritor_baja();

DROP TRIGGER IF EXISTS a00_h14_guard_baja ON public.embarques;
CREATE TRIGGER a00_h14_guard_baja BEFORE UPDATE OR DELETE ON public.embarques FOR EACH ROW EXECUTE FUNCTION public._h14_guard_baja_embarque();

DO $postconditions$
DECLARE r record; p pg_catalog.pg_proc%ROWTYPE;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public._h14_proformas_baja_embarque(uuid, uuid)',ARRAY['c482aed858f0867f2cc93493e6926183']::text[],false,'s','uuid[]',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_facturas_baja_embarque(uuid, uuid, uuid[])',ARRAY['db78cf6b6d6e779cb32c2dd75c8b256f']::text[],false,'s','uuid[]',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_cxp_baja_embarque(uuid, uuid)',ARRAY['b85dd06656791db267e3552c40bd7fce']::text[],false,'s','uuid[]',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_assert_actor_baja_embarque(uuid)',ARRAY['1da5a4e081d57adef053a576f4c536a6']::text[],false,'v','uuid',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_embarque_visible_actor_baja(uuid, uuid)',ARRAY['40b4d51e1dc5b0a06fcb26aedb0632ff']::text[],true,'s','boolean',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_validar_fila_org_baja(uuid, text, jsonb)',ARRAY['8f7da44666159764023b6e04f00f7c62']::text[],true,'v','void',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_validar_actor_org_baja(uuid)',ARRAY['a92da91f961255b75b7f0f47106e61b7']::text[],true,'v','void',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_mutex_baja_embarque(uuid, boolean)',ARRAY['f34e87ceed50aa6e92539ca37fa98684']::text[],true,'v','void',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_documento_bloqueante_baja(uuid, text, uuid)',ARRAY['167f84f94eae112f04468b4b2305b1af']::text[],false,'s','boolean',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_grafo_fila_baja(uuid, text, jsonb)',ARRAY['0c02adc787940c3af8a4418484fb4c2c']::text[],false,'s','uuid[]',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_fila_bloqueante_baja(uuid, text, jsonb)',ARRAY['b90d268966cb5a13497b45c470546009']::text[],false,'s','boolean',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_dependencias_baja_embarque(uuid, uuid, boolean)',ARRAY['2c3f605ce82bba1419c44c5650746f90']::text[],false,'v','jsonb',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_guard_escritor_baja()',ARRAY['1890e8cb452c5dad98a23b99b0c4300e']::text[],true,'v','trigger',ARRAY['postgres=X/postgres']::text[]),
    ('public._h14_guard_baja_embarque()',ARRAY['9cdcb03d59701b5eb691b420e8e1cf2d']::text[],true,'v','trigger',ARRAY['postgres=X/postgres']::text[]),
    ('public.diagnosticar_baja_embarque(uuid)',ARRAY['e47d56141992d3afb0d3c81f50191fda']::text[],true,'v','jsonb',ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]),
    ('public.eliminar_embarque_completo(uuid)',ARRAY['f603355293c0d33598d12fdc44cb9b26']::text[],true,'v','void',ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[]),
    ('public.purgar_embarque_cascade(uuid)',ARRAY['d03f859c24b0a83097c095730823bde5']::text[],true,'v','void',ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[])
  ) v(signature, body_hashes, definer, volatility, return_type, acl) LOOP
    SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure(r.signature);
    IF NOT FOUND OR NOT (md5(p.prosrc) = ANY(r.body_hashes)) OR p.proowner <> 'postgres'::regrole
      OR p.prosecdef IS DISTINCT FROM r.definer OR p.provolatile::text <> r.volatility
      OR p.prorettype <> pg_catalog.to_regtype(r.return_type)
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
      OR (SELECT array_agg(a::text ORDER BY a::text) FROM unnest(p.proacl) a) IS DISTINCT FROM r.acl THEN
      RAISE EXCEPTION 'H14_POSTFLIGHT: function metadata differs for %', r.signature;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_temp.h14_baja_metadata_before b
    LEFT JOIN pg_catalog.pg_proc _meta_proc ON _meta_proc.oid = b.oid
    WHERE _meta_proc.oid IS NULL OR (to_jsonb(_meta_proc) - 'prosrc') IS DISTINCT FROM b.metadata) THEN
    RAISE EXCEPTION 'H14_POSTFLIGHT: an existing mutation changed metadata or ACL';
  END IF;
END;
$postconditions$;
COMMIT;
